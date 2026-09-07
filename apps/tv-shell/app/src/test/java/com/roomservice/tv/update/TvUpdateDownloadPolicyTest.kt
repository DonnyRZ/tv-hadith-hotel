package com.roomservice.tv.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TvUpdateDownloadPolicyTest {
    @Test
    fun `valid content range is parsed for resume`() {
        assertEquals(
            TvUpdateContentRange(start = 1_048_576L, end = 2_097_151L, total = 8_388_608L),
            parseTvUpdateContentRange("bytes 1048576-2097151/8388608"),
        )
    }

    @Test
    fun `malformed content range is rejected`() {
        assertNull(parseTvUpdateContentRange("bytes 1048576-2097151/2097151"))
        assertNull(parseTvUpdateContentRange("bytes 20-10/100"))
        assertNull(parseTvUpdateContentRange("0-10/100"))
    }

    @Test
    fun `unknown total is allowed only when the range itself is valid`() {
        assertEquals(
            TvUpdateContentRange(start = 0L, end = 99L, total = null),
            parseTvUpdateContentRange("bytes 0-99/*"),
        )
    }
}
