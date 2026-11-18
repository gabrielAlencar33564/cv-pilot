# syntax=docker/dockerfile:1
# Imagem do frontend (Next.js standalone).

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat \
 && npm install -g pnpm@12.11.2 --no-audit --no-fund
WORKDIR /repo

# 1) prune: subconjunto do monorepo usado pelo web (ver comentário em node-service.Dockerfile)
FROM base AS pruner
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --store-dir=/pnpm/store dlx turbo@2.11.11 prune @cv-pilot/web --docker

# 2) deps: só manifests + lockfile antes do install (camada reaproveitada)
FROM base AS deps
COPY .npmrc ./
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 3) build
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=pruner /repo/out/full/ ./
RUN --mount=type=cache,target=/repo/apps/web/.next/cache \
    pnpm --filter @cv-pilot/web build

# 4) runtime enxuto: só o output standalone (sem store, sem devDependencies)
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
