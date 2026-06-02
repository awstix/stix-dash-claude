-- CreateTable
CREATE TABLE "AdminOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AdminOption_groupKey_idx" ON "AdminOption"("groupKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminOption_groupKey_value_key" ON "AdminOption"("groupKey", "value");
