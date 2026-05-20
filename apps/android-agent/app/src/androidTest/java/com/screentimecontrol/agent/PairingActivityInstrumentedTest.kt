package com.screentimecontrol.agent

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.ActivityTestRule
import com.screentimecontrol.agent.pairing.PairingActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumentation smoke tests — run with `./gradlew connectedCheck` on an emulator.
 */
@RunWith(AndroidJUnit4::class)
class PairingActivityInstrumentedTest {
    @get:Rule
    val activityRule = ActivityTestRule(PairingActivity::class.java, true, false)

    @Test
    fun pairingActivityLaunches() {
        val activity = activityRule.launchActivity(null)
        assert(activity != null)
        activity.finish()
    }
}
