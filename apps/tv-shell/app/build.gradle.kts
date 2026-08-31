import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val configuredApiBaseUrl = providers.gradleProperty("tvApiBaseUrl")
    .orElse("http://10.0.2.2:3000/api/v1/")
    .get()
    .let { if (it.endsWith("/")) it else "$it/" }

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

fun requiredSigningProperty(name: String): String = signingProperties.getProperty(name)
    ?.trim()
    ?.takeIf { it.isNotEmpty() }
    ?: throw GradleException(
        "Missing '$name' in ${signingPropertiesFile.absolutePath}. " +
            "Use an ignored signing.properties file with a keystore outside source control.",
    )

val hasReleaseSigning = signingPropertiesFile.isFile

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
        buildConfigField("String", "API_BASE_URL", "\"$configuredApiBaseUrl\"")
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

fun validateReleaseConfiguration() {
    if (!hasReleaseSigning) {
        throw GradleException(
            "Release builds must be signed. Create apps/tv-shell/signing.properties " +
                "with a real keystore outside source control.",
        )
    }

    if (!configuredApiBaseUrl.startsWith("https://", ignoreCase = true)) {
        throw GradleException(
            "Release builds require an HTTPS tvApiBaseUrl. " +
                "Pass -PtvApiBaseUrl=https://.../api/v1/.",
        )
    }

    val keystore = file(requiredSigningProperty("storeFile"))
    if (!keystore.isFile) {
        throw GradleException("TV release keystore was not found at ${keystore.absolutePath}")
    }
}

tasks.matching { task ->
    task.name == "preReleaseBuild" || task.name == "assembleRelease" || task.name == "bundleRelease"
}.configureEach {
    doFirst { validateReleaseConfiguration() }
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
