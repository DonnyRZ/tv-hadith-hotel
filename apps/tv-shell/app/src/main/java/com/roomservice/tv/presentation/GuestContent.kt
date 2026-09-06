package com.roomservice.tv.presentation

import com.roomservice.tv.R
import com.roomservice.tv.data.LocalizedText

/** Static hotel editorial content bundled with the TV client, matching Guest Web copy. */
data class TvAboutFeature(
    val title: LocalizedText,
    val body: LocalizedText,
    val imageRes: Int,
    val galleryId: TvGalleryId,
)

enum class TvGalleryId {
    STAY,
    TASTE,
    REST,
}

enum class TvGalleryBrand {
    SAJI,
    SEVEN_OZ,
}

data class TvGalleryItem(
    val id: String,
    val title: LocalizedText,
    val imageRes: Int,
    val brand: TvGalleryBrand? = null,
)

enum class TvStayRoomType {
    STANDARD,
    BALCONY,
    SUITE,
    JUNIOR_SUITE,
}

data class TvStayRoomGallery(
    val type: TvStayRoomType,
    val label: LocalizedText,
    val items: List<TvGalleryItem>,
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
        galleryId = TvGalleryId.STAY,
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
        galleryId = TvGalleryId.TASTE,
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
        galleryId = TvGalleryId.REST,
    ),
)

val TV_STAY_ROOM_GALLERIES: List<TvStayRoomGallery> = listOf(
    TvStayRoomGallery(
        type = TvStayRoomType.STANDARD,
        label = LocalizedText("Standard Room", "Standard Room", "Standard Room"),
        items = listOf(
            TvGalleryItem("standard-room-01", LocalizedText("Standard Room · yotoq xonasi", "Standard Room · спальня", "Standard Room · bedroom"), R.drawable.gallery_stay_standard_01),
            TvGalleryItem("standard-room-02", LocalizedText("Standard Room · yotoq xonasi tafsiloti", "Standard Room · детали спальни", "Standard Room · bedroom detail"), R.drawable.gallery_stay_standard_02),
            TvGalleryItem("standard-room-03", LocalizedText("Standard Room · xona ko‘rinishi", "Standard Room · вид комнаты", "Standard Room · room view"), R.drawable.gallery_stay_standard_03),
            TvGalleryItem("standard-room-04", LocalizedText("Standard Room · interyer", "Standard Room · интерьер", "Standard Room · interior"), R.drawable.gallery_stay_standard_04),
        ),
    ),
    TvStayRoomGallery(
        type = TvStayRoomType.BALCONY,
        label = LocalizedText("Balcony Room", "Balcony Room", "Balcony Room"),
        items = listOf(
            TvGalleryItem("balcony-room-01", LocalizedText("Balcony Room · xona ko‘rinishi", "Balcony Room · вид комнаты", "Balcony Room · room view"), R.drawable.gallery_stay_balcony_01),
        ),
    ),
    TvStayRoomGallery(
        type = TvStayRoomType.SUITE,
        label = LocalizedText("Suite", "Suite", "Suite"),
        items = listOf(
            TvGalleryItem("suite-01", LocalizedText("Suite · yotoq xonasi", "Suite · спальня", "Suite · bedroom"), R.drawable.gallery_stay_suite_01),
            TvGalleryItem("suite-02", LocalizedText("Suite · yotoq xonasi tafsiloti", "Suite · детали спальни", "Suite · bedroom detail"), R.drawable.gallery_stay_suite_02),
            TvGalleryItem("suite-03", LocalizedText("Suite · yashash maydoni", "Suite · гостиная", "Suite · living area"), R.drawable.gallery_stay_suite_03),
            TvGalleryItem("suite-04", LocalizedText("Suite · interyer", "Suite · интерьер", "Suite · interior"), R.drawable.gallery_stay_suite_04),
        ),
    ),
    TvStayRoomGallery(
        type = TvStayRoomType.JUNIOR_SUITE,
        label = LocalizedText("Junior Suite", "Junior Suite", "Junior Suite"),
        items = listOf(
            TvGalleryItem("junior-suite-01", LocalizedText("Junior Suite · yotoq xonasi", "Junior Suite · спальня", "Junior Suite · bedroom"), R.drawable.gallery_stay_junior_suite_01),
            TvGalleryItem("junior-suite-02", LocalizedText("Junior Suite · yashash maydoni", "Junior Suite · гостиная", "Junior Suite · living area"), R.drawable.gallery_stay_junior_suite_02),
            TvGalleryItem("junior-suite-03", LocalizedText("Junior Suite · dam olish maydoni", "Junior Suite · зона отдыха", "Junior Suite · lounge"), R.drawable.gallery_stay_junior_suite_03),
            TvGalleryItem("junior-suite-04", LocalizedText("Junior Suite · rakovina maydoni", "Junior Suite · зона умывальника", "Junior Suite · vanity"), R.drawable.gallery_stay_junior_suite_04),
            TvGalleryItem("junior-suite-05", LocalizedText("Junior Suite · hammom", "Junior Suite · ванная комната", "Junior Suite · bathroom"), R.drawable.gallery_stay_junior_suite_05),
            TvGalleryItem("junior-suite-06", LocalizedText("Junior Suite · o‘tirish maydoni", "Junior Suite · зона отдыха", "Junior Suite · sitting area"), R.drawable.gallery_stay_junior_suite_06),
        ),
    ),
)

