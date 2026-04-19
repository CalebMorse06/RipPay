package com.coldtap.hce

import android.content.Context
import java.math.BigInteger
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Local per-day transaction counter. Stores today's count + running XRP-drops
 * total in SharedPreferences; auto-resets when the local date changes.
 *
 * Intentionally local, not backend-backed — fast, offline-tolerant, and
 * good enough for the "Today" pill on the Home screen. If we later expose a
 * real merchant history from the backend, this can be replaced or layered.
 */
object DailyStats {

    private const val PREFS = "coldtap_stats"
    private const val KEY_DATE = "date"
    private const val KEY_COUNT = "count"
    private const val KEY_DROPS = "drops_total"

    private fun prefs(ctx: Context) =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun todayKey(): String =
        SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    data class Snapshot(val count: Int, val dropsTotal: BigInteger) {
        val xrpDisplay: String
            get() {
                if (dropsTotal.signum() == 0) return "0"
                val whole = dropsTotal.divide(DROPS_PER_XRP)
                val frac = dropsTotal.mod(DROPS_PER_XRP)
                return if (frac.signum() == 0) whole.toString()
                else "%s.%s".format(whole, frac.toString().padStart(6, '0').trimEnd('0'))
            }

        companion object {
            private val DROPS_PER_XRP = BigInteger.valueOf(1_000_000L)
        }
    }

    fun read(ctx: Context): Snapshot {
        val p = prefs(ctx)
        val storedDate = p.getString(KEY_DATE, null)
        val today = todayKey()
        if (storedDate != today) {
            // Day rolled over; report zero. Reset is deferred until next write
            // to avoid a write on a pure read.
            return Snapshot(0, BigInteger.ZERO)
        }
        val count = p.getInt(KEY_COUNT, 0)
        val drops = BigInteger(p.getString(KEY_DROPS, "0") ?: "0")
        return Snapshot(count, drops)
    }

    fun recordPaid(ctx: Context, amountDrops: String) {
        val add = try {
            BigInteger(amountDrops)
        } catch (_: NumberFormatException) {
            return
        }
        if (add.signum() <= 0) return

        val p = prefs(ctx)
        val today = todayKey()
        val storedDate = p.getString(KEY_DATE, null)
        val nextCount: Int
        val nextDrops: BigInteger
        if (storedDate == today) {
            nextCount = p.getInt(KEY_COUNT, 0) + 1
            val prev = BigInteger(p.getString(KEY_DROPS, "0") ?: "0")
            nextDrops = prev.add(add)
        } else {
            nextCount = 1
            nextDrops = add
        }
        p.edit()
            .putString(KEY_DATE, today)
            .putInt(KEY_COUNT, nextCount)
            .putString(KEY_DROPS, nextDrops.toString())
            .apply()
    }
}
