package com.roomservice.tv.data

import io.socket.client.IO
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TvRealtimeClientTest {
    @Test
    fun `configures the realtime namespace credential and reconnect behavior`() {
        val provider = DeviceCredentialProvider().apply { credential = "tv-secret" }
        val sockets = mutableListOf<FakeTvSocket>()
        var createdUrl: String? = null
        var createdOptions: IO.Options? = null
        var assignmentRefreshCount = 0
        val factory = TvSocketFactory { url, options, onAssignmentUpdated ->
            createdUrl = url
            createdOptions = options
            FakeTvSocket(onAssignmentUpdated).also(sockets::add)
        }
        val client = TvRealtimeClient(
            baseUrl = "https://api.example.com/api/v1/",
            credentialProvider = provider,
            onAssignmentUpdated = { assignmentRefreshCount += 1 },
            socketFactory = factory,
        )

        client.connect()
        sockets.single().emitAssignmentUpdated()

        assertEquals("https://api.example.com/realtime", createdUrl)
        assertTrue(createdOptions?.reconnection == true)
        assertArrayEquals(arrayOf("websocket"), createdOptions?.transports)
        assertEquals(
            listOf("tv-secret"),
            createdOptions?.extraHeaders?.get("X-Device-Credential"),
        )
        assertTrue(sockets.single().connectCalled)
        assertEquals(1, assignmentRefreshCount)

        client.connect()

        assertEquals(1, sockets.first().disconnectCount)
        assertEquals(2, sockets.size)
        assertTrue(sockets.last().connectCalled)
    }

    @Test
    fun `does not create a socket without a device credential`() {
        var factoryCallCount = 0
        val client = TvRealtimeClient(
            baseUrl = "https://api.example.com/api/v1/",
            credentialProvider = DeviceCredentialProvider(),
            onAssignmentUpdated = {},
            socketFactory = TvSocketFactory { _, _, _ ->
                factoryCallCount += 1
                FakeTvSocket {}
            },
        )

        client.connect()

        assertEquals(0, factoryCallCount)
    }
}

private class FakeTvSocket(
    private val onAssignment: () -> Unit,
) : TvSocket {
    var connectCalled: Boolean = false
        private set
    var disconnectCount: Int = 0
        private set

    fun emitAssignmentUpdated() {
        onAssignment()
    }

    override fun connect() {
        connectCalled = true
    }

    override fun disconnect() {
        disconnectCount += 1
    }

    override fun off() = Unit
}
