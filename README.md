# CV Pilot

Busca de vagas e envio otimizado de currículos, com bots por site e currículo personalizado por site.
Documentação em [docs/](docs/README.md):
- [PRD](docs/PRD.md): requisitos e decisões do produto
- [Visão geral](docs/visao-geral.md): arquitetura atual e cobertura do PRD
- [Melhorias](docs/melhorias.md): problemas encontrados e plano de ação

## Estrutura

```
apps/
  web/        Next.js + Mantine (frontend)
  api/        Fastify (backend REST)
  workers/    BullMQ: scheduler, bots de busca, matching, envio, notificações
  extension/  extensão do navegador para o modo assistido (fase 2)
packages/
  contracts/  schemas Zod compartilhados (web ↔ api ↔ extensão)
  core/       regras de negócio puras (precedência das regras de envio, dedupe, nota)
  db/         Prisma (schema, migrations, seed)
  queue/      nomes de filas, payloads e conexão Redis
  adapters/   um adapter por site de vagas (gupy, greenhouse, lever...)
  ai/         interface do provedor de IA (extração de CV, carta, embeddings)
  config/     tsconfig compartilhado
infra/docker/ Dockerfiles, compose (produção e dev) e Caddy
docs/         PRD, visão geral e análise de melhorias
```

## Desenvolvimento

Requer Node 22+, pnpm 12 e Docker.

```bash
pnpm install
cp .env.example .env
pnpm infra:up              # Postgres (pgvector), Redis e S3 (SeaweedFS) no Docker
pnpm db:migrate            # aplica as migrations
pnpm db:seed               # fontes iniciais + usuário dev
pnpm dev                   # web :3000, api :4000 e workers com hot reload
```

Em desenvolvimento a API aceita o usuário `dev-user` sem login (ver `apps/api/src/plugins/auth.ts`).
O login real (Auth.js) ainda não foi implementado; em produção a API recusa as requisições até lá.

Outros comandos: `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Adicionar um site de vagas

1. Crie `packages/adapters/src/<site>/index.ts` implementando `JobSourceAdapter`.
2. Adicione uma fixture e um teste de contrato.
3. Registre em `packages/adapters/src/registry.ts`.
4. Cadastre a fonte na tabela `Source` (seed ou admin).

## Produção (VM)

```bash
cp .env.example .env       # ajuste DOMAIN, POSTGRES_PASSWORD, S3_SECRET_KEY_PROD...
docker compose -f infra/docker/compose.yaml up -d --build
```

- `migrate` aplica as migrations e o seed e encerra.
- `workers-scheduler` (1 réplica) agenda as buscas; `workers` escala com `WORKERS_REPLICAS`.
- Os Dockerfiles usam multi-stage, `turbo prune` e cache mount do store do pnpm, para não inflar o build cache.
  Confira de vez em quando com `docker system df`.
