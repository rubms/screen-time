package com.screentimecontrol.agent.pairing

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.lifecycleScope
import com.screentimecontrol.agent.R
import com.screentimecontrol.agent.admin.TamperDeviceAdmin
import com.screentimecontrol.agent.data.prefs.AgentPrefs
import com.screentimecontrol.agent.service.EnforcementService
import com.screentimecontrol.agent.sync.FirestoreSync
import com.screentimecontrol.agent.data.LocalStateStore
import kotlinx.coroutines.launch

class PairingActivity : AppCompatActivity() {
    private lateinit var prefs: AgentPrefs
    private lateinit var sync: FirestoreSync
    private val adminComponent by lazy { ComponentName(this, TamperDeviceAdmin::class.java) }

    private val accessibilityLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { updateUi() }

    private val overlayLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { updateUi() }

    private val adminLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { updateUi() }

    private val batteryLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { updateUi() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = AgentPrefs(this)
        sync = FirestoreSync(this, prefs, LocalStateStore(this))

        if (prefs.paired) {
            EnforcementService.start(this)
            finish()
            return
        }

        setContentView(R.layout.activity_pairing)
        findViewById<Button>(R.id.btnAccessibility).setOnClickListener {
            accessibilityLauncher.launch(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        findViewById<Button>(R.id.btnOverlay).setOnClickListener {
            overlayLauncher.launch(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName"),
                ),
            )
        }
        findViewById<Button>(R.id.btnBattery).setOnClickListener {
            batteryLauncher.launch(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                },
            )
        }
        findViewById<Button>(R.id.btnDeviceAdmin).setOnClickListener {
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    getString(R.string.device_admin_explanation),
                )
            }
            adminLauncher.launch(intent)
        }
        findViewById<Button>(R.id.btnNotifications).setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
            }
            updateUi()
        }
        findViewById<Button>(R.id.btnPair).setOnClickListener { redeemCode() }
        updateUi()
    }

    override fun onResume() {
        super.onResume()
        updateUi()
    }

    private fun updateUi() {
        val status = findViewById<TextView>(R.id.permissionStatus)
        status.text = buildString {
            appendLine("Accessibility: ${if (isAccessibilityEnabled()) "✓" else "✗"}")
            appendLine("Overlay: ${if (Settings.canDrawOverlays(this@PairingActivity)) "✓" else "✗"}")
            appendLine("Device Admin: ${if (isDeviceAdminActive()) "✓" else "✗"}")
            appendLine(
                "Notifications: ${
                    if (Build.VERSION.SDK_INT < 33 ||
                        NotificationManagerCompat.from(this@PairingActivity).areNotificationsEnabled()
                    ) {
                        "✓"
                    } else {
                        "✗"
                    }
                }",
            )
        }
        findViewById<Button>(R.id.btnPair).isEnabled = allPermissionsGranted()
    }

    private fun allPermissionsGranted(): Boolean =
        isAccessibilityEnabled() &&
            Settings.canDrawOverlays(this) &&
            isDeviceAdminActive() &&
            (Build.VERSION.SDK_INT < 33 ||
                NotificationManagerCompat.from(this).areNotificationsEnabled())

    private fun isAccessibilityEnabled(): Boolean {
        val am = getSystemService(ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabled = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
        return enabled.any { it.resolveInfo.serviceInfo.packageName == packageName }
    }

    private fun isDeviceAdminActive(): Boolean {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isAdminActive(adminComponent)
    }

    private fun redeemCode() {
        val code = findViewById<EditText>(R.id.pairingCode).text.toString().trim()
        if (code.length != 6) {
            Toast.makeText(this, R.string.pairing_code_invalid, Toast.LENGTH_SHORT).show()
            return
        }
        val name = findViewById<EditText>(R.id.deviceName).text.toString().trim()
            .ifBlank { "Android ${Build.MODEL}" }

        lifecycleScope.launch {
            try {
                sync.redeemPairingCode(code, name)
                sync.startListeners()
                EnforcementService.start(this@PairingActivity)
                Toast.makeText(this@PairingActivity, R.string.pairing_success, Toast.LENGTH_LONG).show()
                finish()
            } catch (e: Exception) {
                Toast.makeText(
                    this@PairingActivity,
                    getString(R.string.pairing_failed, e.message ?: "error"),
                    Toast.LENGTH_LONG,
                ).show()
            }
        }
    }
}
