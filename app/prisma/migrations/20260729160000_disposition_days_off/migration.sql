CREATE TABLE "DispositionDayOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'COMPANY',
    "scopeLabel" TEXT,
    "sourceLabel" TEXT,
    "sourceUrl" TEXT,
    "sourceCheckedAt" DATETIME,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "DispositionDayOff_date_name_key"
ON "DispositionDayOff"("date", "name");

CREATE INDEX "DispositionDayOff_date_idx"
ON "DispositionDayOff"("date");

CREATE INDEX "DispositionDayOff_isDayOff_idx"
ON "DispositionDayOff"("isDayOff");
