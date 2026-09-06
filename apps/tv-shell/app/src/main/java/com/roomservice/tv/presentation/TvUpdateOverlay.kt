package com.roomservice.tv.presentation

import android.content.res.Configuration
import androidx.activity.compose.BackHandler
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import com.roomservice.tv.R
import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.update.TvUpdateState
import java.util.Locale
import kotlinx.coroutines.delay

private val UpdateBackdrop = Color(0xB8071426)
private val UpdateSurface = Color(0xF20D213A)
private val UpdateIvory = Color(0xFFF5EEE2)
private val UpdateMuted = Color(0xFFB8C0C8)
private val UpdateGold = Color(0xFFD7AE68)
private val UpdateLine = Color(0x55F5EEE2)
private val UpdateBackground = Color(0xFF071426)
private val UpdateActivationKeys = setOf(Key.DirectionCenter, Key.Enter, Key.NumPadEnter, Key.Spacebar)

@Composable
fun TvUpdateOverlay(
    state: TvUpdateState,
    language: TvLanguage,
    onInstall: () -> Unit,
    onOpenPermissionSettings: () -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    // Downloading happens in the background so guest service use is never
    // blocked. The overlay appears only when an APK is fully verified.
    val visibleState = when (state) {
        is TvUpdateState.Ready,
        is TvUpdateState.PermissionRequired,
        is TvUpdateState.Failed -> state
        TvUpdateState.Idle,
        is TvUpdateState.Checking,
        is TvUpdateState.UpToDate,
        is TvUpdateState.Downloading,
        TvUpdateState.Installing -> return
    }
    val mandatory = when (visibleState) {
        is TvUpdateState.Ready -> visibleState.manifest.mandatory
        is TvUpdateState.PermissionRequired -> visibleState.manifest.mandatory
        is TvUpdateState.Failed -> visibleState.mandatory
        else -> false
    }
    BackHandler(enabled = !mandatory) { onDismiss() }

    val primaryFocusRequester = remember(visibleState::class) { FocusRequester() }
    LaunchedEffect(visibleState::class) {
        withFrameNanos { }
        runCatching { primaryFocusRequester.requestFocus() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(UpdateBackdrop)
            .padding(horizontal = 96.dp, vertical = 56.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .width(620.dp)
                .background(UpdateSurface, RoundedCornerShape(18.dp))
                .border(1.dp, UpdateLine, RoundedCornerShape(18.dp))
                .padding(horizontal = 40.dp, vertical = 34.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = updateString(R.string.tv_update_brand, language),
                color = UpdateGold,
                fontFamily = HotelUiFont,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
            )
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = updateTitle(visibleState, language),
                color = UpdateIvory,
                fontFamily = HotelDisplayFont,
                fontSize = 34.sp,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = updateMessage(visibleState, language),
                color = UpdateMuted,
                fontFamily = HotelUiFont,
                fontSize = 18.sp,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(26.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                when (visibleState) {
                    is TvUpdateState.Ready -> {
                        UpdateActionButton(
                            label = updateString(R.string.tv_update_install, language),
                            onClick = onInstall,
                            primary = true,
                            focusRequester = primaryFocusRequester,
                        )
                        if (!mandatory) {
                            UpdateActionButton(
                                label = updateString(R.string.tv_update_later, language),
                                onClick = onDismiss,
                            )
                        }
                    }
                    is TvUpdateState.PermissionRequired -> {
                        UpdateActionButton(
                            label = updateString(R.string.tv_update_open_settings, language),
                            onClick = onOpenPermissionSettings,
                            primary = true,
                            focusRequester = primaryFocusRequester,
                        )
                        if (!mandatory) {
                            UpdateActionButton(
                                label = updateString(R.string.tv_update_later, language),
                                onClick = onDismiss,
                            )
                        }
                    }
                    is TvUpdateState.Failed -> {
                        UpdateActionButton(
                            label = updateString(R.string.tv_update_retry, language),
                            onClick = onRetry,
                            primary = true,
                            focusRequester = primaryFocusRequester,
                        )
                        if (!mandatory) {
                            UpdateActionButton(
                                label = updateString(R.string.tv_update_later, language),
                                onClick = onDismiss,
                            )
                        }
                    }
                    else -> Unit
                }
            }
        }
    }
}

@Composable
fun TvUpdateFeedback(
    state: TvUpdateState,
    language: TvLanguage,
    modifier: Modifier = Modifier,
) {
    val upToDate = state as? TvUpdateState.UpToDate ?: return
    var visible by remember(upToDate.versionName) { mutableStateOf(true) }

    LaunchedEffect(upToDate.versionName) {
        delay(4_500)
        visible = false
    }

    if (!visible) return

    Box(
        modifier = modifier
            .width(360.dp)
            .background(UpdateSurface, RoundedCornerShape(12.dp))
            .border(1.dp, UpdateLine, RoundedCornerShape(12.dp))
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "✓",
                color = UpdateGold,
                fontFamily = HotelUiFont,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
            )
            Column {
                Text(
                    text = updateString(R.string.tv_update_up_to_date, language),
                    color = UpdateIvory,
                    fontFamily = HotelUiFont,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = updateString(R.string.tv_update_current_version, language, upToDate.versionName),
                    color = UpdateMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 14.sp,
                )
            }
        }
    }
}

