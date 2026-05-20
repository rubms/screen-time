package com.screentimecontrol.agent.data.prefs

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class AgentPrefs(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val secure: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "agent_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val plain: SharedPreferences =
        context.getSharedPreferences("agent_prefs", Context.MODE_PRIVATE)

    var customToken: String?
        get() = secure.getString(KEY_CUSTOM_TOKEN, null)
        set(value) = secure.edit().putString(KEY_CUSTOM_TOKEN, value).apply()

    var familyId: String?
        get() = plain.getString(KEY_FAMILY_ID, null)
        set(value) = plain.edit().putString(KEY_FAMILY_ID, value).apply()

    var childId: String?
        get() = plain.getString(KEY_CHILD_ID, null)
        set(value) = plain.edit().putString(KEY_CHILD_ID, value).apply()

    var deviceId: String?
        get() = plain.getString(KEY_DEVICE_ID, null)
        set(value) = plain.edit().putString(KEY_DEVICE_ID, value).apply()

    var firebaseProjectId: String?
        get() = plain.getString(KEY_PROJECT_ID, null)
        set(value) = plain.edit().putString(KEY_PROJECT_ID, value).apply()

    var paired: Boolean
        get() = plain.getBoolean(KEY_PAIRED, false)
        set(value) = plain.edit().putBoolean(KEY_PAIRED, value).apply()

    var deviceDisplayName: String?
        get() = plain.getString(KEY_DEVICE_NAME, null)
        set(value) = plain.edit().putString(KEY_DEVICE_NAME, value).apply()

    fun clearPairing() {
        secure.edit().clear().apply()
        plain.edit()
            .remove(KEY_FAMILY_ID)
            .remove(KEY_CHILD_ID)
            .remove(KEY_DEVICE_ID)
            .remove(KEY_PAIRED)
            .remove(KEY_DEVICE_NAME)
            .apply()
    }

    companion object {
        private const val KEY_CUSTOM_TOKEN = "custom_token"
        private const val KEY_FAMILY_ID = "family_id"
        private const val KEY_CHILD_ID = "child_id"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_PROJECT_ID = "project_id"
        private const val KEY_PAIRED = "paired"
        private const val KEY_DEVICE_NAME = "device_name"
    }
}
