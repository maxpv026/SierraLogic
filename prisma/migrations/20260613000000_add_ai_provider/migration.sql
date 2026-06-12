-- AlterTable: track which AI provider produced each cached analysis
ALTER TABLE "AnalysisResult"
  ADD COLUMN "aiProvider" TEXT NOT NULL DEFAULT 'openai';
