package com.screentimecontrol.agent.rules

import java.time.LocalDateTime
import java.time.LocalTime
import java.time.temporal.ChronoUnit
import kotlin.math.min

/** Built-in Android browser package names. */
val ANDROID_BROWSERS = setOf(
    "com.android.chrome",
    "com.chrome.beta",
    "com.chrome.dev",
    "com.microsoft.emmx",
    "org.mozilla.firefox",
    "org.mozilla.fenix",
    "com.brave.browser",
    "com.opera.browser",
    "com.opera.mini.native",
)

private const val UNKNOWN_TARGET_ID = "__unknown__"

/**
 * Pure decision function — no I/O, no clock access beyond [nowLocal].
 * Mirrors the TypeScript reference semantics in specs/rules-engine.
 */
fun decide(
    activity: Activity,
    rules: Rules,
    usage: UsageSnapshot,
    nowLocal: LocalDateTime,
    tempUnlocks: List<TempUnlock>,
): Decision {
    val activeUnlocks = tempUnlocks.filter { !it.revoked && it.expiresAtEpochMs > nowLocal.toEpochMillis() }
    val resolved = resolveActivity(activity, rules)

    if (resolved.category == Category.BLOCKED) {
        return Decision.Blocked
    }
    if (resolved.category == Category.ALLOWED) {
        return Decision.Allowed
    }

    val scheduleBypass = activeUnlocks.any { it.scope == "schedule" || it.scope == "schedule+quotas" }
    val quotaBypass = activeUnlocks.any { it.scope == "schedule+quotas" }

    if (!scheduleBypass && !isInsideSchedule(rules, nowLocal)) {
        return Decision.OutsideSchedule
    }

    if (quotaBypass) {
        return Decision.LimitedOk(remainingMinutes = 9999.0, warnAt = 9994.0)
    }

    val dayKey = nowLocal.dayKey()
    val warningLead = resolved.target?.warningLeadMinutes
        ?: rules.defaults.warningLeadMinutes

    val remaining = computeRemainingMinutes(
        resolved = resolved,
        rules = rules,
        usage = usage,
        nowLocal = nowLocal,
        dayKey = dayKey,
        activeUnlocks = activeUnlocks,
    )

    if (remaining.isInfinite()) {
        return Decision.LimitedOk(remainingMinutes = 9999.0, warnAt = 9994.0)
    }

    if (remaining <= 0) {
        return Decision.OutOfTime(reason = "quota-or-schedule")
    }

    val warnAt = remaining - warningLead
    if (remaining <= warningLead) {
        return Decision.Warn(
            remainingMinutes = remaining,
            reason = "approaching-limit",
        )
    }

    return Decision.LimitedOk(remainingMinutes = remaining, warnAt = warnAt)
}

fun resolveActivity(activity: Activity, rules: Rules): ResolvedTarget {
    val appTarget = findAppTarget(activity.app, activity.platform, rules)
    if (appTarget?.category == Category.BLOCKED) {
        return toResolved(appTarget)
    }

    val urlTarget = if (isBrowser(activity.app) && !activity.url.isNullOrBlank()) {
        findUrlTarget(activity.url!!, rules)
    } else {
        null
    }

    when {
        urlTarget != null -> return toResolved(urlTarget)
        appTarget != null -> return toResolved(appTarget)
        else -> return ResolvedTarget(
            targetId = UNKNOWN_TARGET_ID,
            displayName = activity.app,
            category = Category.LIMITED,
            target = null,
        )
    }
}

private fun toResolved(target: RuleTarget): ResolvedTarget = ResolvedTarget(
    targetId = target.id,
    displayName = target.displayName,
    category = target.category,
    target = target,
)

fun isBrowser(app: String): Boolean =
    ANDROID_BROWSERS.contains(app) || app.contains("chrome") || app.contains("firefox")

private fun findAppTarget(packageName: String, platform: String, rules: Rules): AppTarget? {
    val pkg = packageName.lowercase()
    return rules.targets.filterIsInstance<AppTarget>().firstOrNull { target ->
        target.matchers.any { m ->
            (m.platform == platform || m.platform == "any") &&
                m.matcher.lowercase() == pkg
        }
    }
}

