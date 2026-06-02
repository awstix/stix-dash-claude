-- CreateTable
CREATE TABLE "ShortHaulTour" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "tourNumber" INTEGER NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "projectId" TEXT,
    "projectNumber" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "material" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShortHaulTour_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ShortHaulAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShortHaulTour_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShortHaulTour_assignmentId_idx" ON "ShortHaulTour"("assignmentId");

-- CreateIndex
CREATE INDEX "ShortHaulTour_projectId_idx" ON "ShortHaulTour"("projectId");

-- CreateIndex
CREATE INDEX "ShortHaulTour_startTime_idx" ON "ShortHaulTour"("startTime");

-- CreateIndex
CREATE INDEX "ShortHaulTour_endTime_idx" ON "ShortHaulTour"("endTime");
