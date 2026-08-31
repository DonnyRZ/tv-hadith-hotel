FROM node:24-bookworm-slim AS build

ENV COREPACK_HOME=/tmp/corepack
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

WORKDIR /workspace

RUN --mount=type=cache,id=s/hadith-hotel-corepack,target=/tmp/corepack \
    corepack enable \
    && corepack prepare pnpm@11.19.0 --activate

COPY . .

RUN --mount=type=cache,id=s/hadith-hotel-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @room-service/api... \
    && pnpm --filter @room-service/api build \
    && pnpm --filter @room-service/api deploy --legacy --prod --strict-peer-dependencies=false /runtime \
    && cp -R apps/api/dist /runtime/dist

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /runtime/ ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
