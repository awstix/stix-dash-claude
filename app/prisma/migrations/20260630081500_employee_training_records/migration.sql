CREATE TABLE "EmployeeTrainingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT,
    "provider" TEXT,
    "topic" TEXT NOT NULL,
    "type" TEXT,
    "defaultLocation" TEXT,
    "defaultDurationDays" REAL,
    "defaultValidityMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EmployeeTrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "trainingTypeId" TEXT,
    "number" TEXT,
    "provider" TEXT,
    "topic" TEXT NOT NULL,
    "trainingDate" DATETIME,
    "type" TEXT,
    "location" TEXT,
    "durationDays" REAL,
    "bookedAt" DATETIME,
    "bookingConfirmedAt" DATETIME,
    "certificateReceivedAt" DATETIME,
    "validityMonths" INTEGER,
    "validUntil" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeTrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeTrainingRecord_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "EmployeeTrainingType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmployeeTrainingType_topic_key" ON "EmployeeTrainingType"("topic");
CREATE INDEX "EmployeeTrainingType_number_idx" ON "EmployeeTrainingType"("number");
CREATE INDEX "EmployeeTrainingType_isActive_idx" ON "EmployeeTrainingType"("isActive");
CREATE INDEX "EmployeeTrainingType_sortOrder_idx" ON "EmployeeTrainingType"("sortOrder");
CREATE INDEX "EmployeeTrainingRecord_employeeId_idx" ON "EmployeeTrainingRecord"("employeeId");
CREATE INDEX "EmployeeTrainingRecord_trainingTypeId_idx" ON "EmployeeTrainingRecord"("trainingTypeId");
CREATE INDEX "EmployeeTrainingRecord_trainingDate_idx" ON "EmployeeTrainingRecord"("trainingDate");
CREATE INDEX "EmployeeTrainingRecord_validUntil_idx" ON "EmployeeTrainingRecord"("validUntil");
CREATE INDEX "EmployeeTrainingRecord_topic_idx" ON "EmployeeTrainingRecord"("topic");

-- Schulungsvorlagen aus der bisherigen STIX-Schulungsübersicht.
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-01', '01', 'EGRO', 'Stix 01 Sicherheitsunterweisung', 'Allgemein', 'Intern', 0.5, 12, 0, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-02', '02', 'Intern', 'Stix 02 Fachtechnischeunterweisung', 'Allgemein', 'Intern', 0.5, 12, 10, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-03', '03', 'Intern', 'Erste Hilfe Kurs', 'Allgemein', 'Niedernberg', 1.0, 24, 20, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-04', '04', 'DVGW', 'TRGS Anlage 4A Asbest', 'DVGW', 'Schweinfurt', 2.0, 72, 30, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-05', '05', 'DVGW', 'GW 15 Nachumhüllung Modul A + B + G', 'DVGW', 'Frankfurt', 2.0, 60, 40, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-06', '06', 'DVGW', 'GW 128 Vermessung', 'DVGW', 'Frankfurt', 2.0, 36, 50, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-07', '07', 'DVGW', 'GW 129 Tiefbau', 'DVGW', 'Heilbronn', 1.0, 60, 60, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-08', '08', 'DVGW', 'Hygieneanforderungen im 
Trinkwassernetz (W291)', 'DVGW', 'Online', 1.0, 60, 70, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-09', '09', 'DVGW', 'W 324 GFK Rohr', 'DVGW', 'Gera', 2.0, 60, 80, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-10', '10', 'DVGW', 'GW 326 (Anhang A)', 'DVGW', 'Würzburg', 3.0, 60, 90, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-11', '11', 'Plasson', 'GW 326 (Anhang C) Hr. Feidel', 'DVGW', 'Großwallstadt', 1.0, 24, 100, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-12', '12', 'Muffenrohr', 'GW 330 PE Schweißen', 'DVGW', 'Aschaffenburg', 1.0, 12, 110, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-13', '13', 'HTI', 'GW 331 Verlängerung', NULL, 'Groß-Zimmern', 1.0, 60, 120, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-14', '14', 'DVGW', 'W 339 Muffentechnik', NULL, 'Gera', 3.0, 60, 130, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-15', '15', 'DVGW', 'W 392 Reinigung und Desifektion', NULL, 'Online', 1.0, 24, 140, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-16', '16', 'DVGW', 'W400-2 Bau & Prüfung 
von Wasserverteilungsanlagen', NULL, 'Online', 2.0, 60, 150, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-17', '17', 'Esders', 'Druckprüfseminar W 400-2', NULL, 'Feuchtwangen', 2.0, 60, 160, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-18', '18', 'DVGW', 'W 551 Grundschulung Wasserprobe', NULL, 'Köln', 1.0, 36, 170, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-19', '19', 'BfGA', 'MVAS 99 / RSA Baustellensicherung', NULL, 'Niedernberg', 1.0, 60, 180, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-20', '20', 'HWK', 'Qualifizierte Gesellen - Fähige Azubis', NULL, 'Aschaffenburg', 1.0, 60, 190, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-21', '21', 'Güteschutz Kanalbau', 'Güteschutz Kanalbau - Allgemeiner Kanalbau in offener Bauwesie - Grundlagen fachgerechter Bauausfürhung und Eigentüberwachung', NULL, 'Aschaffenburg', 1.0, 60, 200, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-22', '22', 'Makineo', 'Der einfache Weg auf die digitale Baustelle - Individualtraining für Einsteiger und Aufsteiger', 'intern', 'Aschaffenburg', 1.0, 60, 210, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-23', '23', 'BauAkademie', 'Vorarbeiter Lehrgang', 'Extern', 'Feuchtwangen', 10.0, 1200, 220, CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO "EmployeeTrainingType" ("id", "number", "provider", "topic", "type", "defaultLocation", "defaultDurationDays", "defaultValidityMonths", "sortOrder", "updatedAt") VALUES ('seed-training-24', '24', NULL, 'WhatsApp Gruppe', NULL, NULL, 0.5, 12, 230, CURRENT_TIMESTAMP);
