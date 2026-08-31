# Docker configuration

`docker-compose.yml` provisions local PostgreSQL, MinIO, and optional monitoring
services only. Railway uses the three explicit application images in this
directory:

- `api.Dockerfile` builds the NestJS API and starts `dist/main.js`.
- `staff-web.Dockerfile` builds the Staff SPA and serves it with the shared
  `tools/static-server.mjs` process.
- `guest-web.Dockerfile` builds the Guest SPA and serves it with the same static
  server.

All hosted processes bind to Railway's injected `PORT`; the documented local
ports remain available as fallbacks for development. The root `.dockerignore`
excludes credentials, local databases, dependency folders, and build output.

The two SPA images read `VITE_API_BASE_URL` during their Vite build. The SPA
Dockerfiles declare that variable as a build argument so Railway can provide it
to Vite. When the variable changes in a hosted environment, trigger a fresh
source build so the new API origin is embedded in the browser bundle.

The Staff Web image can optionally proxy `/api/` requests through the static
server by setting the runtime variable `API_PROXY_TARGET` to the API origin.
When enabled, Staff Web should be built with `VITE_API_BASE_URL=/api/v1` so
session cookies remain same-origin with the Staff Web domain.
