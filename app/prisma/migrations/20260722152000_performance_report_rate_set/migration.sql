-- Allow every performance report to keep its own selected rate set.
ALTER TABLE "ControllingPerformanceReport" ADD COLUMN "rateSetId" TEXT;

UPDATE "ControllingPerformanceReport"
SET "rateSetId" = (
  SELECT "id"
  FROM "ControllingRateSet"
  WHERE "ControllingRateSet"."year" = CAST(strftime('%Y', COALESCE("ControllingPerformanceReport"."periodEnd", "ControllingPerformanceReport"."reportDate")) AS INTEGER)
  LIMIT 1
)
WHERE "rateSetId" IS NULL;

CREATE INDEX "ControllingPerformanceReport_rateSetId_idx" ON "ControllingPerformanceReport"("rateSetId");

PRAGMA foreign_keys=off;
CREATE TABLE "new_ControllingPerformanceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "rateSetId" TEXT,
    "reportDate" DATETIME NOT NULL,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "contractValueNetCents" INTEGER NOT NULL DEFAULT 0,
    "changeOrdersNetCents" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" REAL NOT NULL DEFAULT 0,
    "paymentsNetCents" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControllingPerformanceReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ControllingPerformanceReport_rateSetId_fkey" FOREIGN KEY ("rateSetId") REFERENCES "ControllingRateSet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ControllingPerformanceReport" (
    "changeOrdersNetCents",
    "contractValueNetCents",
    "createdAt",
    "createdByName",
    "id",
    "note",
    "paymentsNetCents",
    "periodEnd",
    "periodStart",
    "progressPercent",
    "projectId",
    "rateSetId",
    "reportDate",
    "status",
    "title",
    "updatedAt"
) SELECT
    "changeOrdersNetCents",
    "contractValueNetCents",
    "createdAt",
    "createdByName",
    "id",
    "note",
    "paymentsNetCents",
    "periodEnd",
    "periodStart",
    "progressPercent",
    "projectId",
    "rateSetId",
    "reportDate",
    "status",
    "title",
    "updatedAt"
FROM "ControllingPerformanceReport";
DROP TABLE "ControllingPerformanceReport";
ALTER TABLE "new_ControllingPerformanceReport" RENAME TO "ControllingPerformanceReport";
PRAGMA foreign_keys=on;

CREATE INDEX "ControllingPerformanceReport_projectId_idx" ON "ControllingPerformanceReport"("projectId");
CREATE INDEX "ControllingPerformanceReport_rateSetId_idx" ON "ControllingPerformanceReport"("rateSetId");
CREATE INDEX "ControllingPerformanceReport_reportDate_idx" ON "ControllingPerformanceReport"("reportDate");
CREATE INDEX "ControllingPerformanceReport_periodStart_idx" ON "ControllingPerformanceReport"("periodStart");
CREATE INDEX "ControllingPerformanceReport_periodEnd_idx" ON "ControllingPerformanceReport"("periodEnd");
CREATE INDEX "ControllingPerformanceReport_status_idx" ON "ControllingPerformanceReport"("status");
