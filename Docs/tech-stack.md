# Tech Stack — Hotel Guest Service Platform

**Version:** 2.0  
**Scope:** MVP  
**Architecture:** Modular Monolith  
**Constraint:** Seluruh software inti/runtime harus gratis/open-source dan tidak
bergantung pada layanan berbayar untuk menjalankan aplikasi. Deployment Google
TV MVP memakai ADB/Wireless Debugging tanpa biaya platform; Full Distribution
US$25 hanya opsi perubahan kebijakan di masa depan.

---

# 1. Architecture

- **Modular Monolith**
- **TypeScript** sebagai bahasa utama
- **pnpm Workspace** untuk monorepo

Struktur high-level:

```text
hotel-guest-platform/
├── apps/
│   ├── api/
│   ├── guest-web/
│   ├── staff-web/
│   └── tv-shell/
├── packages/
│   ├── api-client/
│   ├── contracts/
│   ├── domain/
│   ├── translations/
│   └── shared-utils/
└── infrastructure/
    ├── docker/
    └── deployment/
```

---

# 2. Guest Mobile Application

Guest mengakses aplikasi melalui QR Code di kamar.

### Stack

- React
- TypeScript
- Vite
- PWA
- TanStack Query

### Flow

```text
Scan QR Code
    ↓
Mobile Browser
    ↓
Guest Web App
    ↓
Room automatically identified
    ↓
Guest selects service/order
```

### Requirement

- Tidak ada native Android/iOS app.
- Tidak perlu install dari Play Store/App Store.
- Fully responsive.
- Touch-friendly.
- QR membawa secure room token.
- Guest tidak perlu login username/password.

---

# 3. Staff & Room Manager Dashboard

### Stack

- React
- TypeScript
- Vite
- TanStack Query

Satu web application digunakan untuk seluruh role:

```text
Staff Web App
├── Room Manager
├── SPA
├── Restaurant — Saji Nusantara
├── Lounge
├── Housekeeping
├── Beauty & Salon
└── Cafe
```

Hak akses dibatasi oleh RBAC.

---

# 4. Google TV Application

Google TV menggunakan Android TV OS.

### Stack

- Kotlin
- Gradle
- Java 17
- Jetpack Compose for TV
- `androidx.tv.foundation`
- `androidx.tv.material`
- ViewModel + StateFlow
- Retrofit + OkHttp untuk REST
- Socket.IO client untuk realtime
- DataStore + Android Keystore untuk credential device

### Architecture

```text
Google TV
    ↓
Native Android TV APK
    ↓
Kotlin + Jetpack Compose for TV
    ↓
ViewModel + Repository
    ↓
REST API + Socket.IO (/realtime)
    ↓
NestJS Backend
```

### TV UI Requirements

- D-pad navigation.
- Remote control support.
- Large readable UI.
- Focus state yang jelas.
- Tidak bergantung pada touchscreen.
- TV-specific layout, bukan mobile layout.
- Landscape layout dengan safe margin untuk overscan.
- Semua action dapat dicapai dengan D-pad: Up, Down, Left, Right, Select, dan Back.
- Tidak ada login staff di TV.

### Distribution

Aplikasi didistribusikan sebagai satu universal signed APK untuk seluruh 114
TV/kamar melalui controlled ADB/Wireless Debugging. Untuk internal hotel MVP,
Google Play Store, private/enterprise app store, dan Android Developer Console
Full Distribution tidak digunakan. Karena itu tidak ada biaya platform Google
yang wajib untuk deployment ini.

`tools/tv/package-tv.ps1` membangun release hanya dengan keystore lokal yang
diabaikan source control, mewajibkan API HTTPS, memverifikasi signature dengan
`apksigner`, dan menghasilkan checksum SHA-256. Play Protect tetap
dipertahankan. Detail keputusan dan runbook ADB-only ada di
[`Docs/google-tv-distribution.md`](google-tv-distribution.md).

```text
Build signed APK
    ↓
Developer Mode
    ↓
ADB / Wireless Debugging
    ↓
Install APK ke Google TV / Android TV
```

Provisioning dilakukan sekali per TV: TV menampilkan pairing code, receptionist
memilih room dan memasukkan code di dashboard, backend menerbitkan credential,
lalu TV menyimpannya dengan Android Keystore. Setelah itu setiap startup memuat
`/tv/context` menggunakan `X-Device-Credential`. Event
`guest.assignment.updated` hanya memicu refresh REST; REST tetap authoritative.

Google Play Store tidak diperlukan untuk runtime atau deployment MVP. Full
Distribution dapat dipertimbangkan kembali di masa depan tanpa membangun APK
per-room; package ID dan signing key tetap stabil untuk seluruh fleet.

Build TV menargetkan `targetSdk >= 34` dan membawa ABI 32-bit/64-bit yang
dibutuhkan oleh APK universal. Sebelum release, APK harus diperiksa dengan
`zipalign -P 16` dan dependency native perlu diverifikasi pada environment
Android 15/16 KB page-size yang relevan; hasil emulator TV biasa tidak cukup
untuk menyatakan gate tersebut lulus.

