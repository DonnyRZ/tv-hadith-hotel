package com.roomservice.tv.presentation

import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.tv.material3.MaterialTheme
import com.roomservice.tv.R

val HotelDisplayFont = FontFamily(
    Font(R.font.hotel_display, FontWeight.Normal),
)

val HotelUiFont = FontFamily(
    Font(R.font.hotel_ui, FontWeight.Normal),
)

@Composable
fun RoomServiceTvTheme(content: @Composable () -> Unit) {
    MaterialTheme(content = content)
}
