-- CreateTable
CREATE TABLE "ProjectFormTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "fieldsJson" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectFormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "formDate" DATETIME,
    "valuesJson" TEXT NOT NULL,
    "templateSnapshotJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectFormSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectFormSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProjectFormTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Starter templates
INSERT INTO "ProjectFormTemplate" ("id", "name", "category", "description", "fieldsJson", "sortOrder", "createdAt", "updatedAt")
VALUES
('tpl_bautagesbericht', 'Bautagesbericht', 'Bautagesbericht', 'Tagesbericht mit Wetter, Personal, Leistung und besonderen Vorkommnissen.', '[{"id":"wetter","label":"Wetterangabe","type":"textarea","required":false,"options":[]},{"id":"temperatur_min","label":"Temperatur min C","type":"number","required":false,"options":[]},{"id":"temperatur_max","label":"Temperatur max C","type":"number","required":false,"options":[]},{"id":"personal","label":"Personal","type":"textarea","required":false,"options":[]},{"id":"geraete","label":"Geräte / LKW","type":"textarea","required":false,"options":[]},{"id":"leistung","label":"Ausgeführte Leistung","type":"textarea","required":true,"options":[]},{"id":"material","label":"Material / Mengen","type":"textarea","required":false,"options":[]},{"id":"behinderung","label":"Behinderungen / Unterbrechungen","type":"textarea","required":false,"options":[]},{"id":"vorkommnisse","label":"Besondere Vorkommnisse","type":"textarea","required":false,"options":[]}]', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_verkehrssicherung', 'Verkehrssicherung', 'Sicherung', 'Kontrolle und Dokumentation der Verkehrssicherung.', '[{"id":"bereich","label":"Bereich / Abschnitt","type":"text","required":true,"options":[]},{"id":"kontrollzeit","label":"Kontrollzeit","type":"time","required":false,"options":[]},{"id":"zustand","label":"Zustand","type":"select","required":true,"options":["in Ordnung","Mängel vorhanden","nachgebessert"]},{"id":"massnahmen","label":"Maßnahmen","type":"textarea","required":false,"options":[]},{"id":"maengel","label":"Mängel / Hinweise","type":"textarea","required":false,"options":[]},{"id":"verantwortlich","label":"Verantwortlich","type":"text","required":false,"options":[]}]', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_lastplatte', 'Dynamischer Lastplattendruckversuch', 'Prüfung', 'Prüfwerte für dynamische Lastplattendruckversuche.', '[{"id":"pruefflaeche","label":"Prüffläche / Station","type":"text","required":true,"options":[]},{"id":"material","label":"Material / Schicht","type":"text","required":false,"options":[]},{"id":"schichtdicke","label":"Schichtdicke cm","type":"number","required":false,"options":[]},{"id":"evd","label":"EVd-Wert MN/m2","type":"number","required":true,"options":[]},{"id":"bewertung","label":"Bewertung","type":"select","required":true,"options":["bestanden","nicht bestanden","Nachprüfung erforderlich"]},{"id":"bemerkung","label":"Bemerkung","type":"textarea","required":false,"options":[]}]', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_stundenlohn', 'Stundenlohnnachweis', 'Nachweis', 'Nachweis für Personal, Geräte, Zeiten und Leistung.', '[{"id":"zeitraum","label":"Zeitraum / Uhrzeit","type":"text","required":true,"options":[]},{"id":"personal","label":"Personal","type":"textarea","required":true,"options":[]},{"id":"geraete","label":"Geräte / Fahrzeuge","type":"textarea","required":false,"options":[]},{"id":"leistung","label":"Ausgeführte Arbeiten","type":"textarea","required":true,"options":[]},{"id":"material","label":"Material","type":"textarea","required":false,"options":[]},{"id":"auftraggeber","label":"Auftraggeber / Bestätigung","type":"text","required":false,"options":[]}]', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_abnahme', 'Abnahmeprotokoll', 'Abnahme', 'Abnahme mit Teilnehmern, Ergebnis und Mängeln.', '[{"id":"bauteil","label":"Bauteil / Abschnitt","type":"text","required":true,"options":[]},{"id":"teilnehmer","label":"Teilnehmer","type":"textarea","required":false,"options":[]},{"id":"ergebnis","label":"Ergebnis","type":"select","required":true,"options":["abgenommen","abgenommen mit Mängeln","nicht abgenommen"]},{"id":"maengel","label":"Mängel / Restleistungen","type":"textarea","required":false,"options":[]},{"id":"frist","label":"Frist","type":"date","required":false,"options":[]},{"id":"bemerkung","label":"Bemerkung","type":"textarea","required":false,"options":[]}]', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl_kleine_massnahme', 'Kleine Maßnahme', 'Kurzbericht', 'Schnelles Formular für kleine, kurzfristige Arbeiten.', '[{"id":"ort","label":"Ort / Adresse","type":"text","required":false,"options":[]},{"id":"auftrag","label":"Auftrag / Anlass","type":"textarea","required":true,"options":[]},{"id":"arbeiten","label":"Ausgeführte Arbeiten","type":"textarea","required":true,"options":[]},{"id":"material","label":"Material / Mengen","type":"textarea","required":false,"options":[]},{"id":"zeit","label":"Zeit / Dauer","type":"text","required":false,"options":[]},{"id":"hinweise","label":"Hinweise","type":"textarea","required":false,"options":[]}]', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateIndex
CREATE INDEX "ProjectFormTemplate_isActive_idx" ON "ProjectFormTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ProjectFormTemplate_name_idx" ON "ProjectFormTemplate"("name");

-- CreateIndex
CREATE INDEX "ProjectFormTemplate_sortOrder_idx" ON "ProjectFormTemplate"("sortOrder");

-- CreateIndex
CREATE INDEX "ProjectFormSubmission_projectId_idx" ON "ProjectFormSubmission"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFormSubmission_templateId_idx" ON "ProjectFormSubmission"("templateId");

-- CreateIndex
CREATE INDEX "ProjectFormSubmission_formDate_idx" ON "ProjectFormSubmission"("formDate");

-- CreateIndex
CREATE INDEX "ProjectFormSubmission_status_idx" ON "ProjectFormSubmission"("status");

-- CreateIndex
CREATE INDEX "ProjectFormSubmission_createdAt_idx" ON "ProjectFormSubmission"("createdAt");
