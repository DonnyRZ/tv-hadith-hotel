package com.roomservice.tv.update

internal const val TV_UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000L
internal const val TV_UPDATE_FAILURE_RETRY_INTERVAL_MS = 5 * 60 * 1_000L

enum class TvUpdateCheckTrigger {
    FOREGROUND,
    MANUAL,
    BACKGROUND,
    RETRY,
}

internal fun TvUpdateCheckTrigger.isForced(): Boolean = this != TvUpdateCheckTrigger.BACKGROUND

internal fun TvUpdateCheckTrigger.shouldRespectDismissedRelease(): Boolean =
    this != TvUpdateCheckTrigger.MANUAL

internal fun shouldSkipTvUpdateCheck(
    force: Boolean,
    nowMillis: Long,
    lastSuccessfulCheckAt: Long,
    lastAttemptAt: Long,
): Boolean {
    if (force) return false
    if (lastSuccessfulCheckAt > 0L && nowMillis - lastSuccessfulCheckAt < TV_UPDATE_CHECK_INTERVAL_MS) {
        return true
    }
    return lastAttemptAt > 0L && nowMillis - lastAttemptAt < TV_UPDATE_FAILURE_RETRY_INTERVAL_MS
}
