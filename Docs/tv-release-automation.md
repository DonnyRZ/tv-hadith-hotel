# EGI TV Release Automation

This document defines the release path that removes Codex or any individual
developer from the critical path of producing an operational APK. The normal
release is created by GitHub Actions from a protected release tag. A tag is the
intentional production approval boundary; ordinary commits and pull requests
must never create or distribute a production APK.

## Normal release trigger

After the code has passed review and the existing CI workflow is green, create
an annotated tag using this exact format:

```text
tv-v<version-name>-code<version-code>
```

Example:

```powershell
git tag -a tv-v0.4.8-code12 -m "EGI TV 0.4.8"
git push origin tv-v0.4.8-code12
```

The `EGI TV Release` workflow then:

1. Checks out the tagged source and runs the repository validation suite.
2. Resolves the version from the tag and rejects a non-increasing version code.
3. Loads the production keystore from an encrypted GitHub Actions environment
   secret; no key is stored in Git.
4. Runs `tools/tv/package-tv.ps1`, which is the same release gate used locally.
5. Verifies `com.roomservice.tv`, release variant, HTTPS production API,
   version code, APK SHA-256, and the retained production certificate.
6. Uploads the APK, checksum, and release manifests as a named workflow
   artifact.
7. If update publishing is enabled, uploads the versioned APK to the
   S3-compatible update storage, verifies the public URL without following a
   redirect, and promotes the exact manifest to the Railway API after the
   protected environment approval.

The workflow intentionally has no signing step on pull requests. This keeps
the production key away from untrusted PR code and follows the principle that
the release tag, not a random commit, creates a distributable APK.

## One-time GitHub configuration

Create a protected GitHub Environment named `tv-release` and add these secrets:

```text
TV_SIGNING_KEYSTORE_BASE64
TV_SIGNING_STORE_PASSWORD
TV_SIGNING_KEY_ALIAS
TV_SIGNING_KEY_PASSWORD
```

`TV_SIGNING_KEYSTORE_BASE64` is the base64 encoding of the existing
`room-service-tv-release.p12`. It must be the same key whose certificate is:

```text
50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904
```

Use GitHub Environment required reviewers for `tv-release`. GitHub encrypts
Actions secrets before they are stored and exposes them only to workflows that
explicitly request them. Never print the secret, put it in a workflow log, or
commit the decoded `.p12` file.

Add these non-secret Environment variables:

```text
TV_PRODUCTION_API_BASE_URL=https://api-production-505c.up.railway.app/api/v1/
TV_INITIAL_PRODUCTION_VERSION_CODE=11
TV_UPDATE_AUTOPUBLISH_ENABLED=false
```

Keep the shared values above available to the `tv-release` environment. The
storage values below belong to `tv-update-publish`, and the Railway values
belong to `tv-production-update`; this prevents a publish job from silently
using a different bucket or API service.

When the immutable update storage is ready, add:

```text
TV_UPDATE_PUBLIC_BASE_URL=https://<public-update-host>
TV_UPDATE_S3_ENDPOINT=https://<s3-compatible-endpoint>
TV_UPDATE_S3_BUCKET=<bucket-name>
TV_UPDATE_S3_PREFIX=egi-tv
TV_UPDATE_S3_REGION=us-east-1
```

For the automatic publish path, create a protected Environment named
`tv-update-publish` with these secrets:

```text
TV_UPDATE_S3_ACCESS_KEY_ID
TV_UPDATE_S3_SECRET_ACCESS_KEY
```

Create a second protected Environment named `tv-production-update` with:

```text
RAILWAY_TOKEN=<project-scoped Railway token>
```

and these non-secret variables:

```text
RAILWAY_API_SERVICE=<API service name or ID>
RAILWAY_ENVIRONMENT=production
```

The last environment is an approval gate. Once approved, the workflow updates
all `TV_UPDATE_*` variables as one operation and waits until the Railway API
serves the exact version, URL, and checksum represented by the signed APK.

Until the storage and protected environments are configured, leave
`TV_UPDATE_AUTOPUBLISH_ENABLED=false`. The tag workflow will still build and
archive a signed APK, but it will not claim that the TV update feed is active.

## Bootstrap versus routine update

The first installation of the updater-capable APK on an existing unmanaged TV
is a bootstrap operation and may still require controlled USB installation.
After that APK is installed, a new release follows this path:

```text
protected tag
  -> signed CI build
  -> immutable storage upload
  -> Railway update-feed promotion
  -> TV downloads and verifies in background
  -> Android installer confirmation
  -> app updates in place
```

The same package and signing key preserve the installed application identity,
pairing credential, and room assignment. A release must never use a new package
name or replacement certificate.

## Recovery path

The local custody wrapper remains a recovery path on the designated Windows
release host:

```powershell
.\tools\tv\package-tv-from-custody.ps1 `
  -VersionCode <higher-than-installed> `
  -PreviousVersionCode <installed-production-version> `
  -VersionName <release-version>
```

The DPAPI password can only be opened by the Windows account that created it.
If that local account cannot unlock custody, use the protected CI secret or
restore custody through the approved key-recovery process. Do not generate a
new signing key.

The workflow relies on tag filters and encrypted Actions secrets documented by
[GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
and [GitHub's secrets reference](https://docs.github.com/en/actions/reference/security/secrets).
Railway's project token and `railway variable set` are used only from the
protected promotion environment; see the [Railway CLI variable
documentation](https://docs.railway.com/cli/variable).

## Non-negotiable release gates

- No debug APK is an operational artifact.
- No release uses a laptop IP, `localhost`, `10.0.2.2`, or HTTP.
- The version code increases monotonically.
- The package remains `com.roomservice.tv`.
- The certificate remains the retained production certificate.
- The public APK path is versioned, immutable, HTTPS, and has no query string.
- The API feed is promoted only from the manifest produced by the signed build.
- A failed build or failed verification blocks publication; it never falls back
  to an unsigned APK or a different key.
