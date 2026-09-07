package com.roomservice.tv.update

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.roomservice.tv.BuildConfig
import com.roomservice.tv.data.TvApi
import com.roomservice.tv.data.TvUpdateManifest
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

sealed interface TvUpdateState {
    data object Idle : TvUpdateState

    data class Checking(
        val trigger: TvUpdateCheckTrigger,
    ) : TvUpdateState

    data class UpToDate(
        val versionName: String,
    ) : TvUpdateState

    data class Downloading(
        val manifest: TvUpdateManifest,
        val progressPercent: Int,
    ) : TvUpdateState

    data class Ready(
        val manifest: TvUpdateManifest,
        val apkPath: String,
    ) : TvUpdateState

    data class PermissionRequired(
        val manifest: TvUpdateManifest,
        val apkPath: String,
    ) : TvUpdateState

    data object Installing : TvUpdateState

    data class Failed(
        val message: String,
        val mandatory: Boolean = false,
    ) : TvUpdateState
}

internal sealed interface TvUpdateCheckResult {
    data object Skipped : TvUpdateCheckResult
    data object AlreadyRunning : TvUpdateCheckResult
    data object NoUpdate : TvUpdateCheckResult
    data object Prepared : TvUpdateCheckResult
    data class Failed(val retryable: Boolean) : TvUpdateCheckResult
}

