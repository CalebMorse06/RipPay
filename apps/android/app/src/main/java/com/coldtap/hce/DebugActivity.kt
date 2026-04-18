package com.coldtap.hce

import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.coldtap.hce.databinding.ActivityDebugBinding

/**
 * Manual HCE fallback / diagnostic screen. Lets the operator paste or type a
 * session id directly and reports NFC + HCE radio status. Kept as a debug
 * escape hatch when the normal Home → Create payment flow can't reach the
 * backend (e.g. no internet) but the tap itself still needs to work.
 *
 * Reachable from Settings → Advanced / debug.
 */
class DebugActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDebugBinding
    private val hceComponent by lazy { ComponentName(this, ColdTapApduService::class.java) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDebugBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.setButton.setOnClickListener { setPayloadFromInput() }
        binding.pasteButton.setOnClickListener { pasteFromClipboard() }
        binding.clearButton.setOnClickListener { clearPayload() }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        pinPreferredHceService(true)
        refresh()
    }

    override fun onPause() {
        super.onPause()
        pinPreferredHceService(false)
    }

    private fun pinPreferredHceService(pin: Boolean) {
        val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
        val cardEmu = runCatching { CardEmulation.getInstance(adapter) }.getOrNull() ?: return
        runCatching {
            if (pin) cardEmu.setPreferredService(this, hceComponent)
            else cardEmu.unsetPreferredService(this)
        }
    }

    private fun refresh() {
        val adapter = NfcAdapter.getDefaultAdapter(this)
        val hasHce = packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)
        val sessionId = Payload.readSessionId(this)

        binding.nfcValue.text = when {
            adapter == null -> getString(R.string.nfc_unsupported)
            !adapter.isEnabled -> getString(R.string.nfc_disabled)
            else -> getString(R.string.nfc_enabled)
        }
        binding.hceValue.text = if (hasHce) getString(R.string.hce_supported) else getString(R.string.hce_unsupported)
        binding.payloadValue.text = sessionId?.let { "${Payload.PAYLOAD_PREFIX}$it" }
            ?: getString(R.string.payload_none)

        val ready = sessionId != null && adapter?.isEnabled == true && hasHce
        binding.stateValue.setText(if (ready) R.string.state_ready else R.string.state_not_ready)
        binding.stateValue.setTextColor(
            ContextCompat.getColor(
                this,
                if (ready) R.color.ready_green else R.color.not_ready_red,
            ),
        )

        if (binding.sessionInput.text.toString() != (sessionId ?: "")) {
            binding.sessionInput.setText(sessionId ?: "")
            binding.sessionInput.setSelection(binding.sessionInput.text.length)
        }
    }

    private fun setPayloadFromInput() {
        val raw = binding.sessionInput.text.toString().trim()
        if (!Payload.isLikelySessionId(raw)) {
            toast(R.string.toast_invalid)
            return
        }
        Payload.writeSessionId(this, raw)
        toast(R.string.toast_set)
        refresh()
    }

    private fun pasteFromClipboard() {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val raw = cm.primaryClip?.getItemAt(0)?.text?.toString()?.trim().orEmpty()
        if (raw.isEmpty()) {
            toast(R.string.toast_clipboard_empty)
            return
        }
        val sessionId = raw.removePrefix(Payload.PAYLOAD_PREFIX).trim()
        if (!Payload.isLikelySessionId(sessionId)) {
            toast(R.string.toast_invalid)
            return
        }
        binding.sessionInput.setText(sessionId)
        Payload.writeSessionId(this, sessionId)
        toast(R.string.toast_set)
        refresh()
    }

    private fun clearPayload() {
        Payload.writeSessionId(this, null)
        binding.sessionInput.setText("")
        toast(R.string.toast_cleared)
        refresh()
    }

    private fun toast(resId: Int) {
        Toast.makeText(this, resId, Toast.LENGTH_SHORT).show()
    }
}
