package com.roomservice.tv.presentation

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import android.content.res.Configuration
import android.net.Uri
import android.widget.VideoView
import androidx.annotation.StringRes
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.tv.material3.Text
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.roomservice.tv.R
import com.roomservice.tv.data.BoutiqueCategory
import com.roomservice.tv.data.BoutiqueVariant
import com.roomservice.tv.data.GuestRequest
import com.roomservice.tv.data.LocalizedText
import com.roomservice.tv.data.MenuItem
import com.roomservice.tv.data.RequestStatus
import com.roomservice.tv.data.RoomStatus
import com.roomservice.tv.data.TvContext
import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.data.UnitCode
import com.roomservice.tv.update.TvUpdateState
import java.text.NumberFormat
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private val TvBackground = Color(0xFF071426)
private val TvSurface = Color(0xD90D213A)
private val TvSurfaceStrong = Color(0xF20B1D33)
private val TvFocused = Color(0xFFD7AE68)
private val TvGoldSoft = Color(0x2ED7AE68)
private val TvMuted = Color(0xFFB8C0C8)
private val TvIvory = Color(0xFFF5EEE2)
private val TvLine = Color(0x45F5EEE2)
private val TvDanger = Color(0xFFFFB4AB)
private val LocalTvLanguage = compositionLocalOf { TvLanguage.UZ }
private val TvActivationKeys = setOf(
    Key.DirectionCenter,
    Key.Enter,
    Key.NumPadEnter,
    Key.Spacebar,
)

private val TvGalleryBrand.routeValue: String
    get() = when (this) {
        TvGalleryBrand.SAJI -> "saji"
        TvGalleryBrand.SEVEN_OZ -> "7oz"
    }

/**
 * Converts a gallery selection into one of the routes registered in [NavHost].
 *
 * Do not interpolate [TvGalleryId] directly into a route. Its default string
 * representation is the enum name (for example, `TASTE`), while the
 * navigation graph uses stable, lowercase paths and Taste has a default brand.
 */
internal fun tvGalleryRoute(gallery: TvGalleryId): String = when (gallery) {
    TvGalleryId.STAY -> "about/stay"
    TvGalleryId.TASTE -> "about/taste/saji"
    TvGalleryId.REST -> "about/rest"
}

internal enum class TvHomeLayoutTier {
    COMPACT,
    STANDARD,
    LARGE,
}

internal data class TvHomeLayoutMetrics(
    val tier: TvHomeLayoutTier,
    val sectionGap: Dp,
    val bottomInset: Dp,
    val welcomeHeight: Dp,
    val headingHeight: Dp,
    val cardHeight: Dp,
) {
    val totalHeight: Dp
        get() = welcomeHeight + headingHeight + cardHeight + (sectionGap * 2) + bottomInset
}

/**
 * Allocates the Home content budget before Compose lays out any child. The
 * card height is derived from the remaining space, so stay metadata cannot
 * push the last row below the TV viewport.
 */
internal fun tvHomeLayoutMetrics(viewportHeight: Dp): TvHomeLayoutMetrics {
    val tier = when {
        viewportHeight < 500.dp -> TvHomeLayoutTier.COMPACT
        viewportHeight < 700.dp -> TvHomeLayoutTier.STANDARD
        else -> TvHomeLayoutTier.LARGE
    }
    val sectionGap = when (tier) {
        TvHomeLayoutTier.COMPACT -> 10.dp
        TvHomeLayoutTier.STANDARD -> 16.dp
        TvHomeLayoutTier.LARGE -> 22.dp
    }
    val bottomInset = when (tier) {
        TvHomeLayoutTier.COMPACT -> 8.dp
        TvHomeLayoutTier.STANDARD -> 12.dp
        TvHomeLayoutTier.LARGE -> 18.dp
    }
    val headingHeight = when (tier) {
        TvHomeLayoutTier.COMPACT -> 28.dp
        TvHomeLayoutTier.STANDARD -> 32.dp
        TvHomeLayoutTier.LARGE -> 38.dp
    }
    val preferredWelcomeHeight = when (tier) {
        TvHomeLayoutTier.COMPACT -> 164.dp
        TvHomeLayoutTier.STANDARD -> 184.dp
        TvHomeLayoutTier.LARGE -> 204.dp
    }
    val minimumCardHeight = when (tier) {
        TvHomeLayoutTier.COMPACT -> 112.dp
        TvHomeLayoutTier.STANDARD -> 128.dp
        TvHomeLayoutTier.LARGE -> 148.dp
    }
    val maximumCardHeight = when (tier) {
        TvHomeLayoutTier.COMPACT -> 160.dp
        TvHomeLayoutTier.STANDARD -> 184.dp
        TvHomeLayoutTier.LARGE -> 208.dp
    }
    val fixedHeight = headingHeight + (sectionGap * 2) + bottomInset
    val availableForHero = (viewportHeight - fixedHeight - minimumCardHeight).coerceAtLeast(0.dp)
    val welcomeHeight = preferredWelcomeHeight.coerceAtMost(availableForHero)
    val availableForCards = (viewportHeight - fixedHeight - welcomeHeight).coerceAtLeast(0.dp)
    val cardHeight = availableForCards.coerceAtMost(maximumCardHeight)

    return TvHomeLayoutMetrics(
        tier = tier,
        sectionGap = sectionGap,
        bottomInset = bottomInset,
        welcomeHeight = welcomeHeight,
        headingHeight = headingHeight,
        cardHeight = cardHeight,
    )
}

@Composable
private fun stringResource(@StringRes id: Int, vararg formatArgs: Any): String {
    val context = LocalContext.current
    val baseConfiguration = LocalConfiguration.current
    val language = LocalTvLanguage.current
    val resources = remember(context, baseConfiguration, language) {
        val configuration = Configuration(baseConfiguration).apply {
            setLocale(Locale.forLanguageTag(language.tag))
        }
        context.createConfigurationContext(configuration).resources
    }
    return resources.getString(id, *formatArgs)
}

private suspend fun requestTvFocus(focusRequester: FocusRequester) {
    repeat(4) {
        if (runCatching { focusRequester.requestFocus() }.getOrDefault(false)) {
            return
        }
        withFrameNanos { }
    }
}

