package com.screentimecontrol.agent.enforcement

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.screentimecontrol.agent.AgentState
import com.screentimecontrol.agent.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class LockoutActivity : AppCompatActivity() {
    private var countdownJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )
        setContentView(R.layout.activity_lockout)

        val message = intent.getStringExtra(EXTRA_MESSAGE)
            ?: AgentState.lockoutMessage.get()
            ?: getString(R.string.lockout_default)
        findViewById<TextView>(R.id.lockoutMessage).text = message

        val graceSeconds = intent.getIntExtra(EXTRA_GRACE_SECONDS, 0)
        if (graceSeconds > 0) {
            val countdown = findViewById<TextView>(R.id.lockoutCountdown)
            countdownJob = CoroutineScope(Dispatchers.Main).launch {
                var left = graceSeconds
                while (isActive && left > 0) {
                    countdown.text = getString(R.string.lockout_countdown, left)
                    delay(1000)
                    left--
                }
                countdown.text = ""
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (AgentState.accessibilityEnabled.get() &&
            AgentState.lastDecisionKind.get() in listOf("ALLOWED", "LIMITED_OK")
        ) {
            finish()
        }
    }

    override fun onDestroy() {
        countdownJob?.cancel()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_MESSAGE = "message"
        private const val EXTRA_GRACE_SECONDS = "grace_seconds"

        fun showLockout(context: Context, message: String) {
            val intent = Intent(context, LockoutActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_MESSAGE, message)
            context.startActivity(intent)
        }

        fun showGrace(context: Context, displayName: String, graceSeconds: Int) {
            val intent = Intent(context, LockoutActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(EXTRA_MESSAGE, "Time ending on $displayName")
                .putExtra(EXTRA_GRACE_SECONDS, graceSeconds)
            context.startActivity(intent)
        }
    }
}
