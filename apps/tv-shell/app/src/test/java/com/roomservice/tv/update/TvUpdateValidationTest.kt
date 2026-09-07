package com.roomservice.tv.update

import com.roomservice.tv.data.TvUpdateManifest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TvUpdateValidationTest {
    @Test
    fun `disabled manifest never triggers a download`() {
        val result = evaluateTvUpdateManifest(
            manifest = TvUpdateManifest(),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )

        assertEquals(TvUpdateDecision.NoUpdate, result)
    }

    @Test
    fun `new signed release with stable package is accepted`() {
        val result = evaluateTvUpdateManifest(
            manifest = validManifest(),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )

        assertTrue(result is TvUpdateDecision.Available)
    }

    @Test
    fun `same or lower version is never installed`() {
        val result = evaluateTvUpdateManifest(
            manifest = validManifest().copy(latestVersionCode = 10),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )

        assertEquals(TvUpdateDecision.NoUpdate, result)
    }

    @Test
    fun `wrong package and non HTTPS URL are rejected`() {
        val wrongPackage = evaluateTvUpdateManifest(
            manifest = validManifest().copy(packageName = "com.roomservice.tv.debug"),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )
        val wrongUrl = evaluateTvUpdateManifest(
            manifest = validManifest().copy(apkUrl = "http://updates.example.com/app.apk"),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )

        assertTrue(wrongPackage is TvUpdateDecision.Invalid)
        assertTrue(wrongUrl is TvUpdateDecision.Invalid)
    }

    @Test
    fun `temporary query string URL and missing release identity are rejected`() {
        val temporaryUrl = evaluateTvUpdateManifest(
            manifest = validManifest().copy(apkUrl = "https://updates.example.com/app.apk?token=temporary"),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )
        val missingRelease = evaluateTvUpdateManifest(
            manifest = validManifest().copy(releaseId = null),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 10,
        )

        assertTrue(temporaryUrl is TvUpdateDecision.Invalid)
        assertTrue(missingRelease is TvUpdateDecision.Invalid)
    }

    @Test
    fun `new release remains available even when installed version is the previous release`() {
        val result = evaluateTvUpdateManifest(
            manifest = validManifest().copy(latestVersionCode = 16, latestVersionName = "0.4.11"),
            installedPackageName = "com.roomservice.tv",
            installedVersionCode = 15,
        )

        assertTrue(result is TvUpdateDecision.Available)
    }

    private fun validManifest(): TvUpdateManifest = TvUpdateManifest(
        enabled = true,
        packageName = "com.roomservice.tv",
        latestVersionCode = 11,
        latestVersionName = "0.4.7",
        apkUrl = "https://updates.example.com/egi-tv/11/app-release.apk",
        sha256 = "a".repeat(64),
        certificateSha256 = PRODUCTION_CERTIFICATE_SHA256,
        releaseId = "tv-0.4.7",
    )
}
