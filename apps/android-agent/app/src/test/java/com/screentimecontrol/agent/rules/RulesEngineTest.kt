package com.screentimecontrol.agent.rules

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class RulesEngineTest {
    @Test
    fun blockedAppOverridesAllowedUrl() {
        val rules = Rules(
            targets = listOf(
                AppTarget(
                    id = "chrome",
                    displayName = "Chrome",
                    category = Category.BLOCKED,
                    matchers = listOf(AppMatcher("android", "com.android.chrome")),
                ),
                UrlTarget(
                    id = "kids",
                    displayName = "Kids",
                    category = Category.ALLOWED,
                    pattern = "youtube.com/kids/",
                ),
            ),
        )
        val decision = decide(
            Activity("com.android.chrome", "youtube.com/kids/watch"),
            rules,
            UsageSnapshot(),
            LocalDateTime.of(2026, 5, 19, 14, 0),
            emptyList(),
        )
        assertEquals(Decision.Blocked, decision)
    }

    @Test
    fun unknownAppIsLimited() {
        val decision = decide(
            Activity("com.example.unknown"),
            Rules(),
            UsageSnapshot(),
            LocalDateTime.of(2026, 5, 19, 14, 0),
            emptyList(),
        )
        assertTrue(decision is Decision.LimitedOk || decision is Decision.Warn || decision is Decision.OutOfTime)
    }

    @Test
    fun outsideScheduleWhenNoUnlock() {
        val rules = Rules(
            weekly = mapOf(
                "mon" to DaySchedule(
                    schedule = listOf(TimeWindow("09:00", "20:00")),
                    dailyTotalMinutes = 120,
                ),
            ),
            targets = listOf(
                AppTarget(
                    id = "yt",
                    displayName = "YouTube",
                    category = Category.LIMITED,
                    matchers = listOf(AppMatcher("android", "com.google.android.youtube")),
                ),
            ),
        )
        val mondayNight = LocalDateTime.of(2026, 5, 18, 21, 15) // Monday
        val decision = decide(
            Activity("com.google.android.youtube"),
            rules,
            UsageSnapshot(),
            mondayNight,
            emptyList(),
        )
        assertEquals(Decision.OutsideSchedule, decision)
    }

    @Test
    fun longestUrlPrefixWins() {
        val rules = Rules(
            targets = listOf(
                UrlTarget("yt", "YouTube", Category.LIMITED, pattern = "youtube.com"),
                UrlTarget("kids", "Kids", Category.ALLOWED, pattern = "youtube.com/kids/"),
            ),
        )
        val resolved = resolveActivity(
            Activity("com.android.chrome", "youtube.com/kids/abc"),
            rules,
        )
        assertEquals("kids", resolved.targetId)
        assertEquals(Category.ALLOWED, resolved.category)
    }
}
