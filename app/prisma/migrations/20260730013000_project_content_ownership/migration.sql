ALTER TABLE "ProjectNote" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "createdByName" TEXT;
CREATE INDEX "ProjectNote_createdByUserId_idx" ON "ProjectNote"("createdByUserId");
CREATE INDEX "ProjectDailyReport_createdByUserId_idx" ON "ProjectDailyReport"("createdByUserId");