@Composable
private fun HotelMark(size: Dp = 52.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .border(1.dp, TvFocused, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "H",
            color = TvFocused,
            fontFamily = HotelDisplayFont,
            fontSize = 30.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun TvRoot(
    uiState: TvUiState,
    language: TvLanguage = TvLanguage.UZ,
    onInitialize: () -> Unit,
    onRetry: () -> Unit,
    onLanguageChange: (TvLanguage) -> Unit = {},
    onAddToCart: (MenuItem) -> Unit,
    onAddVariantToCart: (MenuItem, String?) -> Unit = { item, _ -> onAddToCart(item) },
    onRemoveFromCart: (String) -> Unit,
    onSubmitCart: () -> Unit,
    onRefreshRequests: () -> Unit = {},
    updateState: TvUpdateState = TvUpdateState.Idle,
    onCheckForUpdates: () -> Unit = {},
) {
    LaunchedEffect(Unit) {
        onInitialize()
    }

    CompositionLocalProvider(LocalTvLanguage provides language) {
        RoomServiceTvTheme {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(TvBackground),
            ) {
                Image(
                    painter = painterResource(R.drawable.hotel_exterior),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color(0xE6071426),
                                0.38f to Color(0x8F071426),
                                1f to Color(0xF5071426),
                            ),
                        ),
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.horizontalGradient(
                                0f to Color(0x75071426),
                                0.5f to Color.Transparent,
                                1f to Color(0x8A071426),
                            ),
                        ),
                )
                when (uiState) {
                    TvUiState.Loading -> LoadingScreen()
                    is TvUiState.Pairing -> PairingScreen(uiState)
                    is TvUiState.Error -> ErrorScreen(uiState, onRetry)
                    is TvUiState.Ready -> ReadyApp(
                        language = language,
                        onAddToCart = onAddToCart,
                        onAddVariantToCart = onAddVariantToCart,
                        onLanguageChange = onLanguageChange,
                        onRemoveFromCart = onRemoveFromCart,
                        onRefreshRequests = onRefreshRequests,
                        onSubmitCart = onSubmitCart,
                        state = uiState,
                        updateState = updateState,
                        onCheckForUpdates = onCheckForUpdates,
                    )
                }
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    CenteredMessage(
        title = stringResource(R.string.tv_loading_title),
        message = stringResource(R.string.tv_loading_message),
    )
}

@Composable
private fun PairingScreen(state: TvUiState.Pairing) {
    val pairingCodeLabel = stringResource(R.string.tv_pairing_code)
    CenteredMessage(
        title = stringResource(R.string.tv_pairing_title),
        message = stringResource(R.string.tv_pairing_message),
        extra = {
            Text(
                text = state.pairingCode.chunked(3).joinToString(" "),
                color = TvFocused,
                fontFamily = HotelUiFont,
                fontSize = 58.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 8.sp,
                modifier = Modifier.semantics {
                    contentDescription = "$pairingCodeLabel ${state.pairingCode}"
                },
            )
            Spacer(modifier = Modifier.height(18.dp))
            Text(
                text = stringResource(R.string.tv_pairing_expires, state.expiresAt),
                color = TvMuted,
                fontFamily = HotelUiFont,
                fontSize = 20.sp,
            )
        },
    )
}

@Composable
private fun ErrorScreen(
    state: TvUiState.Error,
    onRetry: () -> Unit,
) {
    CenteredMessage(
        title = stringResource(R.string.tv_error_title),
        message = localizedTvErrorMessage(state.errorCode ?: "TV_API_ERROR", state.message),
        extra = {
            if (state.retryable) {
                TvActionButton(label = stringResource(R.string.tv_retry), onClick = onRetry)
            }
        },
    )
}

@Composable
private fun CenteredMessage(
    title: String,
    message: String,
    extra: @Composable () -> Unit = {},
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 120.dp, vertical = 72.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        HotelMark(size = 70.dp)
        Spacer(modifier = Modifier.height(22.dp))
        Text(
            text = title,
            color = TvIvory,
            fontFamily = HotelDisplayFont,
            fontSize = 48.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            color = TvMuted,
            fontFamily = HotelUiFont,
            fontSize = 23.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(28.dp))
        extra()
    }
}

@Composable
private fun ReadyApp(
    language: TvLanguage,
    onAddToCart: (MenuItem) -> Unit,
    onAddVariantToCart: (MenuItem, String?) -> Unit,
    onLanguageChange: (TvLanguage) -> Unit,
    onRemoveFromCart: (String) -> Unit,
    onRefreshRequests: () -> Unit,
    onSubmitCart: () -> Unit,
    state: TvUiState.Ready,
    updateState: TvUpdateState,
    onCheckForUpdates: () -> Unit,
) {
    val navController = rememberNavController()
    var selectedUnit by remember { mutableStateOf<UnitCode?>(null) }
    val cartCount = state.cart.sumOf { it.quantity }

    val navigatePrimary: (String) -> Unit = { route ->
        navController.navigate(route) {
            popUpTo("home") { saveState = false }
            launchSingleTop = true
            restoreState = false
        }
    }

    BackHandler(enabled = navController.previousBackStackEntry != null) {
        navController.popBackStack()
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val compactShell = maxHeight < 560.dp
        val shellVerticalPadding = if (compactShell) 18.dp else 28.dp
        val headerContentGap = if (compactShell) 14.dp else 22.dp

        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 64.dp, vertical = shellVerticalPadding),
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                TvHeader(
                    cartCount = cartCount,
                    language = language,
                    onCart = { navigatePrimary("cart") },
                    onHome = { navigatePrimary("home") },
                    onLanguageChange = onLanguageChange,
                    onRequests = { navigatePrimary("requests") },
                    updateState = updateState,
                    onCheckForUpdates = onCheckForUpdates,
                )
                Spacer(modifier = Modifier.height(headerContentGap))
                NavHost(
                    navController = navController,
                    startDestination = "home",
                    modifier = Modifier.weight(1f),
                ) {
                composable("home") {
                    HomeScreen(
                        state = state,
                        onAbout = { navController.navigate("about") },
                        onDestinations = { navController.navigate("destinations") },
                        onService = { navController.navigate("service") },
                    )
                }
                composable("service") {
                    ServiceScreen(
                        state = state,
                        onBack = { navController.popBackStack() },
                        onOpenFnb = { navController.navigate("fnb") },
                        onOpenUnit = { unit ->
                            selectedUnit = unit
                            navController.navigate("menu")
                        },
                    )
                }
                composable("fnb") {
                    FnbScreen(
                        state = state,
                        onBack = { navController.popBackStack() },
                        onOpenUnit = { unit ->
                            selectedUnit = unit
                            navController.navigate("menu")
                        },
                    )
                }
                composable("menu") {
                    val unit = selectedUnit
                    if (unit === null) {
                        EmptyScreen(onBack = { navController.popBackStack() })
                    } else {
                        MenuScreen(
                            state = state,
                            unit = unit,
                            onAdd = onAddVariantToCart,
                            onBack = { navController.popBackStack() },
                            onCart = { navController.navigate("cart") },
                        )
                    }
                }
                composable("about") {
                    AboutScreen(
                        onBack = { navController.popBackStack() },
                        onOpenGallery = { gallery -> navController.navigate(tvGalleryRoute(gallery)) },
                    )
                }
                composable("about/stay") {
                    TvGalleryScreen(
                        gallery = TvGalleryId.STAY,
                        onBack = { navController.popBackStack() },
                        onBrandChange = {},
                    )
                }
                composable("about/rest") {
                    TvGalleryScreen(
                        gallery = TvGalleryId.REST,
                        onBack = { navController.popBackStack() },
                        onBrandChange = {},
                    )
                }
                composable("about/taste/saji") {
                    TvGalleryScreen(
                        brand = TvGalleryBrand.SAJI,
                        gallery = TvGalleryId.TASTE,
                        onBack = { navController.popBackStack() },
                        onBrandChange = { selected ->
                            navController.navigate("about/taste/${selected.routeValue}") {
                                popUpTo("about/taste/saji") { inclusive = true }
                                launchSingleTop = true
                            }
                        },
                    )
                }
                composable("about/taste/7oz") {
                    TvGalleryScreen(
                        brand = TvGalleryBrand.SEVEN_OZ,
                        gallery = TvGalleryId.TASTE,
                        onBack = { navController.popBackStack() },
                        onBrandChange = { selected ->
                            navController.navigate("about/taste/${selected.routeValue}") {
                                popUpTo("about/taste/7oz") { inclusive = true }
                                launchSingleTop = true
                            }
                        },
                    )
                }
                composable("destinations") {
                    DestinationsScreen(onBack = { navController.popBackStack() })
                }
                composable("cart") {
                    CartScreen(
                        state = state,
                        onRemoveFromCart = onRemoveFromCart,
                        onSubmitCart = onSubmitCart,
                        onBack = { navController.popBackStack() },
                    )
                }
                composable("requests") {
                    RequestsScreen(
                        onBack = { navController.popBackStack() },
                        onRefresh = onRefreshRequests,
                        state = state,
                    )
                }
                }
                state.statusMessage?.let { message ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = when (message) {
                            TvStatusMessage.REQUEST_SUBMITTED -> stringResource(R.string.tv_request_submitted)
                        },
                        color = TvFocused,
                        fontFamily = HotelUiFont,
                        fontSize = 18.sp,
                    )
                }
                state.errorMessage?.let { message ->
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = localizedTvErrorMessage(state.errorCode ?: "TV_API_ERROR", message),
                        color = TvDanger,
                        fontFamily = HotelUiFont,
                        fontSize = 18.sp,
                    )
                }
            }
            TvUpdateFeedback(
                state = updateState,
                language = language,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = if (compactShell) 64.dp else 72.dp),
            )
        }
    }
}

@Composable
private fun localizedTvErrorMessage(errorCode: String?, fallback: String): String {
    return when (errorCode) {
        "CONTEXT_NOT_FOUND" -> stringResource(R.string.tv_error_context_not_found)
        "DEVICE_UNAUTHORIZED" -> stringResource(R.string.tv_error_device_unauthorized)
        "PAIRING_CODE_EXPIRED" -> stringResource(R.string.tv_error_pairing_expired)
        "MENU_NOT_CONFIGURED" -> stringResource(R.string.tv_menu_not_configured)
        null -> fallback
        else -> stringResource(R.string.tv_error_generic)
    }
}

