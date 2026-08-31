# API application

This directory contains the NestJS modular-monolith application boundary.

The REST contract is maintained at
[`packages/contracts/openapi.yaml`](../../packages/contracts/openapi.yaml).
The authentication module now implements the staff session lifecycle from that
contract: Argon2id password verification, an HttpOnly `room_service_session`
cookie, current-user lookup, logout invalidation, and reusable role/permission
guards.

Development and tests use an in-memory user repository. Production can select
`AUTH_STORE=postgres` and `SESSION_STORE=postgres`; the PostgreSQL adapter
stores staff users and server-side sessions without exposing password hashes to
the API response.

Remaining feature modules are rooms and devices, guest assignments, QR access,
departments, menus, requests, realtime, media, and audit history.
