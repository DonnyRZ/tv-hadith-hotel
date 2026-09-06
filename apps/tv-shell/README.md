# Native Android TV application

This is the production Google TV/Android TV application. It is a native Kotlin
app using Jetpack Compose for TV; the TV runtime does not use WebView, React, or
the mobile PWA.

The deployment target is 114 hotel TVs. The current production decision is one
universal signed APK updated through the in-app verified HTTPS updater. Android
may require a one-time install permission and confirmation on an unmanaged TV;
controlled USB remains the recovery fallback. The hotel is not planning to use
Google Play Store, a private enterprise app store, or Android Developer Console
Full Distribution for the MVP, so no US$25 registration is required for this
deployment path. Full Distribution remains an optional future change, not a
runtime dependency.
See [`Docs/google-tv-distribution.md`](../../Docs/google-tv-distribution.md) for
the distribution background. The mandatory operational references are
[`runtime-environment-contract.md`](../../Docs/runtime-environment-contract.md),
[`tv-pairing-runbook.md`](../../Docs/tv-pairing-runbook.md),
[`tv-pairing-troubleshooting.md`](../../Docs/tv-pairing-troubleshooting.md),
and [`tv-release-checklist.md`](../../Docs/tv-release-checklist.md).
The day-to-day APK policy is in
[`tv-apk-best-practices.md`](../../Docs/tv-apk-best-practices.md).
The self-update decision and publish procedure are in
[`tv-self-update-research.md`](../../Docs/tv-self-update-research.md) and
[`tv-self-update-runbook.md`](../../Docs/tv-self-update-runbook.md).
The automated signed-release pipeline is defined in
[`tv-release-automation.md`](../../Docs/tv-release-automation.md).

## Architecture

- UI: Jetpack Compose for TV and `androidx.tv.material3`.
- State: single Activity, ViewModel, StateFlow, and repository boundaries.
- Network: Retrofit/OkHttp for REST and Socket.IO for room assignment updates.
- Device identity: one-time pairing code, then an Android Keystore-protected
  device credential.
- API base URL is mandatory for every build; there is no implicit default. For
  an Android emulator, explicitly use `-PtvTarget=emulator
-PtvApiBaseUrl=http://10.0.2.2:3000/api/v1/`. For a physical TV, use the
  laptop LAN address or a deployed HTTPS API and `-PtvTarget=physical`.

## Development and test-only builds

Use Android Studio with Java 17 and the Android TV Emulator for test-only
builds. Debug APKs are never installed as the pilot or distributed to
operators.

```powershell
Set-Location ../..
.\tools\tv\build-debug-tv.ps1 `
  -ApiBaseUrl http://<laptop-lan-ip>:3000/api/v1/ `
  -Target physical
```

For emulator-only development, use the explicit emulator target:

```powershell
Set-Location apps/tv-shell
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug `
  -PtvTarget=emulator `
  -PtvApiBaseUrl=http://10.0.2.2:3000/api/v1/
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
  -VersionCode 6 `
  -PreviousVersionCode 5 `
  -VersionName 0.1.0
```

The generated certificate fingerprint is the signing identity to retain for
future updates and, when requested by the distribution registration flow, to
associate with the package. No key or payment secret belongs in the repository.

For the normal release path, do not run this command manually. Create a
protected tag such as `tv-v0.4.8-code12` and let the `EGI TV Release` GitHub
Actions workflow build and verify the signed artifact. The manual command is a
recovery path only; see [`tv-release-automation.md`](../../Docs/tv-release-automation.md).

## Install the signed release on a TV

Enable Developer Options and Wireless Debugging on the pilot TV, then install
only the signed release artifact from the repository root. Follow the
preflight and operator steps in `Docs/tv-pairing-runbook.md` first. The
installer must use package `com.roomservice.tv` and the SHA-256 from the
release manifest.

For Android TV Wireless Debugging, use the pairing endpoint and code shown by
the TV, then use the separate connect port shown after pairing:

```powershell
.\tools\tv\install-tv.ps1 `
  -ApkPath .\apps\tv-shell\app\build\outputs\apk\release\app-release.apk `
  -DeviceAddress 192.168.1.50 `
  -Port 42137 `
  -PairingAddress 192.168.1.50:37123 `
  -PairingCode 123456 `
  -PackageName com.roomservice.tv `
  -ExpectedSha256 <SHA256-FROM-MANIFEST>
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
