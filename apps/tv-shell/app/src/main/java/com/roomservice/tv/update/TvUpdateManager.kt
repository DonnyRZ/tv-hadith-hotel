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
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request

sealed interface TvUpdateState {
    data object Idle : TvUpdateState

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

class TvUpdateManager(
    context: Context,
    private val api: TvApi,
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .followRedirects(false)
        .followSslRedirects(false)
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

    @Synchronized
    fun checkForUpdate(force: Boolean = false) {
        if (checkInFlight.getAndSet(true)) return
        val lastCheckAt = preferences.getLong(KEY_LAST_CHECK_AT, 0L)
        if (!force && nowMillis() - lastCheckAt < CHECK_INTERVAL_MS) {
            checkInFlight.set(false)
            return
        }
        preferences.edit().putLong(KEY_LAST_CHECK_AT, nowMillis()).apply()
        checkJob = scope.launch {
            try {
                val manifest = api.getUpdateManifest()
                when (val decision = evaluateTvUpdateManifest(
                    manifest = manifest,
                    installedPackageName = appContext.packageName,
                    installedVersionCode = BuildConfig.VERSION_CODE,
                )) {
                    TvUpdateDecision.NoUpdate -> mutableState.value = TvUpdateState.Idle
                    is TvUpdateDecision.Invalid -> mutableState.value = TvUpdateState.Idle
                    is TvUpdateDecision.Available -> downloadAndPrepare(decision.manifest)
                }
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                // Update discovery must never block pairing or guest service use.
                mutableState.value = TvUpdateState.Idle
            } finally {
                checkInFlight.set(false)
            }
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
        mutableState.value = TvUpdateState.Idle
        checkForUpdate(force = true)
    }

    fun dismiss() {
        val current = mutableState.value
        if (current is TvUpdateState.Failed && current.mandatory) return
        if (current is TvUpdateState.Ready && current.manifest.mandatory) return
        if (current is TvUpdateState.PermissionRequired && current.manifest.mandatory) return
        mutableState.value = TvUpdateState.Idle
    }

    fun close() {
        checkJob?.cancel()
        scope.coroutineContext[Job]?.cancel()
    }

    private suspend fun downloadAndPrepare(manifest: TvUpdateManifest) {
        mutableState.value = TvUpdateState.Downloading(manifest, 0)
        try {
            val apk = withContext(Dispatchers.IO) { downloadOrReuse(manifest) }
            mutableState.value = TvUpdateState.Ready(
                manifest = manifest,
                apkPath = apk.absolutePath,
            )
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            mutableState.value = TvUpdateState.Failed(
                message = exception.message ?: "The update could not be prepared.",
                mandatory = manifest.mandatory,
            )
        }
    }

    private fun downloadOrReuse(manifest: TvUpdateManifest): File {
        val directory = File(appContext.cacheDir, UPDATES_DIRECTORY).apply {
            check(mkdirs() || isDirectory) { "The update cache could not be created." }
        }
        val digest = requireNotNull(manifest.sha256).lowercase(Locale.ROOT)
        val finalFile = File(directory, "egi-tv-${manifest.latestVersionCode}-$digest.apk")
        if (finalFile.isFile && verifyDownloadedApk(finalFile, manifest)) return finalFile
        finalFile.delete()

        val temporaryFile = File(directory, "${finalFile.name}.part")
        temporaryFile.delete()
        val request = Request.Builder()
            .url(requireNotNull(manifest.apkUrl))
            .get()
            .build()
        httpClient.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "The update server returned HTTP ${response.code}." }
            val body = response.body ?: error("The update response was empty.")
            val declaredLength = body.contentLength()
            check(declaredLength <= MAX_APK_BYTES) { "The update file is too large." }
            var downloaded = 0L
            body.byteStream().use { input ->
                FileOutputStream(temporaryFile).use { output ->
                    val buffer = ByteArray(DOWNLOAD_BUFFER_BYTES)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        downloaded += read
                        check(downloaded <= MAX_APK_BYTES) { "The update file is too large." }
                        output.write(buffer, 0, read)
                        val progress = if (declaredLength > 0) {
                            ((downloaded * 100L) / declaredLength).toInt().coerceIn(0, 99)
                        } else {
                            0
                        }
                        mutableState.value = TvUpdateState.Downloading(manifest, progress)
                    }
                }
            }
        }

        check(verifyDownloadedApk(temporaryFile, manifest)) {
            temporaryFile.delete()
            "The downloaded update failed integrity or signing verification."
        }
        check(temporaryFile.renameTo(finalFile)) { "The verified update could not be staged." }
        return finalFile
    }

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
        const val CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000L
        const val DOWNLOAD_BUFFER_BYTES = 32 * 1_024
        const val MAX_APK_BYTES = 250L * 1_024L * 1_024L
        const val KEY_LAST_CHECK_AT = "last_check_at"
        const val PREFERENCES_NAME = "tv_updates"
        const val UPDATES_DIRECTORY = "updates"
    }
}
