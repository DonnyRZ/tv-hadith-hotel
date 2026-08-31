# Room Service Hadith

Initial configuration for the Hotel Guest Service Platform MVP.

## Current status

This configuration establishes the workspace, shared TypeScript settings, linting,
formatting, API contract tests, local infrastructure, environment template, and
application boundaries. The API includes staff authentication/RBAC, Smart TV
provisioning, and the Guest prerequisite API (QR context, localized catalog, and
request isolation). Guest screens and remaining staff screens remain incremental
implementation work.

## Workspace

- apps/api: NestJS modular monolith boundary.
- apps/guest-web: responsive guest PWA opened from a room QR code.
- apps/staff-web: one role-aware internal workspace for all staff roles,
  including the Superadmin user and role management surface.
- apps/tv-shell: native Kotlin Android TV application using Jetpack Compose for TV.
- packages/contracts: shared REST OpenAPI and realtime API contracts.
- packages/api-client: shared browser API and Socket.IO client boundary.
- packages/domain: shared domain types and rules boundary.
- packages/translations: shared translations boundary.
- packages/shared-utils: small cross-application utilities.
- packages/ui: shared UI primitives boundary.

Product invariants currently locked:

- Every user-facing application supports Uzbek (`O'zbekcha`) as the primary
  language, plus Russian and English.
- Internal staff authentication uses email, not a staff ID.
- `SUPERADMIN` manages staff users and roles; it does not automatically receive
  department workflow permissions.

## Tooling decisions

- Node.js 24 and pnpm 11.
- TypeScript with strict compiler settings.
- React 19 and Vite 8 for web applications.
- TanStack Query 5 for server-state management.
- Kotlin, Gradle, Java 17, and Jetpack Compose for TV for the native TV client.
- NestJS 12 with REST, OpenAPI, and Socket.IO boundaries.
- PostgreSQL with memory/PostgreSQL repository adapters; no Prisma schema or
  migration baseline is introduced in this stage.
- Vitest for unit and integration test configuration.
- Playwright for browser E2E test configuration.
- Docker Compose for local PostgreSQL, MinIO, and optional monitoring.
- Prometheus, Grafana, and Loki under the monitoring Compose profile.

The package manifests use semver ranges while the generated pnpm lockfile is
the install-time source of truth. The TV production distribution decision is
documented in [`Docs/google-tv-distribution.md`](Docs/google-tv-distribution.md):
one universal signed APK installed through controlled ADB/Wireless Debugging for
114 internal hotel TVs. No Google Play Store, private app store, or Full
Distribution registration is required for the current MVP.

## Local setup

1. Copy .env.example to .env and replace development-only secrets if needed.
2. Run pnpm install.
3. Run pnpm validate to check formatting, linting, the OpenAPI contract,
   TypeScript configuration, API contract scenarios, and the test suite.
4. Run docker compose up -d to start PostgreSQL and MinIO.
5. Run docker compose --profile monitoring up -d to start observability tools.

The default local ports are:

- Guest web dev server: 5173.
- Staff web dev server: 5174.
- API: 3000.
- PostgreSQL: 5432.
- MinIO API and console: 9000 and 9001.
- Grafana: 3001.
- Prometheus: 9090.
- Loki: 3100.

The API can be started with `pnpm --filter @room-service/api dev` after copying
`.env.example` to `.env`. Build the native TV APK from `apps/tv-shell` with
`./gradlew.bat :app:assembleDebug` on Windows or `./gradlew :app:assembleDebug`
on macOS/Linux. The TV installation and hardware gate are documented in
`apps/tv-shell/README.md`.
