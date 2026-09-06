# TV Pairing Troubleshooting

This document is mandatory for IT/support. Diagnose using the response status,
stable error code, request ID, and environment identity. Pairing codes and TV
credentials are secrets and must not be logged or copied into tickets.

## Decision table

| HTTP | Code | Meaning | Safe action |
|---:|---|---|---|
| 401 | `UNAUTHORIZED` | Staff session is absent or expired. | Sign in again; do not generate a TV code. |
| 403 | `FORBIDDEN` | The account lacks `receptionist:tv:pair`. | Assign the approved Receptionist permission; do not broaden access. |
| 404 | `PAIRING_CODE_NOT_FOUND` | The code belongs to another API/database, was replaced, or is not active. | Compare health release IDs and API topology first. Generate a new code only after the topology is correct. |
| 404 | `ROOM_NOT_FOUND` | The selected room ID is not in the API's room catalog. | Refresh the room board and check the canonical API/database. |
| 409 | `ROOM_NUMBER_MISMATCH` | Room ID and displayed room number do not match. | Reload Staff Web and pair against the exact room; do not edit the request in DevTools. |
| 409 | `TV_ROOM_ALREADY_PAIRED` | The room already has an active TV. | Inspect the active device; use the approved reset/revoke procedure. |
| 409 | `PAIRING_CODE_ALREADY_USED` | A one-time code was already paired or claimed. | Open a fresh TV pairing session. |
| 410 | `PAIRING_CODE_EXPIRED` | The ten-minute TTL elapsed. | Open a fresh code and enter it promptly. |
| 405 | `STAFF_API_PROXY_MISSING` or HTML | Staff Web is serving static files instead of proxying `/api/v1`. | Stop rollout; set `API_PROXY_TARGET` to the API origin and `REQUIRE_API_PROXY=true`, then redeploy. |
| 502 | `API_PROXY_UNAVAILABLE` | Staff proxy cannot reach the API. | Check API service, DNS, HTTPS, and Railway health; do not switch to a laptop API. |
| 0 | `STAFF_API_UNREACHABLE` | Browser could not reach Staff Web/API. | Check operator network and service availability. |

Unknown codes are not permission to retry blindly. Preserve the technical
details and inspect the API logs by request ID.

## Required topology checks

Run the deployment preflight from a controlled workstation:

```powershell
pnpm verify:deployment --staff-url https://staff.example.com --api-url https://api.example.com --environment production
```

Then verify:

1. Direct API `/api/v1/health` and Staff Web `/api/v1/health` are JSON.
2. Both report `environment=production` and the same `releaseId`.
3. Both dependencies report `ok`, especially `database=ok`.
4. Staff Web `GET /api/v1/auth/me` returns JSON `401` without a session.
5. Staff Web pairing `POST` returns JSON `401` without a session, never `405`.
6. The TV release and Staff Web point to the same canonical API.

If the code appears on the TV but Staff Web reports not found, the most likely
cause is split-brain routing: the TV started against a laptop/debug API or a
different production instance/database. Health/release identity proves this;
changing DHCP/static IP does not fix it.

## API restart and persistence

Restarting a correctly configured production API must not invalidate a pending
code. If all pending codes disappear after restart, inspect `AUTH_STORE`,
`SESSION_STORE`, `DATABASE_URL`, and the TV repository logs/configuration. The
production process should have failed startup if memory storage was explicitly
configured; fix the deployment instead of re-pairing all rooms.

## Logging and support evidence

API errors include `X-Request-Id` in both the response header and JSON body.
Search logs by that ID. Logs may contain status, error code, method, path,
environment, and release ID only. They must not contain pairing codes,
credentials, password values, session cookies, or request bodies.
