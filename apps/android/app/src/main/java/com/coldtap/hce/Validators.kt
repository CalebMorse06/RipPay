package com.coldtap.hce

object Validators {
    private val R_ADDRESS_REGEX = Regex("^r[1-9A-HJ-NP-Za-km-z]{24,34}$")

    fun isValidXrplAddress(raw: String): Boolean = R_ADDRESS_REGEX.matches(raw.trim())
}
