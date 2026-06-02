-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "constructionManager" TEXT,
    "plannedStart" DATETIME,
    "plannedEnd" DATETIME,
    "actualStart" DATETIME,
    "actualEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "contractValueNet" INTEGER NOT NULL DEFAULT 0,
    "changeOrdersNet" INTEGER NOT NULL DEFAULT 0,
    "progressPercent" REAL NOT NULL DEFAULT 0,
    "paymentsNet" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");
