package com.coldtap.hce

import android.content.Context

/**
 * ColdTap NFC handoff — APDU byte-level helpers and session-id persistence.
 *
 * Protocol summary (see apps/android/README.md for the full contract):
 *
 *   AID           F0 43 4F 4C 44 54 41 50               ("F0" + ASCII "COLDTAP")
 *   SELECT APDU   00 A4 04 00 08 <AID> 00               (iPhone -> Android)
 *   RESPONSE OK   <UTF-8 "SESSION:<id>"> 90 00          (Android -> iPhone)
 *   RESPONSE NONE 6F 00                                 (AID matched, no payload set)
 *   RESPONSE NOAID 6A 82                                (APDU not our SELECT)
 *
 * The HostApduService does not keep state across invocations; it re-reads the
 * session id from SharedPreferences on every SELECT. That way the UI and the
 * service can live in different process contexts without any IPC.
 */
object Payload {

    const val AID_HEX = "F0434F4C44544150"

    /** The SELECT-by-DF-name APDU bytes that the iPhone sends. */
    val SELECT_APDU_PREFIX: ByteArray = byteArrayOf(
        0x00, 0xA4.toByte(), 0x04, 0x00, 0x08,
        0xF0.toByte(), 0x43, 0x4F, 0x4C, 0x44, 0x54, 0x41, 0x50,
    )

    val STATUS_OK: ByteArray = byteArrayOf(0x90.toByte(), 0x00)
    val STATUS_NO_PAYLOAD: ByteArray = byteArrayOf(0x6F.toByte(), 0x00)
    val STATUS_AID_NOT_FOUND: ByteArray = byteArrayOf(0x6A.toByte(), 0x82.toByte())

    private const val PREFS_NAME = "coldtap"
    private const val KEY_SESSION_ID = "session_id"
    const val SESSION_ID_PREFIX = "s_"
    const val PAYLOAD_PREFIX = "SESSION:"

    /**
     * True when the first 13 bytes of the incoming APDU match our SELECT prefix.
     * The trailing Le byte is ignored since it is reader-chosen (usually 0x00).
     */
    fun matchesSelect(apdu: ByteArray?): Boolean {
        if (apdu == null || apdu.size < SELECT_APDU_PREFIX.size) return false
        for (i in SELECT_APDU_PREFIX.indices) {
            if (apdu[i] != SELECT_APDU_PREFIX[i]) return false
        }
        return true
    }

    /** `SESSION:<id>` UTF-8 bytes followed by the 9000 status word. */
    fun buildSuccessResponse(sessionId: String): ByteArray {
        val payload = (PAYLOAD_PREFIX + sessionId).toByteArray(Charsets.UTF_8)
        return payload + STATUS_OK
    }

    fun prefsFor(ctx: Context) = ctx.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE,
    )

    fun readSessionId(ctx: Context): String? {
        val s = prefsFor(ctx).getString(KEY_SESSION_ID, null)
        return if (s.isNullOrBlank()) null else s
    }

    fun writeSessionId(ctx: Context, sessionId: String?) {
        val edit = prefsFor(ctx).edit()
        if (sessionId.isNullOrBlank()) edit.remove(KEY_SESSION_ID) else edit.putString(KEY_SESSION_ID, sessionId)
        edit.apply()
    }

    fun isLikelySessionId(raw: String): Boolean {
        val trimmed = raw.trim()
        return trimmed.startsWith(SESSION_ID_PREFIX) && trimmed.length in 3..64 &&
            trimmed.all { it.isLetterOrDigit() || it == '_' || it == '-' }
    }
}
