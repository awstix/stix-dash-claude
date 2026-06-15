ALTER TABLE "ProjectDailyReport" ADD COLUMN "reportNumber" INTEGER;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "ProjectDailyReport" ADD COLUMN "sheetNumber" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "ProjectDailyReport" ADD COLUMN "reportProjectName" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "reportProjectNumber" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "weekdayLabel" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "workStart" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "workEnd" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "trafficSafetyFirstCheckTime" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "trafficSafetySecondCheckTime" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "laborJson" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "machinesJson" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "performanceJson" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "approvedFieldsJson" TEXT;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "ProjectDailyReport" ADD COLUMN "approvedByName" TEXT;

CREATE INDEX "ProjectDailyReport_reportNumber_idx" ON "ProjectDailyReport"("reportNumber");
CREATE INDEX "ProjectDailyReport_status_idx" ON "ProjectDailyReport"("status");