@Composable
private fun updateTitle(state: TvUpdateState, language: TvLanguage): String = when (state) {
    is TvUpdateState.Ready,
    is TvUpdateState.PermissionRequired -> updateString(R.string.tv_update_title, language)
    is TvUpdateState.Failed -> updateString(R.string.tv_update_failed, language)
    TvUpdateState.Idle,
    is TvUpdateState.Checking,
    is TvUpdateState.UpToDate,
    is TvUpdateState.Downloading,
    TvUpdateState.Installing -> ""
}

@Composable
private fun updateMessage(state: TvUpdateState, language: TvLanguage): String {
    val versionName = when (state) {
        is TvUpdateState.Ready -> state.manifest.latestVersionName.orEmpty()
        is TvUpdateState.PermissionRequired -> state.manifest.latestVersionName.orEmpty()
        else -> ""
    }
    return when (state) {
        is TvUpdateState.Ready -> updateString(R.string.tv_update_ready_message, language, versionName)
        is TvUpdateState.PermissionRequired -> updateString(R.string.tv_update_permission_message, language)
        is TvUpdateState.Failed -> updateString(R.string.tv_update_failed_message, language)
        TvUpdateState.Idle,
        is TvUpdateState.Checking,
        is TvUpdateState.UpToDate,
        is TvUpdateState.Downloading,
        TvUpdateState.Installing -> ""
    }
}

@Composable
private fun updateString(
    @StringRes id: Int,
    language: TvLanguage,
    vararg args: Any,
): String {
    val context = LocalContext.current
    val baseConfiguration = LocalConfiguration.current
    val resources = remember(context, baseConfiguration, language) {
        val configuration = Configuration(baseConfiguration).apply {
            setLocale(Locale.forLanguageTag(language.tag))
        }
        context.createConfigurationContext(configuration).resources
    }
    return resources.getString(id, *args)
}

@Composable
private fun UpdateActionButton(
    label: String,
    onClick: () -> Unit,
    primary: Boolean = false,
    focusRequester: FocusRequester? = null,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)
    val background = when {
        focused && primary -> UpdateGold
        focused -> Color(0x331D3550)
        primary -> UpdateGold
        else -> Color.Transparent
    }
    val foreground = if (primary) UpdateBackground else UpdateIvory
    Box(
        modifier = Modifier
            .then(if (focusRequester !== null) Modifier.focusRequester(focusRequester) else Modifier)
            .background(background, shape)
            .border(if (focused || primary) 2.dp else 1.dp, if (focused || primary) UpdateGold else UpdateLine, shape)
            .onFocusChanged { focused = it.isFocused }
            .onPreviewKeyEvent { event ->
                if (event.key in UpdateActivationKeys) {
                    if (event.type == KeyEventType.KeyUp) onClick()
                    true
                } else {
                    false
                }
            }
            .focusable()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 13.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = foreground,
            fontFamily = HotelUiFont,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}
