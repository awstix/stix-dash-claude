CREATE TABLE "ProjectWeatherLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "weatherDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'OPEN_METEO',
    "tempMinC" REAL,
    "tempMaxC" REAL,
    "precipitationMm" REAL NOT NULL DEFAULT 0,
    "precipitationProbabilityMax" INTEGER,
    "windSpeedMaxKmh" REAL,
    "weatherCode" INTEGER,
    "weatherLabel" TEXT,
    "weatherCategory" TEXT,
    "weatherCategorySource" TEXT NOT NULL DEFAULT 'AUTO',
    "currentTemperatureC" REAL,
    "currentWeatherCode" INTEGER,
    "currentWeatherLabel" TEXT,
    "currentPrecipitationMm" REAL,
    "currentWindSpeedKmh" REAL,
    "observedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectWeatherLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectWeatherLog_projectId_weatherDate_key" ON "ProjectWeatherLog"("projectId", "weatherDate");
CREATE INDEX "ProjectWeatherLog_projectId_idx" ON "ProjectWeatherLog"("projectId");
CREATE INDEX "ProjectWeatherLog_weatherDate_idx" ON "ProjectWeatherLog"("weatherDate");
CREATE INDEX "ProjectWeatherLog_weatherCategory_idx" ON "ProjectWeatherLog"("weatherCategory");
