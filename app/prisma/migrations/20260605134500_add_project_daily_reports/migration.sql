CREATE TABLE "ProjectDailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "weatherTempMinC" REAL,
    "weatherTempMaxC" REAL,
    "weatherCategory" TEXT,
    "weatherSource" TEXT NOT NULL DEFAULT 'AUTO',
    "weatherNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectDailyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectDailyReport_projectId_reportDate_key" ON "ProjectDailyReport"("projectId", "reportDate");
CREATE INDEX "ProjectDailyReport_projectId_idx" ON "ProjectDailyReport"("projectId");
CREATE INDEX "ProjectDailyReport_reportDate_idx" ON "ProjectDailyReport"("reportDate");
