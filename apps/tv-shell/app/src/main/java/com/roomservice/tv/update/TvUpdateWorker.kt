package com.roomservice.tv.update

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Configuration
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.roomservice.tv.TvApplication
import java.util.concurrent.TimeUnit

private const val TV_UPDATE_WORK_NAME = "egi-tv-background-update-check"
private const val TV_UPDATE_RETRY_WORK_NAME = "egi-tv-background-update-retry"

private val workManagerInitializationLock = Any()
@Volatile
private var workManagerInitializationAttempted = false

/**
 * Performs a quiet, network-constrained update check while the TV app is not
 * necessarily in the foreground. It may stage a verified APK, but it never
 * launches Android's installer without an operator action.
 */
class TvUpdateWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    override suspend fun doWork(): Result {
        val application = applicationContext as? TvApplication ?: return Result.failure()
        return when (val result =
            application.container.updateManager.checkForUpdateAndAwait(
                trigger = TvUpdateCheckTrigger.BACKGROUND,
                publishState = false,
            )
        ) {
            is TvUpdateCheckResult.Failed -> {
                if (result.retryable) Result.retry() else Result.success()
            }
            else -> Result.success()
        }
    }
}

object TvUpdateWorkScheduler {
    fun schedule(context: Context) {
        runCatching {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<TvUpdateWorker>(
                TV_UPDATE_CHECK_INTERVAL_MS,
                TimeUnit.MILLISECONDS,
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    TV_UPDATE_FAILURE_RETRY_INTERVAL_MS,
                    TimeUnit.MILLISECONDS,
                )
                .build()

            workManager(context)?.enqueueUniquePeriodicWork(
                TV_UPDATE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }

    fun scheduleRetry(context: Context) {
        runCatching {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<TvUpdateWorker>()
                .setInitialDelay(TV_UPDATE_FAILURE_RETRY_INTERVAL_MS, TimeUnit.MILLISECONDS)
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    TV_UPDATE_FAILURE_RETRY_INTERVAL_MS,
                    TimeUnit.MILLISECONDS,
                )
                .build()

            workManager(context)?.enqueueUniqueWork(
                TV_UPDATE_RETRY_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }
    }

    private fun workManager(context: Context): WorkManager? {
        val applicationContext = context.applicationContext
        synchronized(workManagerInitializationLock) {
            if (!workManagerInitializationAttempted) {
                workManagerInitializationAttempted = true
                runCatching {
                    WorkManager.initialize(
                        applicationContext,
                        Configuration.Builder().build(),
                    )
                }
            }
        }
        return runCatching { WorkManager.getInstance(applicationContext) }.getOrNull()
    }
}
