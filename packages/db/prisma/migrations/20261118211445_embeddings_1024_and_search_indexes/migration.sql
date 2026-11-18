-- SQL manual: o Prisma não expressa nada desta migration (gerada vazia com --create-only).

-- Embeddings com 1024 dimensões, o padrão do Voyage voyage-4 (item 13 de docs/melhorias.md).
-- O Prisma não detecta mudança de dimensão em Unsupported("vector(N)").
-- As colunas estavam vazias; com vetores gravados, o ALTER falharia por dimensão diferente.
ALTER TABLE "Job" ALTER COLUMN "embedding" TYPE vector(1024);
ALTER TABLE "ResumeVersion" ALTER COLUMN "embedding" TYPE vector(1024);

-- Regras de envio: escopos com NULL também conflitam (PG15+).
-- Mesmo nome do índice gerado pelo Prisma, para ele continuar reconhecendo o @@unique.
DROP INDEX "SendRule_userId_searchProfileId_sourceId_key";
CREATE UNIQUE INDEX "SendRule_userId_searchProfileId_sourceId_key"
  ON "SendRule" ("userId", "searchProfileId", "sourceId") NULLS NOT DISTINCT;

-- Busca vetorial por distância de cosseno (operador <=>).
-- Parciais de propósito: o Prisma ignora índices parciais, e um HNSW comum em coluna
-- Unsupported entraria no diff como DROP INDEX em toda migration nova. O conteúdo é o mesmo
-- (o pgvector não indexa NULL), mas a consulta precisa ter `embedding IS NOT NULL` para usá-lo.
CREATE INDEX "Job_embedding_hnsw_idx" ON "Job" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
CREATE INDEX "ResumeVersion_embedding_hnsw_idx"
  ON "ResumeVersion" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;

-- Busca textual em português. A consulta precisa repetir a mesma expressão para usar o índice.
CREATE INDEX "Job_fts_idx" ON "Job"
  USING gin (to_tsvector('portuguese', "title" || ' ' || "description"));
