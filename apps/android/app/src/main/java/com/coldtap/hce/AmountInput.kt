package com.coldtap.hce

import java.math.BigInteger

/**
 * Cash-register style amount entry. The internal state is an integer number of
 * hundredths — unit-agnostic. The caller decides whether to interpret the
 * display as dollars or as XRP:
 *   - USD mode: `toUsdDecimalStringOrNull()` → "3.50" (dollars, sent as fiatAmount)
 *   - XRP mode: `toDropsOrNull()` → "35000000" (hundredths × 10_000 = drops)
 *
 * Typing "3" when cents=0 produces 3 → displays "0.03"; another "5" produces
 * 35 → "0.35"; another "0" produces 350 → "3.50". Backspace divides by ten;
 * Clear resets to zero.
 */
class AmountInput {

    /** Amount in hundredths. Interpreted as US cents or as hundredths-of-XRP by the caller. */
    private var cents: Long = 0

    /** Human display, always two decimal places, e.g. "0.00", "3.50", "125.00". */
    val display: String
        get() {
            val whole = cents / 100
            val frac = (cents % 100).toInt()
            return "%d.%02d".format(whole, frac)
        }

    fun hasAmount(): Boolean = cents > 0

    fun appendDigit(d: Char) {
        require(d in '0'..'9')
        val digit = d - '0'
        val next = cents * 10 + digit
        if (next > MAX_CENTS) return
        cents = next
    }

    fun backspace() {
        cents /= 10
    }

    fun clear() {
        cents = 0
    }

    /** Return the decimal display ("3.50") when non-zero, else null. */
    fun toUsdDecimalStringOrNull(): String? {
        if (cents <= 0) return null
        return display
    }

    /**
     * Return drops as an integer string when interpreting the input as XRP
     * (hundredths-of-XRP × 10_000). Null when zero.
     */
    fun toDropsOrNull(): String? {
        if (cents <= 0) return null
        return BigInteger.valueOf(cents).multiply(BigInteger.valueOf(DROPS_PER_CENT)).toString()
    }

    companion object {
        private const val MAX_CENTS = 999_999_99L // $999,999.99 or 999,999.99 XRP
        private const val DROPS_PER_CENT = 10_000L
    }
}
