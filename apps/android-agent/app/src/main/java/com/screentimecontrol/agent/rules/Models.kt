package com.screentimecontrol.agent.rules

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.LocalDateTime
import java.time.LocalTime

@Serializable
data class Activity(
    val app: String,
    val url: String? = null,
    val platform: String = "android",
)

@Serializable
enum class Category {
    @SerialName("BLOCKED")
    BLOCKED,

    @SerialName("LIMITED")
    LIMITED,

    @SerialName("ALLOWED")
    ALLOWED,
}

@Serializable
data class Rules(
    val version: Int = 0,
    val weekly: Map<String, DaySchedule> = emptyMap(),
    val defaults: RuleDefaults = RuleDefaults(),
    val targets: List<RuleTarget> = emptyList(),
)

@Serializable
data class RuleDefaults(
    val warningLeadMinutes: Int = 5,
    val gracePeriodSeconds: Int = 120,
)

@Serializable
data class DaySchedule(
    val schedule: List<TimeWindow> = emptyList(),
    val dailyTotalMinutes: Int? = null,
)

@Serializable
data class TimeWindow(
    val start: String,
    val end: String,
)

@Serializable
sealed class RuleTarget {
    abstract val id: String
    abstract val displayName: String
    abstract val category: Category
    abstract val dailyQuotaMinutes: QuotaByDay?
    abstract val warningLeadMinutes: Int?
    abstract val gracePeriodSeconds: Int?
}

@Serializable
@SerialName("app")
data class AppTarget(
    override val id: String,
    override val displayName: String,
    override val category: Category,
    override val dailyQuotaMinutes: QuotaByDay? = null,
    override val warningLeadMinutes: Int? = null,
    override val gracePeriodSeconds: Int? = null,
    val platform: String = "any",
    val matchers: List<AppMatcher> = emptyList(),
) : RuleTarget()

@Serializable
data class AppMatcher(
    val platform: String,
    val matcher: String,
    val windowTitlePattern: String? = null,
)

@Serializable
@SerialName("url")
data class UrlTarget(
    override val id: String,
    override val displayName: String,
    override val category: Category,
    override val dailyQuotaMinutes: QuotaByDay? = null,
    override val warningLeadMinutes: Int? = null,
    override val gracePeriodSeconds: Int? = null,
    val pattern: String,
) : RuleTarget()

@Serializable
data class QuotaByDay(
    val default: Int? = null,
    val mon: Int? = null,
    val tue: Int? = null,
    val wed: Int? = null,
    val thu: Int? = null,
    val fri: Int? = null,
    val sat: Int? = null,
    val sun: Int? = null,
)

@Serializable
data class UsageSnapshot(
    val usageToday: Map<String, Double> = emptyMap(),
    val sumLimitedUsageToday: Double = 0.0,
)

@Serializable
data class TempUnlock(
    val id: String = "",
    val scope: String,
    val target: String? = null,
    val additionalMinutes: Int? = null,
    val expiresAtEpochMs: Long,
    val revoked: Boolean = false,
)

@Serializable
sealed class Decision {
    @Serializable
    @SerialName("ALLOWED")
    data object Allowed : Decision()

    @Serializable
    @SerialName("BLOCKED")
    data object Blocked : Decision()

    @Serializable
    @SerialName("OUTSIDE_SCHEDULE")
    data object OutsideSchedule : Decision()

    @Serializable
    @SerialName("LIMITED_OK")
    data class LimitedOk(
        val remainingMinutes: Double,
        val warnAt: Double,
    ) : Decision()

    @Serializable
    @SerialName("WARN")
    data class Warn(
        val remainingMinutes: Double,
        val reason: String,
    ) : Decision()

    @Serializable
    @SerialName("OUT_OF_TIME")
    data class OutOfTime(
        val reason: String,
    ) : Decision()
}

data class ResolvedTarget(
    val targetId: String,
    val displayName: String,
    val category: Category,
    val target: RuleTarget?,
)

fun LocalDateTime.dayKey(): String = when (dayOfWeek.value) {
    1 -> "mon"
    2 -> "tue"
    3 -> "wed"
    4 -> "thu"
    5 -> "fri"
    6 -> "sat"
    7 -> "sun"
    else -> "mon"
}

fun QuotaByDay?.minutesForDay(dayKey: String): Int? {
    if (this == null) return null
    val specific = when (dayKey) {
        "mon" -> mon
        "tue" -> tue
        "wed" -> wed
        "thu" -> thu
        "fri" -> fri
        "sat" -> sat
        "sun" -> sun
        else -> null
    }
    return specific ?: default
}

fun parseTimeWindow(start: String, end: String): Pair<LocalTime, LocalTime> =
    LocalTime.parse(start) to LocalTime.parse(end)
