ALTER TABLE "WorkshopFormSubmission" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
CREATE INDEX "WorkshopFormSubmission_priority_idx" ON "WorkshopFormSubmission"("priority");
