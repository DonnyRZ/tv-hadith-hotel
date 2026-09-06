# Research source record — EGI TV self-update

**Title:** EGI TV Self-Update — Research and Implementation Decision
**Audience:** EGI release owner, Android/API developers, hotel IT support
**Date:** 2026-09-03
**Scope:** safe updates for the existing sideloaded Android TV package without
ADB, vendor access, or factory reset.

## Direct answer

Use an HTTPS manifest plus a verified in-app APK download and Android's package
installer. Keep `com.roomservice.tv`, the existing production signing key, and
monotonically increasing `versionCode`. This removes per-release flashdisk
copying, but standard unmanaged Android TV may still require one-time install
permission and a user confirmation; zero-touch installation is not universal.

## Assumptions

- Existing TVs retain the installed production package and its data.
- The production signing key and certificate fingerprint remain available.
- A versioned HTTPS object-storage/CDN location can host the APK.
- The hotel cannot rely on vendor support, ADB, or Android Enterprise
  enrollment for this fleet.

## Source ledger

| Claim used                                                                                    | Primary source                                                                                                                | Why it matters                                                                      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| An update requires matching application identity/signing and an acceptable version code       | [Android App updates](https://developer.android.com/google/play/app-updates)                                                  | Preserves installed `com.roomservice.tv` data and credential.                       |
| Private-server APK distribution is supported but unknown-app permission applies on Android 8+ | [Alternative distribution](https://developer.android.com/distribute/marketing-tools/alternative-distribution)                 | Explains why flashdisk can be removed but the installer may still require approval. |
| Package installation can require pending user action                                          | [`PackageInstaller.SessionParams`](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams) | Prevents promising silent installation on an unmanaged TV.                          |
| `REQUEST_INSTALL_PACKAGES` is the relevant install-request permission                         | [Manifest permission reference](https://developer.android.com/reference/android/Manifest.permission)                          | Supports the Android manifest implementation.                                       |
| `FileProvider`/`content://` is the secure way to share the APK with the installer             | [Secure file sharing](https://developer.android.com/training/secure-file-sharing)                                             | Avoids unsafe `file://` URIs and exposed filesystem paths.                          |
| Device-owner provisioning is the managed-device route                                         | [Android Management API provisioning](https://developers.google.com/android/management/provision-device)                      | Identifies the stronger future zero-touch option and its provisioning dependency.   |
| Dedicated devices have management requirements                                                | [Dedicated-device requirements](https://developers.google.com/android/work/requirements/dedicated-device)                     | Confirms MDM/device-owner cannot be assumed for every existing consumer TV.         |

## Limitations and recommendation

The implementation is deliberately fail-closed: malformed update metadata,
HTTP URLs, hash mismatch, package mismatch, version mismatch, or certificate
mismatch never reach Android's installer. The feed remains disabled until
immutable storage and production configuration are provisioned. This is the
recommended current path; Play/managed distribution can be evaluated later if
the fleet becomes eligible.
