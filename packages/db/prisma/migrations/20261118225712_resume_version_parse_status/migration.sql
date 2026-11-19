-- AlterTable
ALTER TABLE "ResumeVersion" ADD COLUMN     "parseError" TEXT,
ADD COLUMN     "parseStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "parsedAt" TIMESTAMP(3);
