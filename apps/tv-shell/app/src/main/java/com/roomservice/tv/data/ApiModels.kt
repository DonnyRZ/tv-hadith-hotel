package com.roomservice.tv.data

import kotlinx.serialization.Serializable

@Serializable
data class RoomReference(
    val id: String,
    val number: String,
)

@Serializable
enum class RoomStatus {
    VACANT,
    OCCUPIED,
}

@Serializable
enum class RequestStatus {
    NEW,
    IN_PROCESS,
    COMPLETED,
}

@Serializable
enum class UnitCode {
    SPA,
    RESTAURANT,
    LOUNGE,
    HOUSEKEEPING,
    BEAUTY_AND_SALON,
    CAFE,
}

enum class TvLanguage(val tag: String) {
    UZ("uz"),
    RU("ru"),
    EN("en"),
}

@Serializable
enum class MenuItemKind {
    PRODUCT,
    SERVICE,
}

@Serializable
data class WelcomeState(
    val message: String,
    val guestName: String? = null,
    val personalized: Boolean,
)

@Serializable
data class TvDevice(
    val id: String,
    val deviceCode: String,
    val room: RoomReference,
)

@Serializable
data class TvContext(
    val device: TvDevice,
    val roomStatus: RoomStatus,
    val welcome: WelcomeState,
)

@Serializable
data class DepartmentUnit(
    val code: UnitCode,
    val department: String,
    val name: String,
    val roomManagerMonitoring: Boolean,
    val enabled: Boolean = true,
    val disabledReason: String? = null,
)

@Serializable
data class DepartmentSummary(
    val code: String,
    val name: String,
    val units: List<DepartmentUnit>,
)

@Serializable
data class DepartmentListResponse(
    val items: List<DepartmentSummary>,
)

@Serializable
data class MenuItem(
    val id: String,
    val unit: UnitCode,
    val kind: MenuItemKind,
    val name: String,
    val localizedName: LocalizedText? = null,
    val description: String? = null,
    val localizedDescription: LocalizedText? = null,
    val price: Double? = null,
    val currency: String? = null,
    val durationMinutes: Int? = null,
    val imageMediaId: String? = null,
    val active: Boolean,
    val available: Boolean,
    val quantityAllowed: Boolean,
    val sortOrder: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class LocalizedText(
    val uz: String,
    val ru: String,
    val en: String,
)

@Serializable
data class MenuItemListResponse(
    val items: List<MenuItem>,
    val page: Int = 1,
    val pageSize: Int = items.size,
    val total: Int = items.size,
)

@Serializable
data class RequestItem(
    val menuItemId: String,
    val unit: UnitCode,
    val kind: MenuItemKind,
    val name: String,
    val localizedName: LocalizedText? = null,
    val quantity: Int,
    val note: String? = null,
)

@Serializable
data class GuestRequest(
    val id: String,
    val clientRequestId: String,
    val department: String,
    val unit: UnitCode,
    val items: List<RequestItem>,
    val status: RequestStatus,
    val requestedAt: String,
    val confirmedAt: String? = null,
    val completedAt: String? = null,
)

@Serializable
data class GuestRequestListResponse(
    val items: List<GuestRequest>,
    val page: Int,
    val pageSize: Int,
    val total: Int,
)

@Serializable
data class CreateGuestRequestItem(
    val menuItemId: String,
    val quantity: Int,
    val note: String? = null,
)

@Serializable
data class CreateGuestRequest(
    val clientRequestId: String,
    val items: List<CreateGuestRequestItem>,
    val guestNote: String? = null,
)

@Serializable
data class StartTvProvisioningRequest(
    val installationId: String,
    val appVersion: String,
    val deviceModel: String,
    val androidApiLevel: Int,
)

@Serializable
data class StartTvProvisioningResponse(
    val deviceId: String,
    val deviceCode: String,
    val pairingCode: String,
    val expiresAt: String,
)

@Serializable
data class ClaimTvProvisioningRequest(
    val pairingCode: String,
    val installationId: String,
)

@Serializable
data class ClaimTvProvisioningResponse(
    val credential: String,
    val device: TvDevice,
)

@Serializable
data class ApiErrorResponse(
    val statusCode: Int? = null,
    val code: String? = null,
    val message: String? = null,
)
