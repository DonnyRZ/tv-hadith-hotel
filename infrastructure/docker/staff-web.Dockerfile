FROM node:24-bookworm-slim AS build

ENV COREPACK_HOME=/tmp/corepack
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /workspace

RUN corepack enable \
    && corepack prepare pnpm@11.19.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile --filter @room-service/staff-web... \
    && pnpm --filter @room-service/staff-web build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /workspace/apps/staff-web/dist ./dist
COPY --from=build /workspace/tools/static-server.mjs ./static-server.mjs

EXPOSE 5174

CMD ["node", "static-server.mjs", "dist"]
