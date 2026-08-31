package com.roomservice.tv.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.roomservice.tv.data.CreateGuestRequest
import com.roomservice.tv.data.CreateGuestRequestItem
import com.roomservice.tv.data.MenuItem
import com.roomservice.tv.data.PairingSession
import com.roomservice.tv.data.TvApiException
import com.roomservice.tv.data.TvLanguage
import com.roomservice.tv.data.TvLanguageStore
import com.roomservice.tv.data.TvRealtimeConnection
import com.roomservice.tv.data.TvRepository
import com.roomservice.tv.data.TvSnapshot
import com.roomservice.tv.data.UnitCode
import com.roomservice.tv.data.newClientRequestId
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

sealed interface TvUiState {
    data object Loading : TvUiState

    data class Pairing(
        val pairingCode: String,
        val expiresAt: String,
    ) : TvUiState

    data class Ready(
        val snapshot: TvSnapshot,
        val selectedUnit: UnitCode?,
        val cart: List<CartLine> = emptyList(),
        val isSubmitting: Boolean = false,
        val statusMessage: TvStatusMessage? = null,
        val errorMessage: String? = null,
        val errorCode: String? = null,
    ) : TvUiState

    data class Error(
        val message: String,
        val retryable: Boolean = true,
        val errorCode: String? = null,
    ) : TvUiState
}

enum class TvStatusMessage {
    REQUEST_SUBMITTED,
    UNIT_CONFLICT,
}

data class CartLine(
    val item: MenuItem,
    val quantity: Int,
)

