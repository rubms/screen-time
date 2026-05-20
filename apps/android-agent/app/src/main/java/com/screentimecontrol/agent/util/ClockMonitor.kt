package com.screentimecontrol.agent.util

import android.os.SystemClock

class ClockMonitor {
    private var lastElapsed = SystemClock.elapsedRealtime()
    private var lastWall = System.currentTimeMillis()

    /** Returns true if suspicious clock drift detected (>5 min backward or >10 min forward vs monotonic). */
    fun checkDrift(): Boolean {
        val nowElapsed = SystemClock.elapsedRealtime()
        val nowWall = System.currentTimeMillis()
        val elapsedDelta = nowElapsed - lastElapsed
        val wallDelta = nowWall - lastWall
        lastElapsed = nowElapsed
        lastWall = nowWall
        val diff = wallDelta - elapsedDelta
        return diff < -5 * 60_000 || diff > 10 * 60_000
    }
}