@Composable
private fun TvHeader(
    cartCount: Int,
    language: TvLanguage,
    onCart: () -> Unit,
    onHome: () -> Unit,
    onLanguageChange: (TvLanguage) -> Unit,
    onRequests: () -> Unit,
    updateState: TvUpdateState,
    onCheckForUpdates: () -> Unit,
) {
    val homeFocusRequester = remember { FocusRequester() }
    val updateBusy = updateState is TvUpdateState.Checking || updateState is TvUpdateState.Downloading

    LaunchedEffect(Unit) {
        requestTvFocus(homeFocusRequester)
    }

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val compactHeader = maxWidth < 1_300.dp
        val actionGap = if (compactHeader) 8.dp else 12.dp
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HotelMark()
                Spacer(modifier = Modifier.width(if (compactHeader) 12.dp else 16.dp))
                Text(
                    text = stringResource(R.string.tv_brand),
                    color = TvIvory,
                    fontFamily = HotelDisplayFont,
                    fontSize = if (compactHeader) 26.sp else 30.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            TvLanguageSwitcher(
                language = language,
                onChange = onLanguageChange,
                compact = compactHeader,
            )
            Spacer(modifier = Modifier.width(actionGap))
            TvActionButton(
                label = stringResource(R.string.tv_home),
                modifier = Modifier.focusRequester(homeFocusRequester),
                onClick = onHome,
                compact = compactHeader,
            )
            Spacer(modifier = Modifier.width(actionGap))
            TvActionButton(
                label = stringResource(R.string.tv_my_requests),
                onClick = onRequests,
                compact = compactHeader,
            )
            Spacer(modifier = Modifier.width(actionGap))
            TvActionButton(
                label = stringResource(R.string.tv_cart, cartCount),
                onClick = onCart,
                compact = compactHeader,
            )
            Spacer(modifier = Modifier.width(actionGap))
            TvActionButton(
                label = stringResource(R.string.tv_updates),
                onClick = onCheckForUpdates,
                enabled = !updateBusy,
                compact = compactHeader,
                busy = updateBusy,
            )
        }
    }
}

@Composable
private fun TvLanguageSwitcher(
    language: TvLanguage,
    onChange: (TvLanguage) -> Unit,
    compact: Boolean = false,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        TvLanguage.entries.forEach { option ->
            TvActionButton(
                label = option.tag.uppercase(Locale.ROOT),
                selected = option == language,
                onClick = { onChange(option) },
                compact = compact,
            )
        }
    }
}

@Composable
private fun HomeScreen(
    state: TvUiState.Ready,
    onAbout: () -> Unit,
    onDestinations: () -> Unit,
    onService: () -> Unit,
) {
    val context = state.snapshot.context
    val occupied = context.roomStatus == RoomStatus.OCCUPIED && state.snapshot.guestData !== null

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val layout = tvHomeLayoutMetrics(maxHeight)
        val compact = layout.tier == TvHomeLayoutTier.COMPACT

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = layout.bottomInset),
            verticalArrangement = Arrangement.spacedBy(layout.sectionGap),
        ) {
            WelcomeBanner(
                context = context,
                layoutTier = layout.tier,
                height = layout.welcomeHeight,
            )
            Text(
                text = stringResource(R.string.tv_home_choose),
                color = TvIvory,
                fontFamily = HotelDisplayFont,
                fontSize = if (compact) 24.sp else 29.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.height(layout.headingHeight),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(if (compact) 12.dp else 18.dp),
            ) {
                TvPrimaryCard(
                    description = stringResource(
                        if (occupied) R.string.tv_service_description
                        else R.string.tv_service_unavailable,
                    ),
                    enabled = occupied,
                    index = "01",
                    compact = compact,
                    modifier = Modifier.weight(1f),
                    onClick = onService,
                    title = stringResource(R.string.tv_service),
                    cardHeight = layout.cardHeight,
                )
                TvPrimaryCard(
                    description = stringResource(R.string.tv_about_description),
                    index = "02",
                    compact = compact,
                    modifier = Modifier.weight(1f),
                    onClick = onAbout,
                    title = stringResource(R.string.tv_about),
                    cardHeight = layout.cardHeight,
                )
                TvPrimaryCard(
                    description = stringResource(R.string.tv_destinations_description),
                    index = "03",
                    compact = compact,
                    modifier = Modifier.weight(1f),
                    onClick = onDestinations,
                    title = stringResource(R.string.tv_destinations),
                    cardHeight = layout.cardHeight,
                )
            }
        }
    }
}

