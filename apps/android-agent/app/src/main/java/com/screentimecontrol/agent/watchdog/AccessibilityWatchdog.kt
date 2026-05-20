package com.screentimecontrol.agent.watchdog

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.view.accessibility.AccessibilityManager
import com.screentimecontrol.agent.AgentState

class AccessibilityWatchdog(
    private val context: Context,
    private val onDisabled: (Boolean) -> Unit,
) {
    private val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    private val listener = AccessibilityManager.AccessibilityStateChangeListener {
        check()
    }

    fun start() {
        manager.addAccessibilityStateChangeListener(listener)
        check()
    }

    fun stop() {
        manager.removeAccessibilityStateChangeListener(listener)
    }

    private fun check() {
        val enabled = manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK,
        ).any { it.resolveInfo.serviceInfo.packageName == context.packageName }
        AgentState.accessibilityEnabled.set(enabled)
        if (!enabled) {
            onDisabled(true)
        }
    }
}
