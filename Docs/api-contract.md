# API Contract — MVP

The canonical REST contract is [`packages/contracts/openapi.yaml`](../packages/contracts/openapi.yaml).
It is an OpenAPI 3.0.3 document and can be opened directly in Swagger UI or
Swagger Editor.

## Contract coverage

| Scope in Docs | Contract surface |
|---|---|
| Guest QR/mobile and Smart TV context | `/guest/context`, `/tv/context` |
| Departments and active menus | `/guest/departments`, `/guest/menus` |
| Guest request/order and status | `/guest/requests` |
| Department dashboards | `/department/requests` |
| Confirm and Done workflow | `/department/requests/{requestId}/confirm`, `/department/requests/{requestId}/done` |
| Room Manager monitoring | `/room-manager/requests` |
| Receptionist guest assignment and QR access | `/receptionist/rooms`, `/receptionist/guest-assignments`, `/receptionist/rooms/{roomId}/guest-access-token` |
| Smart TV provisioning | `/tv/provisioning/start`, `/tv/provisioning/claim`, `/receptionist/tv-devices/pair`, `/receptionist/tv-devices/{deviceId}/revoke` |
| Menu/service management | `/management/menu-items` |
| Staff session authentication | `/auth/staff/login`, `/auth/staff/logout`, `/auth/me` |
| Superadmin staff management | `/management/users`, `/management/roles` |
| Socket.IO updates | [`packages/contracts/realtime-events.md`](../packages/contracts/realtime-events.md) |

## Contract decisions

- API base path is `/api/v1`.
- QR identity is an opaque `X-Guest-Access-Token`; the client never submits a
  room number to create a request.
- Smart TV identity is an `X-Device-Credential` mapped to a room.
- Smart TV provisioning is one-time: the TV starts a short-lived pairing code,
  a receptionist with `receptionist:tv:pair` maps it to a room, and the TV
  claims the resulting device credential. Pairing codes expire, are rate
  limited, and cannot contain a room number supplied by the TV.
- Smart TV realtime uses the `/realtime` namespace and the same
  `X-Device-Credential`; `guest.assignment.updated` is a refresh hint, not the
  authoritative state.
- Staff authentication uses the session cookie `room_service_session`; the
  server is responsible for Secure, HttpOnly, and SameSite attributes.
- Staff authentication uses a unique email address as the login identifier.
- `SUPERADMIN` is the administrative role for staff-user management and role
  CRUD. It does not automatically receive department workflow permissions.
- Superadmin management returns active and inactive staff users without password
  material. User deactivation is reversible, while system roles are protected;
  custom roles can only be deleted when no user is assigned to them.
- The product UI supports three languages: O‘zbekcha as the primary language,
  Русский, and English.
- Every menu/service name is required in Uzbek, Russian, and English.
  Descriptions are optional, but when present they are required in all three
  languages.
- Menu prices are nullable. A non-null price requires a three-letter currency;
  this prerequisite does not include payment, billing, or a request total.
- Guest QR tokens are opaque random values stored only as SHA-256 hashes. Each
  room has at most one active token, tokens do not expire daily, and staff can
  revoke/rotate them. Context is available only while the room has an active
  guest assignment.
- Guest requests are scoped internally to the current `guestAssignmentId`.
  After checkout, the previous assignment and its requests are not visible to
  the next guest using the same physical QR code.
- Guest status is REST-authoritative. Guest clients refresh on open, return, or
  focus; there is no Guest-specific Socket.IO channel. The `/realtime`
  namespace remains for native TV device credentials and assignment refresh
  hints.
- The initial catalog contains 64 Cafe items, 18 Restaurant items, 11 SPA
  services, 11 Housekeeping services, and 11 Beauty & Salon services. Lounge
  is returned as disabled with `MENU_NOT_CONFIGURED` until its menu is supplied.
- Request unit is derived from the selected menu item. A guest cannot choose a
  dashboard destination, and a request cannot mix items from different units.
- The only request transitions are `NEW → IN_PROCESS → COMPLETED`.
- Room Manager endpoints are read-only and expose only SPA, Restaurant,
  Lounge, and Housekeeping.
- Receptionist assignment exposes only `VACANT/OCCUPIED` room state and
  `ACTIVE/CHECKED_OUT` assignment state; PMS integration is excluded.
- Receptionist assignment requires the planned guest stay as a whole number of
  days from 1 to 365. Editing an active assignment may update this duration;
  checkout history retains the recorded value.
- Timestamps use RFC 3339 `date-time` values. The UI may display local date,
  hour, and minute.
- `clientRequestId` is the idempotency key required to prevent duplicate
  submissions after double taps or network retries.

## Intentionally unresolved

The source Docs identify these items as needing confirmation, so the contract
keeps them optional or permission-based rather than inventing a business rule:

- `menu:manage` is assigned to Cafe, Restaurant, Lounge, SPA, and Beauty &
  Salon. Each role is scoped to its own unit: `CAFE`, `RESTAURANT`, `LOUNGE`,
  `SPA`, or `BEAUTY_AND_SALON`. Housekeeping uses a controlled service list in
  the MVP and does not receive CMS permission.
- Menu/service CMS entries are flat; the category headings in `Docs/menu.md`
  are import-only source organization and are not part of the API model.
- Final Lounge menu and final hotel display name. Lounge remains disabled until
  its menu is supplied.
- Retention period for request history.
- Exact TV hardware model, Android TV OS/API level, ABI, resolution, and ADB
  support remain a release gate for the physical pilot device.

The staff authentication/RBAC, TV provisioning, Guest API, QR access, menu
localization, and Guest request isolation foundations are implemented in
`apps/api`. Guest QR, menu, and request repositories have memory and PostgreSQL
adapters; PostgreSQL smoke tests run when `DATABASE_URL` is provided. The
physical TV acceptance gate and remaining deployment decisions are still
outside this prerequisite.