---

# 5. Backend

### Stack

- NestJS
- TypeScript
- REST API
- OpenAPI / Swagger
- Socket.IO

### Backend Modules

```text
Backend
├── Authentication
├── Users & RBAC
├── Rooms
├── Devices
├── QR Access
├── Departments
├── Menus
├── Guest Requests
├── Request Workflow
├── Realtime
├── Media
└── Audit / History
```

---

# 6. API

### REST

Digunakan untuk:

- Create request/order.
- Confirm request.
- Complete request.
- Get menu.
- Get department.
- Get request history.
- Authentication.

Contoh:

```text
POST /requests
POST /requests/:id/confirm
POST /requests/:id/complete

GET /requests
GET /menus
GET /departments
```

### Realtime

- Socket.IO (`/realtime`) untuk native TV assignment refresh hint.

Event contoh:

```text
guest.assignment.updated
```

---

# 7. Request Workflow

Backend harus mengontrol perubahan status.

```text
NEW
 ↓ CONFIRM
IN_PROCESS
 ↓ DONE
COMPLETED
```

Invalid transition harus ditolak.

Contoh:

```text
NEW → COMPLETED        ❌
COMPLETED → IN_PROCESS ❌
IN_PROCESS → NEW       ❌
```

---

# 8. Database

### Stack

- PostgreSQL
- `pg`-based PostgreSQL repository adapters
- In-memory repository adapters for local development and tests
- No Prisma schema or migration baseline is introduced in this stage

### Core Entities

```text
rooms
devices
guest_room_qr_tokens
guest_room_assignments

users
roles
permissions

departments
department_units

menu_items (localized name/description)

service_requests (guest assignment + item snapshots)
request_status_history

media
```

---

# 9. Persistence adapters

Domain repositories expose the same behavior through memory and PostgreSQL
adapters. The PostgreSQL implementation uses the existing `pg` repository
pattern and idempotent initialization; this prerequisite does not introduce a
Prisma schema or attempt a migration-baseline conversion. QR token hashes,
room assignments, localized menu fields, and service requests are persisted by
their respective repositories. Multi-step operational mutations must use a
database transaction when they are added to a production workflow.

---

# 10. Realtime

- Socket.IO (`/realtime`) is retained for native TV assignment refresh hints.
- Guest context, catalog, and request status use REST and refresh on app open,
  return, or focus.

Flow:

```text
Receptionist assigns/edits/checks out a guest
        ↓
Native TV receives guest.assignment.updated
        ↓
TV refreshes /tv/context
```

The event is not authoritative; REST remains the source of truth. Guest
request status does not require a Guest-specific Socket.IO channel in this
prerequisite.

---

# 11. Authentication & Security

### Staff Authentication

- Server-side session.
- Secure HttpOnly Cookie.

Cookie:

```text
HttpOnly
Secure
SameSite
```

### Password

- Argon2id

### RBAC

Roles:

```text
Room Manager
SPA
Restaurant
Lounge
Housekeeping
Beauty & Salon
Cafe
```

Implementation:

- NestJS Guards.
- Permission-based access.

---

# 12. Guest QR Identity

Jangan gunakan nomor kamar langsung di URL.

Tidak disarankan:

```text
/app?room=302
```

Gunakan opaque token pada URL Guest:

```text
https://guest.example/?access_token=AbC92xK...
```

Backend mapping:

```text
Opaque Token
    ↓
Backend
    ↓
Room 302
```

---

# 13. Google TV Device Identity

Setiap TV harus memiliki device identity.

```text
Google TV
    ↓
Device ID + Device Credential
    ↓
Backend
    ↓
Mapped Room
```

Contoh:

```text
device_a83ks9
→ Room 302
```

---

# 14. Duplicate Request Protection

Gunakan:

```text
client_request_id = UUID
```

Tujuan:

- Mencegah duplicate order karena double tap.
- Mencegah duplicate request karena network retry.

Database harus memberi unique constraint.

---

# 15. Media Storage

### Stack

- MinIO
- Self-hosted
- S3-compatible

Digunakan untuk:

- Food images.
- SPA images.
- Salon images.
- Cafe images.
- Menu assets.

PostgreSQL hanya menyimpan metadata atau object reference.

---

# 16. Reverse Proxy

- Nginx

Digunakan untuk:

- HTTPS termination.
- Reverse proxy.
- Frontend/backend routing.
- WebSocket proxying.

---

# 17. Containerization

- Docker Engine
- Docker Compose

Tidak bergantung pada Docker Desktop.

Recommended services:

```text
Docker Compose
├── Nginx
├── NestJS API
├── PostgreSQL
├── MinIO
├── Prometheus
├── Grafana
└── Loki
```

---

# 18. Monitoring

### Stack

- Prometheus
- Grafana
- Loki

Digunakan untuk:

