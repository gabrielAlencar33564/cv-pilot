# syntax=docker/dockerfile:1
# Imagem dos serviços Node (api e workers). Uso:
#   docker build -f infra/docker/node-service.Dockerfile \
#     --build-arg APP=@cv-pilot/api --build-arg APP_DIR=apps/api --build-arg ENTRY=src/server.ts .

ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache openssl libc6-compat \
 && npm install -g pnpm@12.11.2 --no-audit --no-fund
WORKDIR /repo

# 1) prune: separa só os package.json/lockfile que o app precisa (out/json)
#    e o código-fonte (out/full). Esta etapa copia o contexto inteiro, mas o
#    resultado do install abaixo depende APENAS de out/json + lockfile,
#    então mudar código não invalida a camada de dependências.
FROM base AS pruner
ARG APP
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --store-dir=/pnpm/store dlx turbo@2.11.11 prune ${APP} --docker

# 2) deps: instala só dependências de produção; store do pnpm fica no cache mount
FROM base AS deps
COPY .npmrc ./
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --store-dir=/pnpm/store

# 3) runtime: código-fonte + client do Prisma gerado
FROM deps AS runtime
ARG APP_DIR
ARG ENTRY
ENV NODE_ENV=production \
    APP_DIR=${APP_DIR} \
    ENTRY=${ENTRY}
COPY --from=pruner /repo/out/full/ ./
RUN pnpm --filter @cv-pilot/db generate
USER node
WORKDIR /repo/${APP_DIR}
CMD ["sh", "-c", "exec node --import tsx $ENTRY"]
