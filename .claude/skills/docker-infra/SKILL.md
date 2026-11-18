---
name: docker-infra
description: Edita a infraestrutura Docker do CV Pilot (infra/docker). Cobre Dockerfiles multi-stage com turbo prune e cache mount do pnpm, compose de produção e de desenvolvimento, Caddy, .dockerignore, healthchecks, réplicas dos workers e serviços de apoio (Postgres/pgvector, Redis, S3 via SeaweedFS). Use ao criar ou mudar um Dockerfile, compose.yaml, compose.dev.yaml, o Caddyfile ou variáveis de deploy, ao configurar backups, ou ao investigar build lento ou o cache do Docker crescendo.
---

# Infra Docker

## Como está montado

| Arquivo | O que faz |
|---|---|
| [node-service.Dockerfile](../../../infra/docker/node-service.Dockerfile) | API e workers. `pruner` (`turbo prune --docker`) → `deps` (só `out/json` + lockfile, `pnpm install --prod --frozen-lockfile` com cache mount) → `runtime` (código + `prisma generate`, `USER node`) |
| [web.Dockerfile](../../../infra/docker/web.Dockerfile) | Next.js: `pruner` → `deps` → `build` (`output: standalone`, cache de `.next/cache`) → `runtime` enxuto |
| [compose.yaml](../../../infra/docker/compose.yaml) | Produção: caddy, web, api, migrate, workers-scheduler, workers (réplicas), postgres, redis, s3 |
| [compose.dev.yaml](../../../infra/docker/compose.dev.yaml) | Dev: **só** Postgres (:5433), Redis (:6380) e S3 (:8333), presos a `127.0.0.1`. As apps rodam no host com `pnpm dev` |
| [seaweedfs/s3-entrypoint.sh](../../../infra/docker/seaweedfs/s3-entrypoint.sh) | Gera as credenciais do gateway S3 a partir de `S3_ACCESS_KEY`/`S3_SECRET_KEY` e sobe o SeaweedFS |
| [Caddyfile](../../../infra/docker/caddy/Caddyfile) | HTTPS; `/api/*` → api (sem o prefixo), resto → web |

## Regras obrigatórias

O build cache do Docker já chegou a 157 GB porque cada build refazia o install do zero. Estas regras evitam isso:

1. Primeira linha do Dockerfile: `# syntax=docker/dockerfile:1`.
2. **Só os manifests e o lockfile entram antes do `pnpm install`.** `COPY . .` só aparece no estágio `pruner` (cuja saída para o install depende apenas de `out/json`) ou depois do install. Nunca antes do install no mesmo estágio.
3. **Cache mount do store do pnpm**, com o mesmo id e destino em todos os Dockerfiles: `RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install ... --store-dir=/pnpm/store`.
4. **Multi-stage:** a imagem final não leva store do pnpm, devDependencies nem código que não roda.
5. Usuário não root (`USER node`) e healthcheck (no Dockerfile ou no compose).
6. **`.dockerignore`** na raiz cobre pelo menos `node_modules`, `.git`, `dist`, `build`, `.next`, `.turbo`, `coverage`, `.env*`, logs, relatórios de teste, screenshots, `docs` e `.codegraph`. Pasta gerada nova = linha nova.
7. Imagens de terceiros com **versão fixa** (nada de `latest`).
8. Segredos chegam por `env_file`/variável, nunca dentro da imagem. `NEXT_PUBLIC_*` é fixado no build e é público.
9. Postgres, Redis e S3 **não** expõem portas em produção. Em dev, as portas ficam presas a `127.0.0.1`.
10. Serviço novo: `restart: unless-stopped`, healthcheck e `depends_on` com `condition`. Serviços Node reaproveitam a âncora `x-node-service`.
11. Fila nova nos workers = atualizar o `WORKER_QUEUES` do serviço certo.

## Desenvolvimento e verificação

- Dia a dia: `pnpm infra:up` + `pnpm dev`. **Não rode `docker compose up --build` em loop** para testar cada mudança.
- Para validar a sintaxe do compose sem subir nada:
  ```bash
  docker compose -f infra/docker/compose.yaml config --quiet
  ```
- Para testar uma imagem, faça **um** build do serviço alterado: `docker compose -f infra/docker/compose.yaml build api`.
- Depois de uma sessão com vários builds, rode `docker system df`. Se o build cache passar de ~20 GB, avise e sugira `docker builder prune -a -f`, **sem rodar sem confirmação**.
- Nunca rode `down -v`, `volume rm` ou `system prune` sem confirmação: apagam dados.

## Pendências conhecidas (`docs/melhorias.md`)

- Os workers não têm healthcheck.
- Nenhum script cria o bucket `resumes`.
- A identidade S3 das apps tem ação `Admin` no SeaweedFS; deveria ter só leitura e escrita no bucket.
- O serviço `s3` não tem healthcheck.
- Faltam scripts de backup (`pg_dump` + espelho do bucket) em `infra/scripts`.

## Checklist

- [ ] Manifests antes do install; cache mount do pnpm; multi-stage enxuto
- [ ] `USER node`, healthcheck, versões fixas
- [ ] `.dockerignore` cobre as pastas novas
- [ ] `docker compose ... config --quiet` passa
- [ ] `.env.example` e README atualizados se surgiu variável ou serviço
- [ ] `docker system df` conferido se houve vários builds
