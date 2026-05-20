package com.screentimecontrol.agent.util

import android.view.accessibility.AccessibilityNodeInfo

/** Known address-bar resource IDs; falls back to URL-text heuristic. */
object BrowserUrlExtractor {
    private val urlBarIds = listOf(
        "com.android.chrome:id/url_bar",
        "com.chrome.beta:id/url_bar",
        "com.microsoft.emmx:id/url_bar",
        "org.mozilla.firefox:id/url_bar_title",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
        "org.mozilla.fenix:id/mozac_browser_toolbar_url_view",
    )

    private val urlPattern = Regex("""https?://[^\s]+|www\.[^\s]+""")

    fun extractUrl(root: AccessibilityNodeInfo?, packageName: String): String? {
        if (root == null) return null
        for (id in urlBarIds) {
            val nodes = root.findAccessibilityNodeInfosByViewId(id)
            if (!nodes.isNullOrEmpty()) {
                val text = nodes.first().text?.toString()?.trim()
                nodes.forEach { it.recycle() }
                if (!text.isNullOrBlank()) return normalizeDisplayUrl(text)
            }
        }
        return extractByHeuristic(root)
    }

    private fun extractByHeuristic(node: AccessibilityNodeInfo): String? {
        val text = node.text?.toString()
        if (!text.isNullOrBlank()) {
            urlPattern.find(text)?.value?.let { return normalizeDisplayUrl(it) }
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = extractByHeuristic(child)
            child.recycle()
            if (found != null) return found
        }
        return null
    }

    private fun normalizeDisplayUrl(raw: String): String =
        raw.removePrefix("https://").removePrefix("http://").trim()
}