class TvUpdateManager(
    context: Context,
    private val api: TvApi,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .followRedirects(false)
        .followSslRedirects(false)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.MINUTES)
        .build(),
    private val packageManager: PackageManager = context.packageManager,
    private val nowMillis: () -> Long = { System.currentTimeMillis() },
) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val checkInFlight = AtomicBoolean(false)
    private val mutableState = MutableStateFlow<TvUpdateState>(TvUpdateState.Idle)
    private var checkJob: Job? = null

    val state: StateFlow<TvUpdateState> = mutableState.asStateFlow()

    fun checkForUpdate(trigger: TvUpdateCheckTrigger = TvUpdateCheckTrigger.BACKGROUND) {
        checkJob = scope.launch {
            val result = checkForUpdateAndAwait(trigger, publishState = true)
            if (result is TvUpdateCheckResult.Failed && result.retryable) {
                TvUpdateWorkScheduler.scheduleRetry(appContext)
            }
        }
    }

    internal suspend fun checkForUpdateAndAwait(
        trigger: TvUpdateCheckTrigger,
        publishState: Boolean,
    ): TvUpdateCheckResult {
        if (checkInFlight.getAndSet(true)) return TvUpdateCheckResult.AlreadyRunning

        val now = nowMillis()
        val hasPreparedUpdate = !preferences.getString(KEY_PENDING_APK_PATH, null).isNullOrBlank()
        val force = trigger.isForced()
        if (!hasPreparedUpdate && shouldSkipTvUpdateCheck(
                force = force,
                nowMillis = now,
                lastSuccessfulCheckAt = preferences.getLong(KEY_LAST_CHECK_AT, 0L),
                lastAttemptAt = preferences.getLong(KEY_LAST_ATTEMPT_AT, 0L),
            )
        ) {
            checkInFlight.set(false)
            return TvUpdateCheckResult.Skipped
        }

        preferences.edit().putLong(KEY_LAST_ATTEMPT_AT, now).apply()
        if (publishState) mutableState.value = TvUpdateState.Checking(trigger)

        return try {
            if (!force && restorePreparedUpdate(
                    publishState = publishState,
                    allowDismissed = trigger == TvUpdateCheckTrigger.MANUAL ||
                        trigger == TvUpdateCheckTrigger.RETRY,
                )
            ) {
                markSuccessfulCheck()
                TvUpdateCheckResult.Prepared
            } else {
                val manifest = api.getUpdateManifest()
                when (val decision = evaluateTvUpdateManifest(
                    manifest = manifest,
                    installedPackageName = appContext.packageName,
                    installedVersionCode = BuildConfig.VERSION_CODE,
                )) {
                    TvUpdateDecision.NoUpdate -> {
                        clearPreparedUpdate()
                        if (publishState) {
                            mutableState.value = if (trigger == TvUpdateCheckTrigger.MANUAL) {
                                TvUpdateState.UpToDate(BuildConfig.VERSION_NAME)
                            } else {
                                TvUpdateState.Idle
                            }
                        }
                        markSuccessfulCheck()
                        TvUpdateCheckResult.NoUpdate
                    }
                    is TvUpdateDecision.Invalid -> {
                        if (publishState && trigger == TvUpdateCheckTrigger.MANUAL) {
                            mutableState.value = TvUpdateState.Failed(decision.reason)
                        } else if (publishState) {
                            mutableState.value = TvUpdateState.Idle
                        }
                        markSuccessfulCheck()
                        TvUpdateCheckResult.Failed(retryable = false)
                    }
                    is TvUpdateDecision.Available -> {
                        if (isDismissed(decision.manifest) && trigger.shouldRespectDismissedRelease()) {
                            if (publishState) {
                                mutableState.value = TvUpdateState.Idle
                            }
                            markSuccessfulCheck()
                            TvUpdateCheckResult.NoUpdate
                        } else if (downloadAndPrepare(decision.manifest, publishState)) {
                            markSuccessfulCheck()
                            TvUpdateCheckResult.Prepared
                        } else {
                            TvUpdateCheckResult.Failed(retryable = true)
                        }
                    }
                }
            }
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            // Update discovery must never block pairing or guest service use.
            if (force && restorePreparedUpdate(
                    publishState = publishState,
                    allowDismissed = trigger == TvUpdateCheckTrigger.MANUAL ||
                        trigger == TvUpdateCheckTrigger.RETRY,
                )
            ) {
                return TvUpdateCheckResult.Prepared
            }
            if (publishState && trigger == TvUpdateCheckTrigger.MANUAL) {
                mutableState.value = TvUpdateState.Failed(
                    message = exception.message ?: "The update check could not be completed.",
                )
            } else if (publishState) {
                mutableState.value = TvUpdateState.Idle
            }
            TvUpdateCheckResult.Failed(retryable = true)
        } finally {
            checkInFlight.set(false)
        }
    }

    @Suppress("DEPRECATION")
    fun installPreparedUpdate() {
        val current = when (val state = mutableState.value) {
            is TvUpdateState.Ready -> state
            is TvUpdateState.PermissionRequired -> TvUpdateState.Ready(
                manifest = state.manifest,
                apkPath = state.apkPath,
            )
            else -> return
        }
        val apk = File(current.apkPath)
        if (!apk.isFile) {
            mutableState.value = TvUpdateState.Failed(
                message = "The prepared update is no longer available.",
                mandatory = current.manifest.mandatory,
            )
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
            mutableState.value = TvUpdateState.PermissionRequired(
                manifest = current.manifest,
                apkPath = apk.absolutePath,
            )
            return
        }

        try {
            val uri = FileProvider.getUriForFile(
                appContext,
                "${appContext.packageName}.fileprovider",
                apk,
            )
            val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                data = uri
                type = APK_MIME_TYPE
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            mutableState.value = TvUpdateState.Installing
            appContext.startActivity(installIntent)
        } catch (_: Exception) {
            mutableState.value = TvUpdateState.Failed(
                message = "Android could not open the update installer.",
                mandatory = current.manifest.mandatory,
            )
        }
    }

    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls()) {
            installPreparedUpdate()
            return
        }
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${appContext.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { appContext.startActivity(intent) }
            .onFailure {
                appContext.startActivity(
                    Intent(Settings.ACTION_SECURITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }
    }

    fun retry() {
        preferences.edit().remove(KEY_DISMISSED_RELEASE_ID).apply()
        mutableState.value = TvUpdateState.Idle
        checkForUpdate(TvUpdateCheckTrigger.RETRY)
    }

    fun dismiss() {
        val current = mutableState.value
        if (current is TvUpdateState.Failed && current.mandatory) return
        if (current is TvUpdateState.Ready && current.manifest.mandatory) return
        if (current is TvUpdateState.PermissionRequired && current.manifest.mandatory) return
        when (current) {
            is TvUpdateState.Ready -> preferences.edit()
                .putString(KEY_DISMISSED_RELEASE_ID, current.manifest.releaseId)
                .apply()
            is TvUpdateState.PermissionRequired -> preferences.edit()
                .putString(KEY_DISMISSED_RELEASE_ID, current.manifest.releaseId)
                .apply()
            else -> Unit
        }
        mutableState.value = TvUpdateState.Idle
    }

    fun close() {
        checkJob?.cancel()
        scope.coroutineContext[Job]?.cancel()
    }

    private suspend fun downloadAndPrepare(
        manifest: TvUpdateManifest,
        publishState: Boolean,
    ): Boolean {
        if (publishState) mutableState.value = TvUpdateState.Downloading(manifest, 0)
        try {
            val apk = withContext(Dispatchers.IO) {
                downloadOrReuse(manifest, publishState)
            }
            persistPreparedUpdate(manifest, apk)
            if (publishState) {
                mutableState.value = TvUpdateState.Ready(
                    manifest = manifest,
                    apkPath = apk.absolutePath,
                )
            }
            return true
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            if (publishState) {
                mutableState.value = TvUpdateState.Failed(
                    message = exception.message ?: "The update could not be prepared.",
                    mandatory = manifest.mandatory,
                )
            }
            return false
        }
    }

    private fun markSuccessfulCheck() {
        preferences.edit()
            .putLong(KEY_LAST_CHECK_AT, nowMillis())
            .remove(KEY_LAST_ATTEMPT_AT)
            .apply()
    }

    private fun isDismissed(manifest: TvUpdateManifest): Boolean =
        !manifest.mandatory &&
            manifest.releaseId != null &&
            preferences.getString(KEY_DISMISSED_RELEASE_ID, null) == manifest.releaseId

    private fun persistPreparedUpdate(manifest: TvUpdateManifest, apk: File) {
        preferences.edit()
            .putInt(KEY_PENDING_VERSION_CODE, manifest.latestVersionCode)
            .putString(KEY_PENDING_VERSION_NAME, manifest.latestVersionName)
            .putString(KEY_PENDING_APK_URL, manifest.apkUrl)
            .putString(KEY_PENDING_SHA256, manifest.sha256)
            .putString(KEY_PENDING_CERTIFICATE_SHA256, manifest.certificateSha256)
            .putString(KEY_PENDING_RELEASE_ID, manifest.releaseId)
            .putBoolean(KEY_PENDING_MANDATORY, manifest.mandatory)
            .putInt(KEY_PENDING_MIN_SUPPORTED_VERSION_CODE, manifest.minSupportedVersionCode ?: -1)
            .putString(KEY_PENDING_APK_PATH, apk.absolutePath)
            .apply()
    }

    private suspend fun restorePreparedUpdate(
        publishState: Boolean,
        allowDismissed: Boolean,
    ): Boolean = withContext(Dispatchers.IO) {
        val versionCode = preferences.getInt(KEY_PENDING_VERSION_CODE, 0)
        if (versionCode <= BuildConfig.VERSION_CODE) {
            clearPreparedUpdate()
            return@withContext false
        }
        val apkPath = preferences.getString(KEY_PENDING_APK_PATH, null)
        val manifest = TvUpdateManifest(
            enabled = true,
            packageName = appContext.packageName,
            latestVersionCode = versionCode,
            latestVersionName = preferences.getString(KEY_PENDING_VERSION_NAME, null),
            apkUrl = preferences.getString(KEY_PENDING_APK_URL, null),
            sha256 = preferences.getString(KEY_PENDING_SHA256, null),
            certificateSha256 = preferences.getString(KEY_PENDING_CERTIFICATE_SHA256, null),
            releaseId = preferences.getString(KEY_PENDING_RELEASE_ID, null),
            mandatory = preferences.getBoolean(KEY_PENDING_MANDATORY, false),
            minSupportedVersionCode = preferences.getInt(KEY_PENDING_MIN_SUPPORTED_VERSION_CODE, -1)
                .takeIf { it >= 0 },
        )
        val apk = apkPath?.let(::File)
        val apkIsValid = apk != null && verifyDownloadedApk(apk, manifest)
        if (apk == null || !apkIsValid) {
            if (apk != null && apk.isFile && !apkIsValid) apk.delete()
            clearPreparedUpdate()
            return@withContext false
        }
        if (isDismissed(manifest) && !allowDismissed) return@withContext false
        if (publishState) mutableState.value = TvUpdateState.Ready(manifest, apk.absolutePath)
        true
    }

    private fun clearPreparedUpdate() {
        val pendingPath = preferences.getString(KEY_PENDING_APK_PATH, null)
        pendingPath?.let { path ->
            val file = File(path)
            val legacyDirectory = File(appContext.cacheDir, UPDATES_DIRECTORY)
            if (file.isFile && (file.parentFile == updatesDirectory() || file.parentFile == legacyDirectory)) {
                file.delete()
            }
        }
        preferences.edit()
            .remove(KEY_PENDING_VERSION_CODE)
            .remove(KEY_PENDING_VERSION_NAME)
            .remove(KEY_PENDING_APK_URL)
            .remove(KEY_PENDING_SHA256)
            .remove(KEY_PENDING_CERTIFICATE_SHA256)
            .remove(KEY_PENDING_RELEASE_ID)
            .remove(KEY_PENDING_MANDATORY)
            .remove(KEY_PENDING_MIN_SUPPORTED_VERSION_CODE)
            .remove(KEY_PENDING_APK_PATH)
            .apply()
    }

    private suspend fun downloadOrReuse(manifest: TvUpdateManifest, publishState: Boolean): File {
        val directory = updatesDirectory().apply {
            check(mkdirs() || isDirectory) { "The update storage could not be created." }
        }
        val digest = requireNotNull(manifest.sha256).lowercase(Locale.ROOT)
        val finalFile = File(directory, "egi-tv-${manifest.latestVersionCode}-$digest.apk")
        if (finalFile.isFile && verifyDownloadedApk(finalFile, manifest)) return finalFile
        finalFile.delete()

        val temporaryFile = File(directory, "${finalFile.name}.part")
        var lastFailure: Exception? = null
        repeat(MAX_DOWNLOAD_ATTEMPTS) { attempt ->
            try {
                downloadAttempt(manifest, temporaryFile, directory, publishState)
                if (!verifyDownloadedApk(temporaryFile, manifest)) {
                    temporaryFile.delete()
                    throw NonRetryableUpdateException(
                        "The downloaded update failed integrity or signing verification.",
                    )
                }
                check(temporaryFile.renameTo(finalFile)) {
                    "The verified update could not be staged."
                }
                return finalFile
            } catch (exception: CancellationException) {
                throw exception
            } catch (exception: NonRetryableUpdateException) {
                throw exception
            } catch (exception: Exception) {
                lastFailure = exception
                if (attempt + 1 < MAX_DOWNLOAD_ATTEMPTS) {
                    delay(DOWNLOAD_RETRY_DELAYS_MS[attempt])
                }
            }
        }
        lastFailure?.let { throw it }
            ?: throw IOException("The update download did not complete.")
    }

    private fun downloadAttempt(
        manifest: TvUpdateManifest,
        temporaryFile: File,
        directory: File,
        publishState: Boolean,
    ) {
        var existingBytes = temporaryFile.length().coerceAtLeast(0L)
        if (existingBytes > MAX_APK_BYTES) {
            temporaryFile.delete()
            existingBytes = 0L
        }

        val requestBuilder = Request.Builder()
            .url(requireNotNull(manifest.apkUrl))
            .header("Cache-Control", "no-cache")
            .header("Pragma", "no-cache")
            .get()
        if (existingBytes > 0L) requestBuilder.header("Range", "bytes=$existingBytes-")

        httpClient.newCall(requestBuilder.build()).execute().use { response ->
            if (response.code == 416 && existingBytes > 0L) {
                temporaryFile.delete()
                throw IOException("The update range was rejected; restarting the download.")
            }
            if (!response.isSuccessful) {
                val retryable = response.code == 408 || response.code == 429 || response.code >= 500
                if (retryable) throw IOException("The update server returned HTTP ${response.code}.")
                throw NonRetryableUpdateException("The update server returned HTTP ${response.code}.")
            }

            val body = response.body
                ?: throw NonRetryableUpdateException("The update response was empty.")
            val range = parseTvUpdateContentRange(response.header("Content-Range"))
            val append = if (response.code == 206) {
                if (range?.start != existingBytes) {
                    temporaryFile.delete()
                    throw IOException("The update server returned an invalid resume range.")
                }
                true
            } else {
                false
            }
            val startOffset = if (append) existingBytes else 0L
            if (!append && existingBytes > 0L) temporaryFile.delete()

            val bodyLength = body.contentLength()
            val totalLength = when {
                range?.total != null -> range.total
                bodyLength >= 0L -> startOffset + bodyLength
                else -> null
            }
            if (totalLength != null && totalLength > MAX_APK_BYTES) {
                throw NonRetryableUpdateException("The update file is too large.")
            }
            val requiredBytes = totalLength?.minus(startOffset)?.coerceAtLeast(0L) ?: 0L
            checkUsableStorage(directory, requiredBytes)

            var downloaded = startOffset
            body.byteStream().use { input ->
                FileOutputStream(temporaryFile, append).use { output ->
                    val buffer = ByteArray(DOWNLOAD_BUFFER_BYTES)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        downloaded += read
                        if (downloaded > MAX_APK_BYTES ||
                            (totalLength != null && downloaded > totalLength)
                        ) {
                            throw NonRetryableUpdateException("The update file is too large.")
                        }
                        output.write(buffer, 0, read)
                        checkUsableStorage(directory, MIN_STORAGE_HEADROOM_BYTES)
                        val progress = if (totalLength != null && totalLength > 0L) {
                            ((downloaded * 100L) / totalLength).toInt().coerceIn(0, 99)
                        } else {
                            0
                        }
                        if (publishState) {
                            mutableState.value = TvUpdateState.Downloading(manifest, progress)
                        }
                    }
                }
            }
            if (totalLength != null && downloaded != totalLength) {
                throw IOException("The update download ended before the complete file was received.")
            }
        }
    }

    private fun checkUsableStorage(directory: File, requiredBytes: Long) {
        if (directory.usableSpace < requiredBytes + MIN_STORAGE_HEADROOM_BYTES) {
            throw NonRetryableUpdateException(
                "Not enough TV storage is available for the update.",
            )
        }
    }

    private fun updatesDirectory(): File = File(appContext.filesDir, UPDATES_DIRECTORY)

    private fun verifyDownloadedApk(file: File, manifest: TvUpdateManifest): Boolean {
        if (!file.isFile || file.length() <= 0L || file.length() > MAX_APK_BYTES) return false
        val expectedHash = manifest.sha256?.lowercase(Locale.ROOT) ?: return false
        if (sha256(file) != expectedHash) return false

        val packageInfo = readArchivePackageInfo(file) ?: return false
        if (packageInfo.packageName != appContext.packageName) return false
        val archiveVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            packageInfo.versionCode.toLong()
        }
        if (archiveVersionCode != manifest.latestVersionCode.toLong() ||
            archiveVersionCode <= BuildConfig.VERSION_CODE.toLong()) {
            return false
        }
        val expectedCertificate = manifest.certificateSha256?.lowercase(Locale.ROOT) ?: return false
        return archiveCertificateSha256(packageInfo) == expectedCertificate
    }

    @Suppress("DEPRECATION")
    private fun readArchivePackageInfo(file: File): PackageInfo? {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            PackageManager.GET_SIGNATURES
        }
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageArchiveInfo(
                file.absolutePath,
                PackageManager.PackageInfoFlags.of(flags.toLong()),
            )
        } else {
            packageManager.getPackageArchiveInfo(file.absolutePath, flags)
        }
    }

    @Suppress("DEPRECATION")
    private fun archiveCertificateSha256(packageInfo: PackageInfo): String? {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.signingInfo?.apkContentsSigners
        } else {
            packageInfo.signatures
        }
        return signatures?.firstOrNull()?.toByteArray()?.let(::sha256)
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(DOWNLOAD_BUFFER_BYTES)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

    private companion object {
        const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        const val DOWNLOAD_BUFFER_BYTES = 32 * 1_024
        const val MAX_APK_BYTES = 250L * 1_024L * 1_024L
        const val MIN_STORAGE_HEADROOM_BYTES = 16L * 1_024L * 1_024L
        const val MAX_DOWNLOAD_ATTEMPTS = 3
        val DOWNLOAD_RETRY_DELAYS_MS = longArrayOf(2_000L, 5_000L)
        const val KEY_LAST_CHECK_AT = "last_check_at"
        const val KEY_LAST_ATTEMPT_AT = "last_attempt_at"
        const val KEY_DISMISSED_RELEASE_ID = "dismissed_release_id"
        const val KEY_PENDING_VERSION_CODE = "pending_version_code"
        const val KEY_PENDING_VERSION_NAME = "pending_version_name"
        const val KEY_PENDING_APK_URL = "pending_apk_url"
        const val KEY_PENDING_SHA256 = "pending_sha256"
        const val KEY_PENDING_CERTIFICATE_SHA256 = "pending_certificate_sha256"
        const val KEY_PENDING_RELEASE_ID = "pending_release_id"
        const val KEY_PENDING_MANDATORY = "pending_mandatory"
        const val KEY_PENDING_MIN_SUPPORTED_VERSION_CODE = "pending_min_supported_version_code"
        const val KEY_PENDING_APK_PATH = "pending_apk_path"
        const val PREFERENCES_NAME = "tv_updates"
        const val UPDATES_DIRECTORY = "updates"
    }
}

private class NonRetryableUpdateException(message: String) : IOException(message)
