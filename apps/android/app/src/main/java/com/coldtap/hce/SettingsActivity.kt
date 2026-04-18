package com.coldtap.hce

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.coldtap.hce.databinding.ActivitySettingsBinding

/**
 * Thin hub reachable from the Home screen gear icon. Two exits:
 *  - Edit register → SetupActivity in edit mode
 *  - Advanced / debug → DebugActivity (manual HCE fallback, radio status)
 */
class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.editRegisterButton.setOnClickListener {
            startActivity(
                Intent(this, SetupActivity::class.java)
                    .putExtra(SetupActivity.EXTRA_EDIT_MODE, true),
            )
        }
        binding.debugButton.setOnClickListener {
            startActivity(Intent(this, DebugActivity::class.java))
        }
    }
}