class TvViewModel(
    private val repository: TvRepository,
    private val realtimeClient: TvRealtimeConnection,
    private val languageStore: TvLanguageStore = InMemoryTvLanguageStore,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow<TvUiState>(TvUiState.Loading)
    val uiState: StateFlow<TvUiState> = mutableUiState.asStateFlow()
    private val mutableLanguage = MutableStateFlow(TvLanguage.UZ)
    val language: StateFlow<TvLanguage> = mutableLanguage.asStateFlow()

    private var hasInitialized = false
    fun initialize() {
        if (hasInitialized) {
            return
        }
        hasInitialized = true
        viewModelScope.launch {
            mutableLanguage.value = languageStore.getLanguage()
            loadOrProvision()
        }
    }

    fun selectLanguage(language: TvLanguage) {
        mutableLanguage.value = language
        viewModelScope.launch {
            languageStore.saveLanguage(language)
        }
    }

    fun retry() {
        viewModelScope.launch {
            loadOrProvision()
        }
    }

    fun selectUnit(unit: UnitCode) {
        val ready = mutableUiState.value as? TvUiState.Ready ?: return
        mutableUiState.value = ready.copy(
            selectedUnit = unit,
            statusMessage = null,
            errorMessage = null,
            errorCode = null,
        )
    }

    fun addToCart(item: MenuItem) {
        if (!item.available || !item.active) {
            return
        }
        val ready = mutableUiState.value as? TvUiState.Ready ?: return
        if (ready.snapshot.guestData === null) {
            return
        }
        val currentUnit = ready.cart.firstOrNull()?.item?.unit
        if (currentUnit !== null && currentUnit != item.unit) {
            mutableUiState.value = ready.copy(
                statusMessage = TvStatusMessage.UNIT_CONFLICT,
                errorMessage = null,
                errorCode = null,
            )
            return
        }
        val existing = ready.cart.firstOrNull { it.item.id == item.id }
        val nextCart = if (existing === null) {
            ready.cart + CartLine(item = item, quantity = 1)
        } else if (item.quantityAllowed) {
            ready.cart.map { line ->
                if (line.item.id == item.id) line.copy(quantity = line.quantity + 1) else line
            }
        } else {
            ready.cart
        }
        mutableUiState.value = ready.copy(
            cart = nextCart,
            statusMessage = null,
            errorMessage = null,
            errorCode = null,
        )
    }

    fun removeFromCart(itemId: String) {
        val ready = mutableUiState.value as? TvUiState.Ready ?: return
        val nextCart = ready.cart
            .flatMap { line ->
                if (line.item.id != itemId) {
                    listOf(line)
                } else if (line.quantity > 1) {
                    listOf(line.copy(quantity = line.quantity - 1))
                } else {
                    emptyList()
                }
            }
        mutableUiState.value = ready.copy(
            cart = nextCart,
            statusMessage = null,
            errorMessage = null,
            errorCode = null,
        )
    }

    fun submitCart() {
        val ready = mutableUiState.value as? TvUiState.Ready ?: return
        if (ready.cart.isEmpty() || ready.isSubmitting) {
            return
        }

        mutableUiState.value = ready.copy(
            isSubmitting = true,
            statusMessage = null,
            errorMessage = null,
            errorCode = null,
        )
        viewModelScope.launch {
            try {
                val created = repository.submitRequest(
                    CreateGuestRequest(
                        clientRequestId = newClientRequestId(),
                        items = ready.cart.map { line ->
                            CreateGuestRequestItem(
                                menuItemId = line.item.id,
                                quantity = line.quantity,
                            )
                        },
                    ),
                )
                val current = mutableUiState.value as? TvUiState.Ready ?: return@launch
                val currentRequests = current.snapshot.guestData?.requests ?: return@launch
                val updatedRequests = currentRequests.copy(
                    items = listOf(created) + currentRequests.items,
                    total = currentRequests.total + 1,
                )
                mutableUiState.value = current.copy(
                    snapshot = current.snapshot.copy(
                        guestData = current.snapshot.guestData?.copy(requests = updatedRequests),
                    ),
                    cart = emptyList(),
                    isSubmitting = false,
                    statusMessage = TvStatusMessage.REQUEST_SUBMITTED,
                    errorMessage = null,
                    errorCode = null,
                )
            } catch (exception: CancellationException) {
                throw exception
            } catch (exception: Exception) {
                val current = mutableUiState.value as? TvUiState.Ready ?: return@launch
                mutableUiState.value = current.copy(
                    isSubmitting = false,
                    statusMessage = null,
                    errorMessage = exception.userMessage(),
                    errorCode = exception.errorCode(),
                )
            }
        }
    }

    fun onRealtimeAssignmentUpdated() {
        viewModelScope.launch {
            val current = mutableUiState.value as? TvUiState.Ready
            if (current !== null) {
                mutableUiState.value = current.copy(
                    cart = emptyList(),
                    isSubmitting = false,
                    statusMessage = null,
                    errorMessage = null,
                    errorCode = null,
                )
            }
            loadReady()
        }
    }

    override fun onCleared() {
        realtimeClient.disconnect()
        super.onCleared()
    }

    private suspend fun loadOrProvision() {
        mutableUiState.value = TvUiState.Loading
        try {
            if (repository.getCredential() === null) {
                beginProvisioning()
            } else {
                loadReady()
            }
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            mutableUiState.value = TvUiState.Error(
                message = exception.userMessage(),
                errorCode = exception.errorCode(),
            )
        }
    }

    private suspend fun beginProvisioning() {
        val session = repository.startProvisioning()
        if (session.pairingCode.isBlank()) {
            throw TvApiException(
                statusCode = 502,
                code = "TV_API_ERROR",
                message = "TV pairing code was not returned by the service.",
            )
        }
        mutableUiState.value = TvUiState.Pairing(
            pairingCode = session.pairingCode,
            expiresAt = session.expiresAt,
        )

        while (currentCoroutineContext().isActive) {
            delay(PAIRING_POLL_INTERVAL_MS)
            try {
                val claimed = repository.claimProvisioning(session)
                repository.saveCredential(claimed.credential)
                loadReady()
                return
            } catch (exception: TvApiException) {
                if (exception.code == "PAIRING_PENDING") {
                    continue
                }
                if (exception.code == "PAIRING_CODE_EXPIRED") {
                    beginProvisioning()
                    return
                }
                throw exception
            }
        }
    }

    private suspend fun loadReady() {
        mutableUiState.value = TvUiState.Loading
        try {
            val snapshot = repository.loadSnapshot()
            mutableUiState.value = TvUiState.Ready(
                snapshot = snapshot,
                selectedUnit = null,
            )
            realtimeClient.connect()
        } catch (exception: TvApiException) {
            if (exception.statusCode == 401) {
                repository.clearCredential()
                realtimeClient.disconnect()
                beginProvisioning()
            } else {
                throw exception
            }
        }
    }

    private fun Exception.userMessage(): String = when (this) {
        is TvApiException -> message
        else -> message ?: "The TV service is unavailable."
    }

    private fun Exception.errorCode(): String? = (this as? TvApiException)?.code

    private companion object {
        const val PAIRING_POLL_INTERVAL_MS = 2_500L
    }
}

private object InMemoryTvLanguageStore : TvLanguageStore {
    override suspend fun getLanguage(): TvLanguage = TvLanguage.UZ

    override suspend fun saveLanguage(language: TvLanguage) = Unit
}
