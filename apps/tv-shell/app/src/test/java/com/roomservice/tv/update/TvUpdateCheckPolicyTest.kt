package com.roomservice.tv.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TvUpdateCheckPolicyTest {
    @Test
    fun `successful check uses the normal six hour cooldown`() {
        assertTrue(
            shouldSkipTvUpdateCheck(
                force = false,
                nowMillis = TV_UPDATE_CHECK_INTERVAL_MS - 1L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
        assertFalse(
            shouldSkipTvUpdateCheck(
                force = false,
                nowMillis = TV_UPDATE_CHECK_INTERVAL_MS + 1L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
    }

    @Test
    fun `failed network attempt never blocks retries for six hours`() {
        assertTrue(
            shouldSkipTvUpdateCheck(
                force = false,
                nowMillis = TV_UPDATE_FAILURE_RETRY_INTERVAL_MS - 1L,
                lastSuccessfulCheckAt = 0L,
                lastAttemptAt = 1L,
            ),
        )
        assertFalse(
            shouldSkipTvUpdateCheck(
                force = false,
                nowMillis = TV_UPDATE_FAILURE_RETRY_INTERVAL_MS + 1L,
                lastSuccessfulCheckAt = 0L,
                lastAttemptAt = 1L,
            ),
        )
    }

    @Test
    fun `manual retry bypasses every cooldown`() {
        assertFalse(
            shouldSkipTvUpdateCheck(
                force = true,
                nowMillis = 1L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
    }

    @Test
    fun `foreground and manual triggers are forced checks`() {
        assertFalse(
            shouldSkipTvUpdateCheck(
                force = TvUpdateCheckTrigger.FOREGROUND.isForced(),
                nowMillis = 2L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
        assertFalse(
            shouldSkipTvUpdateCheck(
                force = TvUpdateCheckTrigger.MANUAL.isForced(),
                nowMillis = 2L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
    }

    @Test
    fun `background trigger retains the six hour cooldown`() {
        assertTrue(
            shouldSkipTvUpdateCheck(
                force = TvUpdateCheckTrigger.BACKGROUND.isForced(),
                nowMillis = TV_UPDATE_CHECK_INTERVAL_MS - 1L,
                lastSuccessfulCheckAt = 1L,
                lastAttemptAt = 1L,
            ),
        )
    }
}
