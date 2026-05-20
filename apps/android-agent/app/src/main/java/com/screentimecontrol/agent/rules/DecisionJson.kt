package com.screentimecontrol.agent.rules

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/** JSON shape aligned with TS/Python `decision_to_json` for fixture parity. */
fun decisionToJson(decision: Decision): JsonObject = when (decision) {
    is Decision.Allowed -> buildJsonObject { put("kind", JsonPrimitive("ALLOWED")) }
    is Decision.Blocked -> buildJsonObject { put("kind", JsonPrimitive("BLOCKED")) }
    is Decision.OutsideSchedule -> buildJsonObject {
        put("kind", JsonPrimitive("OUTSIDE_SCHEDULE"))
    }
    is Decision.LimitedOk -> buildJsonObject {
        put("kind", JsonPrimitive("LIMITED_OK"))
        put("remainingMinutes", JsonPrimitive(normalizeNumber(decision.remainingMinutes)))
        put("warnAt", JsonPrimitive(normalizeNumber(decision.warnAt)))
    }
    is Decision.Warn -> buildJsonObject {
        put("kind", JsonPrimitive("WARN"))
        put("remainingMinutes", JsonPrimitive(normalizeNumber(decision.remainingMinutes)))
        put("reason", JsonPrimitive(decision.reason))
    }
    is Decision.OutOfTime -> buildJsonObject {
        put("kind", JsonPrimitive("OUT_OF_TIME"))
        put("reason", JsonPrimitive(decision.reason))
    }
}

private fun normalizeNumber(value: Double): Number =
    if (value == value.toLong().toDouble()) value.toLong() else value
