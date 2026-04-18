package com.coldtap.hce

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.coldtap.hce.data.MerchantConfig
import com.coldtap.hce.data.MerchantConfigRepository
import com.coldtap.hce.databinding.ActivitySetupBinding
import kotlinx.coroutines.launch

/**
 * First-run configuration. Collects shop name, XRPL destination address, and
 * (optionally) a custom backend URL. Persists to MerchantConfigRepository.
 * Launched by MainActivity when existing config is incomplete; also reachable
 * from Settings for later edits.
 */
class SetupActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySetupBinding
    private lateinit var repo: MerchantConfigRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySetupBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repo = MerchantConfigRepository.get(this)

        lifecycleScope.launch {
            val current = repo.current()
            binding.merchantNameInput.setText(current.merchantName)
            binding.destinationInput.setText(current.destinationAddress)
            binding.baseUrlInput.setText(
                if (current.baseUrl.isBlank()) MerchantConfigRepository.DEFAULT_BASE_URL
                else current.baseUrl,
            )
        }

        binding.saveButton.setOnClickListener { attemptSave() }
    }

    private fun attemptSave() {
        val name = binding.merchantNameInput.text?.toString()?.trim().orEmpty()
        val dest = binding.destinationInput.text?.toString()?.trim().orEmpty()
        val baseUrl = binding.baseUrlInput.text?.toString()?.trim()
            ?.ifBlank { null } ?: MerchantConfigRepository.DEFAULT_BASE_URL

        binding.merchantNameLayout.error = null
        binding.destinationLayout.error = null

        var ok = true
        if (name.isBlank()) {
            binding.merchantNameLayout.error = getString(R.string.setup_error_name)
            ok = false
        }
        if (!Validators.isValidXrplAddress(dest)) {
            binding.destinationLayout.error = getString(R.string.setup_error_address)
            ok = false
        }
        if (!ok) return

        binding.saveButton.isEnabled = false
        lifecycleScope.launch {
            repo.save(
                MerchantConfig(
                    merchantName = name,
                    destinationAddress = dest,
                    baseUrl = baseUrl,
                ),
            )
            val editMode = intent.getBooleanExtra(EXTRA_EDIT_MODE, false)
            if (editMode) {
                finish()
            } else {
                startActivity(
                    Intent(this@SetupActivity, MainActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                )
                finish()
            }
        }
    }

    companion object {
        /** When true, Save returns to the caller (Settings) instead of launching Main. */
        const val EXTRA_EDIT_MODE = "edit_mode"
    }
}
