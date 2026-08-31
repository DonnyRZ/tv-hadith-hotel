package com.roomservice.tv.data

import android.content.Context
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.coroutines.flow.first

private val Context.tvDeviceDataStore by preferencesDataStore(name = "room-service-tv-device")
private val tvLanguageKey = stringPreferencesKey("language")

interface DeviceCredentialStore {
    suspend fun getInstallationId(): String
    suspend fun getCredential(): String?
    suspend fun saveCredential(credential: String)
    suspend fun clearCredential()
}

interface TvLanguageStore {
    suspend fun getLanguage(): TvLanguage
    suspend fun saveLanguage(language: TvLanguage)
}

class AndroidDeviceCredentialStore(
    private val context: Context,
) : DeviceCredentialStore {
    override suspend fun getInstallationId(): String {
        val preferences = context.tvDeviceDataStore.data.first()
        val existing = preferences[INSTALLATION_ID_KEY]
        if (existing != null) {
            return existing
        }

        val generated = UUID.randomUUID().toString()
        context.tvDeviceDataStore.edit { mutablePreferences ->
            if (mutablePreferences[INSTALLATION_ID_KEY] == null) {
                mutablePreferences[INSTALLATION_ID_KEY] = generated
            }
        }

        return context.tvDeviceDataStore.data.first()[INSTALLATION_ID_KEY] ?: generated
    }

    override suspend fun getCredential(): String? {
        val encrypted = context.tvDeviceDataStore.data.first()[CREDENTIAL_KEY] ?: return null
        return decrypt(encrypted)
    }

    override suspend fun saveCredential(credential: String) {
        context.tvDeviceDataStore.edit { mutablePreferences ->
            mutablePreferences[CREDENTIAL_KEY] = encrypt(credential)
        }
    }

    override suspend fun clearCredential() {
        context.tvDeviceDataStore.edit { mutablePreferences ->
            mutablePreferences.remove(CREDENTIAL_KEY)
        }
    }

    private fun encrypt(value: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val payload = cipher.iv + encrypted
        return Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    private fun decrypt(value: String): String {
        val payload = Base64.decode(value, Base64.NO_WRAP)
        require(payload.size > IV_LENGTH_BYTES) { "Stored TV credential is invalid" }
        val iv = payload.copyOfRange(0, IV_LENGTH_BYTES)
        val encrypted = payload.copyOfRange(IV_LENGTH_BYTES, payload.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(TAG_LENGTH_BITS, iv))
        return cipher.doFinal(encrypted).toString(Charsets.UTF_8)
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        val existing = keyStore.getKey(KEY_ALIAS, null)
        if (existing is SecretKey) {
            return existing
        }

        val generator = KeyGenerator.getInstance(KeyPropertiesAlgorithm, ANDROID_KEY_STORE)
        generator.init(
            android.security.keystore.KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or
                    android.security.keystore.KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val KEY_ALIAS = "room-service-tv-credential"
        const val KeyPropertiesAlgorithm = "AES"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH_BYTES = 12
        const val TAG_LENGTH_BITS = 128
        val INSTALLATION_ID_KEY = stringPreferencesKey("installation_id")
        val CREDENTIAL_KEY = stringPreferencesKey("credential")
    }
}

class AndroidTvLanguageStore(
    private val context: Context,
) : TvLanguageStore {
    override suspend fun getLanguage(): TvLanguage {
        val value = context.tvDeviceDataStore.data.first()[tvLanguageKey]
        return TvLanguage.entries.firstOrNull { language -> language.tag == value } ?: TvLanguage.UZ
    }

    override suspend fun saveLanguage(language: TvLanguage) {
        context.tvDeviceDataStore.edit { mutablePreferences ->
            mutablePreferences[tvLanguageKey] = language.tag
        }
    }
}
