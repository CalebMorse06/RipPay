package com.coldtap.hce

import java.math.BigInteger

/**
 * Cash-register style amount entry. The internal state is an integer number of
 * cents. Typing "3" when cents=0 produces 3 → displays "0.03"; another "5"
 * produces 35 → "0.35"; another "0" produces 350 → "3.50". Backspace divides
 * by ten; Clear resets to zero.
 *
 * All ColdTap amounts are XRP; we enter them at 2-decimal precision (the
 * natural "cashier" granularity) and convert to drops via × 10,000:
 *   1 XRP = 1_000_000 drops, 1 cent-of-XRP = 10_000 drops.
 */
class AmountInput {

    /** Amount in hundredths of XRP. */
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

    /**
     * Convert to drops as an integer string. Returns null when amount is zero.
     * 1 cent = 10_000 drops; BigInteger avoids any long overflow for absurd inputs.
     */
    fun toDropsOrNull(): String? {
        if (cents <= 0) return null
        return BigInteger.valueOf(cents).multiply(BigInteger.valueOf(DROPS_PER_CENT)).toString()
    }

    companion object {
        private const val MAX_CENTS = 999_999_99L // 999,999.99 XRP
        private const val DROPS_PER_CENT = 10_000L
    }
}
