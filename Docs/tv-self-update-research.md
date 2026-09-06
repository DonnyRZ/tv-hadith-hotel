# EGI TV Self-Update — Research and Implementation Decision

**Audience:** release owner, API/Android developers, and hotel IT support
**Research date:** 3 September 2026
**Scope:** updating the already-installed `com.roomservice.tv` APK on the
existing Android TV fleet without ADB, vendor access, or factory reset.

## Direct answer

For the current TVs, the strongest practical route is an in-app self-update:

1. The app checks a public API manifest over HTTPS.
2. The manifest identifies the exact package, version, APK URL, APK SHA-256,
   and production certificate fingerprint.
3. The app downloads the APK in the background, rejects redirects and files
   outside its size limit, then verifies the digest, package name, versionCode,
   and certificate before staging it.
4. Android's official package installer performs the update. The app retains
   its room credential because the package identity and signing key stay the
   same.

This removes the need to copy a new APK to every TV for each release. It does
not promise invisible installation: on ordinary consumer Android TV, the user
may need to allow this app to install unknown-app updates once and confirm the
system installer. Android does not expose a universal zero-touch path to a
normal sideloaded app without device-owner/MDM management or a managed Play
distribution.

## Evidence and implications

- Android accepts an application update when the application ID and signing
  certificate match and the new `versionCode` is not lower. See Google's
  [App updates documentation](https://developer.android.com/google/play/app-updates).
- Website/private-server APK distribution is supported, but Android 8 and
  later require the installing source to be allowed under “Install unknown
  apps”. See [Alternative distribution](https://developer.android.com/distribute/marketing-tools/alternative-distribution).
- The platform's package installer explicitly models a pending user action;
  an app must handle that state instead of assuming a background install will
  always succeed. See
  [`PackageInstaller.SessionParams`](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams).
- `REQUEST_INSTALL_PACKAGES` is the platform permission for an app that needs
  to request package installation. See the
  [Android manifest permission reference](https://developer.android.com/reference/android/Manifest.permission).
- APK files are passed to another Android component through a `content://`
  URI from `FileProvider`, not an unsafe `file://` URI. See
  [Secure file sharing](https://developer.android.com/training/secure-file-sharing).
- Device-owner/dedicated-device management is the route for centralized
  managed-device control, but it depends on device provisioning and is not a
  universal feature that can be assumed for this existing fleet. See Google's
  [Android Management API provisioning guide](https://developers.google.com/android/management/provision-device)
  and [dedicated-device requirements](https://developers.google.com/android/work/requirements/dedicated-device).

## Decision for this repository

The repository now contains the safe client and server contract, but the feed
is intentionally disabled until the first immutable APK location is prepared:

- API: `GET /api/v1/tv/update-manifest`.
- API configuration: `TV_UPDATE_ENABLED`, `TV_UPDATE_VERSION_CODE`,
  `TV_UPDATE_VERSION_NAME`, `TV_UPDATE_APK_URL`, `TV_UPDATE_SHA256`,
  `TV_UPDATE_CERTIFICATE_SHA256`, `TV_UPDATE_RELEASE_ID`,
  `TV_UPDATE_MANDATORY`, and optional
  `TV_UPDATE_MIN_SUPPORTED_VERSION_CODE`.
- The API validates an enabled feed at startup in production. A partial,
  non-HTTPS, temporary-query-string, or wrong-certificate feed fails closed.
- The APK is not stored on the Railway API container. Use immutable S3/
  MinIO-compatible storage or a release CDN and publish the exact checksum.
- The Android client checks at launch/resume with a six-hour cooldown, keeps
  guest use available while downloading, and only offers an APK after all
  integrity checks succeed.
- Debug package `com.roomservice.tv.debug` can never satisfy the update
  contract. Only `com.roomservice.tv` and the existing certificate
  `50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904` are valid.

## Release sequence

1. Create a protected tag such as `tv-v0.4.8-code12`. The `EGI TV Release`
   GitHub Actions workflow is the normal builder; it runs source validation,
   loads the encrypted production signing secret, and verifies the known
   certificate fingerprint. `tools/tv/package-tv-from-custody.ps1` remains the
   local recovery path only.
2. The workflow records the generated APK SHA-256 and release manifest as a
   named artifact.
3. When automatic publishing is enabled, the workflow uploads the APK to
   immutable HTTPS storage using a versioned path. It never overwrites an APK
   after publishing its checksum.
4. After protected promotion approval, the workflow configures the exact
   `TV_UPDATE_*` variables on the API and waits until the API serves the same
   version, URL, and checksum.
5. The workflow verifies the public object and the production API feed before
   the release is considered publishable.
6. Enable the feed for a single pilot TV. Confirm the installer shows an update
   rather than a new application, and verify pairing, room context, guest
   requests, and restart behavior.
7. Roll out the same artifact to the remaining TVs. Keep the previous APK and
   manifest for recovery; a rollback after a higher `versionCode` requires a
   new hotfix with an even higher code.

## Remaining operational limitation

The app can make discovery, download, and verification automatic. It cannot
legitimately bypass Android's user/installer policy on unmanaged consumer TVs.
Therefore “no flashdisk per release” is achievable, while “zero taps on all
existing TVs” is not an honest acceptance criterion unless the fleet is later
enrolled as managed devices or distributed through a compatible Play channel.