@Composable
private fun WelcomeBanner(
    context: TvContext,
    layoutTier: TvHomeLayoutTier,
    height: Dp,
) {
    val compact = layoutTier == TvHomeLayoutTier.COMPACT
    val guestName = context.welcome.guestName
    val title = if (guestName.isNullOrBlank()) {
        stringResource(R.string.tv_welcome_hotel)
    } else {
        stringResource(R.string.tv_welcome_guest, guestName)
    }
    val message = if (guestName.isNullOrBlank()) {
        stringResource(R.string.tv_welcome_vacant_message)
    } else {
        stringResource(R.string.tv_welcome_guest_message)
    }
    val stay = context.stay
    val language = LocalTvLanguage.current
    var nowMillis by remember { mutableStateOf(System.currentTimeMillis()) }
    val lifecycleOwner = LocalLifecycleOwner.current
    val staySummary = calculateTvStaySummary(stay, nowMillis)
    val hasGuest = !guestName.isNullOrBlank()

    LaunchedEffect(stay?.checkInAt, stay?.checkOutAt, stay?.totalDays, stay?.timeZone) {
        nowMillis = System.currentTimeMillis()
        while (isActive && stay !== null) {
            delay(60_000)
            nowMillis = System.currentTimeMillis()
        }
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                nowMillis = System.currentTimeMillis()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(18.dp))
            .background(TvSurfaceStrong)
            .border(1.dp, TvLine, RoundedCornerShape(18.dp))
            .padding(
                horizontal = if (compact) 28.dp else 36.dp,
                vertical = if (compact) 20.dp else 30.dp,
            ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(end = if (compact) 24.dp else 32.dp),
            verticalArrangement = if (hasGuest) Arrangement.SpaceBetween else Arrangement.Center,
        ) {
            Text(
                text = title,
                color = TvIvory,
                fontFamily = HotelDisplayFont,
                fontSize = if (compact) 32.sp else 40.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = message,
                color = TvMuted,
                fontFamily = HotelUiFont,
                fontSize = if (compact) 16.sp else 19.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (hasGuest) {
                TvStaySummary(
                    language = language,
                    summary = staySummary,
                    compact = compact,
                    totalDays = stay?.totalDays,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = stringResource(R.string.tv_room_label),
                color = TvFocused,
                fontFamily = HotelUiFont,
                fontSize = if (compact) 12.sp else 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
            )
            Text(
                text = context.device.room.number,
                color = TvIvory,
                fontFamily = HotelDisplayFont,
                fontSize = if (compact) 46.sp else 54.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

@Composable
private fun TvStaySummary(
    language: TvLanguage,
    summary: TvStayDisplayState?,
    compact: Boolean,
    totalDays: Int?,
) {
    if (summary == null) {
        Text(
            text = stringResource(R.string.tv_stay_unavailable),
            color = TvMuted,
            fontFamily = HotelUiFont,
            fontSize = if (compact) 13.sp else 15.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        return
    }

    val remainingLabel = when {
        summary.isExpired -> stringResource(R.string.tv_stay_ended)
        summary.daysRemaining == 1 -> stringResource(R.string.tv_stay_days_remaining_one, 1)
        else -> stringResource(R.string.tv_stay_days_remaining, summary.daysRemaining)
    }
    val checkOutValue = if (summary.isCheckOutToday) {
        stringResource(
            R.string.tv_stay_checkout_today,
            formatTvStayTime(summary.checkOutAtMillis, summary.timeZone),
        )
    } else {
        formatTvStayDate(summary.checkOutAtMillis, summary.timeZone, language)
    }
    val valueSize = if (compact) 15.sp else 18.sp
    val labelSize = if (compact) 9.sp else 10.sp
    val detailSize = if (compact) 10.sp else 11.sp

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(if (compact) 12.dp else 18.dp),
    ) {
        TvStayMetric(
            label = stringResource(R.string.tv_stay_check_in),
            value = formatTvStayDate(summary.checkInAtMillis, summary.timeZone, language),
            valueSize = valueSize,
            labelSize = labelSize,
            modifier = Modifier.weight(1f),
        )
        TvStayMetric(
            label = stringResource(R.string.tv_stay_check_out),
            value = checkOutValue,
            valueSize = valueSize,
            labelSize = labelSize,
            modifier = Modifier.weight(1f),
        )
        TvStayMetric(
            label = stringResource(R.string.tv_stay_status),
            value = remainingLabel,
            detail = totalDays?.let { stringResource(R.string.tv_stay_total_days, it) },
            valueSize = valueSize,
            labelSize = labelSize,
            detailSize = detailSize,
            valueColor = if (summary.isExpired) TvMuted else TvFocused,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun TvStayMetric(
    label: String,
    value: String,
    valueSize: androidx.compose.ui.unit.TextUnit,
    labelSize: androidx.compose.ui.unit.TextUnit,
    modifier: Modifier = Modifier,
    detail: String? = null,
    detailSize: androidx.compose.ui.unit.TextUnit = 11.sp,
    valueColor: Color = TvIvory,
) {
    Column(modifier = modifier) {
        Text(
            text = label,
            color = TvMuted,
            fontFamily = HotelUiFont,
            fontSize = labelSize,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            color = valueColor,
            fontFamily = HotelUiFont,
            fontSize = valueSize,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (detail !== null) {
            Text(
                text = detail,
                color = TvMuted,
                fontFamily = HotelUiFont,
                fontSize = detailSize,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun TvPrimaryCard(
    description: String,
    index: String,
    onClick: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    cardHeight: Dp = 190.dp,
    compact: Boolean = false,
) {
    TvInteractiveSurface(
        enabled = enabled,
        modifier = modifier.height(cardHeight),
        onClick = onClick,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    horizontal = if (compact) 20.dp else 26.dp,
                    vertical = if (compact) 18.dp else 24.dp,
                ),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = index,
                    color = TvFocused,
                    fontFamily = HotelUiFont,
                    fontSize = if (compact) 12.sp else 14.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                )
                Box(
                    modifier = Modifier
                        .height(1.dp)
                        .width(42.dp)
                        .background(if (enabled) TvFocused else TvLine),
                )
            }
            Column {
                Text(
                    text = title,
                    color = if (enabled) TvIvory else TvMuted,
                    fontFamily = HotelDisplayFont,
                    fontSize = if (compact) 27.sp else 31.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(if (compact) 6.dp else 8.dp))
                Text(
                    text = description,
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = if (compact) 14.sp else 16.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ServiceScreen(
    state: TvUiState.Ready,
    onBack: () -> Unit,
    onOpenFnb: () -> Unit,
    onOpenUnit: (UnitCode) -> Unit,
) {
    val units = state.snapshot.guestData?.departments?.items
        ?.flatMap { department -> department.units }
        ?.associateBy { unit -> unit.code }
        ?: emptyMap()
    val initialFocusRequester = remember { FocusRequester() }
    val housekeepingEnabled = units[UnitCode.HOUSEKEEPING]?.enabled == true
    val fnbEnabled = units[UnitCode.RESTAURANT]?.enabled == true || units[UnitCode.LOUNGE]?.enabled == true
    val cafeEnabled = units[UnitCode.CAFE]?.enabled == true
    val spaEnabled = units[UnitCode.SPA]?.enabled == true
    val beautySalonEnabled = units[UnitCode.BEAUTY_AND_SALON]?.enabled == true
    val butikEnabled = units[UnitCode.BUTIK_INDONESIA]?.enabled == true
    val firstEnabledIndex = when {
        housekeepingEnabled -> "01"
        fnbEnabled -> "02"
        cafeEnabled -> "03"
        spaEnabled -> "04"
        beautySalonEnabled -> "05"
        butikEnabled -> "06"
        else -> null
    }

    LaunchedEffect(firstEnabledIndex) {
        if (firstEnabledIndex !== null) requestTvFocus(initialFocusRequester)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_service),
            description = stringResource(R.string.tv_service_description),
            initialFocus = firstEnabledIndex === null,
            onBack = onBack,
        )
        Spacer(modifier = Modifier.height(22.dp))
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 16.dp),
        ) {
            item {
                ServiceCard(
                    enabled = housekeepingEnabled,
                    index = "01",
                    modifier = if (firstEnabledIndex == "01") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_housekeeping),
                    onClick = { onOpenUnit(UnitCode.HOUSEKEEPING) },
                )
            }
            item {
                ServiceCard(
                    enabled = fnbEnabled,
                    index = "02",
                    modifier = if (firstEnabledIndex == "02") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_fnb),
                    onClick = onOpenFnb,
                )
            }
            item {
                ServiceCard(
                    enabled = cafeEnabled,
                    index = "03",
                    modifier = if (firstEnabledIndex == "03") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_cafe),
                    onClick = { onOpenUnit(UnitCode.CAFE) },
                )
            }
            item {
                ServiceCard(
                    enabled = spaEnabled,
                    index = "04",
                    modifier = if (firstEnabledIndex == "04") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_spa),
                    onClick = { onOpenUnit(UnitCode.SPA) },
                )
            }
            item {
                ServiceCard(
                    enabled = beautySalonEnabled,
                    index = "05",
                    modifier = if (firstEnabledIndex == "05") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_beauty_salon),
                    onClick = { onOpenUnit(UnitCode.BEAUTY_AND_SALON) },
                )
            }
            item {
                ServiceCard(
                    enabled = butikEnabled,
                    index = "06",
                    modifier = if (firstEnabledIndex == "06") {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    },
                    title = stringResource(R.string.tv_butik_indonesia),
                    onClick = { onOpenUnit(UnitCode.BUTIK_INDONESIA) },
                )
            }
        }
    }
}

@Composable
private fun ServiceCard(
    enabled: Boolean,
    index: String,
    modifier: Modifier = Modifier,
    title: String,
    onClick: () -> Unit,
) {
    TvPrimaryCard(
        description = stringResource(if (enabled) R.string.tv_explore else R.string.tv_unavailable),
        enabled = enabled,
        index = index,
        modifier = modifier.fillMaxWidth(),
        onClick = onClick,
        title = title,
        cardHeight = 176.dp,
    )
}

@Composable
private fun FnbScreen(
    state: TvUiState.Ready,
    onBack: () -> Unit,
    onOpenUnit: (UnitCode) -> Unit,
) {
    val units = state.snapshot.guestData?.departments?.items
        ?.flatMap { department -> department.units }
        ?.associateBy { unit -> unit.code }
        ?: emptyMap()
    val initialFocusRequester = remember { FocusRequester() }
    val restaurantEnabled = units[UnitCode.RESTAURANT]?.enabled == true
    val loungeEnabled = units[UnitCode.LOUNGE]?.enabled == true
    val firstEnabledUnit = when {
        restaurantEnabled -> UnitCode.RESTAURANT
        loungeEnabled -> UnitCode.LOUNGE
        else -> null
    }

    LaunchedEffect(firstEnabledUnit) {
        if (firstEnabledUnit !== null) requestTvFocus(initialFocusRequester)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_fnb),
            description = stringResource(R.string.tv_fnb_description),
            initialFocus = firstEnabledUnit === null,
            onBack = onBack,
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ServiceCard(
                enabled = restaurantEnabled,
                index = "01",
                modifier = Modifier
                    .weight(1f)
                    .then(if (firstEnabledUnit == UnitCode.RESTAURANT) {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    }),
                title = stringResource(R.string.tv_saji_nusantara),
                onClick = { onOpenUnit(UnitCode.RESTAURANT) },
            )
            ServiceCard(
                enabled = loungeEnabled,
                index = "02",
                modifier = Modifier
                    .weight(1f)
                    .then(if (firstEnabledUnit == UnitCode.LOUNGE) {
                        Modifier.focusRequester(initialFocusRequester)
                    } else {
                        Modifier
                    }),
                title = stringResource(R.string.tv_lounge),
                onClick = { onOpenUnit(UnitCode.LOUNGE) },
            )
        }
    }
}

@Composable
private fun MenuScreen(
    state: TvUiState.Ready,
    unit: UnitCode,
    onAdd: (MenuItem, String?) -> Unit,
    onBack: () -> Unit,
    onCart: () -> Unit,
) {
    val menuResponse = state.snapshot.guestData?.menusByUnit?.get(unit)
    val allItems = menuResponse?.items
        ?.filter { item -> item.active }
        .orEmpty()
    val categories = menuResponse?.categories
        ?.filter { category -> category.active }
        ?.sortedWith(compareBy<BoutiqueCategory> { it.sortOrder }.thenBy { it.id })
        .orEmpty()
        .ifEmpty {
            allItems.mapNotNull { item -> item.category }
                .distinctBy { category -> category.id }
                .sortedWith(compareBy<BoutiqueCategory> { it.sortOrder }.thenBy { it.id })
        }
    var selectedCategoryId by remember(unit) { mutableStateOf<String?>(null) }
    val items = allItems.filter { item ->
        unit != UnitCode.BUTIK_INDONESIA || selectedCategoryId === null || item.categoryId == selectedCategoryId
    }
    val pageSize = 10
    val totalPages = maxOf(1, (items.size + pageSize - 1) / pageSize)
    var page by remember(unit) { mutableStateOf(1) }
    val visibleItems = items.drop((page - 1) * pageSize).take(pageSize)
    val categoryFocusRequester = remember { FocusRequester() }

    LaunchedEffect(selectedCategoryId) {
        page = 1
    }
    LaunchedEffect(unit, categories.isNotEmpty()) {
        if (unit == UnitCode.BUTIK_INDONESIA && categories.isNotEmpty()) {
            requestTvFocus(categoryFocusRequester)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = unitLabel(unit),
            description = stringResource(R.string.tv_menu_description),
            initialFocus = visibleItems.isEmpty() && categories.isEmpty(),
            onBack = onBack,
            trailing = {
                if (state.cart.isNotEmpty()) {
                    TvActionButton(label = stringResource(R.string.tv_view_cart), onClick = onCart)
                }
            },
        )
        Spacer(modifier = Modifier.height(20.dp))
        if (unit == UnitCode.BUTIK_INDONESIA && categories.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                TvActionButton(
                    label = stringResource(R.string.tv_all),
                    modifier = Modifier.focusRequester(categoryFocusRequester),
                    selected = selectedCategoryId === null,
                    onClick = { selectedCategoryId = null },
                )
                categories.forEach { category ->
                    TvActionButton(
                        label = localize(category.localizedName),
                        selected = selectedCategoryId == category.id,
                        onClick = { selectedCategoryId = category.id },
                    )
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
        }
        if (visibleItems.isEmpty()) {
            EmptyScreen(title = stringResource(R.string.tv_no_menu), onBack = null)
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 14.dp),
            ) {
                itemsIndexed(visibleItems, key = { _, item -> item.id }) { index, item ->
                    MenuItemRow(
                        enabled = !state.isSubmitting,
                        initialFocus = index == 0 && categories.isEmpty(),
                        item = item,
                        onAdd = { variantId -> onAdd(item, variantId) },
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TvActionButton(
                    enabled = page > 1,
                    label = stringResource(R.string.tv_previous),
                    onClick = { page = maxOf(1, page - 1) },
                )
                Text(
                    text = stringResource(R.string.tv_page, page, totalPages),
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 18.sp,
                )
                TvActionButton(
                    enabled = page < totalPages,
                    label = stringResource(R.string.tv_next),
                    onClick = { page = minOf(totalPages, page + 1) },
                )
            }
        }
    }
}

@Composable
private fun MenuItemRow(
    enabled: Boolean = true,
    initialFocus: Boolean = false,
    item: MenuItem,
    onAdd: (String?) -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    var selectedVariantIndex by remember(item.id) { mutableStateOf(0) }
    val initialFocusRequester = remember { FocusRequester() }
    val variants = item.variants.filter { variant -> variant.active }
    val selectedVariant = if (variants.isEmpty()) {
        null
    } else {
        variants[selectedVariantIndex.coerceIn(0, variants.lastIndex)]
    }
    val canOrder = enabled && item.available && (variants.isEmpty() || selectedVariant?.availableQuantity ?: 0 > 0)

    LaunchedEffect(initialFocus) {
        if (initialFocus) requestTvFocus(initialFocusRequester)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(TvSurface)
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) TvFocused else TvLine,
                shape = RoundedCornerShape(16.dp),
            )
            .padding(22.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = localizedMenuName(item),
                color = TvIvory,
                fontFamily = HotelDisplayFont,
                fontSize = 25.sp,
                fontWeight = FontWeight.SemiBold,
            )
            localizedMenuDescription(item)?.let { description ->
                Text(
                    text = description,
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 18.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (variants.size > 1) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TvActionButton(
                        enabled = true,
                        label = "‹",
                        onClick = {
                            selectedVariantIndex = (selectedVariantIndex - 1 + variants.size) % variants.size
                        },
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.tv_select_variant),
                            color = TvMuted,
                            fontFamily = HotelUiFont,
                            fontSize = 14.sp,
                        )
                        Text(
                            text = selectedVariant?.variantLabel() ?: stringResource(R.string.tv_no_menu),
                            color = TvIvory,
                            fontFamily = HotelUiFont,
                            fontSize = 17.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    TvActionButton(
                        enabled = true,
                        label = "›",
                        modifier = if (initialFocus) Modifier.focusRequester(initialFocusRequester) else Modifier,
                        onClick = {
                            selectedVariantIndex = (selectedVariantIndex + 1) % variants.size
                        },
                    )
                }
            }
            Text(
                text = formatPrice(item, selectedVariant),
                color = TvFocused,
                fontFamily = HotelUiFont,
                fontSize = 18.sp,
            )
            if (selectedVariant !== null) {
                Text(
                    text = if (selectedVariant.availableQuantity > 0) {
                        stringResource(R.string.tv_stock, selectedVariant.availableQuantity)
                    } else {
                        stringResource(R.string.tv_out_of_stock)
                    },
                    color = if (selectedVariant.availableQuantity > 0) TvMuted else TvDanger,
                    fontFamily = HotelUiFont,
                    fontSize = 15.sp,
                )
                Text(
                    text = stringResource(R.string.tv_sku, selectedVariant.sku),
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 14.sp,
                )
            } else if (!item.available) {
                Text(
                    text = stringResource(R.string.tv_out_of_stock),
                    color = TvDanger,
                    fontFamily = HotelUiFont,
                    fontSize = 15.sp,
                )
            }
        }
        Spacer(modifier = Modifier.width(24.dp))
        TvActionButton(
            enabled = canOrder,
            label = if (canOrder) stringResource(R.string.tv_add) else stringResource(R.string.tv_out_of_stock),
            modifier = Modifier
                .then(if (initialFocus && variants.size <= 1) Modifier.focusRequester(initialFocusRequester) else Modifier)
                .onFocusChanged { focused = it.isFocused },
            onClick = { onAdd(selectedVariant?.id) },
        )
    }
}

@Composable
private fun CartScreen(
    state: TvUiState.Ready,
    onRemoveFromCart: (String) -> Unit,
    onSubmitCart: () -> Unit,
    onBack: () -> Unit,
) {
    val firstLineFocusRequester = remember { FocusRequester() }

    LaunchedEffect(state.cart.firstOrNull()?.item?.id, state.cart.isNotEmpty()) {
        if (state.cart.isNotEmpty()) requestTvFocus(firstLineFocusRequester)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        PageHeader(
            title = stringResource(R.string.tv_your_request),
            description = stringResource(R.string.tv_cart_description),
            initialFocus = state.cart.isEmpty(),
            onBack = onBack,
        )
        if (state.cart.isEmpty()) {
            Text(
                text = stringResource(R.string.tv_cart_empty),
                color = TvMuted,
                fontFamily = HotelUiFont,
                fontSize = 22.sp,
            )
        } else {
            val groupedCart = state.cart.groupBy { line -> line.item.unit }
            val firstLineKey = state.cart.firstOrNull()?.key
            groupedCart.forEach { (unit, lines) ->
                Text(
                    text = unitLabel(unit),
                    color = TvFocused,
                    fontFamily = HotelDisplayFont,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                lines.forEach { line ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(TvSurface)
                            .padding(20.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = buildString {
                                append("${line.quantity} × ${localizedMenuName(line.item)}")
                                line.variant?.let { variant -> append(" · ${variant.variantLabel()}") }
                            },
                            color = TvIvory,
                            fontFamily = HotelUiFont,
                            fontSize = 22.sp,
                            modifier = Modifier.weight(1f),
                        )
                        TvActionButton(
                            enabled = !state.isSubmitting,
                            label = stringResource(R.string.tv_remove),
                            modifier = if (line.key == firstLineKey) {
                                Modifier.focusRequester(firstLineFocusRequester)
                            } else {
                                Modifier
                            },
                            onClick = { onRemoveFromCart(line.key) },
                        )
                    }
                }
            }
            TvActionButton(
                label = if (state.isSubmitting) {
                    stringResource(R.string.tv_submitting)
                } else {
                    stringResource(R.string.tv_submit_request)
                },
                enabled = !state.isSubmitting && state.snapshot.guestData !== null,
                onClick = onSubmitCart,
            )
        }
    }
}

@Composable
private fun RequestsScreen(
    state: TvUiState.Ready,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    val requests = state.snapshot.guestData?.requests?.items.orEmpty()
    LaunchedEffect(Unit) {
        while (isActive) {
            onRefresh()
            delay(30_000L)
        }
    }
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            PageHeader(
                title = stringResource(R.string.tv_my_requests),
                description = stringResource(R.string.tv_requests_description),
                initialFocus = true,
                onBack = onBack,
            )
        }
        if (requests.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.tv_no_requests),
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 22.sp,
                )
            }
        } else {
            val requestGroups = requests.groupBy { request -> request.clientRequestId }.values.toList()
            items(requestGroups, key = { group -> group.first().clientRequestId }) { group ->
                RequestGroupRow(group)
            }
        }
    }
}

