package com.screentimecontrol.agent.rules

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

private val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
}

fun parseRulesFromJson(text: String): Rules {
    val root = json.parseToJsonElement(text).jsonObject
    return parseRulesObject(root)
}

fun parseRulesObject(root: JsonObject): Rules {
    val weekly = root["weekly"]?.jsonObject?.mapValues { (_, v) ->
        val o = v.jsonObject
        DaySchedule(
            schedule = o["schedule"]?.jsonArray?.map { w ->
                val wo = w.jsonObject
                TimeWindow(
                    start = wo["start"]!!.jsonPrimitive.content,
                    end = wo["end"]!!.jsonPrimitive.content,
                )
            } ?: emptyList(),
            dailyTotalMinutes = o["dailyTotalMinutes"]?.jsonPrimitive?.intOrNull,
        )
    } ?: emptyMap()

    val defaultsObj = root["defaults"]?.jsonObject
    val defaults = RuleDefaults(
        warningLeadMinutes = defaultsObj?.get("warningLeadMinutes")?.jsonPrimitive?.intOrNull ?: 5,
        gracePeriodSeconds = defaultsObj?.get("gracePeriodSeconds")?.jsonPrimitive?.intOrNull ?: 120,
    )

    val targets = root["targets"]?.jsonArray?.mapNotNull { parseTarget(it) } ?: emptyList()

    return Rules(
        version = root["version"]?.jsonPrimitive?.intOrNull ?: 0,
        weekly = weekly,
        defaults = defaults,
        targets = targets,
    )
}

private fun parseTarget(element: JsonElement): RuleTarget? {
    val o = element.jsonObject
    val kind = o["kind"]?.jsonPrimitive?.contentOrNull ?: return null
    val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return null
    val displayName = o["displayName"]?.jsonPrimitive?.contentOrNull ?: id
    val category = parseCategory(o["category"]?.jsonPrimitive?.contentOrNull) ?: Category.LIMITED
    val quota = parseQuota(o["dailyQuotaMinutes"]?.jsonObject)
    val warn = o["warningLeadMinutes"]?.jsonPrimitive?.intOrNull
    val grace = o["gracePeriodSeconds"]?.jsonPrimitive?.intOrNull

    return when (kind) {
        "app" -> AppTarget(
            id = id,
            displayName = displayName,
            category = category,
            dailyQuotaMinutes = quota,
            warningLeadMinutes = warn,
            gracePeriodSeconds = grace,
            platform = o["platform"]?.jsonPrimitive?.contentOrNull ?: "any",
            matchers = o["matchers"]?.jsonArray?.map { m ->
                val mo = m.jsonObject
                AppMatcher(
                    platform = mo["platform"]?.jsonPrimitive?.contentOrNull ?: "android",
                    matcher = mo["matcher"]!!.jsonPrimitive.content,
                    windowTitlePattern = mo["windowTitlePattern"]?.jsonPrimitive?.contentOrNull,
                )
            } ?: emptyList(),
        )
        "url" -> UrlTarget(
            id = id,
            displayName = displayName,
            category = category,
            dailyQuotaMinutes = quota,
            warningLeadMinutes = warn,
            gracePeriodSeconds = grace,
            pattern = o["pattern"]!!.jsonPrimitive.content,
        )
        else -> null
    }
}

private fun parseCategory(raw: String?): Category? = when (raw?.uppercase()) {
    "BLOCKED" -> Category.BLOCKED
    "LIMITED" -> Category.LIMITED
    "ALLOWED" -> Category.ALLOWED
    else -> null
}

private fun parseQuota(obj: JsonObject?): QuotaByDay? {
    if (obj == null) return null
    fun int(key: String) = obj[key]?.jsonPrimitive?.intOrNull
    return QuotaByDay(
        default = int("default"),
        mon = int("mon"),
        tue = int("tue"),
        wed = int("wed"),
        thu = int("thu"),
        fri = int("fri"),
        sat = int("sat"),
        sun = int("sun"),
    )
}

fun parseTempUnlocksFromJsonArray(text: String): List<TempUnlock> {
    val arr = json.parseToJsonElement(text)
    if (arr !is JsonArray) return emptyList()
    return arr.mapNotNull { el ->
        val o = el.jsonObject
        val scope = o["scope"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
        val expires = o["expiresAt"]?.let { parseTimestampMs(it) }
            ?: o["expiresAtEpochMs"]?.jsonPrimitive?.longOrNull
            ?: return@mapNotNull null
        TempUnlock(
            id = o["id"]?.jsonPrimitive?.contentOrNull ?: "",
            scope = scope,
            target = o["target"]?.jsonPrimitive?.contentOrNull,
            additionalMinutes = o["additionalMinutes"]?.jsonPrimitive?.intOrNull,
            expiresAtEpochMs = expires,
            revoked = o["revoked"]?.jsonPrimitive?.booleanOrNull ?: false,
        )
    }
}

private fun parseTimestampMs(element: JsonElement): Long? {
    val prim = element.jsonPrimitive
    prim.longOrNull?.let { return it }
    // Firestore may serialize as map with seconds — best-effort string
    return prim.contentOrNull?.toLongOrNull()
}
