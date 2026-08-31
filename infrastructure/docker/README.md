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
