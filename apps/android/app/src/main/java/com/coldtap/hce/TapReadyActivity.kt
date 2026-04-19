package com.coldtap.hce

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.util.Log
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.LayoutInflater
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.coldtap.hce.data.MerchantConfigRepository
import com.coldtap.hce.data.Session
import com.coldtap.hce.data.SessionApi
import com.coldtap.hce.data.SessionApiFactory
import com.coldtap.hce.data.SessionStatus
import com.coldtap.hce.databinding.ActivityTapReadyBinding
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Tap-to-Pay screen. Shows the buyer-facing tap prompt (big outlined card with
 * a contactless wave), polls session status, and hands off to ReceiptActivity
 * once the session reaches PAID.
 *
 * NFC routing — while this activity is resumed we pin ColdTapApduService as
 * the preferred HCE service via CardEmulation.setPreferredService. That is
 * more robust than relying on Android's implicit foreground-app routing rule
 * for proprietary (category="other") AIDs.
 *
 * Tap feedback — subscribes to TapEventBus so the moment the HCE service
 * dispatches a SELECT response (ApduDispatched), we vibrate + optimistically
 * advance the UI to the signing state, even before the backend's status flips.
 */
class TapReadyActivity : AppCompatActivity() {

    private lateinit var binding: ActivityTapReadyBinding
    private lateinit var sessionId: String
    private lateinit var amountDisplay: String
    private lateinit var itemName: String
    private lateinit var destination: String
    private var baseUrl: String = MerchantConfigRepository.DEFAULT_BASE_URL
    private var api: SessionApi? = null
    private var pulseAnim: AnimatorSet? = null
    private var lastStatus: SessionStatus? = null
    private var handedOffToReceipt = false
    private var qrDialog: AlertDialog? = null

