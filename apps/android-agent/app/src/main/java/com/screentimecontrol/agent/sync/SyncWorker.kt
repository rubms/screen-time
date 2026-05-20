package com.screentimecontrol.agent.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.screentimecontrol.agent.data.LocalStateStore
import com.screentimecontrol.agent.data.prefs.AgentPrefs

class SyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = AgentPrefs(applicationContext)
        if (!prefs.paired) return Result.success()
        val store = LocalStateStore(applicationContext)
        val sync = FirestoreSync(applicationContext, prefs, store)
        return try {
            if (prefs.customToken != null) {
                sync.signInWithCustomToken(prefs.customToken!!)
            }
            sync.uploadPendingEvents()
            sync.touchLastSeen()
            Result.success()
        } catch (e: Exception) {
            store.enqueueEvent(
                "sync-error",
                mapOf("message" to (e.message ?: "unknown")),
            )
            Result.retry()
        }
    }

    companion object {
        const val UNIQUE_NAME = "screen_time_sync"
        const val EXPEDITED_NAME = "screen_time_sync_expedited"

        fun enqueueExpedited(context: Context) {
            val request = OneTimeWorkRequestBuilder<SyncWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                EXPEDITED_NAME,
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
