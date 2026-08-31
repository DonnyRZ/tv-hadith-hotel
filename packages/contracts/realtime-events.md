# Realtime event contract

Transport: Socket.IO 4.x  
Namespace: `/realtime`

The REST contract is in [`openapi.yaml`](./openapi.yaml). This prerequisite
does not add a Guest-specific realtime channel. Guest request status is read
from REST and refreshed when the Guest app opens, returns to the screen, or
regains focus. REST remains authoritative after reconnects or missed events.

## Authentication and delivery scope

- Native Smart TV clients authenticate with the mapped device credential.
- Native Smart TV clients send the mapped credential as
  `X-Device-Credential` during the Socket.IO handshake, matching the REST
  authentication header.
- `guest.assignment.updated` is delivered only to the Smart TV mapped to the
  affected room.
- Staff and Guest request queues/status are not defined as realtime events in
  this prerequisite.

## Events

| Event                      | Producer                          | Intended consumers | Payload                       |
| -------------------------- | --------------------------------- | ------------------ | ----------------------------- |
| `guest.assignment.updated` | Receptionist assign/edit/checkout | Affected Smart TV  | `GuestAssignmentUpdatedEvent` |

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
