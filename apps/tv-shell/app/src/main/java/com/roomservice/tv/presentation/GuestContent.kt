package com.roomservice.tv.presentation

import com.roomservice.tv.R
import com.roomservice.tv.data.LocalizedText

/** Static hotel editorial content bundled with the TV client, matching Guest Web copy. */
data class TvAboutFeature(
    val title: LocalizedText,
    val body: LocalizedText,
    val imageRes: Int,
)

data class TvDestination(
    val title: LocalizedText,
    val eyebrow: LocalizedText,
    val description: LocalizedText,
    val facts: List<LocalizedText>,
    val videoRes: Int,
)

val TV_ABOUT_FEATURES: List<TvAboutFeature> = listOf(
    TvAboutFeature(
        title = LocalizedText(
            uz = "Sokin mehmonxona",
            ru = "Спокойный отель",
            en = "A quieter stay",
        ),
        body = LocalizedText(
            uz = "Yorug‘ hovli, iliq kutib olish va xonangizdan boshqariladigan qulayliklar.",
            ru = "Светлый двор, тёплый приём и удобства, доступные прямо из номера.",
            en = "A luminous courtyard, a warm welcome and comfort available from your room.",
        ),
        imageRes = R.drawable.hotel_exterior,
    ),
    TvAboutFeature(
        title = LocalizedText(
            uz = "Ta’m va suhbat",
            ru = "Вкус и разговор",
            en = "Taste and conversation",
        ),
        body = LocalizedText(
            uz = "Saji Nusantara va 7oz Espresso Cafe kunning istalgan payti uchun.",
            ru = "Saji Nusantara и 7oz Espresso Cafe для любого момента дня.",
            en = "Saji Nusantara and 7oz Espresso Cafe for any moment of the day.",
        ),
        imageRes = R.drawable.saji_nusantara,
    ),
    TvAboutFeature(
        title = LocalizedText(
            uz = "Dam olish va parvarish",
            ru = "Отдых и уход",
            en = "Rest and care",
        ),
        body = LocalizedText(
            uz = "Suv, SPA va salon tajribasi kuningizni yumshoq yakunlashga yordam beradi.",
            ru = "Бассейн, SPA и салон помогают мягко завершить ваш день.",
            en = "The pool, SPA and salon help you ease gently into the rest of your day.",
        ),
        imageRes = R.drawable.pool,
    ),
)

val TV_DESTINATIONS: List<TvDestination> = listOf(
    TvDestination(
        title = LocalizedText(
            uz = "Imom al-Buxoriy merosi",
            ru = "Наследие имама аль-Бухари",
            en = "The legacy of Imam Al-Bukhari",
        ),
        eyebrow = LocalizedText(
            uz = "Ma’naviy sayohat",
            ru = "Духовное путешествие",
            en = "A spiritual journey",
        ),
        description = LocalizedText(
            uz = "Buyuk muhaddis xotirasiga bag‘ishlangan majmua — sokin, chuqur va ilhomlantiruvchi tashrif.",
            ru = "Комплекс в память о великом мухаддисе — тихое, глубокое и вдохновляющее посещение.",
            en = "A quiet, meaningful visit to the complex honouring the great muhaddith.",
        ),
        facts = listOf(
            LocalizedText(
                uz = "Imom al-Buxoriy maqbarasi",
                ru = "Мавзолей имама аль-Бухари",
                en = "Imam Al-Bukhari Mausoleum",
            ),
            LocalizedText(
                uz = "Xalqaro ilmiy markaz",
                ru = "Международный научный центр",
                en = "International scholarly centre",
            ),
        ),
        videoRes = R.raw.imam_al_bukhari_complex,
    ),
    TvDestination(
        title = LocalizedText(
            uz = "Registon maydoni",
            ru = "Площадь Регистан",
            en = "Registan Square",
        ),
        eyebrow = LocalizedText(
            uz = "Samarqand ramzi",
            ru = "Символ Самарканда",
            en = "Samarkand in one view",
        ),
        description = LocalizedText(
            uz = "Moviy koshinlar, uch madrasa va Ipak yo‘lining yuragida yarim kunlik tarixiy sayohat.",
            ru = "Три медресе, голубая мозаика и историческое путешествие в сердце Шёлкового пути.",
            en = "Three madrasas, blue tilework and a half-day journey through the heart of the Silk Road.",
        ),
        facts = listOf(
            LocalizedText(
                uz = "Ulug‘bek madrasasi",
                ru = "Медресе Улугбека",
                en = "Ulugh Beg Madrasa",
            ),
            LocalizedText(
                uz = "Sherdor va Tillakori",
                ru = "Шердор и Тиллякори",
                en = "Sher-Dor and Tilla-Kori",
            ),
        ),
        videoRes = R.raw.registan_square,
    ),
)
