package com.roomservice.tv.presentation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class TvGalleryRouteTest {
    @Test
    fun gallerySelectionsUseRegisteredRoutes() {
        assertEquals("about/stay", tvGalleryRoute(TvGalleryId.STAY))
        assertEquals("about/taste/saji", tvGalleryRoute(TvGalleryId.TASTE))
        assertEquals("about/rest", tvGalleryRoute(TvGalleryId.REST))
    }

    @Test
    fun stayGalleryUsesTheApprovedRoomOrderAndPhotoCounts() {
        assertEquals(
            listOf(
                TvStayRoomType.STANDARD,
                TvStayRoomType.BALCONY,
                TvStayRoomType.SUITE,
                TvStayRoomType.JUNIOR_SUITE,
            ),
            TV_STAY_ROOM_GALLERIES.map { it.type },
        )
        assertEquals(4, TV_STAY_ROOM_GALLERIES[0].items.size)
        assertEquals(1, TV_STAY_ROOM_GALLERIES[1].items.size)
        assertEquals(4, TV_STAY_ROOM_GALLERIES[2].items.size)
        assertEquals(6, TV_STAY_ROOM_GALLERIES[3].items.size)
        assertFalse(TV_STAY_ROOM_GALLERIES.any { it.label.en.contains("President") })
    }
}
