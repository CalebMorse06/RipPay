package com.coldtap.hce

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.setPadding
import androidx.lifecycle.lifecycleScope
import com.coldtap.hce.data.CreateSessionRequest
import com.coldtap.hce.data.MerchantConfig
import com.coldtap.hce.data.MerchantConfigRepository
import com.coldtap.hce.data.SessionApi
import com.coldtap.hce.data.SessionApiFactory
import com.coldtap.hce.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException

/**
 * Home / Charge screen — Square-style POS keypad.
 *
 * Tabs (Keypad / Library / Favourites) are rendered for visual consistency with
 * the reference design; only Keypad is functional today. The amount hero uses
 * cash-register entry (AmountInput, cents-based). "+ Note" opens a dialog to
 * capture the item name which is sent to /api/sessions as itemName.
 *
 * Redirects to SetupActivity on first launch when MerchantConfig is empty.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var repo: MerchantConfigRepository
    private val amount = AmountInput()
    private var note: String = ""
    private var currentConfig: MerchantConfig? = null
    private var api: SessionApi? = null
    private var submitting = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repo = MerchantConfigRepository.get(this)

        wireKeypad()
        binding.settingsButton.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        binding.noteButton.setOnClickListener { showNoteDialog() }
        binding.createButton.setOnClickListener { onCreateTap() }

        refreshAmountUi()
    }

    override fun onResume() {
        super.onResume()
        refreshTodayStats()
        lifecycleScope.launch {
            // First-launch routing: onboarding pitch → setup → home.
            if (!repo.isOnboarded()) {
                startActivity(Intent(this@MainActivity, OnboardingActivity::class.java))
                finish()
                return@launch
            }
            val config = repo.current()
            if (!config.isConfigured) {
                startActivity(Intent(this@MainActivity, SetupActivity::class.java))
                finish()
                return@launch
            }
            currentConfig = config
            api = SessionApiFactory.create(config.baseUrl)
        }
    }

    private fun refreshTodayStats() {
        val snap = DailyStats.read(this)
        binding.todayStats.text = if (snap.count == 0) {
            getString(R.string.home_today_zero)
        } else {
            getString(R.string.home_today_format, snap.count, snap.xrpDisplay)
        }
    }

    private fun wireKeypad() {
        val digitMap = mapOf(
            binding.key0 to '0', binding.key1 to '1', binding.key2 to '2',
            binding.key3 to '3', binding.key4 to '4', binding.key5 to '5',
            binding.key6 to '6', binding.key7 to '7', binding.key8 to '8',
            binding.key9 to '9',
        )
        digitMap.forEach { (view, ch) ->
            view.setOnClickListener { amount.appendDigit(ch); refreshAmountUi() }
        }
        binding.keyBack.setOnClickListener { amount.backspace(); refreshAmountUi() }
        binding.keyClear.setOnClickListener { amount.clear(); refreshAmountUi() }
    }

    private fun refreshAmountUi() {
        binding.amountText.text = amount.display
        val has = amount.hasAmount()
        binding.createButton.isEnabled = has && !submitting
        binding.createButton.text = if (has) {
            getString(R.string.home_charge, amount.display)
        } else {
            getString(R.string.home_charge_zero)
        }
    }

    private fun showNoteDialog() {
        val padding = resources.displayMetrics.density.let { (20 * it).toInt() }
        val input = EditText(this).apply {
            hint = getString(R.string.home_item_hint)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setText(note)
            setSelection(text.length)
            maxLines = 1
        }
        val container = FrameLayout(this).apply {
            setPadding(padding, padding / 2, padding, 0)
            addView(input)
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.home_add_note)
            .setView(container)
            .setPositiveButton(R.string.settings_save) { _, _ ->
                note = input.text.toString().trim()
                updateNoteButtonLabel()
            }
            .setNegativeButton(R.string.tap_cancel, null)
            .show()
    }

    private fun updateNoteButtonLabel() {
        binding.noteButton.text = if (note.isBlank()) getString(R.string.home_add_note) else note
    }

    private fun onCreateTap() {
        val config = currentConfig ?: return
        val client = api ?: return
        val drops = amount.toDropsOrNull() ?: run {
            Toast.makeText(this, R.string.home_error_zero, Toast.LENGTH_SHORT).show()
            return
        }
        // Square-style: "note" doubles as the item name. Default when empty.
        val itemName = note.ifBlank { DEFAULT_ITEM_NAME }

        submitting = true
        refreshAmountUi()
        binding.createButton.alpha = 0.6f

        lifecycleScope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    client.createSession(
                        CreateSessionRequest(
                            merchantName = config.merchantName,
                            itemName = itemName,
                            amountDrops = drops,
                            destinationAddress = config.destinationAddress,
                        ),
                    )
                }
            }
            submitting = false
            binding.createButton.alpha = 1f

            result.onSuccess { session ->
                Payload.writeSessionId(this@MainActivity, session.id)
                val intent = Intent(this@MainActivity, TapReadyActivity::class.java).apply {
                    putExtra(TapReadyActivity.EXTRA_SESSION_ID, session.id)
                    putExtra(TapReadyActivity.EXTRA_AMOUNT_DISPLAY, session.amountDisplay)
                    putExtra(TapReadyActivity.EXTRA_ITEM_NAME, session.itemName)
                    putExtra(TapReadyActivity.EXTRA_DESTINATION, session.destinationAddress)
                }
                startActivity(intent)
                amount.clear()
                note = ""
                updateNoteButtonLabel()
                refreshAmountUi()
            }.onFailure { t ->
                val msg = when (t) {
                    is HttpException -> getString(R.string.home_error_generic)
                    else -> getString(R.string.home_error_network)
                }
                Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                refreshAmountUi()
            }
        }
    }

    companion object {
        private const val DEFAULT_ITEM_NAME = "Sale"
    }
}
