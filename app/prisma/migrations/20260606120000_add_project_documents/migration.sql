-- CreateTable
CREATE TABLE "ProjectDocumentFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectDocumentFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT,
    "displayName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT,
    "uploadedByName" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ProjectDocumentFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocumentFolder_projectId_name_key" ON "ProjectDocumentFolder"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectDocumentFolder_projectId_idx" ON "ProjectDocumentFolder"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocumentFolder_sortOrder_idx" ON "ProjectDocumentFolder"("sortOrder");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocument_folderId_idx" ON "ProjectDocument"("folderId");

-- CreateIndex
CREATE INDEX "ProjectDocument_displayName_idx" ON "ProjectDocument"("displayName");

-- CreateIndex
CREATE INDEX "ProjectDocument_originalFileName_idx" ON "ProjectDocument"("originalFileName");

-- CreateIndex
CREATE INDEX "ProjectDocument_uploadedAt_idx" ON "ProjectDocument"("uploadedAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_uploadedByUserId_idx" ON "ProjectDocument"("uploadedByUserId");