@Composable
private fun RequestGroupRow(requests: List<GuestRequest>) {
    val language = currentTvLanguage()
    TvFocusableSurface(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = if (requests.size > 1) {
                    stringResource(R.string.tv_combined_request)
                } else {
                    unitLabel(requests.first().unit)
                },
                color = TvFocused,
                fontFamily = HotelDisplayFont,
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
            )
            requests.forEach { request ->
                val itemSummary = request.items.joinToString { item ->
                    "${item.quantity} × ${item.localizedName?.forLanguage(language)?.takeIf { it.isNotBlank() } ?: item.name}"
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = unitLabel(request.unit),
                            color = TvIvory,
                            fontFamily = HotelUiFont,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = itemSummary,
                            color = TvMuted,
                            fontFamily = HotelUiFont,
                            fontSize = 17.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Text(
                        text = requestStatusLabel(request.status),
                        color = requestStatusColor(request.status),
                        fontFamily = HotelUiFont,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

@Composable
private fun requestStatusLabel(status: RequestStatus): String = when (status) {
    RequestStatus.NEW -> stringResource(R.string.tv_status_new)
    RequestStatus.IN_PROCESS -> stringResource(R.string.tv_status_in_process)
    RequestStatus.COMPLETED -> stringResource(R.string.tv_status_completed)
    RequestStatus.CANCELLED -> stringResource(R.string.tv_status_cancelled)
}

private fun requestStatusColor(status: RequestStatus): Color = when (status) {
    RequestStatus.COMPLETED -> TvFocused
    RequestStatus.CANCELLED -> TvDanger
    else -> TvIvory
}

@Composable
private fun AboutScreen(
    onBack: () -> Unit,
    onOpenGallery: (TvGalleryId) -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_about),
            description = stringResource(R.string.tv_about_description),
            initialFocus = true,
            onBack = onBack,
        )
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(top = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            items(TV_ABOUT_FEATURES) { feature ->
                TvInteractiveSurface(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onOpenGallery(feature.galleryId) },
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Image(
                            painter = painterResource(feature.imageRes),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .height(150.dp)
                                .width(250.dp),
                        )
                        Column(modifier = Modifier.padding(24.dp)) {
                            Text(
                                text = localize(feature.title),
                                color = TvIvory,
                                fontFamily = HotelDisplayFont,
                                fontSize = 25.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = localize(feature.body),
                                color = TvMuted,
                                fontFamily = HotelUiFont,
                                fontSize = 18.sp,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TvGalleryScreen(
    gallery: TvGalleryId,
    onBack: () -> Unit,
    onBrandChange: (TvGalleryBrand) -> Unit,
    brand: TvGalleryBrand? = null,
) {
    val activeBrand = brand ?: TvGalleryBrand.SAJI
    var activeRoomType by remember(gallery) { mutableStateOf(TvStayRoomType.JUNIOR_SUITE) }
    val activeRoomGallery = TV_STAY_ROOM_GALLERIES.firstOrNull { it.type == activeRoomType }
    val allItems = TV_GALLERY_ITEMS[gallery].orEmpty()
    val items = when (gallery) {
        TvGalleryId.STAY -> activeRoomGallery?.items.orEmpty()
        TvGalleryId.TASTE -> allItems.filter { it.brand == activeBrand }
        TvGalleryId.REST -> allItems
    }
    var activeIndex by remember(gallery, activeBrand, activeRoomType) { mutableStateOf(0) }
    var viewerOpen by remember(gallery, activeBrand, activeRoomType) { mutableStateOf(false) }
    val initialFocusRequester = remember(gallery, activeBrand) { FocusRequester() }
    val viewerCloseRequester = remember(gallery, activeBrand) { FocusRequester() }
    val backFocusRequester = remember(gallery, activeBrand) { FocusRequester() }
    val roomFocusRequesters = remember(gallery) {
        TV_STAY_ROOM_GALLERIES.map { FocusRequester() }
    }
    val brandFocusRequesters = remember(gallery) {
        listOf(FocusRequester(), FocusRequester())
    }
    val activeItem = items.getOrNull(activeIndex) ?: items.firstOrNull()
    val title = TV_ABOUT_FEATURES.firstOrNull { it.galleryId == gallery }
        ?.title
        ?.let { value -> localize(value) }
        ?: stringResource(R.string.tv_about)
    val description = when (gallery) {
        TvGalleryId.STAY -> stringResource(R.string.tv_gallery_stay_description)
        TvGalleryId.TASTE -> stringResource(R.string.tv_gallery_taste_description)
        TvGalleryId.REST -> stringResource(R.string.tv_gallery_rest_description)
    }

    LaunchedEffect(gallery, activeBrand) {
        if (items.isNotEmpty()) requestTvFocus(initialFocusRequester)
    }
    LaunchedEffect(viewerOpen) {
        if (viewerOpen) requestTvFocus(viewerCloseRequester)
    }
    BackHandler(enabled = viewerOpen) {
        viewerOpen = false
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            PageHeader(
                title = title,
                description = description,
                backFocusRequester = backFocusRequester,
                onBack = onBack,
            )
            if (gallery == TvGalleryId.STAY) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(22.dp),
                ) {
                    TV_STAY_ROOM_GALLERIES.forEachIndexed { index, roomGallery ->
                        TvGalleryTab(
                            label = localize(roomGallery.label),
                            modifier = Modifier
                                .weight(1f)
                                .focusRequester(roomFocusRequesters[index])
                                .focusProperties {
                                    up = backFocusRequester
                                    down = initialFocusRequester
                                    if (index > 0) left = roomFocusRequesters[index - 1]
                                    if (index < TV_STAY_ROOM_GALLERIES.lastIndex) {
                                        right = roomFocusRequesters[index + 1]
                                    }
                                },
                            onClick = { activeRoomType = roomGallery.type },
                            onFocused = { activeRoomType = roomGallery.type },
                            selected = activeRoomType == roomGallery.type,
                        )
                    }
                }
            }
            if (gallery == TvGalleryId.TASTE) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    TvGalleryTab(
                        label = stringResource(R.string.tv_gallery_saji),
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(brandFocusRequesters[0])
                            .focusProperties {
                                up = backFocusRequester
                                down = initialFocusRequester
                                right = brandFocusRequesters[1]
                            },
                        onClick = { onBrandChange(TvGalleryBrand.SAJI) },
                        selected = activeBrand == TvGalleryBrand.SAJI,
                    )
                    TvGalleryTab(
                        label = stringResource(R.string.tv_gallery_7oz),
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(brandFocusRequesters[1])
                            .focusProperties {
                                up = backFocusRequester
                                down = initialFocusRequester
                                left = brandFocusRequesters[0]
                            },
                        onClick = { onBrandChange(TvGalleryBrand.SEVEN_OZ) },
                        selected = activeBrand == TvGalleryBrand.SEVEN_OZ,
                    )
                }
            }
            if (activeItem === null) {
                Text(
                    text = stringResource(R.string.tv_gallery_unavailable),
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 22.sp,
                    modifier = Modifier.padding(top = 24.dp),
                )
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(top = 18.dp, bottom = 18.dp),
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    TvInteractiveSurface(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .focusRequester(initialFocusRequester)
                            .focusProperties {
                                up = when (gallery) {
                                    TvGalleryId.STAY -> {
                                        val index = TV_STAY_ROOM_GALLERIES.indexOfFirst {
                                            it.type == activeRoomType
                                        }.coerceAtLeast(0)
                                        roomFocusRequesters[index]
                                    }
                                    TvGalleryId.TASTE -> brandFocusRequesters[
                                        if (activeBrand == TvGalleryBrand.SAJI) 0 else 1
                                    ]
                                    TvGalleryId.REST -> backFocusRequester
                                }
                                down = backFocusRequester
                            },
                        onClick = { viewerOpen = true },
                        onDpadLeft = {
                            activeIndex = (activeIndex - 1 + items.size) % items.size
                        },
                        onDpadRight = {
                            activeIndex = (activeIndex + 1) % items.size
                        },
                    ) {
                        Box(modifier = Modifier.fillMaxSize()) {
                            Image(
                                painter = painterResource(activeItem.imageRes),
                                contentDescription = localize(activeItem.title),
                                contentScale = ContentScale.Fit,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF061426)),
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(
                                        Brush.verticalGradient(
                                            0f to Color.Transparent,
                                            0.7f to Color.Transparent,
                                            1f to Color(0xE6071426),
                                        ),
                                    ),
                            )
                            Column(
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(22.dp),
                            ) {
                                Text(
                                    text = localize(activeItem.title),
                                    color = TvIvory,
                                    fontFamily = HotelDisplayFont,
                                    fontSize = 25.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    text = stringResource(
                                        R.string.tv_gallery_photo,
                                        activeIndex + 1,
                                        items.size,
                                    ),
                                    color = TvFocused,
                                    fontFamily = HotelUiFont,
                                    fontSize = 16.sp,
                                )
                            }
                        }
                    }
                }
            }
        }
        if (viewerOpen && activeItem !== null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xF5071426))
                    .padding(26.dp),
            ) {
                Image(
                    painter = painterResource(activeItem.imageRes),
                    contentDescription = localize(activeItem.title),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(vertical = 44.dp, horizontal = 70.dp),
                )
                TvActionButton(
                    label = stringResource(R.string.tv_back),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .focusRequester(viewerCloseRequester),
                    onClick = { viewerOpen = false },
                )
                if (items.size > 1) {
                    TvActionButton(
                        label = "‹",
                        modifier = Modifier.align(Alignment.CenterStart),
                        onClick = {
                            activeIndex = (activeIndex - 1 + items.size) % items.size
                        },
                    )
                    TvActionButton(
                        label = "›",
                        modifier = Modifier.align(Alignment.CenterEnd),
                        onClick = { activeIndex = (activeIndex + 1) % items.size },
                    )
                }
                Column(modifier = Modifier.align(Alignment.BottomStart)) {
                    Text(
                        text = localize(activeItem.title),
                        color = TvIvory,
                        fontFamily = HotelDisplayFont,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.tv_gallery_photo, activeIndex + 1, items.size),
                        color = TvFocused,
                        fontFamily = HotelUiFont,
                        fontSize = 16.sp,
                    )
                }
            }
        }
    }
}

