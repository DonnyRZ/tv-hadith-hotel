# EGI TV Self-Update Runbook

This runbook is for the release owner and hotel IT support. Read it together
with [`tv-release-checklist.md`](tv-release-checklist.md) and
[`tv-self-update-research.md`](tv-self-update-research.md).

## What this changes

After the self-update feed is enabled, an installed `com.roomservice.tv` app
checks the API and downloads a newer signed APK in the background. When the
download is verified, the app presents Android's official installer. The
existing app data, pairing credential, and room mapping are preserved because
the package name and production signing certificate remain unchanged.

The API does not host the APK on its Railway container. Publish the APK first
to immutable HTTPS object storage/CDN, then point the API at that exact file.

## Release owner procedure

1. Read `tv-apk-best-practices.md` and `tv-release-checklist.md`.
2. Use the protected GitHub Actions release workflow for a normal release.
   Create an annotated protected tag from `main` with a new version code:

   ```text
   tv-v0.4.8-code12
   ```

   The workflow uses its project-scoped `RAILWAY_TOKEN` only during the
   protected feed-promotion job; it does not depend on a browser login. The
   manual custody build below is recovery/bootstrap-only:

   ```powershell
   .\tools\tv\package-tv-from-custody.ps1 `
     -VersionCode <higher-than-the-fleet> `
     -PreviousVersionCode <current-fleet-version> `
     -VersionName <release-version> `
     -UpdateApkUrl https://updates.example.com/egi-tv/<version-code>/app-release.apk `
     -UpdateReleaseId tv-<release-version>
   ```

   Supplying `-UpdateApkUrl` also makes the script emit
   `app-release.apk.tv-update-manifest.json`; it is a ready-to-copy record for
   the API `TV_UPDATE_*` variables. The URL may be supplied later, but it must
   be the immutable location of this exact APK and must not use an expiring
   signed query string; TVs need the same stable URL for later checks.
3. The workflow produces the signed APK, checksum, release record, and update
   manifest as a GitHub artifact. The `tv-update-publish` approval uploads the
   immutable objects to MinIO and verifies the public URL without redirects.
4. The `tv-production-update` approval updates the API variables with
   `railway variable set --skip-deploys`, redeploys the API explicitly, and
   verifies direct API, Staff Web, Guest Web, Redis/realtime health, Socket.IO,
   and exact manifest-to-artifact equality. It is not complete until that
   verification passes.
5. The API update manifest is the exact artifact metadata:

   ```text
   TV_UPDATE_ENABLED=true
   TV_UPDATE_VERSION_CODE=11
   TV_UPDATE_VERSION_NAME=0.4.7
   TV_UPDATE_APK_URL=https://updates.example.com/egi-tv/11/app-release.apk
   TV_UPDATE_SHA256=<sha256-from-the-release-manifest>
   TV_UPDATE_CERTIFICATE_SHA256=50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904
   TV_UPDATE_RELEASE_ID=tv-0.4.7
   TV_UPDATE_MANDATORY=false
   TV_UPDATE_MIN_SUPPORTED_VERSION_CODE=1
   ```

6. Verify the production surfaces:

   ```text
   GET https://<api-host>/api/v1/health
   GET https://<api-host>/api/v1/tv/update-manifest
   ```

   The first response must report production and healthy dependencies. The
   second must report the exact version, URL, SHA-256, and certificate. Never
   paste a password, cookie, pairing code, or TV credential into a ticket.
   The release verification checks the APK URL from the Staff Web origin and
   rejects a missing, redirected, or unreachable artifact.
7. Test the feed on one pilot TV. Keep `TV_UPDATE_ENABLED=false` until the
   object is reachable and the pilot is ready.
8. After pilot approval, leave the same immutable artifact enabled for the
   fleet and record which TVs completed the update.

## TV operator procedure

On the first update, Android may show a permission screen for “Install unknown
apps”. Choose **Open settings**, allow EGI TV, and return to EGI TV. This is a
one-time Android policy step on an unmanaged TV. Then choose **Install update**
in the EGI TV prompt and accept Android's installer confirmation.

The app only displays the install prompt after checking the APK checksum,
package name, exact versionCode, and production certificate. If any check
fails, the APK is discarded and the installed app remains in place.

## Recovery

- If no prompt appears, check that the API manifest is enabled, the TV has
  network access, and the advertised version is higher than the installed
  version.
- A failed network check does not consume the six-hour normal cooldown. The
  updater retries after a short failure backoff, and **Retry** always bypasses
  the cooldown.
- If the APK finished downloading before an app restart, the updater restores
  the verified cached file instead of downloading it again.
- If Android asks for permission, complete the one-time permission step above.
- If the feed reports a mismatch or the download fails, stop the rollout and
  fix the manifest/storage. Do not disable signing verification.
- If the self-update feed is unavailable, the installed app continues to work;
  use the controlled release checklist and USB as a fallback for the pilot.
- Do not uninstall `com.roomservice.tv` as a first response. Do not install
  `com.roomservice.tv.debug` over the operational app.
- A rollback after a higher `versionCode` requires a new signed hotfix with an
  even higher code; Android normally rejects a downgrade.

## Acceptance checklist

- [ ] APK package is `com.roomservice.tv`.
- [ ] APK is release-signed with the existing certificate.
- [ ] APK URL is HTTPS and versioned.
- [ ] API manifest checksum equals the immutable APK checksum.
- [ ] API manifest certificate equals the known production fingerprint.
- [ ] API health is production and healthy.
- [ ] Pilot TV retained room pairing and guest flow after update.
- [ ] No debug package was used for the pilot.
- [ ] Fleet update results are recorded.
