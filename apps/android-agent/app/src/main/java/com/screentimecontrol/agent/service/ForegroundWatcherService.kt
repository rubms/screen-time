package com.screentimecontrol.agent.service

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import com.screentimecontrol.agent.AgentState
import com.screentimecontrol.agent.rules.Activity
import com.screentimecontrol.agent.util.BrowserUrlExtractor
import java.util.concurrent.atomic.AtomicLong

class ForegroundWatcherService : AccessibilityService() {
    private val lastContentEventMs = AtomicLong(0)

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> handleWindow(event)
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                val now = System.currentTimeMillis()
                if (now - lastContentEventMs.get() < 200) return
                lastContentEventMs.set(now)
                handleWindow(event)
            }
        }
    }

    private fun handleWindow(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: return
        val previous = AgentState.lastFocusPackage
        if (previous != pkg) {
            AgentState.lastFocusPackage = pkg
        }

        var url: String? = null
        val source = event.source
        if (source != null) {
            url = BrowserUrlExtractor.extractUrl(source, pkg)
            source.recycle()
        }

        AgentState.currentActivity.set(Activity(app = pkg, url = url))
        AgentState.currentUrl.set(url)
    }

    override fun onInterrupt() = Unit

    override fun onServiceConnected() {
        super.onServiceConnected()
        AgentState.accessibilityEnabled.set(true)
    }

    override fun onDestroy() {
        AgentState.accessibilityEnabled.set(false)
        super.onDestroy()
    }
}