@Composable
private fun TvGalleryTab(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    onFocused: (() -> Unit)? = null,
    selected: Boolean = false,
) {
    var focused by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }
    Column(
        modifier = modifier
            .onFocusChanged {
                val nextFocused = it.isFocused
                if (nextFocused && !focused) onFocused?.invoke()
                focused = nextFocused
            }
            .onPreviewKeyEvent { event ->
                if (event.key in TvActivationKeys) {
                    if (event.type == KeyEventType.KeyUp) onClick()
                    true
                } else {
                    false
                }
            }
            .focusable()
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .then(
                if (focused) {
                    Modifier.border(2.dp, TvFocused, RoundedCornerShape(6.dp))
                } else {
                    Modifier
                },
            )
            .padding(horizontal = 10.dp, vertical = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = label,
            color = if (focused) TvIvory else if (selected) TvFocused else TvMuted,
            fontFamily = HotelUiFont,
            fontSize = 16.sp,
            fontWeight = if (focused || selected) FontWeight.SemiBold else FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(modifier = Modifier.height(6.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(if (focused || selected) 3.dp else 1.dp)
                .background(if (focused || selected) TvFocused else TvLine),
        )
    }
}

@Composable
private fun TvFocusableSurface(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(18.dp)

    Box(
        modifier = modifier
            .clip(shape)
            .background(if (focused) Color(0xEB193653) else TvSurface)
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) TvFocused else TvLine,
                shape = shape,
            )
            .onFocusChanged { focused = it.isFocused }
            .focusable(),
        content = content,
    )
}

