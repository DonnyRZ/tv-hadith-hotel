package com.roomservice.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.roomservice.tv.presentation.TvRoot
import com.roomservice.tv.presentation.RoomServiceTvTheme
import com.roomservice.tv.presentation.TvViewModel
import com.roomservice.tv.presentation.TvUpdateOverlay
import com.roomservice.tv.update.TvUpdateCheckTrigger

class MainActivity : ComponentActivity() {
    private val tvUpdateManager by lazy { (application as TvApplication).container.updateManager }
    private val tvViewModel: TvViewModel by viewModels {
        TvViewModelFactory((application as TvApplication).container)
    }
    private var foregroundCheckIssued = false

    override fun onStart() {
        super.onStart()
        if (!foregroundCheckIssued) {
            foregroundCheckIssued = true
            tvUpdateManager.checkForUpdate(TvUpdateCheckTrigger.FOREGROUND)
        }
    }

    override fun onStop() {
        foregroundCheckIssued = false
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val uiState by tvViewModel.uiState.collectAsStateWithLifecycle()
            val language by tvViewModel.language.collectAsStateWithLifecycle()
            val updateState by tvUpdateManager.state.collectAsStateWithLifecycle()
            RoomServiceTvTheme {
                Box(modifier = Modifier.fillMaxSize()) {
                    TvRoot(
                        language = language,
                        uiState = uiState,
                        onInitialize = tvViewModel::initialize,
                        onRetry = tvViewModel::retry,
                        onLanguageChange = tvViewModel::selectLanguage,
                        onAddToCart = { item -> tvViewModel.addToCart(item) },
                        onAddVariantToCart = { item, variantId -> tvViewModel.addToCart(item, variantId) },
                        onRemoveFromCart = tvViewModel::removeFromCart,
                        onRefreshRequests = tvViewModel::refreshRequests,
                        onSubmitCart = tvViewModel::submitCart,
                        updateState = updateState,
                        onCheckForUpdates = {
                            tvUpdateManager.checkForUpdate(TvUpdateCheckTrigger.MANUAL)
                        },
                    )
                    TvUpdateOverlay(
                        state = updateState,
                        language = language,
                        onInstall = tvUpdateManager::installPreparedUpdate,
                        onOpenPermissionSettings = tvUpdateManager::openInstallPermissionSettings,
                        onRetry = tvUpdateManager::retry,
                        onDismiss = tvUpdateManager::dismiss,
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
