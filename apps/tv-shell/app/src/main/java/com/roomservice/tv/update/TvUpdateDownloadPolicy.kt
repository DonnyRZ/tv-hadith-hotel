package com.roomservice.tv.update

internal data class TvUpdateContentRange(
    val start: Long,
    val end: Long,
    val total: Long?,
)

/**
 * Parses the standard byte range response used to resume an interrupted APK
 * download. A malformed range is treated as unsafe rather than guessed.
 */
internal fun parseTvUpdateContentRange(value: String?): TvUpdateContentRange? {
    val match = value?.trim()?.let {
        Regex("bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)", RegexOption.IGNORE_CASE).matchEntire(it)
    } ?: return null
    val start = match.groupValues[1].toLongOrNull() ?: return null
    val end = match.groupValues[2].toLongOrNull() ?: return null
    if (end < start) return null
    val total = match.groupValues[3].takeUnless { it == "*" }?.toLongOrNull()
    if (total != null && (total <= end || total <= 0L)) return null
    return TvUpdateContentRange(start = start, end = end, total = total)
}
