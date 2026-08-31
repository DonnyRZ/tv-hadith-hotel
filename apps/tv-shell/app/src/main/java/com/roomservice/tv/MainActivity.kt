package com.roomservice.tv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.roomservice.tv.presentation.TvRoot
import com.roomservice.tv.presentation.TvViewModel

class MainActivity : ComponentActivity() {
    private val tvViewModel: TvViewModel by viewModels {
        TvViewModelFactory((application as TvApplication).container)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val uiState by tvViewModel.uiState.collectAsStateWithLifecycle()
            val language by tvViewModel.language.collectAsStateWithLifecycle()
            TvRoot(
                language = language,
                uiState = uiState,
                onInitialize = tvViewModel::initialize,
                onRetry = tvViewModel::retry,
                onLanguageChange = tvViewModel::selectLanguage,
                onAddToCart = tvViewModel::addToCart,
                onRemoveFromCart = tvViewModel::removeFromCart,
                onSubmitCart = tvViewModel::submitCart,
            )
        }
    }
}