val TV_GALLERY_ITEMS: Map<TvGalleryId, List<TvGalleryItem>> = mapOf(
    TvGalleryId.TASTE to listOf(
        TvGalleryItem(
            id = "saji-nasi-goreng",
            title = LocalizedText("Nasi Goreng", "Nasi Goreng", "Nasi Goreng"),
            imageRes = R.drawable.gallery_taste_saji_nasi_goreng,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "saji-sate-kambing",
            title = LocalizedText("Sate Kambing", "Sate Kambing", "Sate Kambing"),
            imageRes = R.drawable.gallery_taste_saji_sate_kambing,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "saji-soto-ayam",
            title = LocalizedText("Soto Ayam", "Soto Ayam", "Soto Ayam"),
            imageRes = R.drawable.gallery_taste_saji_soto_ayam,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "saji-beef-rendang",
            title = LocalizedText("Beef Rendang", "Beef Rendang", "Beef Rendang"),
            imageRes = R.drawable.gallery_taste_saji_beef_rendang,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "saji-ayam-bakar",
            title = LocalizedText("Ayam Bakar", "Ayam Bakar", "Ayam Bakar"),
            imageRes = R.drawable.gallery_taste_saji_ayam_bakar,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "saji-es-cendol",
            title = LocalizedText("Es Cendol", "Es Cendol", "Es Cendol"),
            imageRes = R.drawable.gallery_taste_saji_es_cendol,
            brand = TvGalleryBrand.SAJI,
        ),
        TvGalleryItem(
            id = "7oz-berrypresso",
            title = LocalizedText("Berrypresso", "Berrypresso", "Berrypresso"),
            imageRes = R.drawable.gallery_taste_7oz_berrypresso,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
        TvGalleryItem(
            id = "7oz-spanish-latte",
            title = LocalizedText("Spanish Latte", "Spanish Latte", "Spanish Latte"),
            imageRes = R.drawable.gallery_taste_7oz_spanish_latte,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
        TvGalleryItem(
            id = "7oz-mont-blanc",
            title = LocalizedText("Mont Blanc", "Mont Blanc", "Mont Blanc"),
            imageRes = R.drawable.gallery_taste_7oz_mont_blanc,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
        TvGalleryItem(
            id = "7oz-pink-lemonade",
            title = LocalizedText("Pink Lemonade", "Pink Lemonade", "Pink Lemonade"),
            imageRes = R.drawable.gallery_taste_7oz_pink_lemonade,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
        TvGalleryItem(
            id = "7oz-hazelnut-latte",
            title = LocalizedText("Hazelnut Latte", "Hazelnut Latte", "Hazelnut Latte"),
            imageRes = R.drawable.gallery_taste_7oz_hazelnut_latte,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
        TvGalleryItem(
            id = "7oz-bomboloni-raspberry",
            title = LocalizedText("Bomboloni Raspberry", "Bomboloni Raspberry", "Bomboloni Raspberry"),
            imageRes = R.drawable.gallery_taste_7oz_bomboloni_raspberry,
            brand = TvGalleryBrand.SEVEN_OZ,
        ),
    ),
    TvGalleryId.REST to listOf(
        TvGalleryItem(
            id = "rest-pool",
            title = LocalizedText("Basseyn", "Бассейн", "Pool"),
            imageRes = R.drawable.gallery_rest_pool,
        ),
        TvGalleryItem(
            id = "rest-hamam",
            title = LocalizedText("Hammom", "Хамам", "Hamam"),
            imageRes = R.drawable.gallery_rest_hamam,
        ),
        TvGalleryItem(
            id = "rest-massage",
            title = LocalizedText("Massaj", "Массаж", "Massage"),
            imageRes = R.drawable.gallery_rest_massage,
        ),
        TvGalleryItem(
            id = "rest-sauna",
            title = LocalizedText("Sauna", "Сауна", "Sauna"),
            imageRes = R.drawable.gallery_rest_sauna,
        ),
        TvGalleryItem(
            id = "rest-salon",
            title = LocalizedText("Salon", "Салон", "Salon"),
            imageRes = R.drawable.gallery_rest_salon,
        ),
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
