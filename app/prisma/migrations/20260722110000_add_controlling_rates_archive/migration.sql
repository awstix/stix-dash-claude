ALTER TABLE "InventoryCategory" ADD COLUMN "billingRateCents" INTEGER;
ALTER TABLE "InventoryCategory" ADD COLUMN "idleBillingRateCents" INTEGER;

CREATE TABLE "ControllingRateChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "previousValueCents" INTEGER,
    "newValueCents" INTEGER,
    "changeType" TEXT NOT NULL DEFAULT 'UPDATE',
    "changeReason" TEXT,
    "changedByName" TEXT,
    "canRevert" BOOLEAN NOT NULL DEFAULT true,
    "revertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ControllingRateChangeLog_targetType_idx" ON "ControllingRateChangeLog"("targetType");
CREATE INDEX "ControllingRateChangeLog_targetId_idx" ON "ControllingRateChangeLog"("targetId");
CREATE INDEX "ControllingRateChangeLog_fieldName_idx" ON "ControllingRateChangeLog"("fieldName");
CREATE INDEX "ControllingRateChangeLog_changeType_idx" ON "ControllingRateChangeLog"("changeType");
CREATE INDEX "ControllingRateChangeLog_createdAt_idx" ON "ControllingRateChangeLog"("createdAt");
