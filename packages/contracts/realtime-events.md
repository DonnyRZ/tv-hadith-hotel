# Realtime event contract

Transport: Socket.IO 4.x.

The TV namespace remains `/realtime`. Staff dashboards use the separate
`/staff-realtime` namespace so TV device credentials and Staff session cookies
can never be mixed.

The REST contract is in [`openapi.yaml`](./openapi.yaml). This prerequisite
does not add a Guest-specific realtime channel. Guest request status is read
from REST and refreshed when the Guest app opens, returns to the screen, or
regains focus. REST remains authoritative after reconnects or missed events.
The typed Staff event contract is in [`src/realtime-events.ts`](./src/realtime-events.ts).

## Authentication and delivery scope

- Native Smart TV clients authenticate with the mapped device credential.
- Native Smart TV clients send the mapped credential as
  `X-Device-Credential` during the Socket.IO handshake, matching the REST
  authentication header.
- `guest.assignment.updated` is delivered only to the Smart TV mapped to the
  affected room.
- Staff clients authenticate with the existing `room_service_session` cookie.
- Staff subscriptions are assigned server-side from roles and permissions;
  clients cannot join an arbitrary unit channel.
- Receptionists with `receptionist:folio:view` additionally receive the
  server-assigned `staff:receptionist:folio` channel for room folio refresh hints.
- Production Staff realtime uses the Redis Socket.IO adapter for multi-instance
  delivery. Local tests may use the memory adapter explicitly.

## Events

| Event                      | Producer                          | Intended consumers | Payload                       |
| -------------------------- | --------------------------------- | ------------------ | ----------------------------- |
| `guest.assignment.updated` | Receptionist assign/edit/checkout | Affected Smart TV  | `GuestAssignmentUpdatedEvent` |

## Staff events

| Event                              | Intended consumers                                             | Meaning                                      |
| ---------------------------------- | -------------------------------------------------------------- | -------------------------------------------- |
| `staff.request.created`            | The request's authorized unit dashboard and Receptionist folio | A new guest request was committed.           |
| `staff.request.updated`            | The request's authorized unit dashboard and Receptionist folio | A request status or terminal state changed.  |
| `staff.room.updated`               | Receptionist                                                   | A room assignment or checkout was committed. |
| `staff.boutique.catalog.updated`   | Butik Indonesia                                                | A category, product, or variant changed.     |
| `staff.boutique.inventory.updated` | Butik Indonesia                                                | Available inventory changed.                 |

Staff request events contain `roomId` and `guestAssignmentId` in addition to
identifiers, unit/status and timestamps. They are refresh hints, not full
records. The REST API remains the source of truth after
initial connection, reconnect, visibility regain, online regain, and fallback
polling.

## Guest assignment payload

```json
{
  "eventId": "75ab4d2b-9307-4e71-b9cf-8a7f4495ab9b",
  "occurredAt": "2026-08-29T13:00:00Z",
  "room": { "id": "c3a4b6d6-5a58-4dd8-a4c5-2d4606c8a1e4", "number": "302" },
  "roomStatus": "OCCUPIED",
  "assignmentStatus": "ACTIVE",
  "guestName": "Ahmad Fauzan",
  "stayDays": 3,
  "welcome": {
    "message": "Welcome, Ahmad Fauzan",
    "guestName": "Ahmad Fauzan",
    "personalized": true
  }
}
```

For checkout, `assignmentStatus` is `CHECKED_OUT`, `roomStatus` is `VACANT`,
`guestName` and `stayDays` are `null`, and `welcome.personalized` is `false`.

## State authority

The server remains authoritative. The TV treats `guest.assignment.updated` as
a hint to refresh `/tv/context`; the event itself is not the source of truth.
Valid request transitions are:

```text
NEW → IN_PROCESS → COMPLETED
```

Clients must not synthesize transitions or accept reverse transitions.

Example request event shape (the assignment identifier may be `null` for
legacy/unassigned requests):

```json
{
  "eventId": "event-123",
  "eventType": "staff.request.created",
  "occurredAt": "2026-09-02T10:00:00Z",
  "entityId": "request-123",
  "updatedAt": "2026-09-02T10:00:00Z",
  "unit": "CAFE",
  "status": "NEW",
  "roomId": "room-230",
  "guestAssignmentId": "assignment-123"
}
```
