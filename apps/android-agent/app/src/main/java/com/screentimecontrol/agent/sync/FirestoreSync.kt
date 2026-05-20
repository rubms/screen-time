package com.screentimecontrol.agent.sync

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.functions.FirebaseFunctions
import com.screentimecontrol.agent.BuildConfig
import com.screentimecontrol.agent.data.LocalStateStore
import com.screentimecontrol.agent.data.local.UnlocksCacheEntity
import com.screentimecontrol.agent.data.prefs.AgentPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

class FirestoreSync(
    private val context: Context,
    private val prefs: AgentPrefs,
    private val store: LocalStateStore,
) {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseFirestore.getInstance()
    private var rulesListener: ListenerRegistration? = null
    private var unlocksListener: ListenerRegistration? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    suspend fun signInWithCustomToken(token: String) {
        auth.signInWithCustomToken(token).await()
    }

    suspend fun redeemPairingCode(code: String, deviceName: String): PairingResult {
        val functions = FirebaseFunctions.getInstance()
        val result = functions
            .getHttpsCallable("redeemPairingCode")
            .call(
                mapOf(
                    "code" to code.uppercase().trim(),
                    "platform" to "android",
                    "displayName" to deviceName,
                    "installedVersion" to BuildConfig.VERSION_NAME,
                ),
            )
            .await()

        @Suppress("UNCHECKED_CAST")
        val data = result.data as? Map<String, Any?> ?: error("Invalid pairing response")
        val customToken = data["customToken"] as? String ?: error("Missing customToken")
        val familyId = data["familyId"] as? String ?: error("Missing familyId")
        val childId = data["childId"] as? String ?: error("Missing childId")
        val deviceId = data["deviceId"] as? String ?: error("Missing deviceId")

        signInWithCustomToken(customToken)
        prefs.customToken = customToken
        prefs.familyId = familyId
        prefs.childId = childId
        prefs.deviceId = deviceId
        prefs.deviceDisplayName = deviceName
        prefs.paired = true

        return PairingResult(familyId, childId, deviceId, customToken)
    }

    fun startListeners() {
        val familyId = prefs.familyId ?: return
        val childId = prefs.childId ?: return
        val deviceId = prefs.deviceId ?: return

        rulesListener?.remove()
        rulesListener = db.collection("families").document(familyId)
            .collection("children").document(childId)
            .collection("rules").document("current")
            .addSnapshotListener { snap, _ ->
                if (snap != null && snap.exists()) {
                    val json = JSONObject(snap.data ?: emptyMap<String, Any>()).toString()
                    val version = (snap.getLong("version") ?: 0L).toInt()
                    scope.launch {
                        store.cacheRules(json, version)
                    }
                }
            }

        unlocksListener?.remove()
        unlocksListener = db.collection("families").document(familyId)
            .collection("temp-unlocks")
            .whereEqualTo("deviceId", deviceId)
            .whereEqualTo("revoked", false)
            .addSnapshotListener { snaps, _ ->
                if (snaps == null) return@addSnapshotListener
                val rows = snaps.documents.mapNotNull { doc ->
                    val expires = doc.getTimestamp("expiresAt")?.toDate()?.time ?: return@mapNotNull null
                    UnlocksCacheEntity(
                        unlockId = doc.id,
                        payloadJson = JSONObject(doc.data ?: emptyMap<String, Any>()).toString(),
                        expiresAtMs = expires,
                        revoked = doc.getBoolean("revoked") ?: false,
                    )
                }
                scope.launch {
                    store.replaceUnlocks(rows)
                }
            }
    }

    fun stopListeners() {
        rulesListener?.remove()
        unlocksListener?.remove()
        rulesListener = null
        unlocksListener = null
    }

    suspend fun uploadPendingEvents(): Int {
        val familyId = prefs.familyId ?: return 0
        val deviceId = prefs.deviceId ?: return 0
        val childId = prefs.childId ?: return 0
        val pending = store.pendingEvents()
        if (pending.isEmpty()) return 0

        val col = db.collection("families").document(familyId)
            .collection("devices").document(deviceId)
            .collection("events")

        val uploaded = mutableListOf<com.screentimecontrol.agent.data.local.EventEntity>()
        for (event in pending) {
            val body = JSONObject(event.payloadJson)
            body.put("eventType", event.eventType)
            body.put("localDate", event.localDate)
            body.put("at", event.atIso)
            body.put("childId", childId)
            body.put("deviceId", deviceId)
            body.put("platform", "android")
            body.put("agentVersion", BuildConfig.VERSION_NAME)
            col.add(body).await()
            uploaded.add(event)
        }
        store.markUploaded(uploaded)
        return uploaded.size
    }

    suspend fun touchLastSeen() {
        val familyId = prefs.familyId ?: return
        val deviceId = prefs.deviceId ?: return
        db.collection("families").document(familyId)
            .collection("devices").document(deviceId)
            .update(
                mapOf(
                    "lastSeenAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "installedVersion" to BuildConfig.VERSION_NAME,
                ),
            )
            .await()
    }

    data class PairingResult(
        val familyId: String,
        val childId: String,
        val deviceId: String,
        val customToken: String,
    )
}
