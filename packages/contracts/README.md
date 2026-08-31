# API contracts

`openapi.yaml` is the canonical REST/OpenAPI 3.0.3 contract for the MVP. It
can be imported into Swagger UI, Swagger Editor, or the NestJS OpenAPI
tooling when the API implementation is added.

The Socket.IO event surface is documented separately in
`realtime-events.md`, because OpenAPI does not describe Socket.IO event
semantics completely.

This package intentionally contains contract artifacts only. It does not yet
contain generated TypeScript types, DTOs, controllers, or runtime code.
