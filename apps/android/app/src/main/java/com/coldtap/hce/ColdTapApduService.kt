// Note: the Kotlin package name `com.coldtap.hce` is retained from an earlier
// iteration; the product is branded RipPay. Renaming would invalidate signing
// identity and break merchants who already have the app installed, so we keep
// the internal name.

package com.coldtap.hce

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log

/**
 * NFC Host Card Emulation endpoint. The Android system binds this service when
 * a reader (the buyer's iPhone) selects our AID (F0434F4C44544150) against the
 * device. We answer with the current session id — or a 6F00 if none is set —
 * and return to an idle state. Stateless; no pending state across selects.
 *
 * Routing: this service uses `aid-group` category "other", so it receives the
 * APDU only when ColdTap is either the foregrounded activity OR explicitly set
 * as the preferred HCE service. See apps/android/README.md §routing.
 */
class ColdTapApduService : HostApduService() {

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        Log.d(TAG, "APDU in: ${commandApdu?.toHexString() ?: "<null>"}")

        if (!Payload.matchesSelect(commandApdu)) {
            Log.d(TAG, "APDU did not match our SELECT; returning 6A82")
            return Payload.STATUS_AID_NOT_FOUND
        }

        val sessionId = Payload.readSessionId(this)
        if (sessionId == null) {
            Log.w(TAG, "SELECT matched but no session id is set; returning 6F00")
            return Payload.STATUS_NO_PAYLOAD
        }

        val response = Payload.buildSuccessResponse(sessionId)
        Log.i(TAG, "SELECT matched; sending SESSION:$sessionId (${response.size} bytes)")
        TapEventBus.emit(TapEvent.ApduDispatched(sessionId))
        return response
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "onDeactivated reason=$reason")
        TapEventBus.emit(TapEvent.FieldLost)
    }

    private fun ByteArray.toHexString(): String =
        joinToString(separator = " ") { String.format("%02X", it) }

    companion object {
        private const val TAG = "ColdTapHCE"
    }
}
