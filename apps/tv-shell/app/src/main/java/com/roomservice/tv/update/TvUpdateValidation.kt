package com.roomservice.tv.update

import com.roomservice.tv.data.TvUpdateManifest
import java.net.URI

internal const val PRODUCTION_CERTIFICATE_SHA256 =
    "50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904"

internal sealed interface TvUpdateDecision {
    data object NoUpdate : TvUpdateDecision

    data class Available(
        val manifest: TvUpdateManifest,
    ) : TvUpdateDecision

    data class Invalid(
        val reason: String,
    ) : TvUpdateDecision
}

internal fun evaluateTvUpdateManifest(
    manifest: TvUpdateManifest,
    installedPackageName: String,
    installedVersionCode: Int,
): TvUpdateDecision {
    if (!manifest.enabled || manifest.latestVersionCode <= installedVersionCode) {
        return TvUpdateDecision.NoUpdate
    }
    if (manifest.packageName != installedPackageName) {
        return TvUpdateDecision.Invalid("The update package does not match this TV application.")
    }
    if (manifest.latestVersionName.isNullOrBlank()) {
        return TvUpdateDecision.Invalid("The update version name is missing.")
    }
    if (manifest.releaseId.isNullOrBlank()) {
        return TvUpdateDecision.Invalid("The update release identity is missing.")
    }
    val apkUrl = manifest.apkUrl
    if (apkUrl.isNullOrBlank() || !isSafeHttpsUrl(apkUrl)) {
        return TvUpdateDecision.Invalid("The update download URL is not a valid HTTPS URL.")
    }
    if (!isSha256(manifest.sha256)) {
        return TvUpdateDecision.Invalid("The update checksum is missing or invalid.")
    }
    if (!isSha256(manifest.certificateSha256)) {
        return TvUpdateDecision.Invalid("The update signing certificate is missing or invalid.")
    }
    if (!manifest.certificateSha256.equals(PRODUCTION_CERTIFICATE_SHA256, ignoreCase = true)) {
        return TvUpdateDecision.Invalid("The update signing certificate is not the production certificate.")
    }
    return TvUpdateDecision.Available(manifest)
}

private fun isSha256(value: String?): Boolean =
    value?.matches(Regex("^[0-9a-fA-F]{64}$")) == true

private fun isSafeHttpsUrl(value: String): Boolean {
    val parsed = runCatching { URI(value) }.getOrNull() ?: return false
    return parsed.isAbsolute && parsed.scheme.equals("https", ignoreCase = true) &&
        parsed.rawUserInfo.isNullOrBlank() && parsed.host?.isNotBlank() == true &&
        parsed.rawQuery.isNullOrBlank() &&
        parsed.rawFragment.isNullOrBlank()
}
