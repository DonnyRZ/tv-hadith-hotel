package com.roomservice.tv

import android.app.Application
import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.roomservice.tv.data.AndroidDeviceCredentialStore
import com.roomservice.tv.data.AndroidTvLanguageStore
import com.roomservice.tv.data.DefaultTvRepository
import com.roomservice.tv.data.DeviceCredentialProvider
import com.roomservice.tv.data.TvRealtimeClient
import com.roomservice.tv.data.TvRepository
import com.roomservice.tv.presentation.TvViewModel

class TvApplication : Application() {
    lateinit var container: TvAppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = TvAppContainer(this)
    }
}

class TvAppContainer(
    application: Application,
) {
    private val credentialProvider = DeviceCredentialProvider()
    private val credentialStore = AndroidDeviceCredentialStore(application)
    private val languageStore = AndroidTvLanguageStore(application)
    private val api = com.roomservice.tv.data.createTvApi(BuildConfig.API_BASE_URL, credentialProvider)
    private var viewModel: TvViewModel? = null

    val repository: TvRepository = DefaultTvRepository(
        api = api,
        credentialStore = credentialStore,
        credentialProvider = credentialProvider,
        deviceModel = Build.MODEL.ifBlank { "Android TV" },
        androidApiLevel = Build.VERSION.SDK_INT,
        appVersion = BuildConfig.VERSION_NAME,
    )

    private val realtimeClient = TvRealtimeClient(
        baseUrl = BuildConfig.API_BASE_URL,
        credentialProvider = credentialProvider,
        onAssignmentUpdated = { viewModel?.onRealtimeAssignmentUpdated() },
    )

    fun createViewModel(): TvViewModel {
        return TvViewModel(repository, realtimeClient, languageStore).also { viewModel = it }
    }
}

class TvViewModelFactory(
    private val container: TvAppContainer,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(TvViewModel::class.java)) {
            "Unknown ViewModel class: ${modelClass.name}"
        }
        return container.createViewModel() as T
    }
}
