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

- A coluna é `Unsupported("vector(N)")`. **N precisa ser a dimensão do modelo de embeddings**: hoje é `vector(1024)`, o padrão do Voyage `voyage-4` (ver skill `integracao-ia`).
- **O Prisma não detecta mudança de dimensão** em `Unsupported("vector(N)")`: a migration sai vazia. Gere com `--create-only` e escreva o `ALTER TABLE ... ALTER COLUMN "embedding" TYPE vector(N)` à mão. Com vetores gravados, o `ALTER` falha; é preciso apagar e recalcular.
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

-- Busca vetorial. Sempre PARCIAL: veja abaixo.
CREATE INDEX "Job_embedding_hnsw_idx" ON "Job" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

-- Busca textual em português
CREATE INDEX "Job_fts_idx" ON "Job"
  USING gin (to_tsvector('portuguese', title || ' ' || description));
```

Esses três já existem (migration `embeddings_1024_and_search_indexes`, que também cria o HNSW de `ResumeVersion`). Use-os como modelo.

O Prisma não conhece índices criados à mão, e o que ele faz com cada um muda:

- **Ignora** índices de expressão (o GIN acima), índices parciais e o `NULLS NOT DISTINCT` de um índice com o nome que ele espera.
- **Derruba** um índice comum numa coluna que ele conhece, como um HNSW sem `WHERE`: toda migration nova viria com `DROP INDEX`. Por isso o HNSW é parcial. O conteúdo é o mesmo (o pgvector não indexa NULL), mas **a consulta precisa ter `embedding IS NOT NULL`** para o planner usar o índice, como no exemplo da seção pgvector.
- A busca textual só usa o GIN se repetir **a mesma expressão** do índice: `to_tsvector('portuguese', title || ' ' || description) @@ plainto_tsquery('portuguese', ${termo})`.

Depois de criar uma migration com SQL manual, confira que o Prisma não quer desfazer nada. Este comando não altera o banco e não pede nada interativo:

```bash
pnpm exec dotenv -e .env -- sh -c 'pnpm --filter @cv-pilot/db exec prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script'
# esperado: "-- This is an empty migration."
```

Se aparecer `DROP INDEX` de um índice manual, corrija o índice (ou remova as linhas da migration gerada) antes de aplicar.

### Armadilhas do `migrate dev`

- Sem `--name`, e com alguma diferença entre schema e banco, ele **espera um nome no terminal** e fica parado num agente ou na CI. Passe sempre `--name`.
- No Windows, `prisma generate` (e por isso o `pnpm check` e o `pnpm test:integration`) falha com `EPERM ... query_engine-windows.dll.node` enquanto a API ou os workers de dev estão rodando: eles prendem a DLL do motor. Pare os dois antes.
- Se ele for interrompido no Windows, o processo `node` pode continuar vivo segurando o advisory lock do Prisma (`pg_advisory_lock(72707369)`). O sintoma é _"The database server was reached but timed out"_ na próxima execução. Encerre o processo `node ... prisma ... migrate dev` que sobrou.

## Checklist

- [ ] Migration com nome descritivo, revisada, versionada junto do schema
- [ ] Nenhuma migration antiga editada; nenhum índice manual derrubado
- [ ] Enums alinhados com `contracts`; JSON validado com Zod
- [ ] Índices para os novos filtros; cascata correta a partir de `User`
- [ ] Seed idempotente; `pnpm check` passa