@Composable
private fun DestinationsScreen(onBack: () -> Unit) {
    var activeIndex by remember { mutableStateOf(0) }
    val destination = TV_DESTINATIONS[activeIndex]
    val initialFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        requestTvFocus(initialFocusRequester)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_destinations),
            description = stringResource(R.string.tv_destinations_description),
            onBack = onBack,
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvDestinationVideo(videoRes = destination.videoRes)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = localize(destination.eyebrow),
                    color = TvFocused,
                    fontFamily = HotelUiFont,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = localize(destination.title),
                    color = TvIvory,
                    fontFamily = HotelDisplayFont,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = localize(destination.description),
                    color = TvMuted,
                    fontFamily = HotelUiFont,
                    fontSize = 19.sp,
                )
                Spacer(modifier = Modifier.height(16.dp))
                destination.facts.forEach { fact ->
                    Text(
                        text = "• ${localize(fact)}",
                        color = TvMuted,
                        fontFamily = HotelUiFont,
                        fontSize = 17.sp,
                    )
                }
                Spacer(modifier = Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TvActionButton(
                        enabled = activeIndex > 0,
                        label = stringResource(R.string.tv_previous),
                        onClick = { activeIndex = maxOf(0, activeIndex - 1) },
                    )
                    Text(
                        text = stringResource(R.string.tv_page, activeIndex + 1, TV_DESTINATIONS.size),
                        color = TvMuted,
                        fontFamily = HotelUiFont,
                        fontSize = 18.sp,
                    )
                    TvActionButton(
                        enabled = activeIndex < TV_DESTINATIONS.lastIndex,
                        label = stringResource(R.string.tv_next),
                        modifier = Modifier.focusRequester(initialFocusRequester),
                        onClick = { activeIndex = minOf(TV_DESTINATIONS.lastIndex, activeIndex + 1) },
                    )
                }
            }
        }
    }
}

