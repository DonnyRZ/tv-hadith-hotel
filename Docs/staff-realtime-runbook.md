# Staff Realtime Runbook

This is the required operational reference for the Staff Web live dashboard.
It covers the shared Socket.IO channel and its REST fallback. It does not
change the TV namespace, Guest Web, pairing, or request business flow.

## Before enabling realtime

Confirm all of the following on the API and Staff Web deployment:

1. `NODE_ENV=production`, `APP_ENVIRONMENT=production`, and an immutable
   `RELEASE_ID` are present.
2. `AUTH_STORE=postgres`, `SESSION_STORE=postgres`, and `DATABASE_URL` point to
   the production database.
3. `STAFF_REALTIME_ENABLED=true` and `REDIS_URL` point to the same production
   Redis service for every API instance.
4. Staff Web is built with `VITE_API_BASE_URL=/api/v1`.
5. The Staff Web runtime has `API_PROXY_TARGET` set to the API origin only and
   `REQUIRE_API_PROXY=true`.
6. The proxy forwards `/api/*` and `/socket.io/*`, including WebSocket
   upgrades. It must not point to a laptop, debug API, or another environment.

Run the deployment preflight before pilot use:

```powershell
$env:PREFLIGHT_STAFF_EMAIL = 'receptionist@example.com'
$env:PREFLIGHT_STAFF_PASSWORD = '<use-the-existing-receptionist-password>'
pnpm verify:deployment --staff-url https://staff.example.com --api-url https://api.example.com --environment production
Remove-Item Env:PREFLIGHT_STAFF_EMAIL, Env:PREFLIGHT_STAFF_PASSWORD
```

The preflight uses those credentials only to authenticate the Staff Web
Socket.IO namespace; it never prints them or stores them. Do not put a
password in a deployment manifest or ticket.

`/api/v1/health` must be JSON with matching `environment` and `releaseId` from
the direct API and Staff Web. In production, `database`, `redis`, `realtime`,
and media storage must be `ok`. The preflight also completes an authenticated
`/staff-realtime` namespace handshake and waits for its server-ready signal.

## How the live dashboard behaves

After staff login, one browser tab opens one Socket.IO connection to the
`/staff-realtime` namespace. The server reads the existing
`room_service_session` cookie and assigns channels from the account's role and
permissions. The browser never chooses a unit channel.

Events are only refresh signals. The REST response remains authoritative. On a
live connection, dashboards reconcile every 60 seconds. If the socket is
disconnected, visible dashboards poll every 15 seconds. Polling pauses while
the browser tab is hidden and resumes on focus/visibility or online regain.

The small shell indicator has three operational states:

- `Live`: socket connected and REST reconciliation is active.
- `Reconnecting`: the browser is retrying the socket; cached data remains
  visible.
- `Offline — syncing automatically`: socket and network are unavailable;
  refresh resumes when connectivity returns.

Incoming changes briefly highlight the affected order or room and show a short
update notice. Manual Refresh remains available as a fallback.

## Support diagnosis

1. Open the browser network panel and check that `/api/v1/health` returns JSON,
   not the Staff Web HTML shell.
2. Check the health values and release identity before investigating a code or
   dashboard. A mismatched release or environment means the proxy is pointing
   at the wrong API.
3. Check the Socket.IO handshake through the Staff Web origin. A failed
   handshake must not be “fixed” by opening a laptop port; use the proxy and
   canonical API.
4. Check the Staff session. A `401` means sign in again; a `403` means the
   account lacks the required unit permission.
5. Use the API request ID and stable error code when reporting a failure. Never
   copy session cookies, passwords, request bodies, or pairing credentials into
   a ticket.

Common failures:

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `405` or HTML from `/api/v1/health` | Static server is not proxying | Set the API origin and `REQUIRE_API_PROXY=true`; rerun preflight. |
| `502` from Staff Web | API origin unavailable | Check API health, DNS, HTTPS, and Railway service status. |
| Reconnecting forever in production | Redis or WebSocket proxy unavailable | Check `REDIS_URL`, API readiness, and `/socket.io` upgrade forwarding. |
| Only one API instance receives updates | Redis adapter not shared | Verify every instance uses the same Redis URL and restart after correction. |
| Dashboard shows old data after reconnect | Missed event or failed REST refresh | Check network/API response; the next successful REST refresh is authoritative. |
| A unit sees another unit's updates | Scope regression | Stop rollout and inspect server-side role/channel assignment; do not hide it in UI. |

## Safe rollback

Set `STAFF_REALTIME_ENABLED=false` on the API and the matching Staff Web build
flag, then redeploy. REST dashboards continue to work with the fallback polling
path. Do not change database schema, remove sessions, revoke pairing, or
install a debug APK as a realtime rollback.

## Event contract

The event names and minimal payloads are defined in
[`../packages/contracts/realtime-events.md`](../packages/contracts/realtime-events.md).
The TV `/realtime` namespace is separate and must remain untouched.
