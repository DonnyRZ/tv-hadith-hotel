package com.roomservice.tv.data

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface TvApi {
    @POST("tv/provisioning/start")
    suspend fun startProvisioning(
        @Body request: StartTvProvisioningRequest,
    ): StartTvProvisioningResponse

    @POST("tv/provisioning/claim")
    suspend fun claimProvisioning(
        @Body request: ClaimTvProvisioningRequest,
    ): ClaimTvProvisioningResponse

    @GET("tv/context")
    suspend fun getTvContext(): TvContext

    @GET("guest/departments")
    suspend fun getDepartments(): DepartmentListResponse

    @GET("guest/menus")
    suspend fun getMenus(
        @Query("unit") unit: UnitCode,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 100,
    ): MenuItemListResponse

    @GET("guest/requests")
    suspend fun getRequests(): GuestRequestListResponse

    @POST("guest/requests")
    suspend fun createRequest(
        @Body request: CreateGuestRequest,
    ): GuestRequest
}
