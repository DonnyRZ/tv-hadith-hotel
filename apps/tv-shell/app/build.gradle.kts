import java.net.URI
import java.util.Locale
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

fun configuredValue(propertyName: String, environmentName: String, fallback: String = ""): String =
    providers.gradleProperty(propertyName)
        .orElse(providers.environmentVariable(environmentName))
        .orElse(fallback)
        .get()
        .trim()

val configuredApiBaseUrl = configuredValue("tvApiBaseUrl", "TV_API_BASE_URL")
    .let { value ->
        when {
            value.isEmpty() -> value
            value.endsWith("/") -> value
            else -> "$value/"
        }
    }

val configuredTvTarget = configuredValue("tvTarget", "TV_TARGET", "physical")
    .lowercase(Locale.ROOT)
    .ifEmpty { "physical" }

fun buildConfigString(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val configuredVersionCode = providers.gradleProperty("tvVersionCode")
    .orElse("1")
    .get()
    .toIntOrNull()
    ?.takeIf { it > 0 }
    ?: throw GradleException("tvVersionCode must be a positive integer")

val configuredVersionName = providers.gradleProperty("tvVersionName")
    .orElse("0.1.0")
    .get()
    .trim()
    .ifEmpty { throw GradleException("tvVersionName must not be empty") }

val signingProperties = Properties()
val signingPropertiesFile = rootProject.file("signing.properties")
if (signingPropertiesFile.isFile) {
    signingPropertiesFile.inputStream().use(signingProperties::load)
}

val signingEnvironmentNames = mapOf(
    "storeFile" to "TV_SIGNING_STORE_FILE",
    "storePassword" to "TV_SIGNING_STORE_PASSWORD",
    "keyAlias" to "TV_SIGNING_KEY_ALIAS",
    "keyPassword" to "TV_SIGNING_KEY_PASSWORD",
)

fun configuredSigningProperty(name: String): String? = signingProperties.getProperty(name)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: signingEnvironmentNames[name]?.let { environmentName ->
        providers.environmentVariable(environmentName).orNull
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
    }

fun requiredSigningProperty(name: String): String = configuredSigningProperty(name)
    ?: throw GradleException(
        "Missing signing property '$name'. Provide ${signingPropertiesFile.absolutePath} " +
            "or the corresponding TV_SIGNING_* environment variable.",
    )

val hasReleaseSigning = signingPropertiesFile.isFile || signingEnvironmentNames.values.any { name ->
    providers.environmentVariable(name).orNull?.trim()?.isNotEmpty() == true
}

android {
    namespace = "com.roomservice.tv"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.roomservice.tv"
        minSdk = 23
        targetSdk = 36
        versionCode = configuredVersionCode
        versionName = configuredVersionName
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", buildConfigString(configuredApiBaseUrl))
        buildConfigField("String", "API_TARGET", buildConfigString(configuredTvTarget))
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(requiredSigningProperty("storeFile"))
                storePassword = requiredSigningProperty("storePassword")
                keyAlias = requiredSigningProperty("keyAlias")
                keyPassword = requiredSigningProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    testOptions {
        animationsDisabled = true
        unitTests.isIncludeAndroidResources = true
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

fun validateApiConfiguration(isRelease: Boolean) {
    if (configuredApiBaseUrl.isBlank()) {
        throw GradleException(
            "TV API URL is required for every build. Pass -PtvApiBaseUrl=<URL>/api/v1/ " +
                "or set TV_API_BASE_URL. Never rely on an implicit emulator URL.",
        )
    }

    if (configuredTvTarget !in setOf("physical", "emulator")) {
        throw GradleException("tvTarget must be either 'physical' or 'emulator'.")
    }

    val apiUri = try {
        URI(configuredApiBaseUrl)
    } catch (exception: Exception) {
        throw GradleException("tvApiBaseUrl must be a valid absolute HTTP(S) URL.", exception)
    }
    val scheme = apiUri.scheme?.lowercase(Locale.ROOT)
    val host = apiUri.host?.lowercase(Locale.ROOT)
    if (!apiUri.isAbsolute || host.isNullOrBlank() || scheme !in setOf("http", "https")) {
        throw GradleException("tvApiBaseUrl must be a valid absolute HTTP(S) URL.")
    }
    if (apiUri.userInfo != null || apiUri.rawQuery != null || apiUri.rawFragment != null) {
        throw GradleException("tvApiBaseUrl must not contain credentials, query parameters, or fragments.")
    }
    if (apiUri.path?.trimEnd('/') != "/api/v1") {
        throw GradleException("tvApiBaseUrl must end with /api/v1/.")
    }

    val emulatorOrLoopbackHost = host in setOf("localhost", "127.0.0.1", "::1", "10.0.2.2", "10.0.3.2")
    if (configuredTvTarget == "physical" && emulatorOrLoopbackHost) {
        throw GradleException(
            "Physical TV builds cannot target $host. Use the laptop LAN IP for a local API " +
                "or an HTTPS deployed API. Use tvTarget=emulator only for an Android emulator.",
        )
    }
    if (isRelease) {
        if (configuredTvTarget != "physical") {
            throw GradleException("Release builds must use tvTarget=physical.")
        }
        if (scheme != "https") {
            throw GradleException("Release builds require an HTTPS tvApiBaseUrl.")
        }
        val isIpv4Literal = host.matches(Regex("^\\d{1,3}(\\.\\d{1,3}){3}$"))
        if (isIpv4Literal || host.endsWith(".local")) {
            throw GradleException("Release builds must target a deployed production hostname, not a laptop/IP/.local host.")
        }
    }
}

fun validateReleaseConfiguration() {
    validateApiConfiguration(isRelease = true)
    if (!hasReleaseSigning) {
        throw GradleException(
            "Release builds must be signed. Provide apps/tv-shell/signing.properties " +
                "or all TV_SIGNING_* environment variables with a real keystore outside source control.",
        )
    }

    val keystore = file(requiredSigningProperty("storeFile"))
    if (!keystore.isFile) {
        throw GradleException("TV release keystore was not found at ${keystore.absolutePath}")
    }
}

tasks.matching { task ->
    task.name in setOf(
        "preDebugBuild",
        "assembleDebug",
        "installDebug",
        "connectedDebugAndroidTest",
        "preReleaseBuild",
        "assembleRelease",
        "bundleRelease",
    )
}.configureEach {
    doFirst {
        if (name.contains("Release", ignoreCase = true)) {
            validateReleaseConfiguration()
        } else {
            validateApiConfiguration(isRelease = false)
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.08.00"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.tv:tv-foundation:1.0.0")
    implementation("androidx.tv:tv-material:1.1.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("androidx.navigation:navigation-compose:2.9.7")
    implementation("androidx.datastore:datastore-preferences:1.1.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation("com.squareup.retrofit2:retrofit:3.0.0")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:3.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.socket:socket.io-client:2.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")

    androidTestImplementation(platform("androidx.compose:compose-bom:2026.08.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