    private val hceComponent by lazy {
        ComponentName(this, ColdTapApduService::class.java)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTapReadyBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionId = intent.getStringExtra(EXTRA_SESSION_ID).orEmpty()
        if (sessionId.isBlank()) {
            finish()
            return
        }
        amountDisplay = intent.getStringExtra(EXTRA_AMOUNT_DISPLAY).orEmpty()
        itemName = intent.getStringExtra(EXTRA_ITEM_NAME).orEmpty()
        destination = intent.getStringExtra(EXTRA_DESTINATION).orEmpty()

        binding.amountText.text = amountDisplay
        binding.itemText.text = itemName

        binding.backButton.setOnClickListener { finish() }
        binding.primaryButton.setOnClickListener { finish() }
        binding.showQrText.setOnClickListener { showQrFallbackDialog() }

        applyStatus(SessionStatus.AWAITING_BUYER)

        lifecycleScope.launch {
            baseUrl = MerchantConfigRepository.get(this@TapReadyActivity).current().baseUrl
            api = SessionApiFactory.create(baseUrl)
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                runPollingLoop()
            }
        }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                TapEventBus.events.collect { event ->
                    if (event is TapEvent.ApduDispatched && event.sessionId == sessionId) {
                        onTapDispatched()
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        pinPreferredHceService(true)
    }

    override fun onPause() {
        super.onPause()
        pinPreferredHceService(false)
        qrDialog?.dismiss()
        qrDialog = null
    }

    override fun onStart() {
        super.onStart()
        if (lastStatus == SessionStatus.AWAITING_BUYER || lastStatus == SessionStatus.CREATED) {
            startPulse()
        }
    }

    override fun onStop() {
        super.onStop()
        stopPulse()
    }

    override fun finish() {
        if (!handedOffToReceipt) {
            Payload.writeSessionId(this, null)
        }
        super.finish()
    }

    /**
     * Pin (or release) ColdTapApduService as the preferred HCE target for our
     * AID. Called on resume/pause so routing is reliable only while this
     * screen is actually on top — other screens shouldn't hijack proprietary
     * taps.
     */
    private fun pinPreferredHceService(pin: Boolean) {
        val adapter = NfcAdapter.getDefaultAdapter(this) ?: return
        val cardEmu = runCatching { CardEmulation.getInstance(adapter) }.getOrNull() ?: return
        runCatching {
            if (pin) cardEmu.setPreferredService(this, hceComponent)
            else cardEmu.unsetPreferredService(this)
        }
    }

    private fun onTapDispatched() {
        vibrateSoft()
        // Optimistic: flip to signing visual even before backend confirms.
        if (lastStatus == SessionStatus.AWAITING_BUYER ||
            lastStatus == SessionStatus.CREATED ||
            lastStatus == null
        ) {
            lastStatus = SessionStatus.AWAITING_SIGNATURE
            applyStatus(SessionStatus.AWAITING_SIGNATURE)
        }
    }

    private fun vibrateSoft() {
        @Suppress("DEPRECATION")
        val vibrator: Vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(45L, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(45L)
        }
    }

    private suspend fun runPollingLoop() {
        while (true) {
            val client = api
            if (client == null) {
                delay(250)
                continue
            }
            try {
                val session = withContext(Dispatchers.IO) { client.getSession(sessionId) }
                setLiveDotOk(true)
                onSessionUpdate(session)
                if (session.status.isTerminal) return
            } catch (ce: CancellationException) {
                throw ce
            } catch (t: Throwable) {
                Log.w(TAG, "Session poll failed", t)
                setLiveDotOk(false)
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    private fun setLiveDotOk(ok: Boolean) {
        val tintRes = if (ok) R.color.success else R.color.danger
        val labelRes = if (ok) R.string.live_label_ok else R.string.live_label_offline
        binding.liveDot.backgroundTintList = ContextCompat.getColorStateList(this, tintRes)
        binding.liveLabel.setText(labelRes)
    }

    private fun showQrFallbackDialog() {
        val payUrl = "${baseUrl.trimEnd('/')}/s/$sessionId"
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_qr_fallback, null, false)
        val img = view.findViewById<ImageView>(R.id.qrImage)
        val urlText = view.findViewById<TextView>(R.id.qrUrlText)
        val closeBtn = view.findViewById<MaterialButton>(R.id.qrCloseButton)

        urlText.text = payUrl
        try {
            img.setImageBitmap(QrGen.generate(payUrl, sizePx = 600))
        } catch (_: Throwable) {
            urlText.text = payUrl  // fall back to visible URL if QR gen fails
        }

        qrDialog = AlertDialog.Builder(this)
            .setView(view)
            .setOnDismissListener { qrDialog = null }
            .create()
            .also { dialog ->
                closeBtn.setOnClickListener { dialog.dismiss() }
                dialog.show()
            }
    }

    private fun onSessionUpdate(session: Session) {
        if (session.status == lastStatus) return
        lastStatus = session.status

        if (session.status == SessionStatus.PAID) {
            handedOffToReceipt = true
            stopPulse()
            val networkWire = when (session.network) {
                com.coldtap.hce.data.NetworkId.TESTNET -> "testnet"
                com.coldtap.hce.data.NetworkId.MAINNET -> "mainnet"
                com.coldtap.hce.data.NetworkId.MOCK -> "mock"
            }
            val intent = Intent(this, ReceiptActivity::class.java).apply {
                putExtra(ReceiptActivity.EXTRA_SESSION_ID, session.id)
                putExtra(ReceiptActivity.EXTRA_AMOUNT_DISPLAY, session.amountDisplay)
                putExtra(ReceiptActivity.EXTRA_ITEM_NAME, session.itemName)
                putExtra(ReceiptActivity.EXTRA_MERCHANT_NAME, session.merchantName)
                putExtra(ReceiptActivity.EXTRA_DESTINATION, session.destinationAddress)
                putExtra(ReceiptActivity.EXTRA_TX_HASH, session.txHash.orEmpty())
                putExtra(ReceiptActivity.EXTRA_PAID_AT, session.paidAt ?: session.updatedAt)
                putExtra(ReceiptActivity.EXTRA_NETWORK, networkWire)
            }
            Payload.writeSessionId(this, null)
            startActivity(intent)
            finish()
            return
        }

        applyStatus(session.status, session.failureReason)
    }

    private fun applyStatus(status: SessionStatus, failureReason: String? = null) {
        binding.contactlessIcon.visibility = View.GONE
        binding.spinner.visibility = View.GONE
        binding.errorView.visibility = View.GONE
        binding.cardHintText.visibility = View.GONE

        when (status) {
            SessionStatus.CREATED, SessionStatus.AWAITING_BUYER -> {
                binding.contactlessIcon.visibility = View.VISIBLE
                binding.cardHintText.visibility = View.VISIBLE
                binding.statusText.setText(R.string.tap_ready_title)
                binding.primaryButton.setText(R.string.tap_cancel)
                binding.primaryButton.isEnabled = true
                startPulse()
            }
            SessionStatus.AWAITING_SIGNATURE -> {
                binding.spinner.visibility = View.VISIBLE
                binding.statusText.setText(R.string.status_awaiting_signature)
                binding.primaryButton.setText(R.string.tap_cancel)
                binding.primaryButton.isEnabled = true
                stopPulse()
            }
            SessionStatus.SUBMITTED -> {
                binding.spinner.visibility = View.VISIBLE
                binding.statusText.setText(R.string.status_submitted)
                binding.primaryButton.setText(R.string.tap_cancel)
                binding.primaryButton.isEnabled = false
                stopPulse()
            }
            SessionStatus.VALIDATING -> {
                binding.spinner.visibility = View.VISIBLE
                binding.statusText.setText(R.string.status_validating)
                binding.primaryButton.setText(R.string.tap_cancel)
                binding.primaryButton.isEnabled = false
                stopPulse()
            }
            SessionStatus.PAID -> {
                // Handled by onSessionUpdate.
            }
            SessionStatus.FAILED -> {
                binding.errorView.visibility = View.VISIBLE
                binding.statusText.text = buildString {
                    append(getString(R.string.status_failed))
                    if (!failureReason.isNullOrBlank()) append(" · ").append(failureReason)
                }
                binding.primaryButton.setText(R.string.tap_retry)
                binding.primaryButton.isEnabled = true
                stopPulse()
            }
            SessionStatus.EXPIRED -> {
                binding.errorView.visibility = View.VISIBLE
                binding.statusText.setText(R.string.status_expired)
                binding.primaryButton.setText(R.string.tap_retry)
                binding.primaryButton.isEnabled = true
                stopPulse()
            }
        }
    }

    private fun startPulse() {
        if (pulseAnim?.isRunning == true) return
        val view = binding.contactlessIcon
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 0.94f, 1.04f).apply {
            duration = 1200
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
        }
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 0.94f, 1.04f).apply {
            duration = 1200
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
        }
        val alpha = ObjectAnimator.ofFloat(view, "alpha", 0.75f, 1f).apply {
            duration = 1200
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
        }
        pulseAnim = AnimatorSet().apply {
            interpolator = AccelerateDecelerateInterpolator()
            playTogether(scaleX, scaleY, alpha)
            start()
        }
    }

    private fun stopPulse() {
        pulseAnim?.cancel()
        pulseAnim = null
        binding.contactlessIcon.scaleX = 1f
        binding.contactlessIcon.scaleY = 1f
        binding.contactlessIcon.alpha = 1f
    }

    companion object {
        const val EXTRA_SESSION_ID = "session_id"
        const val EXTRA_AMOUNT_DISPLAY = "amount_display"
        const val EXTRA_ITEM_NAME = "item_name"
        const val EXTRA_DESTINATION = "destination"
        private const val POLL_INTERVAL_MS = 1500L
        private const val TAG = "TapReadyActivity"
    }
}
