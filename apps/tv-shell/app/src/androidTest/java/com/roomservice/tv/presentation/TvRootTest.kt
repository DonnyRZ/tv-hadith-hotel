package com.roomservice.tv.presentation

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.isFocused
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyPress
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.roomservice.tv.data.DepartmentListResponse
import com.roomservice.tv.data.DepartmentSummary
import com.roomservice.tv.data.DepartmentUnit
import com.roomservice.tv.data.GuestRequestListResponse
import com.roomservice.tv.data.MenuItem
import com.roomservice.tv.data.MenuItemKind
import com.roomservice.tv.data.MenuItemListResponse
import com.roomservice.tv.data.RoomReference
import com.roomservice.tv.data.RoomStatus
import com.roomservice.tv.data.TvContext
import com.roomservice.tv.data.TvDevice
import com.roomservice.tv.data.TvGuestData
import com.roomservice.tv.data.TvSnapshot
import com.roomservice.tv.data.TvStay
import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.data.UnitCode
import com.roomservice.tv.data.WelcomeState
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean

class TvRootTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun readyScreenExposesRemoteFriendlyActions() {
        val added = AtomicBoolean(false)
        composeRule.setContent {
            TvRoot(
                language = TvLanguage.EN,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onLanguageChange = {},
                onAddToCart = { added.set(true) },
                onRemoveFromCart = {},
                onSubmitCart = {},
            )
        }

        composeRule.onNodeWithText("Welcome, Ahmad Fauzan").assertIsDisplayed()
        composeRule.onAllNodesWithText("Room 302").assertCountEquals(0)
        composeRule.onNodeWithText("CHECK-IN").assertIsDisplayed()
        composeRule.onNodeWithText("CHECK-OUT").assertIsDisplayed()
        composeRule.onNodeWithText("STAY").assertIsDisplayed()
        composeRule.onNodeWithText("Home").assertIsDisplayed()
        composeRule.onNodeWithText("Service").assertIsDisplayed()
        composeRule.onNodeWithText("About hotel").assertIsDisplayed()
        composeRule.onNodeWithText("Destinations").assertIsDisplayed()

