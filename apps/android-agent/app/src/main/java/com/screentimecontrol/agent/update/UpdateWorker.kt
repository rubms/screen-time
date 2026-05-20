package com.screentimecontrol.agent.update

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.FileProvider
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.screentimecontrol.agent.FirebaseFunctionsProvider
import com.screentimecontrol.agent.BuildConfig
import com.screentimecontrol.agent.R
import com.screentimecontrol.agent.ScreenTimeApplication
import kotlinx.coroutines.tasks.await
import java.io.File
import java.net.URL
import java.security.MessageDigest

class UpdateWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            checkForUpdate()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private suspend fun checkForUpdate() {
        val result = FirebaseFunctionsProvider.get()
            .getHttpsCallable("getUpdateManifest")
            .call(
                mapOf(
                    "platform" to "android",
                    "channel" to "stable",
                    "currentVersion" to BuildConfig.VERSION_NAME,
                ),
            )
            .await()

        @Suppress("UNCHECKED_CAST")
        val data = result.data as? Map<String, Any?> ?: return
        val version = data["version"] as? String ?: return
        val assetUrl = data["assetUrl"] as? String ?: return
        val expectedSha = data["sha256"] as? String ?: return

        if (version == BuildConfig.VERSION_NAME) return

        val apkFile = File(applicationContext.filesDir, "updates/update-$version.apk")
        apkFile.parentFile?.mkdirs()
        URL(assetUrl).openStream().use { input ->
            apkFile.outputStream().use { output -> input.copyTo(output) }
        }

        val digest = MessageDigest.getInstance("SHA-256")
        apkFile.inputStream().use { input ->
            val buf = ByteArray(8192)
            var read: Int
            while (input.read(buf).also { read = it } > 0) {
                digest.update(buf, 0, read)
            }
        }
        val hex = digest.digest().joinToString("") { "%02x".format(it) }
        if (!hex.equals(expectedSha, ignoreCase = true)) {
            apkFile.delete()
            error("SHA-256 mismatch")
        }

        showUpdateNotification(apkFile)
    }

    private fun showUpdateNotification(apkFile: File) {
        val uri: Uri = FileProvider.getUriForFile(
            applicationContext,
            "${applicationContext.packageName}.fileprovider",
            apkFile,
        )
        val install = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val pending = PendingIntent.getActivity(
            applicationContext,
            0,
            install,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(applicationContext, ScreenTimeApplication.CHANNEL_UPDATES)
            .setSmallIcon(android.R.drawable.ic_menu_upload)
            .setContentTitle(applicationContext.getString(R.string.update_available_title))
            .setContentText(applicationContext.getString(R.string.update_available_body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(applicationContext).notify(3003, notification)
    }

    companion object {
        const val UNIQUE_NAME = "screen_time_update"

        fun enqueueOneTime(context: Context) {
            val request = OneTimeWorkRequestBuilder<UpdateWorker>().build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "screen_time_update_once",
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
