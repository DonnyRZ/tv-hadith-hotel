package com.roomservice.tv.data

import java.io.IOException
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class TvRepositoryTest {
    @Test
    fun `loads the complete TV snapshot through the repository boundary`() = runTest {
        val api = FakeTvApi()
        val provider = DeviceCredentialProvider()
        val repository = DefaultTvRepository(
            api = api,
            credentialStore = FakeCredentialStore(credential = "tv-secret"),
            credentialProvider = provider,
            deviceModel = "Test TV",
            androidApiLevel = 36,
            appVersion = "0.1.0",
        )

        val snapshot = repository.loadSnapshot()

        assertEquals("room-302", snapshot.context.device.room.id)
        assertEquals(1, snapshot.guestData!!.departments.items.size)
        assertEquals(1, snapshot.guestData.menusByUnit[UnitCode.RESTAURANT]!!.items.size)
        assertEquals(1, snapshot.guestData.requests.total)
        assertEquals("tv-secret", repository.getCredential())
        assertEquals("tv-secret", provider.credential)
    }

    @Test
    fun `loads vacant context without calling guest endpoints`() = runTest {
        val api = FakeTvApi().apply { vacant = true }
        val repository = DefaultTvRepository(
            api = api,
            credentialStore = FakeCredentialStore(credential = "tv-secret"),
            credentialProvider = DeviceCredentialProvider(),
            deviceModel = "Test TV",
            androidApiLevel = 36,
            appVersion = "0.1.0",
        )

        val snapshot = repository.loadSnapshot()

        assertEquals(RoomStatus.VACANT, snapshot.context.roomStatus)
        assertEquals(null, snapshot.guestData)
        assertEquals(0, api.departmentsCalls)
        assertEquals(0, api.menusCalls)
        assertEquals(0, api.requestsCalls)
    }

    @Test
    fun `maps an unauthorized HTTP response into the TV API error`() = runTest {
        val api = FakeTvApi().apply {
            contextFailure = HttpException(
                Response.error<TvContext>(
                    401,
                    """{"code":"DEVICE_UNAUTHORIZED","message":"expired"}"""
                        .toResponseBody("application/json".toMediaType()),
                ),
            )
        }
        val repository = DefaultTvRepository(
            api = api,
            credentialStore = FakeCredentialStore(credential = "expired"),
            credentialProvider = DeviceCredentialProvider(),
            deviceModel = "Test TV",
            androidApiLevel = 36,
            appVersion = "0.1.0",
        )

        val exception = runCatching { repository.loadSnapshot() }.exceptionOrNull()

        assertEquals(TvApiException::class, exception!!::class)
        assertEquals(401, (exception as TvApiException).statusCode)
        assertEquals("DEVICE_UNAUTHORIZED", exception.code)
    }

    @Test
    fun `keeps offline failures retryable for the presentation layer`() = runTest {
        val api = FakeTvApi().apply { menusFailure = IOException("offline") }
        val repository = DefaultTvRepository(
            api = api,
            credentialStore = FakeCredentialStore(credential = "tv-secret"),
            credentialProvider = DeviceCredentialProvider(),
            deviceModel = "Test TV",
            androidApiLevel = 36,
            appVersion = "0.1.0",
        )

        val exception = runCatching { repository.loadSnapshot() }.exceptionOrNull()

        assertEquals(IOException::class, exception!!::class)
        assertEquals("offline", exception.message)
    }
}

private class FakeCredentialStore(
    private var credential: String?,
) : DeviceCredentialStore {
    override suspend fun getInstallationId(): String = "installation-123456"

    override suspend fun getCredential(): String? = credential

    override suspend fun saveCredential(credential: String) {
        this.credential = credential
    }

    override suspend fun clearCredential() {
        credential = null
    }
}

private class FakeTvApi : TvApi {
    var contextFailure: Exception? = null
    var menusFailure: Exception? = null
    var vacant: Boolean = false
    var departmentsCalls: Int = 0
    var menusCalls: Int = 0
    var requestsCalls: Int = 0

    override suspend fun startProvisioning(
        request: StartTvProvisioningRequest,
    ): StartTvProvisioningResponse = StartTvProvisioningResponse(
        deviceId = "device-1",
        deviceCode = "device_302",
        pairingCode = "123456",
        expiresAt = "2099-01-01T00:00:00Z",
    )

    override suspend fun claimProvisioning(
        request: ClaimTvProvisioningRequest,
    ): ClaimTvProvisioningResponse = error("not used")

    override suspend fun getTvContext(): TvContext {
        contextFailure?.let { throw it }
        return sampleContext().copy(
            roomStatus = if (vacant) RoomStatus.VACANT else RoomStatus.OCCUPIED,
            welcome = if (vacant) {
                WelcomeState(
                    message = "Welcome to Hadith Hotel",
                    guestName = null,
                    personalized = false,
                )
            } else {
                sampleContext().welcome
            },
        )
    }

    override suspend fun getDepartments(): DepartmentListResponse {
        departmentsCalls += 1
        return DepartmentListResponse(
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
        )
    }

    override suspend fun getMenus(unit: UnitCode, page: Int, pageSize: Int): MenuItemListResponse {
        menusCalls += 1
        menusFailure?.let { throw it }
        return MenuItemListResponse(items = listOf(sampleMenuItem()), page = page, pageSize = pageSize, total = 1)
    }

    override suspend fun getRequests(): GuestRequestListResponse {
        requestsCalls += 1
        return GuestRequestListResponse(
            items = emptyList(),
            page = 1,
            pageSize = 25,
            total = 1,
        )
    }

    override suspend fun createRequest(request: CreateGuestRequest): GuestRequest = error("not used")
}

private fun sampleContext(): TvContext = TvContext(
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
)

private fun sampleMenuItem(): MenuItem = MenuItem(
    id = "menu-1",
    unit = UnitCode.RESTAURANT,
    kind = MenuItemKind.PRODUCT,
    name = "Nasi Goreng",
    active = true,
    available = true,
    quantityAllowed = true,
)
