package com.coldtap.hce.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

data class MerchantConfig(
    val merchantName: String,
    val destinationAddress: String,
    val baseUrl: String,
) {
    val isConfigured: Boolean
        get() = merchantName.isNotBlank() && destinationAddress.isNotBlank()
}

private val Context.merchantConfigStore: DataStore<Preferences> by preferencesDataStore(
    name = "merchant_config",
)

class MerchantConfigRepository(context: Context) {

    private val store = context.applicationContext.merchantConfigStore

    val configFlow: Flow<MerchantConfig> = store.data.map { prefs ->
        MerchantConfig(
            merchantName = prefs[KEY_MERCHANT_NAME].orEmpty(),
            destinationAddress = prefs[KEY_DESTINATION_ADDRESS].orEmpty(),
            baseUrl = prefs[KEY_BASE_URL] ?: DEFAULT_BASE_URL,
        )
    }

    suspend fun current(): MerchantConfig = configFlow.first()

    suspend fun setMerchantName(value: String) {
        store.edit { it[KEY_MERCHANT_NAME] = value.trim() }
    }

    suspend fun setDestinationAddress(value: String) {
        store.edit { it[KEY_DESTINATION_ADDRESS] = value.trim() }
    }

    suspend fun setBaseUrl(value: String) {
        val trimmed = value.trim().ifBlank { DEFAULT_BASE_URL }
        store.edit { it[KEY_BASE_URL] = trimmed }
    }

    suspend fun save(config: MerchantConfig) {
        store.edit {
            it[KEY_MERCHANT_NAME] = config.merchantName.trim()
            it[KEY_DESTINATION_ADDRESS] = config.destinationAddress.trim()
            it[KEY_BASE_URL] = config.baseUrl.trim().ifBlank { DEFAULT_BASE_URL }
        }
    }

    /** True once the user has dismissed the first-launch onboarding pitch. */
    suspend fun isOnboarded(): Boolean = store.data.first()[KEY_ONBOARDED] ?: false

    suspend fun markOnboarded() {
        store.edit { it[KEY_ONBOARDED] = true }
    }

    companion object {
        const val DEFAULT_BASE_URL = "https://coldtap-web.vercel.app"

        private val KEY_MERCHANT_NAME = stringPreferencesKey("merchant_name")
        private val KEY_DESTINATION_ADDRESS = stringPreferencesKey("destination_address")
        private val KEY_BASE_URL = stringPreferencesKey("base_url")
        private val KEY_ONBOARDED = booleanPreferencesKey("onboarded")

        @Volatile
        private var instance: MerchantConfigRepository? = null

        fun get(context: Context): MerchantConfigRepository =
            instance ?: synchronized(this) {
                instance ?: MerchantConfigRepository(context).also { instance = it }
            }
    }
}
