---
name: banco-prisma
description: Altera o banco do CV Pilot. Cobre o schema Prisma (packages/db/prisma/schema.prisma), migrations, índices, pgvector, SQL manual (NULLS NOT DISTINCT, HNSW, full-text) e o seed. Use ao criar ou mudar models, campos, relações, índices ou dados iniciais, ao gravar ou consultar embeddings e ao resolver erros de migration ou do Prisma Client.
---

# Banco de dados (Prisma + PostgreSQL 16 + pgvector)

## Fluxo de uma mudança

1. Edite [schema.prisma](../../../packages/db/prisma/schema.prisma).
2. Suba o Postgres de dev: `pnpm infra:up`.
3. Gere e aplique a migration, **sempre com nome**, porque sem ele o comando pede o nome interativamente. Use os scripts da raiz: eles carregam o `.env` (`dotenv-cli`) e repassam os argumentos ao `prisma migrate dev`. Chamar `prisma` direto em `packages/db` não encontra o `DATABASE_URL`.
   ```bash
   pnpm db:migrate --name adiciona_timezone_usuario
   ```
   Quando precisar de SQL que o Prisma não expressa, gere só o arquivo, edite e depois aplique:
   ```bash
   pnpm db:migrate --create-only --name indice_busca_vetorial
   # editar packages/db/prisma/migrations/<timestamp>_indice_busca_vetorial/migration.sql
   pnpm db:migrate
   ```
4. **Leia o `migration.sql` gerado.** `DROP COLUMN`, troca de tipo ou `NOT NULL` em tabela com dados exigem plano. Para `NOT NULL`, faça em dois passos: coluna com default ou backfill, depois a restrição.
5. `pnpm typecheck` (o Client é regenerado pelo `migrate dev`; se não for, rode `pnpm db:generate`).
6. Faça o commit do `schema.prisma` junto da pasta da migration.

Para só aplicar migrations pendentes, sem criar nada: `pnpm db:deploy`. Em produção, o serviço `migrate` do compose roda `prisma migrate deploy` e o seed.

## Regras

- **Nunca edite nem apague uma migration já aplicada.** Corrija com uma nova.
- **Nunca rode `prisma migrate reset` nem `db push`** sem pedir confirmação: o reset apaga os dados, e o `db push` não gera histórico.
- Convenções: model em PascalCase no singular, campos em camelCase, `id String @id @default(cuid())`, `createdAt`/`updatedAt`. O `id` de `Source` é o id do adapter.
- **Dados do usuário caem em cascata a partir de `User`** (`onDelete: Cascade`), o que é necessário para a exclusão de conta pela LGPD. Dados globais (`Job`, `Source`) não pertencem a um usuário.
- Indexe toda FK usada em `where` e as combinações que as consultas usam. Garanta invariantes com `@@unique` (ex.: `Application(userId, jobId)`).
- Os valores de status, modo, tom e tipo devem ser **idênticos** aos enums de `packages/contracts/src/enums.ts`. Mudou de um lado, mude do outro.
- Colunas `Json` não têm tipo: valide com um schema Zod ao ler e ao gravar.
- Seed ([seed.ts](../../../packages/db/src/seed.ts)) só com `upsert` idempotente. Dados de desenvolvimento ficam atrás de `NODE_ENV !== 'production'`.

## pgvector

- A coluna é `Unsupported("vector(N)")`. **N precisa ser a dimensão do modelo de embeddings** (Voyage `voyage-4` = 1024 por padrão; ver skill `integracao-ia`). Hoje está 1536, fixado na migration inicial; a troca exige uma migration nova (item 13 de `docs/melhorias.md`).
- O Prisma Client não lê nem grava esse tipo. Use SQL com **template tagged** (parametrizado), nunca `$queryRawUnsafe` com interpolação:
  ```ts
  const vetor = `[${embedding.join(',')}]`;
  await prisma.$executeRaw`UPDATE "Job" SET embedding = ${vetor}::vector WHERE id = ${jobId}`;

  const proximas = await prisma.$queryRaw<{ id: string; distancia: number }[]>`
    SELECT id, embedding <=> ${vetor}::vector AS distancia
    FROM "Job" WHERE active AND embedding IS NOT NULL
    ORDER BY distancia LIMIT ${limite}`;
  ```
  Se isso se repetir, crie helpers em `packages/db/src` em vez de copiar o SQL.

## SQL manual recorrente

```sql
-- Unicidade de escopo das regras de envio tratando NULL como valor (PG15+).
-- Recrie o índice único que o Prisma gerou, com o mesmo nome:
DROP INDEX "SendRule_userId_searchProfileId_sourceId_key";
CREATE UNIQUE INDEX "SendRule_userId_searchProfileId_sourceId_key"
  ON "SendRule" ("userId", "searchProfileId", "sourceId") NULLS NOT DISTINCT;

-- Busca vetorial
CREATE INDEX "Job_embedding_hnsw_idx" ON "Job" USING hnsw (embedding vector_cosine_ops);

-- Busca textual em português
CREATE INDEX "Job_fts_idx" ON "Job"
  USING gin (to_tsvector('portuguese', title || ' ' || description));
```

O Prisma não conhece índices criados à mão. **Revise toda migration gerada depois disso:** se ela tentar `DROP INDEX` de um desses índices, remova essas linhas antes de aplicar. Depois de criar a migration, confirme que um novo `migrate dev` não acusa diferença (drift).

## Checklist

- [ ] Migration com nome descritivo, revisada, versionada junto do schema
- [ ] Nenhuma migration antiga editada; nenhum índice manual derrubado
- [ ] Enums alinhados com `contracts`; JSON validado com Zod
- [ ] Índices para os novos filtros; cascata correta a partir de `User`
- [ ] Seed idempotente; `pnpm check` passa
