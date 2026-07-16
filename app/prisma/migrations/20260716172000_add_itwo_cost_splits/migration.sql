ALTER TABLE "ControllingInvoiceItem" ADD COLUMN "laborCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ControllingInvoiceItem" ADD COLUMN "equipmentCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ControllingInvoiceItem" ADD COLUMN "materialCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ControllingInvoiceItem" ADD COLUMN "subcontractorCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ControllingInvoiceItem" ADD COLUMN "otherCostCents" INTEGER NOT NULL DEFAULT 0;
