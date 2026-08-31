# Native Android TV application

This is the production Google TV/Android TV application. It is a native Kotlin
app using Jetpack Compose for TV; the TV runtime does not use WebView, React, or
the mobile PWA.

The deployment target is 114 hotel TVs. The current production decision is one
universal signed APK installed through controlled ADB / Wireless Debugging. The
hotel is not planning to use Google Play Store, a private enterprise app store,
or Android Developer Console Full Distribution for the MVP, so no US$25
registration is required for this deployment path. Full Distribution remains
an optional future change, not a runtime dependency.
See [`Docs/google-tv-distribution.md`](../../Docs/google-tv-distribution.md) for
the ADB-only release and deployment runbook.

## Architecture

- UI: Jetpack Compose for TV and `androidx.tv.material3`.
- State: single Activity, ViewModel, StateFlow, and repository boundaries.
- Network: Retrofit/OkHttp for REST and Socket.IO for room assignment updates.
- Device identity: one-time pairing code, then an Android Keystore-protected
  device credential.
- API base URL: `http://10.0.2.2:3000/api/v1/` by default for the Android
  emulator. Override it with `-PtvApiBaseUrl=https://host/api/v1/`.

## Development

Use Android Studio with Java 17 and the Android TV Emulator, or run the Gradle
wrapper from this directory:

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
```

Release builds require `signing.properties` or all of the ephemeral
`TV_SIGNING_STORE_FILE`, `TV_SIGNING_STORE_PASSWORD`, `TV_SIGNING_KEY_ALIAS`,
and `TV_SIGNING_KEY_PASSWORD` environment variables, plus a real keystore
outside source control; never commit credentials. Keep the same signing key
for all updates.
Release packaging also requires an HTTPS API base URL, verifies the APK with
`apksigner`, and prints both the APK checksum and signing certificate details.
For a release artifact, run the repository-root packaging script:

```powershell
.\tools\tv\package-tv.ps1 `
  -ApiBaseUrl https://api.example.com/api/v1/ `
  -VersionCode 1 `
  -VersionName 0.1.0
```

The generated certificate fingerprint is the signing identity to retain for
future updates and, when requested by the distribution registration flow, to
associate with the package. No key or payment secret belongs in the repository.

## Install on a TV

Enable Developer Options and Wireless Debugging on the pilot TV, then run the
installer from the repository root:

```powershell
.\tools\tv\install-tv.ps1 `
  -ApkPath .\apps\tv-shell\app\build\outputs\apk\debug\app-debug.apk `
  -DeviceAddress 192.168.1.50 `
  -PackageName com.roomservice.tv.debug
```

For Android TV Wireless Debugging pairing, use the pairing endpoint and code
shown by the TV, then use the separate connect port shown after pairing:

```powershell
.\tools\tv\install-tv.ps1 `
  -ApkPath .\apps\tv-shell\app\build\outputs\apk\debug\app-debug.apk `
  -DeviceAddress 192.168.1.50 `
  -Port 42137 `
  -PairingAddress 192.168.1.50:37123 `
  -PairingCode 123456 `
  -PackageName com.roomservice.tv.debug
```

The pairing port and connect port are displayed by the TV and may change; port
`5555` is retained for legacy ADB-over-TCP setups. Perform installation from a
controlled administrator network, never from guest Wi-Fi.

For production, pass the signed release APK, production package name, and the
SHA-256 printed by `package-tv.ps1` through `-ExpectedSha256` before installation.
The same APK is used for every room; room mapping happens during pairing, not
through separate APK builds.

On first launch the TV displays a short pairing code. A Receptionist maps that
code to a room; the TV then saves the issued credential and loads its room
context.

Capture the pilot hardware gate before release:

```powershell
.\tools\tv\inspect-tv.ps1 -DeviceAddress 192.168.1.50
```

Record the output with the hotel deployment notes; it identifies the model,
Android TV API/build, ABI, resolution, Play Store presence, and ADB support.

## Hardware release gate

The exact hotel TV model is still a release input. Record the model, Android TV
OS build/API, ABI, resolution, and ADB support before declaring compatibility.
Emulator and unit tests are required, but they do not replace the physical TV
acceptance test.
