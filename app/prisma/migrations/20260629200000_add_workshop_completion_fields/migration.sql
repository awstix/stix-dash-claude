ALTER TABLE "WorkshopRepairOrder" ADD COLUMN "completedByName" TEXT;

ALTER TABLE "WorkshopFormSubmission" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "WorkshopFormSubmission" ADD COLUMN "completedByName" TEXT;

CREATE INDEX "WorkshopFormSubmission_completedAt_idx" ON "WorkshopFormSubmission"("completedAt");
