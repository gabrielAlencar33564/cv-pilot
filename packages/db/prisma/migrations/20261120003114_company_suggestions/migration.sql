-- CreateTable
CREATE TABLE "CompanySuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceId" TEXT,
    "careerBoardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySuggestion_userId_createdAt_idx" ON "CompanySuggestion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanySuggestion" ADD CONSTRAINT "CompanySuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySuggestion" ADD CONSTRAINT "CompanySuggestion_careerBoardId_fkey" FOREIGN KEY ("careerBoardId") REFERENCES "CareerBoard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
