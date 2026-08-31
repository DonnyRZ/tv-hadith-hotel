# Staff web application

This is the single desktop-first internal workspace for Room Manager,
Receptionist, Superadmin, SPA, Restaurant, Lounge, Housekeeping, Beauty and
Salon, and Cafe roles.

The current slice implements the multilingual authentication entry point and
the first internal workspaces:

- Uzbek (`O'zbekcha`) is the default language, with Russian and English also
  available.
- Staff sign-in uses an email address and a session cookie from the API.
- Password recovery currently hands the staff member to the hotel system
  administrator because the reset endpoint is not part of the contract yet.
- Superadmin users are routed to `/admin/users`, where they can manage staff
  accounts, reset passwords, activate/deactivate access, and manage custom
  roles. System roles remain visible but protected.
- Cafe users are routed to `/cafe/orders`, a single-page operational queue for
  the scoped 7oz Espresso request flow. The page shows only API-backed NEW,
  IN_PROCESS, and COMPLETED records, supports room filtering, request detail,
  Confirm, Done, history, and periodic refresh.
- Cafe users can open `/cafe/menu` as a separate CMS page for the scoped 7oz
  Espresso menu: items, prices, display order, visibility, and temporary
  availability. The initial menu is seeded from `Docs/menu.md`.
- Receptionist users are routed to `/receptionist/rooms`, a focused room board
  for the 114 guest rooms across physical Floors 1–3. Each floor retains its
  supplied 2xx, 3xx, or 4xx room range and is paginated at ten rooms per page.
  The current frontend-first slice uses clearly temporary local status values;
  guest assignment forms and live room API wiring are intentionally deferred.
- Cafe menu management is limited to the `CAFE` unit by the API; the UI never
  accepts a unit switch for this workspace.
- Restaurant (`Saji Nusantara`), Lounge, SPA, and Beauty & Salon each have a
  separate scoped CMS route. Restaurant and Lounge manage product menus;
  SPA and Beauty & Salon manage service catalogs with optional duration.
- The CMS is a flat list without persisted categories. Lounge intentionally
  starts empty until its operational menu is approved.
- The workspace uses the authenticated session cookie and the API management
  contract; it does not keep passwords or access tokens in browser storage.

## Internal workspace UX invariants

- On desktop, the sidebar is a separate viewport-level pane; only the main
  workspace content scrolls.
- User table action menus open on click as an overlay and must remain visible
  above table overflow boundaries.
- The three-dot trigger opens the action menu only. Edit drawers open only
  after the staff member selects `Edit`.
- Uzbek remains the primary language, with Russian and English available in
  every internal workspace.

Guest request submission and the remaining operational department workspaces
will be added incrementally. Until guest submission is wired, an empty Cafe
queue is the correct state; the dashboard does not create demo orders.
