package com.screentimecontrol.agent.rules

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.time.LocalDateTime

class FixtureParityTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun allSharedFixtureCasesMatchTypeScript() {
        val casesPath = locateFixtures()
        val root = json.parseToJsonElement(Files.readString(casesPath)).jsonObject
        val cases = root["cases"]!!.jsonArray
        cases.forEach { element ->
            val c = element.jsonObject
            val id = c["id"]!!.jsonPrimitive.content
            val activity = parseActivity(c["activity"]!!.jsonObject)
            val rules = parseRulesObject(c["rules"]!!.jsonObject)
            val usage = parseUsage(c["usage"]!!.jsonObject)
            val now = parseNowLocal(c["nowLocal"]!!.jsonObject)
            val unlocks = c["tempUnlocks"]!!.jsonArray.map { parseUnlock(it.jsonObject) }
            val expected = c["expected"]!!.jsonObject
            val actual = decisionToJson(decide(activity, rules, usage, now, unlocks))
            assertEquals("case $id", jsonString(expected), jsonString(actual))
        }
    }

    private fun locateFixtures(): Path {
        var dir = Paths.get("").toAbsolutePath()
        repeat(6) {
            val candidate = dir.resolve("packages/shared-rules-engine/fixtures/cases.json")
            if (Files.exists(candidate)) return candidate
            dir = dir.parent ?: break
        }
        error("fixtures/cases.json not found")
    }

    private fun parseActivity(o: JsonObject): Activity = Activity(
        app = o["app"]!!.jsonPrimitive.content,
        url = o["url"]?.jsonPrimitive?.content,
        platform = o["platform"]?.jsonPrimitive?.content ?: "windows",
    )

    private fun parseUsage(o: JsonObject): UsageSnapshot {
        val per = o["perTarget"]?.jsonObject?.mapValues { (_, v) -> v.jsonPrimitive.double } ?: emptyMap()
        val total = o["totalLimitedMinutes"]?.jsonPrimitive?.double ?: 0.0
        return UsageSnapshot(usageToday = per, sumLimitedUsageToday = total)
    }

    private fun parseNowLocal(o: JsonObject): LocalDateTime {
        val mins = o["minutesSinceMidnight"]!!.jsonPrimitive.int
        return LocalDateTime.of(2026, 5, 19, mins / 60, mins % 60)
    }

    private fun parseUnlock(o: JsonObject): TempUnlock = TempUnlock(
        id = o["id"]?.jsonPrimitive?.content ?: "",
        deviceId = o["deviceId"]?.jsonPrimitive?.content ?: "",
        scope = o["scope"]!!.jsonPrimitive.content,
        target = o["target"]?.jsonPrimitive?.content,
        additionalMinutes = o["additionalMinutes"]?.jsonPrimitive?.int,
        expiresAtEpochMs = o["expiresAtMs"]!!.jsonPrimitive.long,
        revoked = o["revoked"]?.jsonPrimitive?.boolean ?: false,
    )

    private fun jsonString(o: JsonObject): String = json.encodeToString(JsonObject.serializer(), o)
}
