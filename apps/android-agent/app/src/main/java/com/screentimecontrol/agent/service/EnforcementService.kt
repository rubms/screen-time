package com.screentimecontrol.agent.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.screentimecontrol.agent.AgentState
import com.screentimecontrol.agent.R
import com.screentimecontrol.agent.ScreenTimeApplication
import com.screentimecontrol.agent.data.LocalStateStore
import com.screentimecontrol.agent.data.prefs.AgentPrefs
import com.screentimecontrol.agent.enforcement.WarningController
import com.screentimecontrol.agent.pairing.PairingActivity
import com.screentimecontrol.agent.rules.Decision
import com.screentimecontrol.agent.rules.decide
import com.screentimecontrol.agent.rules.resolveActivity
import com.screentimecontrol.agent.sync.FirestoreSync
import com.screentimecontrol.agent.util.ClockMonitor
import com.screentimecontrol.agent.watchdog.AccessibilityWatchdog
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class EnforcementService : LifecycleService() {
    private lateinit var prefs: AgentPrefs
    private lateinit var store: LocalStateStore
    private lateinit var firestore: FirestoreSync
    private lateinit var warningController: WarningController
    private lateinit var watchdog: AccessibilityWatchdog
    private val clockMonitor = ClockMonitor()

    private var tickerJob: Job? = null
    private var lastTickElapsed = SystemClock.elapsedRealtime()
    private var focusTargetId: String? = null
    private var storedLocalDate: String? = null

    override fun onCreate() {
        super.onCreate()
        prefs = AgentPrefs(this)
        store = LocalStateStore(this)
        firestore = FirestoreSync(this, prefs, store)
        warningController = WarningController(this)
        watchdog = AccessibilityWatchdog(this) { disabled ->
            if (disabled) {
                lifecycleScope.launch {
                    store.enqueueEvent(
                        "tamper-attempt",
                        mapOf("tamperKind" to "accessibility-disabled"),
                    )
                }
                com.screentimecontrol.agent.enforcement.LockoutActivity.showLockout(
                    this,
                    getString(R.string.lockout_accessibility),
                )
            }
        }
        watchdog.start()
        if (prefs.paired) {
            firestore.startListeners()
        }
        startForegroundWithNotification("Starting…")
        lifecycleScope.launch {
            store.enqueueEvent("agent-start", agentMeta())
        }
        startTicker()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        return START_STICKY
    }

    override fun onDestroy() {
        tickerJob?.cancel()
        watchdog.stop()
        firestore.stopListeners()
        lifecycleScope.launch {
            store.enqueueEvent("agent-stop", agentMeta())
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent): IBinder? = super.onBind(intent)

    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = lifecycleScope.launch {
            while (isActive) {
                tick()
                delay(1000)
            }
        }
    }

    private suspend fun tick() {
        val localDate = LocalDate.now().toString()
        AgentState.resetDailyIfNeeded(localDate, storedLocalDate)
        storedLocalDate = localDate

        if (clockMonitor.checkDrift()) {
            store.enqueueEvent("tamper-attempt", mapOf("tamperKind" to "clock-tamper-suspected"))
        }

        val activity = AgentState.currentActivity.get()
        val rules = store.loadRules()
        val usage = store.usageSnapshot(localDate)
        val unlocks = store.loadTempUnlocks()
        val nowLocal = LocalDateTime.now()
        val decision = decide(activity, rules, usage, nowLocal, unlocks)
        val resolved = resolveActivity(activity, rules)

        val elapsedDelta = (SystemClock.elapsedRealtime() - lastTickElapsed) / 1000.0 / 60.0
        lastTickElapsed = SystemClock.elapsedRealtime()
        if (resolved.category.name == "LIMITED" && elapsedDelta > 0) {
            store.addUsageMinutes(resolved.targetId, localDate, elapsedDelta)
        }

        val kind = decisionKind(decision)
        AgentState.lastDecisionKind.set(kind)
        AgentState.currentCategory.set(resolved.category.name)
        val remaining = when (decision) {
            is Decision.LimitedOk -> decision.remainingMinutes
            is Decision.Warn -> decision.remainingMinutes
            else -> null
        }
        AgentState.remainingMinutesDisplay.set(remaining)
        updateNotification(remaining, resolved.displayName)

        val grace = resolved.target?.gracePeriodSeconds ?: rules.defaults.gracePeriodSeconds
        warningController.onDecision(decision, resolved.targetId, resolved.displayName, grace)
        warningController.tickEnforcement(decision, resolved.targetId, resolved.displayName)

        if (focusTargetId != resolved.targetId) {
            focusTargetId = resolved.targetId
            store.enqueueEvent(
                "focus-start",
                focusPayload(resolved, activity),
            )
        }
    }

    private fun decisionKind(decision: Decision): String = when (decision) {
        Decision.Allowed -> "ALLOWED"
        Decision.Blocked -> "BLOCKED"
        Decision.OutsideSchedule -> "OUTSIDE_SCHEDULE"
        is Decision.LimitedOk -> "LIMITED_OK"
        is Decision.Warn -> "WARN"
        is Decision.OutOfTime -> "OUT_OF_TIME"
    }

    private fun agentMeta(): Map<String, Any?> = mapOf(
        "childId" to prefs.childId,
        "deviceId" to prefs.deviceId,
        "platform" to "android",
    )

    private fun focusPayload(
        resolved: com.screentimecontrol.agent.rules.ResolvedTarget,
        activity: com.screentimecontrol.agent.rules.Activity,
    ): Map<String, Any?> = mapOf(
        "targetId" to resolved.targetId,
        "category" to resolved.category.name,
        "app" to mapOf(
            "platformId" to activity.app,
            "displayName" to resolved.displayName,
            "id" to activity.app,
        ),
        "url" to activity.url,
    )

    private fun startForegroundWithNotification(text: String) {
        val notification = buildNotification(text)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(remainingMinutes: Double?, label: String) {
        val text = when {
            remainingMinutes == null || remainingMinutes.isInfinite() ->
                "Screen Time: $label"
            else -> {
                val mins = remainingMinutes.toInt().coerceAtLeast(0)
                val h = mins / 60
                val m = mins % 60
                if (h > 0) "Screen Time: ${h}h ${m}m left" else "Screen Time: ${m}m left"
            }
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification {
        val pending = PendingIntent.getActivity(
            this,
            0,
            Intent(this, PairingActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, ScreenTimeApplication.CHANNEL_STATUS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Screen Time Control")
            .setContentText(text)
            .setContentIntent(pending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    companion object {
        const val NOTIFICATION_ID = 1001

        fun start(context: android.content.Context) {
            val intent = Intent(context, EnforcementService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
