ALTER TABLE "ControllingRateChangeLog" ADD COLUMN "batchId" TEXT;
ALTER TABLE "ControllingRateChangeLog" ADD COLUMN "batchLabel" TEXT;

CREATE INDEX "ControllingRateChangeLog_batchId_idx" ON "ControllingRateChangeLog"("batchId");
