# TV Pairing Runbook

This document is mandatory for Receptionists and TV operators. It is for the
signed production application only.

## Before starting

The release owner must confirm all of these items:

- Staff Web `/api/v1/health` displays JSON, not the Staff SPA HTML.
- Health reports `environment=production`, a non-empty `releaseId`, and
  PostgreSQL and media storage as `ok`.
- An unauthenticated `POST /api/v1/receptionist/tv-devices/pair` returns JSON
  `401`, not `405`.
- The TV has exactly one operational app: `com.roomservice.tv`.
- The installed app is a signed release whose API URL is the production HTTPS
  API. Do not use `com.roomservice.tv.debug`.
- The release certificate matches the retained fingerprint in the release
  checklist.

If any item fails, stop and contact IT. Do not keep generating new codes.

## Pair a TV

1. Open the signed `EGI TV` release on the TV and wait for the pairing screen.
2. In Staff Web, sign in with the Receptionist account and open the exact room.
3. Confirm the room number shown in Staff Web before entering anything.
4. Enter the six-digit code exactly as shown on the TV. Keep leading zeroes.
5. Select **Pair TV** once. Wait for the TV to claim the pairing.
6. Confirm the Staff Web status becomes **Active** and the TV loads the room
   context/welcome screen.
7. Record the release ID and outcome in the controlled deployment record; do
   not record the pairing code or TV credential.

The code is valid for ten minutes. Pairing is a one-time operation. A code
created by one API instance works from another instance only when both use the
same production PostgreSQL database; this is why the preflight and health
checks are required.

## Reset or replace a TV

Use **Pair again** only when the active TV is intentionally being replaced or
repaired. Revoke the old credential when the procedure requires it. Never
uninstall the production package as a first response. If a debug package is
present from development, IT may remove only `com.roomservice.tv.debug`; the
production package must remain installed so it can be updated in place.

After reset, wait for the new code and repeat the normal room confirmation.
The new code is not interchangeable with a previous code.

## If pairing fails

Open the error's **Technical details** panel and give IT only the HTTP status,
error code, request ID, environment, release ID, and endpoint. Do not send a
photo containing the six-digit pairing code or a TV credential. Use
[`tv-pairing-troubleshooting.md`](tv-pairing-troubleshooting.md) to select the
next safe action.

Do not immediately close/reopen the TV dialog or create another code unless the
error is explicitly `PAIRING_CODE_EXPIRED` or IT instructs you to reset the
device. Creating another code can hide an API mismatch and does not repair a
broken proxy or database topology.

## Completion checklist

- The room number is correct.
- Staff Web shows the expected production release ID.
- TV status is Active/Claimed.
- TV displays the correct room context.
- No debug package remains on the pilot TV.
- Wireless Debugging is disabled after installation/recovery when the TV
  permits it.
