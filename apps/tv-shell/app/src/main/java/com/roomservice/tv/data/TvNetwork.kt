package com.roomservice.tv.data

import io.socket.client.IO
import io.socket.emitter.Emitter
import io.socket.engineio.client.transports.WebSocket
import java.net.HttpURLConnection
import java.net.URI
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaType
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json

private val tvJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
}

class DeviceCredentialProvider {
    @Volatile
    var credential: String? = null
}

class DeviceCredentialInterceptor(
    private val credentialProvider: DeviceCredentialProvider,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val credential = credentialProvider.credential
        val request = chain.request()
        if (credential.isNullOrBlank()) {
            return chain.proceed(request)
        }

        return chain.proceed(
            request.newBuilder()
                .header("X-Device-Credential", credential)
                .build(),
        )
    }
}

fun createTvApi(
    baseUrl: String,
    credentialProvider: DeviceCredentialProvider,
): TvApi {
    val client = OkHttpClient.Builder()
        .addInterceptor(DeviceCredentialInterceptor(credentialProvider))
        .build()

    return Retrofit.Builder()
        .baseUrl(if (baseUrl.endsWith('/')) baseUrl else "$baseUrl/")
        .client(client)
        .addConverterFactory(tvJson.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(TvApi::class.java)
}

class TvApiException(
    val statusCode: Int,
    val code: String,
    override val message: String,
) : RuntimeException(message)

fun apiException(error: HttpException): TvApiException {
    val response = error.response()
    if (response === null) {
        return TvApiException(
            statusCode = error.code(),
            code = defaultErrorCode(error.code()),
            message = "The TV service could not complete the request.",
        )
    }
    val body = response.errorBody()?.string()
    val parsed = body?.let {
        runCatching {
            tvJson.decodeFromString<ApiErrorResponse>(it)
        }.getOrNull()
    }

    return TvApiException(
        statusCode = response.code(),
        code = parsed?.code ?: defaultErrorCode(response.code()),
        message = parsed?.message ?: "The TV service could not complete the request.",
    )
}

private fun defaultErrorCode(statusCode: Int): String = when (statusCode) {
    HttpURLConnection.HTTP_UNAUTHORIZED -> "DEVICE_UNAUTHORIZED"
    HttpURLConnection.HTTP_NOT_FOUND -> "CONTEXT_NOT_FOUND"
    HttpURLConnection.HTTP_CONFLICT -> "RESOURCE_CONFLICT"
    HttpURLConnection.HTTP_GONE -> "PAIRING_CODE_EXPIRED"
    else -> "TV_API_ERROR"
}

interface TvRealtimeConnection {
    fun connect()
    fun disconnect()
}

interface TvSocket {
    fun connect()
    fun disconnect()
    fun off()
}

fun interface TvSocketFactory {
    fun create(
        url: String,
        options: IO.Options,
        onAssignmentUpdated: () -> Unit,
    ): TvSocket
}

class TvRealtimeClient(
    private val baseUrl: String,
    private val credentialProvider: DeviceCredentialProvider,
    private val onAssignmentUpdated: () -> Unit,
    private val socketFactory: TvSocketFactory = TvSocketFactory { url, options, onAssignment ->
        val socket = IO.socket(url, options)
        socket.on(
            "guest.assignment.updated",
            Emitter.Listener { onAssignment() },
        )
        object : TvSocket {
            override fun connect() {
                socket.connect()
            }

            override fun disconnect() {
                socket.disconnect()
            }

            override fun off() {
                socket.off()
            }
        }
    },
) : TvRealtimeConnection {
    private var socket: TvSocket? = null

    override fun connect() {
        disconnect()
        val credential = credentialProvider.credential ?: return
        val options = IO.Options().apply {
            transports = arrayOf(WebSocket.NAME)
            reconnection = true
            extraHeaders = mapOf("X-Device-Credential" to listOf(credential))
        }

        socket = socketFactory.create(
            url = realtimeUrl(baseUrl),
            options = options,
            onAssignmentUpdated = onAssignmentUpdated,
        ).also { connectedSocket ->
            connectedSocket.connect()
        }
    }

    override fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
    }

    private fun realtimeUrl(apiBaseUrl: String): String {
        val uri = URI(apiBaseUrl)
        val authority = uri.rawAuthority ?: error("TV API base URL must include a host")
        return "${uri.scheme}://$authority/realtime"
    }
}
