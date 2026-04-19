package com.coldtap.hce

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.coldtap.hce.data.MerchantConfigRepository
import com.coldtap.hce.databinding.ActivitySettingsBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * Settings hub. Shows merchant config (read-only), live backend reachability,
 * brand + version, and routes into Edit register / Advanced debug.
 */
class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.backButton.setOnClickListener { finish() }

        binding.editRegisterButton.setOnClickListener {
            startActivity(
                Intent(this, SetupActivity::class.java)
                    .putExtra(SetupActivity.EXTRA_EDIT_MODE, true),
            )
        }
        binding.debugButton.setOnClickListener {
            startActivity(Intent(this, DebugActivity::class.java))
        }

        binding.versionText.text = getString(R.string.settings_version_format, appVersion())
    }

    override fun onResume() {
        super.onResume()
        loadConfig()
    }

    private fun loadConfig() {
        val repo = MerchantConfigRepository.get(this)
        lifecycleScope.launch {
            val config = repo.current()
            binding.shopNameText.text = config.merchantName.ifBlank { "—" }
            binding.destinationText.text = config.destinationAddress.ifBlank { "—" }
            binding.baseUrlText.text = config.baseUrl

            binding.copyDestinationButton.setOnClickListener {
                if (config.destinationAddress.isNotBlank()) {
                    copy(config.destinationAddress, "destination_address")
                }
            }

            // Ping the backend for a live indicator.
            pingBackend(config.baseUrl)
        }
    }

    private fun pingBackend(baseUrl: String) {
        binding.networkStatusText.setText(R.string.settings_network_checking)
        binding.networkDot.backgroundTintList =
            ContextCompat.getColorStateList(this, R.color.text_tertiary)
        lifecycleScope.launch {
            val ok = runCatching {
                withContext(Dispatchers.IO) {
                    val conn = (URL(baseUrl.trimEnd('/') + "/").openConnection() as HttpURLConnection).apply {
                        connectTimeout = 10_000
                        readTimeout = 10_000
                        requestMethod = "GET"
                        instanceFollowRedirects = true
                        setRequestProperty("User-Agent", "RipPay/Android")
                    }
                    val code = conn.responseCode
                    conn.disconnect()
                    code in 200..399
                }
            }.getOrDefault(false)

            if (ok) {
                binding.networkStatusText.setText(R.string.settings_network_live)
                binding.networkDot.backgroundTintList =
                    ContextCompat.getColorStateList(this@SettingsActivity, R.color.success)
            } else {
                binding.networkStatusText.setText(R.string.settings_network_offline)
                binding.networkDot.backgroundTintList =
                    ContextCompat.getColorStateList(this@SettingsActivity, R.color.danger)
            }
        }
    }

    private fun copy(text: String, label: String) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText(label, text))
        Toast.makeText(this, R.string.settings_copied, Toast.LENGTH_SHORT).show()
    }

    private fun appVersion(): String =
        try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "?"
        } catch (_: PackageManager.NameNotFoundException) {
            "?"
        }
}
