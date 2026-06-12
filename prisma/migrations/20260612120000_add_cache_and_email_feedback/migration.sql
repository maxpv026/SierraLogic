-- AlterTable: 24h cache fields on AnalysisResult
ALTER TABLE "AnalysisResult"
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN "sentimentScore" INTEGER,
  ADD COLUMN "category" TEXT,
  ADD COLUMN "designStyle" TEXT,
  ADD COLUMN "scrapedText" TEXT,
  ADD COLUMN "boardOfDirectors" JSONB,
  ADD COLUMN "cachedTasks" JSONB;

-- CreateIndex
CREATE INDEX "AnalysisResult_url_language_createdAt_idx" ON "AnalysisResult"("url", "language", "createdAt");

-- CreateTable: EmailFeedback (fine-tuning corpus collection)
CREATE TABLE "EmailFeedback" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "url" TEXT NOT NULL,
    "emailDraft" TEXT NOT NULL,
    "editedDraft" TEXT,
    "rating" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailFeedback_userId_idx" ON "EmailFeedback"("userId");
