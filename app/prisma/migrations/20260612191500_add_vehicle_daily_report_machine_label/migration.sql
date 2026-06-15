ALTER TABLE "Vehicle" ADD COLUMN "dailyReportMachineLabel" TEXT;

CREATE INDEX "Vehicle_dailyReportMachineLabel_idx" ON "Vehicle"("dailyReportMachineLabel");