- Metrics.
- Server monitoring.
- Application monitoring.
- Log collection.
- Troubleshooting.

---

# 19. Testing

### Unit / Integration

- Vitest

### End-to-End

- Playwright

### Google TV

- Real device testing wajib sebelum production rollout.
- Android TV Emulator digunakan untuk smoke test dan D-pad test.
- Satu TV pilot fisik harus diidentifikasi melalui model, Android TV OS/API, ABI,
  resolusi, dan dukungan ADB sebelum kompatibilitas dinyatakan selesai.
- Target minimal: certified Google TV/Android TV. Play Store presence dicatat
  sebagai compatibility signal, tetapi bukan distribution dependency.

Flow penting yang harus diuji:

```text
Guest
→ Submit Restaurant Order
→ Restaurant Dashboard
→ Confirm
→ Guest In Process
→ Room Manager Updated
→ Done
→ Guest Completed
→ Room Manager Updated
```

TV-specific tests juga mencakup Gradle build, lint, ViewModel/repository,
Compose focus/D-pad, API provisioning/context, Socket.IO reconnect, emulator,
dan acceptance test pada TV pilot.

---

# 20. CI/CD

### Stack

- Git
- GitHub Free
- GitHub Actions
- Self-hosted runner

Pipeline:

```text
Push / Pull Request
        ↓
Lint
        ↓
Test
        ↓
Build
        ↓
E2E Test
        ↓
Docker Image
        ↓
Deploy
```

---

# 21. Deployment

Recommended environments:

```text
Development
Staging
Production
```

High-level production architecture:

```text
Guest Mobile
Google TV
Staff PC
Room Manager PC
      │
      ▼
HTTPS / WSS
      │
      ▼
Nginx
      │
      ▼
NestJS API
      │
      ├── PostgreSQL
      └── MinIO
```

---

# 22. Final Tech Stack Summary

| Layer | Technology |
|---|---|
| Architecture | Modular Monolith |
| Main Language | TypeScript |
| Monorepo | pnpm Workspace |
| Guest Mobile | React + Vite + PWA |
| Staff Dashboard | React + Vite |
| Room Manager Dashboard | React + Vite |
| TV Platform | Google TV / Android TV APK |
| TV Native App | Kotlin + Gradle + Java 17 |
| TV Rendering | Jetpack Compose for TV |
| TV State | ViewModel + StateFlow |
| TV REST | Retrofit + OkHttp |
| TV Realtime | Socket.IO client (`/realtime`) |
| TV Credential Storage | DataStore + Android Keystore |
| Frontend Data Fetching | TanStack Query |
| Backend | NestJS |
| API | REST |
| API Documentation | OpenAPI / Swagger |
| Realtime | Socket.IO |
| Database | PostgreSQL |
| Persistence | `pg` repository adapters + in-memory test adapters |
| Media Storage | MinIO self-hosted |
| Authentication | Server Session + HttpOnly Cookie |
| Password Hashing | Argon2id |
| RBAC | NestJS Guards + Permissions |
| Reverse Proxy | Nginx |
| Containers | Docker Engine |
| Container Orchestration | Docker Compose |
| Unit Testing | Vitest |
| E2E Testing | Playwright |
| Monitoring | Prometheus + Grafana + Loki |
| CI/CD | GitHub Actions + self-hosted runner |
| Source Control | Git + GitHub Free |

---

# 23. Explicitly Not Used for MVP

- Native Android guest mobile app.
- Native iOS guest mobile app.
- React/WebView TV runtime and the retired `apps/tv-web` package.
- Microservices.
- Kubernetes.
- Redis.
- Kafka.
- RabbitMQ.
- Paid SaaS dependencies.
- Paid managed database.
- Paid object storage.
- Paid monitoring platform.
- Docker Desktop dependency.
- Google Play Store as a runtime dependency.
- Google Play Store distribution for the MVP.
- Private/enterprise app store distribution for the MVP.
- Android Developer Console Full Distribution for the MVP.
- Per-TV APK, per-room build, or per-device software license.

---

# 24. Cost Principle

Seluruh software inti dan runtime harus:

> **Gratis/open-source dan dapat dijalankan secara self-hosted tanpa mandatory paid runtime software license atau paid SaaS dependency.**

Untuk deployment internal hotel saat ini, project tidak menganggarkan biaya
registrasi distribusi Google. ADB/Wireless Debugging menjadi jalur tanpa biaya
platform untuk install, update, dan recovery. Full Distribution US$25 hanya
opsi perubahan kebijakan di masa depan, bukan requirement MVP.

Existing company-owned server/infrastructure dapat digunakan untuk hosting.

---

# 25. Final Frontend Structure

```text
Guest Mobile
→ React + Vite + PWA
→ Dibuka melalui QR Code

Staff / Room Manager
→ React + Vite Web App

Google TV
→ Android TV APK
→ Kotlin Shell
→ Jetpack Compose for TV
→ ViewModel + Repository
→ REST API + Socket.IO
```

Tidak ada native mobile application untuk guest.
