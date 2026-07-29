CREATE TABLE "UserProjectAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canViewProjectData" BOOLEAN NOT NULL DEFAULT true,
    "canApproveLeaveRequests" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UserFeatureAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserFeatureAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserProjectAccess_userId_projectId_key" ON "UserProjectAccess"("userId", "projectId");
CREATE INDEX "UserProjectAccess_userId_idx" ON "UserProjectAccess"("userId");
CREATE INDEX "UserProjectAccess_projectId_idx" ON "UserProjectAccess"("projectId");
CREATE UNIQUE INDEX "UserFeatureAccess_userId_featureKey_key" ON "UserFeatureAccess"("userId", "featureKey");
CREATE INDEX "UserFeatureAccess_userId_idx" ON "UserFeatureAccess"("userId");
CREATE INDEX "UserFeatureAccess_featureKey_idx" ON "UserFeatureAccess"("featureKey");
