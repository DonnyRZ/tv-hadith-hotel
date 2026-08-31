package com.roomservice.tv.presentation

import android.content.res.Configuration
import android.net.Uri
import android.widget.MediaController
import android.widget.VideoView
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.tv.material3.Button
import androidx.tv.material3.Text
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.roomservice.tv.R
import com.roomservice.tv.data.GuestRequest
import com.roomservice.tv.data.LocalizedText
import com.roomservice.tv.data.MenuItem
import com.roomservice.tv.data.RequestStatus
import com.roomservice.tv.data.RoomStatus
import com.roomservice.tv.data.TvContext
import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.data.UnitCode
import java.text.NumberFormat
import java.util.Locale

private val TvBackground = Color(0xFF061426)
private val TvSurface = Color(0xFF0D213A)
private val TvFocused = Color(0xFFD7AE68)
private val TvMuted = Color(0xFFB7C0CA)
private val TvIvory = Color(0xFFF7F2E8)
private val TvLine = Color(0x3DE6DDCD)

@Composable
fun TvRoot(
    uiState: TvUiState,
    language: TvLanguage = TvLanguage.UZ,
    onInitialize: () -> Unit,
    onRetry: () -> Unit,
    onLanguageChange: (TvLanguage) -> Unit = {},
    onAddToCart: (MenuItem) -> Unit,
    onRemoveFromCart: (String) -> Unit,
    onSubmitCart: () -> Unit,
) {
    LaunchedEffect(Unit) {
        onInitialize()
    }

    val baseConfiguration = LocalConfiguration.current
    val localizedConfiguration = remember(baseConfiguration, language) {
        Configuration(baseConfiguration).apply {
            setLocale(Locale.forLanguageTag(language.tag))
        }
    }

    CompositionLocalProvider(LocalConfiguration provides localizedConfiguration) {
        RoomServiceTvTheme {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(TvBackground),
            ) {
                when (uiState) {
                    TvUiState.Loading -> LoadingScreen()
                    is TvUiState.Pairing -> PairingScreen(uiState)
                    is TvUiState.Error -> ErrorScreen(uiState, onRetry)
                    is TvUiState.Ready -> ReadyApp(
                        language = language,
                        onAddToCart = onAddToCart,
                        onLanguageChange = onLanguageChange,
                        onRemoveFromCart = onRemoveFromCart,
                        onSubmitCart = onSubmitCart,
                        state = uiState,
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
            .padding(72.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = title, color = TvIvory, fontSize = 40.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = message, color = TvMuted, fontSize = 23.sp)
        Spacer(modifier = Modifier.height(28.dp))
        extra()
    }
}

@Composable
private fun ReadyApp(
    language: TvLanguage,
    onAddToCart: (MenuItem) -> Unit,
    onLanguageChange: (TvLanguage) -> Unit,
    onRemoveFromCart: (String) -> Unit,
    onSubmitCart: () -> Unit,
    state: TvUiState.Ready,
) {
    val navController = rememberNavController()
    var selectedUnit by remember { mutableStateOf<UnitCode?>(null) }
    val cartCount = state.cart.sumOf { it.quantity }

    BackHandler(enabled = navController.previousBackStackEntry != null) {
        navController.popBackStack()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 64.dp, vertical = 38.dp),
    ) {
        TvHeader(
            cartCount = cartCount,
            language = language,
            onCart = { navController.navigate("cart") { launchSingleTop = true } },
            onHome = { navController.navigate("home") { launchSingleTop = true } },
            onLanguageChange = onLanguageChange,
            onRequests = { navController.navigate("requests") { launchSingleTop = true } },
            roomNumber = state.snapshot.context.device.room.number,
        )
        Spacer(modifier = Modifier.height(30.dp))
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
                        onAdd = onAddToCart,
                        onBack = { navController.popBackStack() },
                        onCart = { navController.navigate("cart") },
                    )
                }
            }
            composable("about") {
                AboutScreen(onBack = { navController.popBackStack() })
            }
            composable("destinations") {
                DestinationsScreen(onBack = { navController.popBackStack() })
            }
            composable("cart") {
                CartScreen(
                    state = state,
                    onRemoveFromCart = onRemoveFromCart,
                    onSubmitCart = onSubmitCart,
                )
            }
            composable("requests") {
                RequestsScreen(state = state)
            }
        }
        state.statusMessage?.let { message ->
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = when (message) {
                    TvStatusMessage.REQUEST_SUBMITTED -> stringResource(R.string.tv_request_submitted)
                    TvStatusMessage.UNIT_CONFLICT -> stringResource(R.string.tv_request_unit_conflict)
                },
                color = TvFocused,
                fontSize = 18.sp,
            )
        }
        state.errorMessage?.let { message ->
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = localizedTvErrorMessage(state.errorCode ?: "TV_API_ERROR", message),
                color = Color(0xFFFFB4AB),
                fontSize = 18.sp,
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
        "GUEST_REQUEST_UNIT_CONFLICT" -> stringResource(R.string.tv_request_unit_conflict)
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
    roomNumber: String,
) {
    val initialFocusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        initialFocusRequester.requestFocus()
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stringResource(R.string.tv_brand),
                color = TvIvory,
                fontSize = 31.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 3.sp,
            )
            Text(
                text = stringResource(R.string.tv_room, roomNumber),
                color = TvMuted,
                fontSize = 18.sp,
            )
        }
        TvLanguageSwitcher(language = language, onChange = onLanguageChange)
        Spacer(modifier = Modifier.width(14.dp))
        TvActionButton(
            label = stringResource(R.string.tv_home),
            modifier = Modifier.focusRequester(initialFocusRequester),
            onClick = onHome,
        )
        Spacer(modifier = Modifier.width(12.dp))
        TvActionButton(label = stringResource(R.string.tv_my_requests), onClick = onRequests)
        Spacer(modifier = Modifier.width(12.dp))
        TvActionButton(label = stringResource(R.string.tv_cart, cartCount), onClick = onCart)
    }
}

