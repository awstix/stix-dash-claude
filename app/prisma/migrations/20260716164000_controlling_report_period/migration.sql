ALTER TABLE "ControllingPerformanceReport" ADD COLUMN "periodStart" DATETIME;
ALTER TABLE "ControllingPerformanceReport" ADD COLUMN "periodEnd" DATETIME;

UPDATE "ControllingPerformanceReport"
SET
  "periodStart" = COALESCE("periodStart", "reportDate"),
  "periodEnd" = COALESCE("periodEnd", "reportDate");

CREATE INDEX "ControllingPerformanceReport_periodStart_idx" ON "ControllingPerformanceReport"("periodStart");
CREATE INDEX "ControllingPerformanceReport_periodEnd_idx" ON "ControllingPerformanceReport"("periodEnd");
