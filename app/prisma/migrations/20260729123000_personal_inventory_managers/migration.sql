ALTER TABLE "Employee" ADD COLUMN "canManagePersonalInventory" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Employee_canManagePersonalInventory_idx" ON "Employee"("canManagePersonalInventory");
