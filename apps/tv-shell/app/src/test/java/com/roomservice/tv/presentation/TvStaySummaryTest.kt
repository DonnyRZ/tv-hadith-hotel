package com.roomservice.tv.presentation

import com.roomservice.tv.data.TvStay
import java.text.SimpleDateFormat
import java.util.Locale
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TvStaySummaryTest {
    private val stay = TvStay(
        checkInAt = "2026-08-30T10:00:00.000Z",
        checkOutAt = "2026-09-02T10:00:00.000Z",
        totalDays = 3,
        timeZone = "Asia/Tashkent",
    )

    @Test
    fun `shows three days at check in and two days after one day`() {
        val atCheckIn = calculateTvStaySummary(stay, millis("2026-08-30T10:00:00.000Z"))
        val nextDay = calculateTvStaySummary(stay, millis("2026-08-31T10:00:00.000Z"))

        assertEquals(3, atCheckIn?.daysRemaining)
        assertFalse(atCheckIn?.isExpired == true)
        assertEquals(2, nextDay?.daysRemaining)
    }

    @Test
    fun `marks checkout today in the hotel timezone`() {
        val summary = calculateTvStaySummary(stay, millis("2026-09-01T20:00:00.000Z"))

        assertEquals(1, summary?.daysRemaining)
        assertTrue(summary?.isCheckOutToday == true)
        assertFalse(summary?.isExpired == true)
    }

    @Test
    fun `marks a stay expired after checkout`() {
        val summary = calculateTvStaySummary(stay, millis("2026-09-02T10:00:01.000Z"))

        assertEquals(0, summary?.daysRemaining)
        assertTrue(summary?.isExpired == true)
        assertFalse(summary?.isCheckOutToday == true)
    }

    @Test
    fun `returns no display state for missing or malformed stay data`() {
        assertNull(calculateTvStaySummary(null, millis("2026-08-30T10:00:00.000Z")))
        assertNull(
            calculateTvStaySummary(
                stay.copy(timeZone = "Not/A_TimeZone"),
                millis("2026-08-30T10:00:00.000Z"),
            ),
        )
        assertNull(
            calculateTvStaySummary(
                stay.copy(checkOutAt = "not-a-date"),
                millis("2026-08-30T10:00:00.000Z"),
            ),
        )
    }

    @Test
    fun `layout budget never exceeds target viewport`() {
        for (viewportHeight in listOf(500f, 560f, 720f, 1080f)) {
            val metrics = tvHomeLayoutMetrics(viewportHeight.toInt().dp)
            assertTrue(
                "${metrics.totalHeight} > ${viewportHeight}dp",
                metrics.totalHeight.value <= viewportHeight,
            )
        }
    }

    private fun millis(value: String): Long = SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ss.SSSX",
        Locale.ROOT,
    ).parse(value)!!.time
}
