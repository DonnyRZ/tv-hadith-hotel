plugins {
    id("com.android.application") version "9.2.1" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.10" apply false
}

tasks.wrapper {
    distributionUrl = "https://services.gradle.org/distributions/gradle-9.4.1-bin.zip"
    validateDistributionUrl = false
}
