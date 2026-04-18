package com.coldtap.hce.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class SessionStatus {
    CREATED,
    AWAITING_BUYER,
    AWAITING_SIGNATURE,
    SUBMITTED,
    VALIDATING,
    PAID,
    FAILED,
    EXPIRED,
    ;

    val isTerminal: Boolean
        get() = this == PAID || this == FAILED || this == EXPIRED
}

@Serializable
enum class NetworkId {
    @SerialName("mock") MOCK,
    @SerialName("testnet") TESTNET,
    @SerialName("mainnet") MAINNET,
}

@Serializable
data class Session(
    val id: String,
    val merchantName: String,
    val itemName: String,
    val amountDrops: String,
    val amountDisplay: String,
    val currency: String = "XRP",
    val destinationAddress: String,
    val memo: String? = null,
    val status: SessionStatus,
    val txHash: String? = null,
    val network: NetworkId,
    val failureReason: String? = null,
    val expiresAt: String,
    val createdAt: String,
    val updatedAt: String,
    val paidAt: String? = null,
    val failedAt: String? = null,
    val expiredAt: String? = null,
)

@Serializable
data class CreateSessionRequest(
    val merchantName: String,
    val itemName: String,
    val amountDrops: String,
    val destinationAddress: String,
    val memo: String? = null,
    val expiresInSec: Int? = null,
)

@Serializable
data class ApiError(
    val error: String,
    val issues: List<ValidationIssue>? = null,
)

@Serializable
data class ValidationIssue(
    val code: String? = null,
    val message: String,
    val path: List<String>? = null,
)