@Composable
private fun TvDestinationVideo(videoRes: Int) {
    AndroidView(
        factory = { context ->
            VideoView(context).apply {
                setOnPreparedListener { player ->
                    player.isLooping = true
                    player.start()
                }
                tag = videoRes
                setVideoURI(Uri.parse("android.resource://${context.packageName}/$videoRes"))
            }
        },
        update = { view ->
            val uri = Uri.parse("android.resource://${view.context.packageName}/$videoRes")
            if (view.tag != videoRes) {
                view.tag = videoRes
                view.setVideoURI(uri)
            }
        },
        modifier = Modifier
            .height(330.dp)
            .width(560.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Color.Black),
    )
}

@Composable
private fun PageHeader(
    title: String,
    description: String,
    initialFocus: Boolean = false,
    backFocusRequester: FocusRequester? = null,
    onBack: (() -> Unit)?,
    trailing: @Composable (() -> Unit)? = null,
) {
    val initialFocusRequester = remember { FocusRequester() }

    LaunchedEffect(initialFocus) {
        if (initialFocus && onBack !== null) requestTvFocus(initialFocusRequester)
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = TvIvory,
                fontFamily = HotelDisplayFont,
                fontSize = 40.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = description, color = TvMuted, fontFamily = HotelUiFont, fontSize = 18.sp)
        }
        trailing?.invoke()
        if (onBack !== null) {
            Spacer(modifier = Modifier.width(14.dp))
            TvActionButton(
                label = stringResource(R.string.tv_back),
                modifier = Modifier
                    .then(
                        if (initialFocus) {
                            Modifier.focusRequester(initialFocusRequester)
                        } else {
                            Modifier
                        },
                    )
                    .then(
                        if (backFocusRequester !== null) {
                            Modifier.focusRequester(backFocusRequester)
                        } else {
                            Modifier
                        },
                    ),
                onClick = onBack,
            )
        }
    }
}

@Composable
private fun EmptyScreen(
    title: String = stringResource(R.string.tv_not_ready),
    onBack: (() -> Unit)?,
) {
    val initialFocusRequester = remember { FocusRequester() }

    LaunchedEffect(onBack !== null) {
        if (onBack !== null) requestTvFocus(initialFocusRequester)
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = title, color = TvMuted, fontFamily = HotelUiFont, fontSize = 22.sp)
        if (onBack !== null) {
            Spacer(modifier = Modifier.height(18.dp))
            TvActionButton(
                label = stringResource(R.string.tv_back),
                modifier = Modifier.focusRequester(initialFocusRequester),
                onClick = onBack,
            )
        }
    }
}

@Composable
private fun TvInteractiveSurface(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onDpadLeft: (() -> Unit)? = null,
    onDpadRight: (() -> Unit)? = null,
    content: @Composable BoxScope.() -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (focused && enabled) 1.018f else 1f,
        animationSpec = spring(stiffness = 700f),
        label = "tv-focus-scale",
    )
    val shape = RoundedCornerShape(18.dp)
    val interactionSource = remember { MutableInteractionSource() }

    Box(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(shape)
            .background(
                when {
                    !enabled -> Color(0x6610223A)
                    focused -> Color(0xEB193653)
                    else -> TvSurface
                },
            )
            .border(
                width = if (focused && enabled) 3.dp else 1.dp,
                color = if (focused && enabled) TvFocused else TvLine,
                shape = shape,
            )
            .onFocusChanged { focused = it.isFocused }
            .onPreviewKeyEvent { event ->
                if (
                    enabled &&
                    event.type == KeyEventType.KeyDown &&
                    event.key == Key.DirectionLeft &&
                    onDpadLeft !== null
                ) {
                    onDpadLeft()
                    true
                } else if (
                    enabled &&
                    event.type == KeyEventType.KeyDown &&
                    event.key == Key.DirectionRight &&
                    onDpadRight !== null
                ) {
                    onDpadRight()
                    true
                } else if (enabled && event.key in TvActivationKeys) {
                    if (event.type == KeyEventType.KeyUp) onClick()
                    true
                } else {
                    false
                }
            }
            .focusable(enabled)
            .clickable(
                enabled = enabled,
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            ),
        content = content,
    )
}

@Composable
private fun TvActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    selected: Boolean = false,
    compact: Boolean = false,
    busy: Boolean = false,
) {
    var focused by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(
        targetValue = if (focused && enabled) 1.035f else 1f,
        animationSpec = spring(stiffness = 700f),
        label = "tv-action-focus-scale",
    )
    val shape = RoundedCornerShape(10.dp)
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(shape)
            .background(
                when {
                    focused && enabled -> TvFocused
                    selected -> TvGoldSoft
                    else -> Color(0xB80C2037)
                },
            )
            .border(
                width = if (focused || selected) 2.dp else 1.dp,
                color = if (focused || selected) TvFocused else TvLine,
                shape = shape,
            )
            .onFocusChanged { focused = it.isFocused }
            .onPreviewKeyEvent { event ->
                if (enabled && event.key in TvActivationKeys) {
                    if (event.type == KeyEventType.KeyUp) onClick()
                    true
                } else {
                    false
                }
            }
            .focusable(enabled)
            .clickable(
                enabled = enabled,
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .heightIn(min = 48.dp)
            .padding(
                horizontal = if (compact) 14.dp else 18.dp,
                vertical = if (compact) 10.dp else 12.dp,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(
                text = label,
                color = if (focused && enabled) TvBackground else if (enabled) TvIvory else TvMuted,
                fontFamily = HotelUiFont,
                fontSize = if (compact) 15.sp else 16.sp,
                fontWeight = if (focused || selected) FontWeight.SemiBold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (busy) {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .background(
                            if (focused) TvBackground else TvFocused,
                            CircleShape,
                        ),
                )
            }
        }
    }
}

@Composable
private fun localizedMenuName(item: MenuItem): String =
    item.localizedName?.let { localize(it).takeIf { value -> value.isNotBlank() } } ?: item.name

@Composable
private fun localizedMenuDescription(item: MenuItem): String? =
    item.localizedDescription?.let { localize(it).takeIf { value -> value.isNotBlank() } }
        ?: item.description

@Composable
private fun localize(value: LocalizedText): String = value.forLanguage(currentTvLanguage())

@Composable
private fun currentTvLanguage(): TvLanguage {
    return LocalTvLanguage.current
}

private fun LocalizedText.forLanguage(language: TvLanguage): String = listOf(
    when (language) {
        TvLanguage.UZ -> uz
        TvLanguage.RU -> ru
        TvLanguage.EN -> en
    },
    en,
    ru,
    uz,
).firstOrNull { value -> value.isNotBlank() }.orEmpty()

@Composable
private fun formatPrice(item: MenuItem, variant: BoutiqueVariant? = null): String {
    val price = variant?.price ?: item.price
    val currency = variant?.currency ?: item.currency
    if (price === null || currency === null) return stringResource(R.string.tv_price_not_set)
    val locale = when (currentTvLanguage()) {
        TvLanguage.UZ -> Locale.forLanguageTag("uz-UZ")
        TvLanguage.RU -> Locale.forLanguageTag("ru-RU")
        TvLanguage.EN -> Locale.UK
    }
    return runCatching {
        NumberFormat.getNumberInstance(locale).format(price.toLong()) + " $currency"
    }.getOrDefault("${price.toLong()} $currency")
}

@Composable
private fun BoutiqueVariant.variantLabel(): String {
    val labels = mutableListOf<String>()
    for (option in options) {
        labels += "${localize(option.label)}: ${localize(option.value)}"
    }
    val optionLabel = labels.joinToString(" · ")
    return optionLabel.ifBlank { sku }
}

@Composable
private fun unitLabel(unit: UnitCode): String = when (unit) {
    UnitCode.SPA -> stringResource(R.string.tv_spa)
    UnitCode.RESTAURANT -> stringResource(R.string.tv_saji_nusantara)
    UnitCode.LOUNGE -> stringResource(R.string.tv_lounge)
    UnitCode.HOUSEKEEPING -> stringResource(R.string.tv_housekeeping)
    UnitCode.BEAUTY_AND_SALON -> stringResource(R.string.tv_beauty_salon)
    UnitCode.CAFE -> stringResource(R.string.tv_cafe)
    UnitCode.BUTIK_INDONESIA -> stringResource(R.string.tv_butik_indonesia)
}
