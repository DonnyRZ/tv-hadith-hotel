package com.roomservice.tv.presentation

import com.roomservice.tv.data.ClaimTvProvisioningResponse
import com.roomservice.tv.data.CreateGuestRequest
import com.roomservice.tv.data.DepartmentListResponse
import com.roomservice.tv.data.GuestRequest
import com.roomservice.tv.data.GuestRequestListResponse
import com.roomservice.tv.data.MenuItem
import com.roomservice.tv.data.MenuItemKind
import com.roomservice.tv.data.MenuItemListResponse
import com.roomservice.tv.data.PairingSession
import com.roomservice.tv.data.RequestItem
import com.roomservice.tv.data.RequestStatus
import com.roomservice.tv.data.RoomReference
import com.roomservice.tv.data.RoomStatus
import com.roomservice.tv.data.TvContext
import com.roomservice.tv.data.TvDevice
import com.roomservice.tv.data.TvApiException
import com.roomservice.tv.data.TvGuestData
import com.roomservice.tv.data.TvRealtimeConnection
import com.roomservice.tv.data.TvRepository
import com.roomservice.tv.data.TvSnapshot
import com.roomservice.tv.data.UnitCode
import com.roomservice.tv.data.WelcomeState
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestWatcher
import org.junit.runner.Description

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule : TestWatcher() {
    private val dispatcher = StandardTestDispatcher()

    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class TvViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `initializes an unpaired tv through pairing and loads the room`() = runTest {
        val repository = FakeTvRepository(initialCredential = null)
        val realtime = FakeRealtimeConnection()
        val viewModel = TvViewModel(repository, realtime)

        viewModel.initialize()
        advanceUntilIdle()

        val state = viewModel.uiState.value as TvUiState.Ready
        assertEquals("302", state.snapshot.context.device.room.number)
        assertEquals("credential-from-pairing", repository.savedCredential)
        assertTrue(realtime.connected.get())
    }

    @Test
    fun `adds an item and submits an idempotent request`() = runTest {
        val repository = FakeTvRepository(initialCredential = "existing-credential")
        val viewModel = TvViewModel(repository, FakeRealtimeConnection())
        viewModel.initialize()
        advanceUntilIdle()

        val item = sampleMenuItem()
        viewModel.addToCart(item)
        viewModel.submitCart()
        advanceUntilIdle()

        val state = viewModel.uiState.value as TvUiState.Ready
        assertTrue(state.cart.isEmpty())
        assertEquals(1, state.snapshot.guestData!!.requests.total)
        assertEquals(TvStatusMessage.REQUEST_SUBMITTED, state.statusMessage)
        assertEquals(1, repository.submittedRequestCount)
    }

    @Test
    fun `shows an offline error and retry recovers`() = runTest {
        val repository = FakeTvRepository(
            initialCredential = "existing-credential",
            snapshotFailures = mutableListOf(IllegalStateException("offline")),
        )
        val viewModel = TvViewModel(repository, FakeRealtimeConnection())

        viewModel.initialize()
        advanceUntilIdle()

        assertEquals("offline", (viewModel.uiState.value as TvUiState.Error).message)

        viewModel.retry()
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is TvUiState.Ready)
    }

    @Test
    fun `re-provisions after an unauthorized context response`() = runTest {
        val repository = FakeTvRepository(
            initialCredential = "expired-credential",
            snapshotFailures = mutableListOf(
                TvApiException(
                    statusCode = 401,
                    code = "DEVICE_UNAUTHORIZED",
                    message = "expired",
                ),
            ),
        )
        val realtime = FakeRealtimeConnection()
        val viewModel = TvViewModel(repository, realtime)

        viewModel.initialize()
        advanceUntilIdle()

        assertEquals(1, repository.clearCredentialCount)
        assertEquals("credential-from-pairing", repository.savedCredential)
        assertTrue(realtime.disconnectCount > 0)
        assertTrue(viewModel.uiState.value is TvUiState.Ready)
    }

    @Test
    fun `refreshes authoritative context after a realtime assignment hint`() = runTest {
        val updatedContext = sampleSnapshot().context.copy(
            welcome = WelcomeState(
                message = "Welcome, Siti Rahma",
                guestName = "Siti Rahma",
                personalized = true,
            ),
        )
        val repository = FakeTvRepository(
            initialCredential = "existing-credential",
            refreshContextValue = updatedContext,
        )
        val viewModel = TvViewModel(repository, FakeRealtimeConnection())

        viewModel.initialize()
        advanceUntilIdle()
        viewModel.onRealtimeAssignmentUpdated()
        advanceUntilIdle()

        val state = viewModel.uiState.value as TvUiState.Ready
        assertEquals("Welcome, Siti Rahma", state.snapshot.context.welcome.message)
        assertNull(state.statusMessage)
    }
}

