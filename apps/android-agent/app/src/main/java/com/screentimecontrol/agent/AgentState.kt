package com.screentimecontrol.agent

import com.screentimecontrol.agent.rules.Activity
import java.util.concurrent.atomic.AtomicReference

/** Process-wide focus + enforcement state shared between services. */
object AgentState {
    val currentActivity = AtomicReference(Activity(app = "unknown"))
    val currentUrl = AtomicReference<String?>(null)
    val lastDecisionKind = AtomicReference("ALLOWED")
    val remainingMinutesDisplay = AtomicReference<Double?>(null)
    val currentCategory = AtomicReference("LIMITED")
    val accessibilityEnabled = AtomicReference(true)
    val lockoutMessage = AtomicReference<String?>(null)

    @Volatile
    var warnedTargetsToday: MutableSet<String> = mutableSetOf()

    @Volatile
    var reblockUntilMs: Long = 0

    @Volatile
    var lastFocusPackage: String? = null

    fun resetDailyIfNeeded(localDate: String, storedDate: String?) {
        if (storedDate != localDate) {
            warnedTargetsToday = mutableSetOf()
        }
    }
}
