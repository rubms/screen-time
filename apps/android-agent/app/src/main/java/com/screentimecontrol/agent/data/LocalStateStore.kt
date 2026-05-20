package com.screentimecontrol.agent.data

import android.content.Context
import com.screentimecontrol.agent.data.local.AppDatabase
import com.screentimecontrol.agent.data.local.EventEntity
import com.screentimecontrol.agent.data.local.RulesCacheEntity
import com.screentimecontrol.agent.data.local.UnlocksCacheEntity
import com.screentimecontrol.agent.data.local.UsageTodayEntity
import com.screentimecontrol.agent.rules.Rules
import com.screentimecontrol.agent.rules.TempUnlock
import com.screentimecontrol.agent.rules.UsageSnapshot
import com.screentimecontrol.agent.rules.parseRulesFromJson
import com.screentimecontrol.agent.rules.parseTempUnlocksFromJsonArray
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.time.LocalDate

class LocalStateStore(context: Context) {
    private val db = AppDatabase.get(context)
    private val filesDir = context.filesDir
    private val rulesFile = File(filesDir, "rules.json")

    suspend fun cacheRules(json: String, version: Int) = withContext(Dispatchers.IO) {
        rulesFile.writeText(json)
        db.rulesCacheDao().upsert(
            RulesCacheEntity(rulesJson = json, version = version, updatedAtMs = System.currentTimeMillis()),
        )
    }

    suspend fun loadRules(): Rules = withContext(Dispatchers.IO) {
        val fromDb = db.rulesCacheDao().current()?.rulesJson
        val text = fromDb ?: rulesFile.takeIf { it.exists() }?.readText()
        if (text.isNullOrBlank()) Rules() else parseRulesFromJson(text)
    }

    suspend fun loadTempUnlocks(): List<TempUnlock> = withContext(Dispatchers.IO) {
        db.unlocksCacheDao().active().mapNotNull { row ->
            parseTempUnlocksFromJsonArray("[${row.payloadJson}]").firstOrNull()
        }
    }

    suspend fun replaceUnlocks(unlocks: List<UnlocksCacheEntity>) = withContext(Dispatchers.IO) {
        db.unlocksCacheDao().clear()
        if (unlocks.isNotEmpty()) db.unlocksCacheDao().upsertAll(unlocks)
    }

    suspend fun usageSnapshot(localDate: String): UsageSnapshot = withContext(Dispatchers.IO) {
        val rows = db.usageDao().forDate(localDate)
        val map = rows.associate { it.targetId to it.minutes }
        val sum = rows.filter { it.targetId != "__allowed__" }.sumOf { it.minutes }
        UsageSnapshot(usageToday = map, sumLimitedUsageToday = sum)
    }

    suspend fun addUsageMinutes(targetId: String, localDate: String, deltaMinutes: Double) =
        withContext(Dispatchers.IO) {
            val existing = db.usageDao().forDate(localDate).find { it.targetId == targetId }
            val next = (existing?.minutes ?: 0.0) + deltaMinutes
            db.usageDao().upsert(UsageTodayEntity(targetId = targetId, localDate = localDate, minutes = next))
        }

    suspend fun enqueueEvent(eventType: String, payload: Map<String, Any?>) = withContext(Dispatchers.IO) {
        val json = JSONObject(payload).toString()
        val localDate = LocalDate.now().toString()
        db.eventDao().insert(
            EventEntity(
                eventType = eventType,
                payloadJson = json,
                localDate = localDate,
                atIso = java.time.OffsetDateTime.now().toString(),
            ),
        )
    }

    suspend fun pendingEvents(limit: Int = 100) = withContext(Dispatchers.IO) {
        db.eventDao().pending(limit)
    }

    suspend fun markUploaded(events: List<EventEntity>) = withContext(Dispatchers.IO) {
        events.forEach { db.eventDao().update(it.copy(uploaded = true)) }
        val cutoff = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
        db.eventDao().purgeUploadedBefore(cutoff)
    }
}
