# TV Release Checklist

This document is mandatory for the release owner. A release is not eligible
for the pilot until every blocking item is checked.

Before starting, also read [`tv-apk-best-practices.md`](tv-apk-best-practices.md)
for the package, signing, versioning, installation, rollout, and recovery rules.
For the no-flashdisk update route, also read
[`tv-self-update-runbook.md`](tv-self-update-runbook.md).
For the automated build and publication path, also read
[`tv-release-automation.md`](tv-release-automation.md).

## Signing identity

- [x] The original production keystore is recovered from protected key custody
      outside the repository on the EGI release host.
- [ ] No replacement key was generated.
- [ ] The certificate fingerprint is exactly:
  `50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904`
- [ ] The signing alias and passwords are supplied through ignored local
  configuration or CI secrets, never committed to Git.
- [ ] `apksigner verify --print-certs` confirms the expected certificate.

The private keystore is intentionally outside the source tree. On the EGI
release host, the custody files are:

- `C:\IT\hadith-hotel-secrets\tv-release\room-service-tv-release.p12`
- `C:\IT\hadith-hotel-secrets\tv-release\room-service-tv-release.password.dpapi`

The password file is Windows DPAPI-protected and must be decrypted only by its
owning Windows account. Do not put the password into Git, chat, or a permanent
repository file. If custody cannot be unlocked, stop the release; do not create
a new key, because it would make updates to installed `com.roomservice.tv`
packages impossible.

## Build identity and API

- [ ] For a normal release, the protected `EGI TV Release` workflow is used
      from a tag such as `tv-v0.4.8-code12`; local packaging is recovery-only.
- [ ] Package name is exactly `com.roomservice.tv`.
- [ ] Build variant is `release`; no debug APK is handed to an operator.
- [ ] Version code is greater than the installed production version.
- [ ] Version name and `RELEASE_ID` are recorded in the deployment manifest.
- [ ] API base URL is absolute HTTPS production and ends in `/api/v1`.
- [ ] API URL contains no `localhost`, `127.0.0.1`, `10.0.2.2`, laptop IP, or
  development hostname.
- [ ] Staff Web and TV use the same canonical production API.
- [ ] If self-update is enabled, the immutable APK URL, SHA-256, and certificate
  in `/tv/update-manifest` match the release artifact exactly.

Build from the repository root using the protected custody wrapper:

```powershell
.\tools\tv\package-tv-from-custody.ps1 `
  -VersionCode <higher-than-installed> `
  -PreviousVersionCode <installed-production-version> `
  -VersionName <release-version>
```

The packaging script must fail if the key is missing, the URL is not HTTPS,
the package is not the stable package, or the certificate does not match.
The automated equivalent and its required GitHub environments are documented
in [`tv-release-automation.md`](tv-release-automation.md).

## Artifact evidence

- [ ] SHA-256 of the final APK is calculated and stored in the controlled
  deployment manifest.
- [ ] `apksigner` output, package name, version code, certificate fingerprint,
  API URL, release ID, and builder are recorded.
- [ ] APK is copied only to the controlled release location.
- [ ] The artifact is not labelled or distributed as debug.

## Production preflight

- [ ] API starts with PostgreSQL auth/session stores.
- [ ] API health reports `environment=production`, the expected release ID,
  `database=ok`, and `mediaStorage=ok`.
- [ ] Staff Web is built with `VITE_API_BASE_URL=/api/v1`.
- [ ] Staff Web runtime has `API_PROXY_TARGET` set to the API origin with no
  `/api/v1` suffix and `REQUIRE_API_PROXY=true`.
- [ ] `pnpm verify:deployment` passes.
- [ ] When the self-update feed is enabled, `pnpm verify:deployment` passes
      with `--require-tv-update` and confirms the immutable APK is reachable.
- [ ] Unauthenticated Staff Web API requests return JSON `401`; no request
  returns `405` or static HTML.

## Pilot smoke test

- [ ] Install/update without uninstalling the production package.
- [ ] Confirm exactly one app remains: `com.roomservice.tv`.
- [ ] TV shows a six-digit string pairing code, including any leading zero if
  present.
- [ ] Receptionist pairs the TV to the correct room.
- [ ] TV claims the device and loads the room context.
- [ ] Guest welcome, menu, request, and status flow work.
- [ ] API restart test confirms pending pairing data remains available.
- [ ] No pairing code or credential is written into screenshots/logs.
- [ ] Pilot owner signs off before fleet rollout.

## Recovery rules

Remove only `com.roomservice.tv.debug` if an old test package is present. Do
not force-uninstall `com.roomservice.tv` as a troubleshooting shortcut. If the
production package cannot be updated, stop and recover the original keystore
or follow the approved recovery procedure.
