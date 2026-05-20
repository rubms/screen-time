package com.screentimecontrol.agent

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.screentimecontrol.agent.sync.SyncWorker
import com.screentimecontrol.agent.update.UpdateWorker
import java.util.concurrent.TimeUnit

class ScreenTimeApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        scheduleWorkers()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_STATUS,
                "Screen Time Status",
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ALERTS,
                "Screen Time Alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ),
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_UPDATES,
                "Screen Time Updates",
                NotificationManager.IMPORTANCE_HIGH,
            ),
        )
    }

    private fun scheduleWorkers() {
        val sync = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            SyncWorker.UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            sync,
        )
        val update = PeriodicWorkRequestBuilder<UpdateWorker>(6, TimeUnit.HOURS).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            UpdateWorker.UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            update,
        )
    }

    companion object {
        const val CHANNEL_STATUS = "SCREEN_TIME_STATUS"
        const val CHANNEL_ALERTS = "SCREEN_TIME_ALERTS"
        const val CHANNEL_UPDATES = "SCREEN_TIME_UPDATES"
    }
}