@Composable
private fun TvLanguageSwitcher(
    language: TvLanguage,
    onChange: (TvLanguage) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        TvLanguage.entries.forEach { option ->
            TvActionButton(
                label = option.tag.uppercase(Locale.ROOT),
                selected = option == language,
                onClick = { onChange(option) },
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

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(24.dp),
        contentPadding = PaddingValues(bottom = 34.dp),
    ) {
        item { WelcomeBanner(context = context) }
        item {
            Text(
                text = stringResource(R.string.tv_home_choose),
                color = TvIvory,
                fontSize = 29.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                TvPrimaryCard(
                    description = stringResource(
                        if (occupied) R.string.tv_service_description
                        else R.string.tv_service_unavailable,
                    ),
                    enabled = occupied,
                    index = "01",
                    modifier = Modifier.weight(1f),
                    onClick = onService,
                    title = stringResource(R.string.tv_service),
                )
                TvPrimaryCard(
                    description = stringResource(R.string.tv_about_description),
                    index = "02",
                    modifier = Modifier.weight(1f),
                    onClick = onAbout,
                    title = stringResource(R.string.tv_about),
                )
                TvPrimaryCard(
                    description = stringResource(R.string.tv_destinations_description),
                    index = "03",
                    modifier = Modifier.weight(1f),
                    onClick = onDestinations,
                    title = stringResource(R.string.tv_destinations),
                )
            }
        }
    }
}

@Composable
private fun WelcomeBanner(context: TvContext) {
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

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(TvSurface)
            .border(1.dp, TvLine, RoundedCornerShape(20.dp))
            .padding(34.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = TvFocused, fontSize = 38.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(10.dp))
            Text(text = message, color = TvMuted, fontSize = 21.sp)
        }
        Text(
            text = context.device.room.number,
            color = TvIvory,
            fontSize = 46.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun TvPrimaryCard(
    description: String,
    enabled: Boolean = true,
    index: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    title: String,
) {
    var focused by remember { mutableStateOf(false) }
    Button(
        enabled = enabled,
        onClick = onClick,
        modifier = modifier
            .height(190.dp)
            .onFocusChanged { focused = it.isFocused }
            .border(
                width = if (focused) 3.dp else 1.dp,
                color = if (focused) TvFocused else TvLine,
                shape = RoundedCornerShape(18.dp),
            ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(text = index, color = TvFocused, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Column {
                Text(text = title, color = TvIvory, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = description,
                    color = TvMuted,
                    fontSize = 17.sp,
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
    PageHeader(
        title = stringResource(R.string.tv_service),
        description = stringResource(R.string.tv_service_description),
        onBack = onBack,
    )
    val units = state.snapshot.guestData?.departments?.items
        ?.flatMap { department -> department.units }
        ?.associateBy { unit -> unit.code }
        ?: emptyMap()

    Column(modifier = Modifier.fillMaxSize()) {
        Spacer(modifier = Modifier.height(22.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            ServiceCard(
                enabled = units[UnitCode.HOUSEKEEPING]?.enabled == true,
                index = "01",
                title = stringResource(R.string.tv_housekeeping),
                onClick = { onOpenUnit(UnitCode.HOUSEKEEPING) },
            )
            ServiceCard(
                enabled = units[UnitCode.RESTAURANT]?.enabled == true || units[UnitCode.LOUNGE]?.enabled == true,
                index = "02",
                title = stringResource(R.string.tv_fnb),
                onClick = onOpenFnb,
            )
            ServiceCard(
                enabled = units[UnitCode.CAFE]?.enabled == true,
                index = "03",
                title = stringResource(R.string.tv_cafe),
                onClick = { onOpenUnit(UnitCode.CAFE) },
            )
        }
        Spacer(modifier = Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            ServiceCard(
                enabled = units[UnitCode.SPA]?.enabled == true,
                index = "04",
                title = stringResource(R.string.tv_spa),
                onClick = { onOpenUnit(UnitCode.SPA) },
            )
            ServiceCard(
                enabled = units[UnitCode.BEAUTY_AND_SALON]?.enabled == true,
                index = "05",
                title = stringResource(R.string.tv_beauty_salon),
                onClick = { onOpenUnit(UnitCode.BEAUTY_AND_SALON) },
            )
        }
    }
}

@Composable
private fun ServiceCard(
    enabled: Boolean,
    index: String,
    title: String,
    onClick: () -> Unit,
) {
    TvPrimaryCard(
        description = stringResource(if (enabled) R.string.tv_explore else R.string.tv_unavailable),
        enabled = enabled,
        index = index,
        modifier = Modifier.width(300.dp),
        onClick = onClick,
        title = title,
    )
}

@Composable
private fun FnbScreen(
    state: TvUiState.Ready,
    onBack: () -> Unit,
    onOpenUnit: (UnitCode) -> Unit,
) {
    PageHeader(
        title = stringResource(R.string.tv_fnb),
        description = stringResource(R.string.tv_fnb_description),
        onBack = onBack,
    )
    val units = state.snapshot.guestData?.departments?.items
        ?.flatMap { department -> department.units }
        ?.associateBy { unit -> unit.code }
        ?: emptyMap()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 24.dp),
        horizontalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        ServiceCard(
            enabled = units[UnitCode.RESTAURANT]?.enabled == true,
            index = "01",
            title = stringResource(R.string.tv_saji_nusantara),
            onClick = { onOpenUnit(UnitCode.RESTAURANT) },
        )
        ServiceCard(
            enabled = units[UnitCode.LOUNGE]?.enabled == true,
            index = "02",
            title = stringResource(R.string.tv_lounge),
            onClick = { onOpenUnit(UnitCode.LOUNGE) },
        )
    }
}

@Composable
private fun MenuScreen(
    state: TvUiState.Ready,
    unit: UnitCode,
    onAdd: (MenuItem) -> Unit,
    onBack: () -> Unit,
    onCart: () -> Unit,
) {
    val items = state.snapshot.guestData?.menusByUnit?.get(unit)?.items
        ?.filter { item -> item.active && item.available }
        .orEmpty()
    val pageSize = 10
    val totalPages = maxOf(1, (items.size + pageSize - 1) / pageSize)
    var page by remember(unit) { mutableStateOf(1) }
    val visibleItems = items.drop((page - 1) * pageSize).take(pageSize)

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = unitLabel(unit),
            description = stringResource(R.string.tv_menu_description),
            onBack = onBack,
            trailing = {
                if (state.cart.isNotEmpty()) {
                    TvActionButton(label = stringResource(R.string.tv_view_cart), onClick = onCart)
                }
            },
        )
        Spacer(modifier = Modifier.height(20.dp))
        if (visibleItems.isEmpty()) {
            EmptyScreen(title = stringResource(R.string.tv_no_menu), onBack = null)
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 14.dp),
            ) {
                items(visibleItems, key = { item -> item.id }) { item ->
                    MenuItemRow(item = item, onAdd = { onAdd(item) })
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
    item: MenuItem,
    onAdd: () -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
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
                fontSize = 25.sp,
                fontWeight = FontWeight.SemiBold,
            )
            localizedMenuDescription(item)?.let { description ->
                Text(
                    text = description,
                    color = TvMuted,
                    fontSize = 18.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(text = formatPrice(item), color = TvFocused, fontSize = 18.sp)
        }
        Spacer(modifier = Modifier.width(24.dp))
        TvActionButton(
            label = stringResource(R.string.tv_add),
            modifier = Modifier.onFocusChanged { focused = it.isFocused },
            onClick = onAdd,
        )
    }
}

@Composable
private fun CartScreen(
    state: TvUiState.Ready,
    onRemoveFromCart: (String) -> Unit,
    onSubmitCart: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = stringResource(R.string.tv_your_request),
            color = TvIvory,
            fontSize = 31.sp,
            fontWeight = FontWeight.Bold,
        )
        if (state.cart.isEmpty()) {
            Text(text = stringResource(R.string.tv_cart_empty), color = TvMuted, fontSize = 22.sp)
        } else {
            state.cart.forEach { line ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(TvSurface)
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${line.quantity} × ${localizedMenuName(line.item)}",
                        color = TvIvory,
                        fontSize = 22.sp,
                        modifier = Modifier.weight(1f),
                    )
                    TvActionButton(
                        label = stringResource(R.string.tv_remove),
                        onClick = { onRemoveFromCart(line.item.id) },
                    )
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
private fun RequestsScreen(state: TvUiState.Ready) {
    val requests = state.snapshot.guestData?.requests?.items.orEmpty()
    LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text(
                text = stringResource(R.string.tv_my_requests),
                color = TvIvory,
                fontSize = 31.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        if (requests.isEmpty()) {
            item {
                Text(text = stringResource(R.string.tv_no_requests), color = TvMuted, fontSize = 22.sp)
            }
        } else {
            items(requests, key = { request -> request.id }) { request ->
                RequestRow(request)
            }
        }
    }
}

@Composable
private fun RequestRow(request: GuestRequest) {
    val language = currentTvLanguage()
    val itemSummary = request.items.joinToString { item ->
        "${item.quantity} × ${item.localizedName?.forLanguage(language) ?: item.name}"
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(TvSurface)
            .padding(20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = itemSummary,
                color = TvIvory,
                fontSize = 21.sp,
            )
            Text(text = unitLabel(request.unit), color = TvMuted, fontSize = 17.sp)
        }
        Text(
            text = when (request.status) {
                RequestStatus.NEW -> stringResource(R.string.tv_status_new)
                RequestStatus.IN_PROCESS -> stringResource(R.string.tv_status_in_process)
                RequestStatus.COMPLETED -> stringResource(R.string.tv_status_completed)
            },
            color = if (request.status == RequestStatus.COMPLETED) TvFocused else TvIvory,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun AboutScreen(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_about),
            description = stringResource(R.string.tv_about_description),
            onBack = onBack,
        )
        LazyColumn(
            modifier = Modifier.padding(top = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            items(TV_ABOUT_FEATURES) { feature ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(TvSurface)
                        .border(1.dp, TvLine, RoundedCornerShape(18.dp)),
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
                            fontSize = 25.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = localize(feature.body), color = TvMuted, fontSize = 18.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DestinationsScreen(onBack: () -> Unit) {
    var activeIndex by remember { mutableStateOf(0) }
    val destination = TV_DESTINATIONS[activeIndex]

    Column(modifier = Modifier.fillMaxSize()) {
        PageHeader(
            title = stringResource(R.string.tv_destinations),
            description = stringResource(R.string.tv_destinations_description),
            onBack = onBack,
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(22.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TvDestinationVideo(videoRes = destination.videoRes)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = localize(destination.eyebrow), color = TvFocused, fontSize = 17.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = localize(destination.title),
                    color = TvIvory,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(text = localize(destination.description), color = TvMuted, fontSize = 19.sp)
                Spacer(modifier = Modifier.height(16.dp))
                destination.facts.forEach { fact ->
                    Text(text = "• ${localize(fact)}", color = TvMuted, fontSize = 17.sp)
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
                        fontSize = 18.sp,
                    )
                    TvActionButton(
                        enabled = activeIndex < TV_DESTINATIONS.lastIndex,
                        label = stringResource(R.string.tv_next),
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
                setMediaController(MediaController(context))
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
    onBack: (() -> Unit)?,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, color = TvIvory, fontSize = 34.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = description, color = TvMuted, fontSize = 19.sp)
        }
        trailing?.invoke()
        if (onBack !== null) {
            Spacer(modifier = Modifier.width(14.dp))
            TvActionButton(label = stringResource(R.string.tv_back), onClick = onBack)
        }
    }
}

@Composable
private fun EmptyScreen(
    title: String = stringResource(R.string.tv_not_ready),
    onBack: (() -> Unit)?,
) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = title, color = TvMuted, fontSize = 23.sp)
        if (onBack !== null) {
            Spacer(modifier = Modifier.height(18.dp))
            TvActionButton(label = stringResource(R.string.tv_back), onClick = onBack)
        }
    }
}

@Composable
private fun TvActionButton(
    enabled: Boolean = true,
    label: String,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    onClick: () -> Unit,
) {
    Button(
        enabled = enabled,
        modifier = modifier.then(
            if (selected) Modifier.border(2.dp, TvFocused, RoundedCornerShape(8.dp)) else Modifier,
        ),
        onClick = onClick,
    ) {
        Text(text = label, fontSize = 17.sp)
    }
}

@Composable
private fun localizedMenuName(item: MenuItem): String = item.localizedName?.let { localize(it) } ?: item.name

@Composable
private fun localizedMenuDescription(item: MenuItem): String? =
    item.localizedDescription?.let { localize(it) } ?: item.description

@Composable
private fun localize(value: LocalizedText): String = value.forLanguage(currentTvLanguage())

@Composable
private fun currentTvLanguage(): TvLanguage {
    val language = LocalConfiguration.current.locales[0].language
    return when (language) {
        "ru" -> TvLanguage.RU
        "en" -> TvLanguage.EN
        else -> TvLanguage.UZ
    }
}

private fun LocalizedText.forLanguage(language: TvLanguage): String = when (language) {
    TvLanguage.UZ -> uz
    TvLanguage.RU -> ru
    TvLanguage.EN -> en
}

@Composable
private fun formatPrice(item: MenuItem): String {
    if (item.price === null || item.currency === null) return stringResource(R.string.tv_price_not_set)
    val locale = when (currentTvLanguage()) {
        TvLanguage.UZ -> Locale("uz", "UZ")
        TvLanguage.RU -> Locale("ru", "RU")
        TvLanguage.EN -> Locale.UK
    }
    return runCatching {
        NumberFormat.getNumberInstance(locale).format(item.price.toLong()) + " ${item.currency}"
    }.getOrDefault("${item.price.toLong()} ${item.currency}")
}

@Composable
private fun unitLabel(unit: UnitCode): String = when (unit) {
    UnitCode.SPA -> stringResource(R.string.tv_spa)
    UnitCode.RESTAURANT -> stringResource(R.string.tv_saji_nusantara)
    UnitCode.LOUNGE -> stringResource(R.string.tv_lounge)
    UnitCode.HOUSEKEEPING -> stringResource(R.string.tv_housekeeping)
    UnitCode.BEAUTY_AND_SALON -> stringResource(R.string.tv_beauty_salon)
    UnitCode.CAFE -> stringResource(R.string.tv_cafe)
}
