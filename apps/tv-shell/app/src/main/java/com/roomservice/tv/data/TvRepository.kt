package com.roomservice.tv.data

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import retrofit2.HttpException
import java.util.UUID

data class PairingSession(
    val installationId: String,
    val pairingCode: String,
    val expiresAt: String,
)

data class TvGuestData(
    val departments: DepartmentListResponse,
    val menusByUnit: Map<UnitCode, MenuItemListResponse>,
    val requests: GuestRequestListResponse,
)

data class TvSnapshot(
    val context: TvContext,
    val guestData: TvGuestData?,
)

interface TvRepository {
    suspend fun getInstallationId(): String
    suspend fun getCredential(): String?
    suspend fun startProvisioning(): PairingSession
    suspend fun claimProvisioning(pairingSession: PairingSession): ClaimTvProvisioningResponse
    suspend fun saveCredential(credential: String)
    suspend fun clearCredential()
    suspend fun loadSnapshot(): TvSnapshot
    suspend fun refreshContext(): TvContext
    suspend fun submitRequest(request: CreateGuestRequest): GuestRequest
}

class DefaultTvRepository(
    private val api: TvApi,
    private val credentialStore: DeviceCredentialStore,
    private val credentialProvider: DeviceCredentialProvider,
    private val deviceModel: String,
    private val androidApiLevel: Int,
    private val appVersion: String,
) : TvRepository {
    override suspend fun getInstallationId(): String = credentialStore.getInstallationId()

    override suspend fun getCredential(): String? {
        val credential = credentialStore.getCredential()
        credentialProvider.credential = credential
        return credential
    }

    override suspend fun startProvisioning(): PairingSession {
        val installationId = credentialStore.getInstallationId()
        val response = call {
            api.startProvisioning(
                StartTvProvisioningRequest(
                    installationId = installationId,
                    appVersion = appVersion,
                    deviceModel = deviceModel,
                    androidApiLevel = androidApiLevel,
                ),
            )
        }
        return PairingSession(
            installationId = installationId,
            pairingCode = response.pairingCode,
            expiresAt = response.expiresAt,
        )
    }

    override suspend fun claimProvisioning(pairingSession: PairingSession): ClaimTvProvisioningResponse =
        call {
            api.claimProvisioning(
                ClaimTvProvisioningRequest(
                    pairingCode = pairingSession.pairingCode,
                    installationId = pairingSession.installationId,
                ),
            )
        }

    override suspend fun saveCredential(credential: String) {
        credentialStore.saveCredential(credential)
        credentialProvider.credential = credential
    }

    override suspend fun clearCredential() {
        credentialStore.clearCredential()
        credentialProvider.credential = null
    }

    override suspend fun loadSnapshot(): TvSnapshot {
        val context = call { api.getTvContext() }
        if (context.roomStatus == RoomStatus.VACANT) {
            return TvSnapshot(context = context, guestData = null)
        }

        val departments = call { api.getDepartments() }
        val enabledUnits = departments.items
            .flatMap { department -> department.units }
            .filter { unit -> unit.enabled }
            .map { unit -> unit.code }
            .distinct()

        return coroutineScope {
            val menus = enabledUnits.associateWith { unit ->
                async {
                    call { api.getMenus(unit = unit, page = 1, pageSize = 100) }
                }
            }
            val requests = async { call { api.getRequests() } }
            TvSnapshot(
                context = context,
                guestData = TvGuestData(
                    departments = departments,
                    menusByUnit = menus.mapValues { (_, deferred) -> deferred.await() },
                    requests = requests.await(),
                ),
            )
        }
    }

    override suspend fun refreshContext(): TvContext = call { api.getTvContext() }

    override suspend fun submitRequest(request: CreateGuestRequest): GuestRequest =
        call { api.createRequest(request) }

    private suspend fun <T> call(block: suspend () -> T): T = try {
        block()
    } catch (exception: HttpException) {
        throw apiException(exception)
    }
}

fun newClientRequestId(): String = UUID.randomUUID().toString()
