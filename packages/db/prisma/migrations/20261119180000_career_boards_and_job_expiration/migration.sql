-- Catálogo de empresas (CareerBoard) no lugar de Source.config, e expiração de vagas (RF-34).

-- CreateTable
CREATE TABLE "CareerBoard" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerBoard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerBoard_sourceId_active_idx" ON "CareerBoard"("sourceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CareerBoard_sourceId_token_key" ON "CareerBoard"("sourceId", "token");

-- AddForeignKey
ALTER TABLE "CareerBoard" ADD CONSTRAINT "CareerBoard_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copia os boards do Greenhouse e as empresas do Lever que estavam em Source.config.
INSERT INTO "CareerBoard" ("id", "sourceId", "token", "updatedAt")
SELECT DISTINCT ON (s."id", t.token) gen_random_uuid()::text, s."id", t.token, CURRENT_TIMESTAMP
FROM "Source" s
CROSS JOIN LATERAL (
    SELECT jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(s."config"::jsonb -> k) = 'array' THEN s."config"::jsonb -> k ELSE '[]'::jsonb END
    ) AS token
    FROM (VALUES ('boards'), ('companies')) AS keys(k)
) t
WHERE t.token <> '';

-- AlterTable
ALTER TABLE "JobSource" ADD COLUMN     "careerBoardId" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3);

-- Liga as vagas já coletadas ao board de origem, que os adapters guardavam no raw.
UPDATE "JobSource" js
SET "careerBoardId" = cb."id"
FROM "CareerBoard" cb
WHERE cb."sourceId" = js."sourceId"
  AND cb."token" = COALESCE(js."raw" ->> '_board', js."raw" ->> '_company');

-- CreateIndex
CREATE INDEX "JobSource_careerBoardId_lastSeen_idx" ON "JobSource"("careerBoardId", "lastSeen");

-- CreateIndex
CREATE INDEX "JobSource_closedAt_lastSeen_idx" ON "JobSource"("closedAt", "lastSeen");

-- AddForeignKey
ALTER TABLE "JobSource" ADD CONSTRAINT "JobSource_careerBoardId_fkey" FOREIGN KEY ("careerBoardId") REFERENCES "CareerBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Source" DROP COLUMN "config";