private class FakeRealtimeConnection : TvRealtimeConnection {
    val connected = AtomicBoolean(false)
    var disconnectCount: Int = 0
        private set

    override fun connect() {
        connected.set(true)
    }

    override fun disconnect() {
        connected.set(false)
        disconnectCount += 1
    }
}

private class FakeTvRepository(
    initialCredential: String?,
    private val snapshotFailures: MutableList<Exception> = mutableListOf(),
    private val refreshContextValue: TvContext = sampleSnapshot().context,
) : TvRepository {
    private var credential: String? = initialCredential
    private var loadSnapshotCount: Int = 0
    var savedCredential: String? = null
        private set
    var submittedRequestCount: Int = 0
        private set
    var clearCredentialCount: Int = 0
        private set

    override suspend fun getInstallationId(): String = "installation-123456"

    override suspend fun getCredential(): String? = credential

    override suspend fun startProvisioning(): PairingSession = PairingSession(
        installationId = getInstallationId(),
        pairingCode = "123456",
        expiresAt = "2099-01-01T00:00:00Z",
    )

    override suspend fun claimProvisioning(pairingSession: PairingSession): ClaimTvProvisioningResponse =
        ClaimTvProvisioningResponse(
            credential = "credential-from-pairing",
            device = sampleDevice(),
        )

    override suspend fun saveCredential(credential: String) {
        this.credential = credential
        savedCredential = credential
    }

    override suspend fun clearCredential() {
        credential = null
        clearCredentialCount += 1
    }

    override suspend fun loadSnapshot(): TvSnapshot {
        if (snapshotFailures.isNotEmpty()) {
            throw snapshotFailures.removeAt(0)
        }
        val snapshot = sampleSnapshot()
        return if (loadSnapshotCount++ == 0) {
            snapshot
        } else {
            snapshot.copy(context = refreshContextValue)
        }
    }

    override suspend fun refreshContext(): TvContext = refreshContextValue

    override suspend fun submitRequest(request: CreateGuestRequest): GuestRequest {
        submittedRequestCount += 1
        return GuestRequest(
            id = "request-1",
            clientRequestId = request.clientRequestId,
            department = "FOOD_AND_BEVERAGES",
            unit = UnitCode.RESTAURANT,
            items = listOf(
                RequestItem(
                    menuItemId = request.items.first().menuItemId,
                    unit = UnitCode.RESTAURANT,
                    kind = MenuItemKind.PRODUCT,
                    name = "Nasi Goreng",
                    quantity = request.items.first().quantity,
                ),
            ),
            status = RequestStatus.NEW,
            requestedAt = "2026-08-29T10:00:00Z",
        )
    }
}

private fun sampleSnapshot(): TvSnapshot = TvSnapshot(
    context = TvContext(
        device = sampleDevice(),
        roomStatus = RoomStatus.OCCUPIED,
        welcome = WelcomeState(
            message = "Welcome, Ahmad Fauzan",
            guestName = "Ahmad Fauzan",
            personalized = true,
        ),
    ),
    guestData = TvGuestData(
        departments = DepartmentListResponse(items = emptyList()),
        menusByUnit = mapOf(
            UnitCode.RESTAURANT to MenuItemListResponse(items = listOf(sampleMenuItem())),
        ),
        requests = GuestRequestListResponse(
            items = emptyList(),
            page = 1,
            pageSize = 25,
            total = 0,
        ),
    ),
)

private fun sampleDevice(): TvDevice = TvDevice(
    id = "device-1",
    deviceCode = "device_302",
    room = RoomReference(id = "room-302", number = "302"),
)

private fun sampleMenuItem(): MenuItem = MenuItem(
    id = "menu-1",
    unit = UnitCode.RESTAURANT,
    kind = MenuItemKind.PRODUCT,
    name = "Nasi Goreng",
    description = "Indonesian fried rice",
    price = 85000.0,
    currency = "IDR",
    active = true,
    available = true,
    quantityAllowed = true,
)
