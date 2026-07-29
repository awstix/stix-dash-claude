ALTER TABLE "DispositionDayOff"
ADD COLUMN "endDate" DATETIME;

CREATE INDEX "DispositionDayOff_endDate_idx"
ON "DispositionDayOff"("endDate");
