# Runtime Environment Contract

This document is mandatory for developers and deployers. It defines the only
supported production topology for the Staff Web, Guest Web, API, and release
TV application.

## Canonical production topology

Production has one HTTPS API origin and one PostgreSQL database shared by every
production client:

```text
Staff Web browser -- same-origin /api/v1 --> Staff Web proxy --API_PROXY_TARGET--> API --+--> PostgreSQL
Guest Web browser -- same-origin /api/v1 --> Guest Web proxy --API_PROXY_TARGET--> API --+--> MinIO
EGI TV release ---------------- HTTPS API base URL -------------------------------> API
```

`API_PROXY_TARGET` is the API origin only, for example
`https://api.example.com`. Do not append `/api/v1`; the static server forwards
the complete request path. Staff and Guest builds use
`VITE_API_BASE_URL=/api/v1`. `REQUIRE_API_PROXY=true` is mandatory for hosted
SPA containers, so a missing proxy stops the server instead of serving a
misleading `405 Method Not Allowed` response.

## Required API variables

The API production process must have all of the following:

```text
NODE_ENV=production
APP_ENVIRONMENT=production
RELEASE_ID=<immutable-api-release-id>
AUTH_STORE=postgres
SESSION_STORE=postgres
DATABASE_URL=<Railway PostgreSQL URL>
SESSION_SECRET=<at-least-32-character-secret>
STAFF_REALTIME_ENABLED=true
REDIS_URL=<Railway Redis URL>
```

The API may also require the configured MinIO variables documented in
`.env.example`. `TV_PAIRING_TTL_SECONDS`, when present, must be an integer from
60 through 3600; the default is 600 seconds. The API refuses to start in
production when either auth or session storage is `memory`, when PostgreSQL is
missing, or when the release/environment identity is missing.
When `STAFF_REALTIME_ENABLED=true` (the production default), `REDIS_URL` is
mandatory. The API refuses to start if Redis cannot be initialized; it never
silently falls back to an in-process adapter in production. Local development
may use the memory adapter when Redis is not running.

The TV self-update feed is disabled by default. When it is enabled, the API
also requires a complete immutable artifact contract: `TV_UPDATE_VERSION_CODE`,
`TV_UPDATE_VERSION_NAME`, `TV_UPDATE_APK_URL` (absolute HTTPS without query
parameters or fragments), `TV_UPDATE_SHA256`, and
`TV_UPDATE_CERTIFICATE_SHA256`. The certificate must remain the existing
production certificate
`50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904`.
Optional `TV_UPDATE_RELEASE_ID`, `TV_UPDATE_MANDATORY`, and
`TV_UPDATE_MIN_SUPPORTED_VERSION_CODE` control rollout metadata. A partial or
non-HTTPS update configuration fails production startup. See
[`tv-self-update-runbook.md`](tv-self-update-runbook.md).

## Required Staff and Guest variables

Build-time:

```text
VITE_API_BASE_URL=/api/v1
```

Runtime:

```text
API_PROXY_TARGET=https://<api-production-host>
REQUIRE_API_PROXY=true
```

The proxy must preserve cookies and the `X-Request-Id` header. Staff Web
production must not embed a laptop address, `localhost`, `127.0.0.1`, or
`10.0.2.2` in the browser bundle.

## Environment identity and preflight

`GET /api/v1/health` is unauthenticated and must return JSON containing
`environment`, `releaseId`, and `dependencies.database`, `mediaStorage`,
`redis`, and `realtime`.
The Staff Web response and the direct API response must have the same
environment and release ID. In production both dependencies must be `ok`.

Before any TV is paired, run:

```powershell
$env:PREFLIGHT_STAFF_EMAIL = 'receptionist@example.com'
$env:PREFLIGHT_STAFF_PASSWORD = '<use-the-existing-receptionist-password>'
pnpm verify:deployment --staff-url https://staff.example.com --api-url https://api.example.com --environment production
Remove-Item Env:PREFLIGHT_STAFF_EMAIL, Env:PREFLIGHT_STAFF_PASSWORD
```

The preflight verifies the direct API, the Staff Web same-origin proxy, an
authenticated `/staff-realtime` namespace handshake, an unauthenticated JSON
`401` session response, and an unauthenticated JSON `401` TV-pair response. A
`405`, HTML response, mismatched release ID, missing authenticated namespace,
or memory database is a deployment failure. The temporary credentials are
used in memory by the local preflight process and are never printed.

When a TV update feed is being rolled out, add
`--require-tv-update`. This verifies the enabled manifest, stable HTTPS APK
URL, production certificate fingerprint, and artifact reachability through the
same Staff Web origin before any TV is asked to update.

## Staff realtime topology

The Staff Web uses one Socket.IO connection per signed-in browser tab at the
same-origin `/socket.io` path and the `/staff-realtime` namespace. The hosted
static server must proxy both `/api/*` and `/socket.io/*` to the API origin,
including WebSocket upgrades. Staff sessions are authenticated from the
existing `room_service_session` cookie; unit channels are assigned by the API
from the staff role and permissions.

Realtime events are refresh hints. REST remains authoritative, and the client
refreshes after connect, reconnect, focus/visibility regain, and online regain.
When the socket is unavailable, visible dashboards fall back to 15-second
polling; while connected they reconcile every 60 seconds. See
[`staff-realtime-runbook.md`](staff-realtime-runbook.md) for the preflight and
support procedure.

## Release identity rules

The pilot uses only the signed release package `com.roomservice.tv`. Its API
base URL is the same production API used by Staff Web and must be absolute
HTTPS. Debug builds are test-only and are never an operational artifact.

The package update must retain the existing signing key and certificate
fingerprint. Never generate a replacement key to solve a build problem; that
would prevent updates to installed production TVs. See
[`tv-release-checklist.md`](tv-release-checklist.md).

## Non-negotiable boundaries

- Pairing codes remain strings, including leading zeroes, and expire after ten
  minutes.
- Pairing data is stored in PostgreSQL in production and survives API restart.
- Pairing codes and TV credentials never appear in logs, screenshots, or
  support tickets.
- No production procedure uses a laptop IP, `10.0.2.2`, or a debug APK.
- Existing unit APIs and business flows remain on the same canonical API; do
  not create a second local or unit-specific API for the pilot.
