package com.screentimecontrol.agent.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.screentimecontrol.agent.R
import com.screentimecontrol.agent.ScreenTimeApplication
import com.screentimecontrol.agent.data.prefs.AgentPrefs
import com.screentimecontrol.agent.pairing.PairingActivity
import com.screentimecontrol.agent.service.EnforcementService
import com.screentimecontrol.agent.update.UpdateWorker

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }

        val prefs = AgentPrefs(context)
        if (!prefs.paired) {
            return
        }

        EnforcementService.start(context)
        UpdateWorker.enqueueOneTime(context)

        if (!isAccessibilityEnabled(context)) {
            showAccessibilityNotification(context)
        }
    }

    private fun isAccessibilityEnabled(context: Context): Boolean {
        val enabled = Settings.Secure.getInt(
            context.contentResolver,
            Settings.Secure.ACCESSIBILITY_ENABLED,
            0,
        ) == 1
        if (!enabled) return false
        val services = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        return services.contains(context.packageName)
    }

    private fun showAccessibilityNotification(context: Context) {
        val pending = android.app.PendingIntent.getActivity(
            context,
            0,
            Intent(context, PairingActivity::class.java),
            android.app.PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, ScreenTimeApplication.CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(context.getString(R.string.accessibility_required_title))
            .setContentText(context.getString(R.string.accessibility_required_body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(context).notify(2002, notification)
    }
}
