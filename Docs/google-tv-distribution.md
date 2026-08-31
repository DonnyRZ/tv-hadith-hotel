# Google TV ADB Distribution & Signing Runbook

**Status:** ADB-only internal deployment; no Google distribution registration planned for MVP  
**Deployment:** One hotel, 114 Google TV / Android TV devices  
**Application ID:** `com.roomservice.tv`

## Locked decision

Production uses one universal, signed native Android TV APK for all rooms. The
current internal-hotel deployment uses controlled **ADB / Wireless Debugging**
to install, update, and recover the APK. Google Play Store, private/enterprise
app store, and Android Developer Console Full Distribution are outside the MVP.
Therefore the current Google platform cost for deployment is US$0.

The repository does not create an account, make a payment, or store Google
credentials. Full Distribution remains an optional future route only; it is not
needed to develop, pilot, or operate this controlled internal deployment.

Google TV devices use Android TV OS, and an app built for Android TV OS works
across the TV ecosystem, including Google TV-branded devices. The APK therefore
does not need a separate Google TV build or a build per room. [Android TV and
Google TV compatibility](https://developer.android.com/training/tv/get-started/google-tv)

## Cost and distribution choices

| Route | Google platform fee | Decision for this project |
|---|---:|---|
| ADB / Wireless Debugging | US$0 | **Selected route** for controlled internal installation, update, and recovery |
| Limited Distribution | US$0 | Not used; limited to 20 devices |
| Full Distribution | US$25 once | Optional future route; not an MVP requirement |
| Google Play Console | US$25 once | Optional future route; not an MVP requirement ([official fee](https://support.google.com/googleplay/android-developer/answer/6112435)) |

The 20-device limit belongs to the Limited Distribution plan, not to the ADB
workflow described by Google's documentation. Google documents ADB as remaining
available for installing and updating unregistered apps. For this controlled
hotel-owned fleet, ADB is the selected route; the tradeoff is deployment labor
and the need for a disciplined device inventory. [Distribution
plans](https://support.google.com/android-developer-console/answer/16640817)
[Android Developer Verification FAQ](https://developer.android.com/developer-verification/guides/faq)

This distinction is important:

- Android APK signing is done with a private keystore controlled by the
  developer; no certificate authority payment is required. [Android app
  signing](https://developer.android.com/studio/publish/app-signing)
- The US$25 amount is a developer/distribution registration fee, not a signing
  certificate and not a device license.
- Device Play Protect certification is a property of the TV model and
  manufacturer, not something purchased per application. [Play Protect
  certification](https://support.google.com/googleplay/answer/7165974?hl=en)

## Future policy checkpoint

As of 29 August 2026, the official announcements do not state that Google TV or
Android TV will require a paid certificate on a specific future date.

| Date | Official position | Project response |
|---|---|---|
| 30 September 2026 | Initial Android Developer Verification protections begin in Brazil, Indonesia, Singapore, and Thailand. ADB remains available; the FAQ does not publish a TV-specific paid-certificate rule. | Continue the controlled ADB deployment and monitor official policy updates. |
| 2027 | Global rollout is planned, but no exact day is published. No TV-specific paid-certificate deadline is published. | Continue using ADB unless an official rule changes this route; retain the production signing key. |

If the hotel operates in Indonesia, the 30 September 2026 checkpoint is
relevant. It still does not turn the 114-TV deployment into a per-device fee or
currently require a paid registration for ADB installation.
[Google rollout announcement](https://developer.android.com/blog/posts/android-developer-verification-rolling-out-to-all-developers-on-play-console-and-android-developer-console)
[Global Android Developer Verification information](https://support.google.com/android/answer/17065026?hl=en)

## Optional future registration

No registration or payment is needed for the current MVP. If the hotel later
decides that it wants Full Distribution, the account owner can complete these
steps outside the repository:

1. Create or use the hotel/company organization account in Android Developer
   Console. Organization verification uses a D-U-N-S number; Google documents
   the D-U-N-S request as free, although verification can take time.
2. Choose Full Distribution and pay the one-time US$25 fee when ready.
3. Generate or import the production keystore in a protected key-custody
   location. Do not generate a new key for each room or each release.
4. Copy `apps/tv-shell/signing.properties.example` to the ignored local file
   `apps/tv-shell/signing.properties`, replace all placeholders, and keep the
   keystore outside source control.
5. Build with `tools/tv/package-tv.ps1`. Record the APK SHA-256 and the signing
   certificate fingerprint printed by `apksigner` in the private deployment
   record.
6. Register the stable package identity `com.roomservice.tv` and its signing
   identity when the console flow requests them.
7. Pilot the signed artifact on the identified physical TV model before
   installing it across all 114 rooms.

Organization account guidance: [Android Developer Console account types](https://support.google.com/android-developer-console/answer/16641046?hl=en)

## Release commands

Debug development remains possible before payment or account registration:

```powershell
Set-Location apps/tv-shell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
```

Production packaging requires the local keystore and an HTTPS API endpoint:

```powershell
.\tools\tv\package-tv.ps1 `
  -ApiBaseUrl https://api.example.com/api/v1/ `
  -VersionCode 1 `
  -VersionName 0.1.0
```

The packaging script fails if the release is unsigned, the keystore is missing,
the API URL is not HTTPS, or `apksigner` cannot verify the APK. The output
checksum must be supplied to the installation script:

```powershell
.\tools\tv\install-tv.ps1 `
  -ApkPath .\apps\tv-shell\app\build\outputs\apk\release\app-release.apk `
  -DeviceAddress 192.168.1.50 `
  -Port 5555 `
  -PackageName com.roomservice.tv `
  -ExpectedSha256 <SHA256-FROM-PACKAGING>
```

## ADB deployment rules for 114 TVs

- Build and distribute one APK; never embed a room number in the APK.
- Increment `versionCode` for every update and retain the signing key.
- Record each TV's model, Android TV OS/API level, ABI, resolution, Play Store
  presence, ADB state, assigned room, installed version, and install checksum.
- Pair each TV once through the receptionist flow; room mapping and device
  credentials remain backend data.
- Keep the signed artifact and checksum in the controlled deployment record,
  not in the source repository.
- Use ADB/Wireless Debugging only from a controlled administrator workstation
  and an isolated management network; never expose ADB to the guest Wi-Fi.
- For Android TV Wireless Debugging, pair with the TV's one-time pairing
  address/code, then connect using the separate port shown by the TV. The
  installer supports both pairing and legacy port-5555 connections.
- Enable Wireless Debugging only for the installation/update/recovery window and
  disable it afterward where the TV configuration permits. Do not disable Play
  Protect.

## Scope boundary

This runbook prepares the application and ADB release process. It does not
claim that the physical pilot has passed or that all 114 TVs are compatible.
Those remain deployment actions owned by the hotel administrator. Full
Distribution registration and the US$25 fee are intentionally not part of the
current deployment.
