# Guest web application

The mobile-first guest PWA opened from a room QR code. It keeps the experience
simple and visual: a hotel welcome, service selection, menu browsing, request
submission, request status, hotel information, and two curated destinations.

## Local development

From the repository root:

```text
pnpm --filter @room-service/guest-web dev
```

The app is served on `http://localhost:5173`. It proxies `/api` to the API on
`http://localhost:3000` and uses the token supplied in the URL:

```text
http://localhost:5173/?access_token=<guest-qr-token>
```

`VITE_GUEST_ACCESS_TOKEN` can be used for a local-only development token when
testing without a QR URL. The token stays in memory and is never stored in
`localStorage`.

## Guest flow

- The active guest name and room are resolved from the QR-backed Guest Context.
- Services are grouped into Housekeeping, F&B, 7oz Espresso Cafe, SPA, and
  Beauty Salon. F&B contains Saji Nusantara and Lounge.
- Lounge remains visible when it is not configured, but cannot be opened or
  ordered from.
- Menus are loaded from the Guest API, localized in Uzbek, Russian, or English,
  and paginated at ten items per page.
- A request contains only selected service items and notes. There is no payment
  or fabricated total.
- The request list refreshes when the page is opened or regains focus.
- About Hotel uses the supplied Hadith Hotel assets. Destinations contain only
  the Imam Al-Bukhari and Registan Square videos currently provided by the
  project.

## PWA notes

The manifest and lightweight service worker are kept in `public/`. Static shell
assets may be cached, while Guest API responses and destination videos are
always requested from the network. The app remains online-first; offline state
is communicated in the UI rather than showing stale request data.