        composeRule.onNodeWithText("Service").performClick()
        composeRule.onNodeWithText("F&B").performClick()
        composeRule.onNodeWithText("Saji Nusantara").performClick()
        val addButton = composeRule.onNodeWithText("Add").assertHasClickAction()
        addButton.performSemanticsAction(androidx.compose.ui.semantics.SemanticsActions.RequestFocus) { it() }
        addButton.assertIsFocused()
        addButton.performKeyPress(composeKeyEvent(AndroidKeyEvent.ACTION_DOWN, AndroidKeyEvent.KEYCODE_DPAD_CENTER))
        addButton.performKeyPress(composeKeyEvent(AndroidKeyEvent.ACTION_UP, AndroidKeyEvent.KEYCODE_DPAD_CENTER))
        composeRule.waitForIdle()
        assertTrue(added.get())
    }

    @Test
    fun dpadNavigationSupportsAllDirectionsSelectAndBack() {
        composeRule.setContent {
            TvRoot(
                language = TvLanguage.EN,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onLanguageChange = {},
                onAddToCart = {},
                onRemoveFromCart = {},
                onSubmitCart = {},
            )
        }

        val homeButton = composeRule.onNodeWithText("Home")
        val requestsButton = composeRule.onNodeWithText("My requests")
        val cartButton = composeRule.onNodeWithText("Selection (0)")
        val updatesButton = composeRule.onNodeWithText("Updates")

        composeRule.waitForIdle()
        homeButton.assertIsFocused()
        sendDpad(homeButton, AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
        requestsButton.assertIsFocused()
        sendDpad(requestsButton, AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
        cartButton.assertIsFocused()
        sendDpad(cartButton, AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
        updatesButton.assertIsFocused()
        sendDpad(updatesButton, AndroidKeyEvent.KEYCODE_DPAD_LEFT)
        cartButton.assertIsFocused()
        sendDpad(cartButton, AndroidKeyEvent.KEYCODE_DPAD_LEFT)
        requestsButton.assertIsFocused()
        sendDpad(requestsButton, AndroidKeyEvent.KEYCODE_DPAD_LEFT)
        homeButton.assertIsFocused()

        sendDpad(homeButton, AndroidKeyEvent.KEYCODE_DPAD_DOWN)
        composeRule.onAllNodes(isFocused()).assertCountEquals(1)
        sendDpad(homeButton, AndroidKeyEvent.KEYCODE_DPAD_UP)
        homeButton.assertIsFocused()

        sendDpad(homeButton, AndroidKeyEvent.KEYCODE_DPAD_RIGHT)
        sendDpad(requestsButton, AndroidKeyEvent.KEYCODE_DPAD_CENTER)
        composeRule.onNodeWithText("No requests yet.").assertIsDisplayed()

        InstrumentationRegistry.getInstrumentation()
            .sendKeyDownUpSync(AndroidKeyEvent.KEYCODE_BACK)
        composeRule.waitForIdle()
        composeRule.onNodeWithText("Service").assertIsDisplayed()
    }

    @Test
    fun updateButtonIsVisibleAndInvokesManualCheck() {
        val checked = AtomicBoolean(false)
        composeRule.setContent {
            TvRoot(
                language = TvLanguage.EN,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onAddToCart = {},
                onRemoveFromCart = {},
                onSubmitCart = {},
                onCheckForUpdates = { checked.set(true) },
            )
        }

        val updatesButton = composeRule.onNodeWithText("Updates")
        updatesButton.assertIsDisplayed()
        updatesButton.performClick()
        assertTrue(checked.get())
    }

    @Test
    fun manualCheckCanShowUpToDateFeedbackWithoutBlockingHome() {
        composeRule.setContent {
            TvRoot(
                language = TvLanguage.EN,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onAddToCart = {},
                onRemoveFromCart = {},
                onSubmitCart = {},
                updateState = com.roomservice.tv.update.TvUpdateState.UpToDate("0.4.9"),
            )
        }

        composeRule.onNodeWithText("You’re up to date").assertIsDisplayed()
        composeRule.onNodeWithText("Welcome, Ahmad Fauzan").assertIsDisplayed()
    }

    @Test
    fun uzbekIsTheDefaultAndLanguageSwitcherUpdatesUiCopy() {
        var language by mutableStateOf(TvLanguage.UZ)
        composeRule.setContent {
            TvRoot(
                language = language,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onLanguageChange = { language = it },
                onAddToCart = {},
                onRemoveFromCart = {},
                onSubmitCart = {},
            )
        }

        composeRule.onNodeWithText("Bosh sahifa").assertIsDisplayed()
        composeRule.onNodeWithText("Xizmatlar").assertIsDisplayed()
        composeRule.onNodeWithText("Siz uchun").assertIsDisplayed()

        composeRule.onNodeWithText("EN").performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText("Home").assertIsDisplayed()
        composeRule.onNodeWithText("Service").assertIsDisplayed()
        composeRule.onNodeWithText("Made for you").assertIsDisplayed()
    }

    @Test
    fun tasteAboutCardOpensTheSajiGalleryWithoutLeavingTheApp() {
        composeRule.setContent {
            TvRoot(
                language = TvLanguage.EN,
                uiState = sampleReadyState(),
                onInitialize = {},
                onRetry = {},
                onLanguageChange = {},
                onAddToCart = {},
                onRemoveFromCart = {},
                onSubmitCart = {},
            )
        }

        composeRule.onNodeWithText("About hotel").performClick()
        composeRule.onNodeWithText("Taste and conversation").performClick()
        composeRule.onNodeWithText("Saji Nusantara").assertIsDisplayed()
    }
}

private fun composeKeyEvent(action: Int, keyCode: Int): KeyEvent =
    KeyEvent(AndroidKeyEvent(action, keyCode))

private fun sendDpad(node: SemanticsNodeInteraction, keyCode: Int) {
    node.performKeyPress(composeKeyEvent(AndroidKeyEvent.ACTION_DOWN, keyCode))
    node.performKeyPress(composeKeyEvent(AndroidKeyEvent.ACTION_UP, keyCode))
}

private fun sampleReadyState(): TvUiState.Ready = TvUiState.Ready(
    snapshot = TvSnapshot(
        context = TvContext(
            device = TvDevice(
                id = "device-1",
                deviceCode = "device_302",
                room = RoomReference(id = "room-302", number = "302"),
            ),
            roomStatus = RoomStatus.OCCUPIED,
            welcome = WelcomeState(
                message = "Welcome, Ahmad Fauzan",
                guestName = "Ahmad Fauzan",
                personalized = true,
            ),
            stay = TvStay(
                checkInAt = "2030-08-30T10:00:00.000Z",
                checkOutAt = "2030-09-02T10:00:00.000Z",
                totalDays = 3,
                timeZone = "Asia/Tashkent",
            ),
        ),
        guestData = TvGuestData(
            departments = DepartmentListResponse(
                items = listOf(
                    DepartmentSummary(
                        code = "FOOD_AND_BEVERAGES",
                        name = "Food & Beverages",
                        units = listOf(
                            DepartmentUnit(
                                code = UnitCode.RESTAURANT,
                                department = "FOOD_AND_BEVERAGES",
                                name = "Saji Nusantara",
                                roomManagerMonitoring = true,
                                enabled = true,
                                disabledReason = null,
                            ),
                        ),
                    ),
                ),
            ),
            menusByUnit = mapOf(
                UnitCode.RESTAURANT to MenuItemListResponse(
                    items = listOf(
                        MenuItem(
                            id = "menu-1",
                            unit = UnitCode.RESTAURANT,
                            kind = MenuItemKind.PRODUCT,
                            name = "Nasi Goreng",
                            active = true,
                            available = true,
                            quantityAllowed = true,
                        ),
                    ),
                ),
            ),
            requests = GuestRequestListResponse(
                items = emptyList(),
                page = 1,
                pageSize = 25,
                total = 0,
            ),
        ),
    ),
    selectedUnit = null,
)