private fun findUrlTarget(rawUrl: String, rules: Rules): UrlTarget? {
    val normalized = normalizeUrl(rawUrl)
    return rules.targets
        .filterIsInstance<UrlTarget>()
        .map { it to patternMatchLength(it.pattern, normalized) }
        .filter { (_, len) -> len > 0 }
        .maxByOrNull { (_, len) -> len }
        ?.first
}

/** Returns match length for longest-prefix semantics (0 = no match). */
fun patternMatchLength(pattern: String, url: String): Int {
    val pat = pattern.trim().removePrefix("https://").removePrefix("http://").trimEnd('/')
    val hostPath = url.trim().removePrefix("https://").removePrefix("http://")
        .substringBefore('?').trimEnd('/')

    if (pat.startsWith("*.")) {
        val suffix = pat.removePrefix("*.")
        val host = hostPath.substringBefore('/')
        return if (host == suffix.removeSuffix("/") || host.endsWith(".$suffix")) hostPath.length else 0
    }

    if (pat.contains('/')) {
        return if (hostPath.startsWith(pat) || hostPath == pat.trimEnd('/')) pat.length else 0
    }

    val host = hostPath.substringBefore('/')
    return when {
        host == pat -> pat.length
        host.endsWith(".$pat") -> pat.length
        else -> 0
    }
}

fun normalizeUrl(raw: String): String {
    var s = raw.trim().lowercase()
    s = s.removePrefix("https://").removePrefix("http://")
    return s.substringBefore('?').trimEnd('/')
}

private fun isInsideSchedule(rules: Rules, nowLocal: LocalDateTime): Boolean {
    val day = rules.weekly[nowLocal.dayKey()] ?: return false
    if (day.schedule.isEmpty()) return false
    val now = nowLocal.toLocalTime()
    return day.schedule.any { window ->
        val (start, end) = parseTimeWindow(window.start, window.end)
        !now.isBefore(start) && now.isBefore(end)
    }
}

private fun computeRemainingMinutes(
    resolved: ResolvedTarget,
    rules: Rules,
    usage: UsageSnapshot,
    nowLocal: LocalDateTime,
    dayKey: String,
    activeUnlocks: List<TempUnlock>,
): Double {
    val candidates = mutableListOf<Double>()

    val daySchedule = rules.weekly[dayKey]
    val totalBudget = daySchedule?.dailyTotalMinutes?.toDouble()
    if (totalBudget != null) {
        val extra = addMinutesForScope(activeUnlocks, targetId = null, scopeTarget = "total")
        candidates += (totalBudget + extra) - usage.sumLimitedUsageToday
    }

    val targetQuota = resolved.target?.dailyQuotaMinutes?.minutesForDay(dayKey)?.toDouble()
    if (targetQuota != null) {
        val used = usage.usageToday[resolved.targetId] ?: 0.0
        val extra = addMinutesForScope(activeUnlocks, resolved.targetId, scopeTarget = resolved.targetId)
        candidates += (targetQuota + extra) - used
    }

    val untilWindowEnd = minutesUntilScheduleWindowEnds(rules, nowLocal)
    if (untilWindowEnd != null) {
        candidates += untilWindowEnd
    }

    if (candidates.isEmpty()) return Double.POSITIVE_INFINITY
    return candidates.min()
}

private fun addMinutesForScope(
    unlocks: List<TempUnlock>,
    targetId: String?,
    scopeTarget: String,
): Double {
    return unlocks
        .filter { it.scope == "add-minutes" && it.target == scopeTarget }
        .sumOf { (it.additionalMinutes ?: 0).toDouble() }
}

private fun minutesUntilScheduleWindowEnds(rules: Rules, nowLocal: LocalDateTime): Double? {
    val day = rules.weekly[nowLocal.dayKey()] ?: return null
    if (day.schedule.isEmpty()) return null
    val now = nowLocal.toLocalTime()
    val active = day.schedule.firstOrNull { window ->
        val (start, end) = parseTimeWindow(window.start, window.end)
        !now.isBefore(start) && now.isBefore(end)
    } ?: return 0.0
    val end = parseTimeWindow(active.start, active.end).second
    val seconds = ChronoUnit.SECONDS.between(now, end).toDouble()
    return maxOf(0.0, seconds / 60.0)
}

private fun LocalDateTime.toEpochMillis(): Long =
    atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
