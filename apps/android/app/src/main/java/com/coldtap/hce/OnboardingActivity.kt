package com.coldtap.hce

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.coldtap.hce.data.MerchantConfigRepository
import com.coldtap.hce.databinding.ActivityOnboardingBinding
import kotlinx.coroutines.launch

/**
 * First-launch pitch screen. Shown once, then never again — gated by a
 * boolean flag in the merchant DataStore (`isOnboarded` / `markOnboarded`).
 *
 * The pitch sells the product before extracting any setup info from the user.
 * Tapping "Get started" marks onboarded and routes to SetupActivity (which
 * collects the actual merchant config).
 */
class OnboardingActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityOnboardingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val repo = MerchantConfigRepository.get(this)

        binding.getStartedButton.setOnClickListener {
            lifecycleScope.launch {
                repo.markOnboarded()
                startActivity(Intent(this@OnboardingActivity, SetupActivity::class.java))
                finish()
            }
        }
    }
}
