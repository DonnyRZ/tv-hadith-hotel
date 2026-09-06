package com.roomservice.tv.presentation

import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.data.TvStay
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ceil

private const val MILLIS_PER_DAY = 24L * 60L * 60L * 1000L

internal data class TvStayDisplayState(
    val checkInAtMillis: Long,
    val checkOutAtMillis: Long,
    val timeZone: TimeZone,
    val totalDays: Int,
    val daysRemaining: Int,
    val isCheckOutToday: Boolean,
    val isExpired: Boolean,
)

/**
 * Calculates the same remaining-day semantics as Guest Web without storing a
 * mutable countdown in the TV. Passing nowMillis makes the calculation fully
 * deterministic in tests and allows the UI to refresh at minute/day boundaries.
 */
internal fun calculateTvStaySummary(
    stay: TvStay?,
    nowMillis: Long = System.currentTimeMillis(),
): TvStayDisplayState? {
    if (stay === null || stay.totalDays < 1) return null

    val timeZone = parseTimeZone(stay.timeZone) ?: return null
    val checkInAtMillis = parseIsoInstant(stay.checkInAt) ?: return null
    val checkOutAtMillis = parseIsoInstant(stay.checkOutAt) ?: return null
    if (checkOutAtMillis <= checkInAtMillis) return null

    val millisecondsRemaining = checkOutAtMillis - nowMillis
    val isExpired = millisecondsRemaining <= 0
    val daysRemaining = if (isExpired) {
        0
    } else {
        ceil(millisecondsRemaining.toDouble() / MILLIS_PER_DAY).toInt()
    }

    return TvStayDisplayState(
        checkInAtMillis = checkInAtMillis,
        checkOutAtMillis = checkOutAtMillis,
        timeZone = timeZone,
        totalDays = stay.totalDays,
        daysRemaining = daysRemaining,
        isCheckOutToday = !isExpired && sameLocalDay(checkOutAtMillis, nowMillis, timeZone),
        isExpired = isExpired,
    )
}

internal fun formatTvStayDate(
    millis: Long,
    timeZone: TimeZone,
    language: TvLanguage,
): String = SimpleDateFormat("d MMM yyyy", tvLocale(language)).apply {
    this.timeZone = timeZone
}.format(Date(millis))

internal fun formatTvStayTime(
    millis: Long,
    timeZone: TimeZone,
): String = SimpleDateFormat("HH:mm", Locale.ROOT).apply {
    this.timeZone = timeZone
}.format(Date(millis))

private fun parseTimeZone(value: String): TimeZone? {
    val requested = value.trim()
    if (requested.isEmpty()) return null
    val timeZone = TimeZone.getTimeZone(requested)
    return if (timeZone.id == requested || requested == "UTC" || requested == "GMT") {
        timeZone
    } else {
        null
    }
}

private fun parseIsoInstant(value: String): Long? {
    val normalized = value.trim()
    if (normalized.isEmpty()) return null

    val patterns = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
        "yyyy-MM-dd'T'HH:mm:ssXXX",
        "yyyy-MM-dd'T'HH:mm:ss.SSSX",
        "yyyy-MM-dd'T'HH:mm:ssX",
    )
    for (pattern in patterns) {
        val formatter = SimpleDateFormat(pattern, Locale.ROOT).apply {
            isLenient = false
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val position = ParsePosition(0)
        val parsed = formatter.parse(normalized, position)
        if (parsed !== null && position.index == normalized.length) return parsed.time
    }
    return null
}

private fun sameLocalDay(firstMillis: Long, secondMillis: Long, timeZone: TimeZone): Boolean {
    fun dayKey(millis: Long): Int {
        val calendar = Calendar.getInstance(timeZone, Locale.ROOT).apply {
            timeInMillis = millis
        }
        return calendar.get(Calendar.YEAR) * 1000 + calendar.get(Calendar.DAY_OF_YEAR)
    }

    return dayKey(firstMillis) == dayKey(secondMillis)
}

private fun tvLocale(language: TvLanguage): Locale = when (language) {
    TvLanguage.UZ -> Locale.forLanguageTag("uz-UZ")
    TvLanguage.RU -> Locale.forLanguageTag("ru-RU")
    TvLanguage.EN -> Locale.ENGLISH
}
