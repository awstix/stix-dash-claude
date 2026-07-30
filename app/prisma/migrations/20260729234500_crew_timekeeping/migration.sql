CREATE TABLE "CrewTimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "workDate" DATETIME NOT NULL,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "crewName" TEXT NOT NULL DEFAULT '',
    "defaultStartTime" TEXT NOT NULL DEFAULT '07:00',
    "defaultEndTime" TEXT NOT NULL DEFAULT '17:00',
    "defaultBreak1From" TEXT,
    "defaultBreak1To" TEXT,
    "defaultBreak2From" TEXT,
    "defaultBreak2To" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "recordedByUserId" TEXT,
    "recordedByName" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedByUserId" TEXT,
    "approvedByName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "CrewTimeEmployee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "roleLabel" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "break1From" TEXT,
    "break1To" TEXT,
    "break2From" TEXT,
    "break2To" TEXT,
    "netHours" REAL NOT NULL DEFAULT 0,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CrewTimeEmployee_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CrewTimeEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "CrewTimeEntryRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "changedByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrewTimeEntryRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "CrewTimeEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CrewTimeEntry_projectId_crewId_workDate_key" ON "CrewTimeEntry"("projectId", "crewId", "workDate");
CREATE INDEX "CrewTimeEntry_projectId_workDate_idx" ON "CrewTimeEntry"("projectId", "workDate");
CREATE INDEX "CrewTimeEntry_crewId_workDate_idx" ON "CrewTimeEntry"("crewId", "workDate");
CREATE INDEX "CrewTimeEntry_status_idx" ON "CrewTimeEntry"("status");
CREATE UNIQUE INDEX "CrewTimeEmployee_entryId_employeeId_key" ON "CrewTimeEmployee"("entryId", "employeeId");
CREATE INDEX "CrewTimeEmployee_entryId_idx" ON "CrewTimeEmployee"("entryId");
CREATE INDEX "CrewTimeEmployee_employeeId_idx" ON "CrewTimeEmployee"("employeeId");
CREATE UNIQUE INDEX "CrewTimeEntryRevision_entryId_version_key" ON "CrewTimeEntryRevision"("entryId", "version");
CREATE INDEX "CrewTimeEntryRevision_entryId_idx" ON "CrewTimeEntryRevision"("entryId");
