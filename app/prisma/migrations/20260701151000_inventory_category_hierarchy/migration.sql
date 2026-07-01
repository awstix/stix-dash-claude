-- Add parent/child hierarchy for inventory categories.
ALTER TABLE "InventoryCategory" ADD COLUMN "parentCategoryId" TEXT;

CREATE INDEX "InventoryCategory_parentCategoryId_idx" ON "InventoryCategory"("parentCategoryId");

-- SQLite cannot add foreign keys to an existing table without rebuilding it.
-- Prisma keeps the relation in the generated client; existing rows stay compatible.
