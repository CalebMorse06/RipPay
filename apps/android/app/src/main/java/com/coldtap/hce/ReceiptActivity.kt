package com.coldtap.hce

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.coldtap.hce.databinding.ActivityReceiptBinding
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

/**
 * Paid-state receipt screen (dark). Shown by TapReadyActivity once a session
 * reaches PAID. Displays merchant-facing transaction detail, offers a copy on
 * the tx hash, and — when we have a real network — links out to an XRPL
 * explorer so judges can verify the settlement independently.
 *
 * Plays a brief confirmation tone on open.
 */
class ReceiptActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Theme is set in AndroidManifest.xml (Theme.ColdTap.Receipt).
        val binding = ActivityReceiptBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val amount = intent.getStringExtra(EXTRA_AMOUNT_DISPLAY).orEmpty()
        val item = intent.getStringExtra(EXTRA_ITEM_NAME).orEmpty()
        val merchant = intent.getStringExtra(EXTRA_MERCHANT_NAME).orEmpty()
        val destination = intent.getStringExtra(EXTRA_DESTINATION).orEmpty()
        val txHash = intent.getStringExtra(EXTRA_TX_HASH).orEmpty()
        val paidAtIso = intent.getStringExtra(EXTRA_PAID_AT).orEmpty()
        val network = intent.getStringExtra(EXTRA_NETWORK).orEmpty()
        val amountDrops = intent.getStringExtra(EXTRA_AMOUNT_DROPS).orEmpty()

        // Record this payment in the local "Today" counter — drives the Home pill.
        if (amountDrops.isNotBlank()) DailyStats.recordPaid(this, amountDrops)

        binding.amountText.text = getString(R.string.amount_with_xrp, amount)
        binding.merchantText.text = merchant
        binding.itemText.text = item
        binding.destinationText.text = destination
        binding.timestampText.text = formatTimestamp(paidAtIso)

        if (txHash.isNotBlank()) {
            binding.txHashText.text = txHash
            binding.copyHashButton.visibility = View.VISIBLE
            binding.copyHashButton.setOnClickListener { copyToClipboard(txHash) }
        } else {
            binding.txHashText.setText(R.string.receipt_no_hash)
            binding.copyHashButton.visibility = View.GONE
        }

        val explorerUrl = xrplExplorerUrl(network, txHash)
        if (explorerUrl != null) {
            binding.explorerLink.visibility = View.VISIBLE
            binding.explorerLink.setOnClickListener { openUrl(explorerUrl) }
            binding.verifiedBadge.visibility = View.VISIBLE
        } else {
            binding.explorerLink.visibility = View.GONE
            binding.verifiedBadge.visibility = View.GONE
        }

        binding.backButton.setOnClickListener { finish() }
        binding.doneButton.setOnClickListener { finish() }

        playConfirmTone()
    }

    private fun copyToClipboard(text: String) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("tx_hash", text))
        Toast.makeText(this, R.string.receipt_copied, Toast.LENGTH_SHORT).show()
    }

    private fun openUrl(url: String) {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun xrplExplorerUrl(network: String, txHash: String): String? {
        if (txHash.isBlank()) return null
        return when (network) {
            "testnet" -> "https://testnet.xrpl.org/transactions/$txHash"
            "devnet" -> "https://devnet.xrpl.org/transactions/$txHash"
            "mainnet" -> "https://livenet.xrpl.org/transactions/$txHash"
            else -> null // mock / unknown — no explorer
        }
    }

    private fun playConfirmTone() {
        runCatching {
            ToneGenerator(AudioManager.STREAM_MUSIC, 80)
                .startTone(ToneGenerator.TONE_PROP_ACK, 150)
        }
    }

    private fun formatTimestamp(iso: String): String {
        if (iso.isBlank()) return ""
        return try {
            val date = Date.from(Instant.parse(iso))
            SimpleDateFormat("MMM d, yyyy, h:mm a", Locale.getDefault()).format(date)
        } catch (_: Throwable) {
            iso
        }
    }

    companion object {
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_AMOUNT_DISPLAY = "amount_display"
        const val EXTRA_ITEM_NAME = "item_name"
        const val EXTRA_MERCHANT_NAME = "merchant_name"
        const val EXTRA_DESTINATION = "destination"
        const val EXTRA_TX_HASH = "tx_hash"
        const val EXTRA_PAID_AT = "paid_at"
        const val EXTRA_NETWORK = "network"
        const val EXTRA_AMOUNT_DROPS = "amount_drops"
    }
}
