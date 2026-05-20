package com.screentimecontrol.agent.enforcement

import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.screentimecontrol.agent.AgentState
import com.screentimecontrol.agent.rules.Decision

class WarningController(private val context: Context) {
    private var graceEndMs: Long = 0
    private var graceTargetId: String? = null

    fun onDecision(decision: Decision, targetId: String, displayName: String, graceSeconds: Int) {
        when (decision) {
            is Decision.Warn -> {
                if (!AgentState.warnedTargetsToday.contains(targetId)) {
                    AgentState.warnedTargetsToday.add(targetId)
                    Toast.makeText(
                        context,
                        decision.reason,
                        Toast.LENGTH_SHORT,
                    ).show()
                }
                graceTargetId = targetId
                graceEndMs = System.currentTimeMillis() + graceSeconds * 1000L
            }
            is Decision.OutOfTime, Decision.OutsideSchedule -> {
                val now = System.currentTimeMillis()
                if (now < graceEndMs && graceTargetId == targetId) {
                    return
                }
                if (System.currentTimeMillis() < AgentState.reblockUntilMs) {
                    showLockout("Time is up on $displayName")
                    return
                }
                graceTargetId = targetId
                graceEndMs = System.currentTimeMillis() + graceSeconds * 1000L
                LockoutActivity.showGrace(context, displayName, graceSeconds)
            }
            is Decision.Blocked -> {
                sendHomeAndLockout("Blocked: $displayName")
            }
            else -> {
                graceEndMs = 0
                graceTargetId = null
            }
        }
    }

    fun tickEnforcement(decision: Decision, targetId: String, displayName: String) {
        if (decision !is Decision.OutOfTime && decision !is Decision.OutsideSchedule && decision !is Decision.Blocked) {
            return
        }
        val now = System.currentTimeMillis()
        if (graceTargetId == targetId && now < graceEndMs) return
        if (now < AgentState.reblockUntilMs) {
            showLockout("Time is up on $displayName")
            return
        }
        sendHomeAndLockout(displayName)
        AgentState.reblockUntilMs = now + 60_000
    }

    private fun sendHomeAndLockout(message: String) {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(home)
        showLockout(message)
    }

    private fun showLockout(message: String) {
        AgentState.lockoutMessage.set(message)
        LockoutActivity.showLockout(context, message)
    }
}
