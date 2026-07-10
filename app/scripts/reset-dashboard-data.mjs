#!/usr/bin/env node

import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const dbPath = path.resolve(appRoot, "dev.db");
const backupDir = path.resolve(appRoot, "backups");

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--confirm");
const skipBackup = args.has("--no-backup");
const deleteUploads = args.has("--delete-uploads");
const deleteCategories = args.has("--delete-categories");
const deleteQualificationTypes = args.has("--delete-qualification-types");

const keepTables = new Set([
  "_prisma_migrations",
  "AdminOption",
  "CompanyInfo",
  "InventoryLabelTemplate",
  "ProjectFormTemplate",
  "WorkTimePreset",
  "WorkshopFormTemplate",
]);

if (!deleteCategories) {
  keepTables.add("InventoryCategory");
}

if (!deleteQualificationTypes) {
  keepTables.add("EmployeeQualificationType");
}

const uploadDirectories = [
  path.resolve(appRoot, "public", "exports"),
  path.resolve(appRoot, "public", "uploads", "employee-photos"),
  path.resolve(appRoot, "public", "uploads", "employee-qualifications"),
  path.resolve(appRoot, "public", "uploads", "employee-training-certificates"),
  path.resolve(appRoot, "public", "uploads", "inventory-items"),
  path.resolve(appRoot, "public", "uploads", "project-documents"),
  path.resolve(appRoot, "public", "uploads", "project-forms"),
  path.resolve(appRoot, "public", "uploads", "project-photos"),
  path.resolve(appRoot, "public", "uploads", "workshop-forms"),
];

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function printUsage() {
  console.log(`
STIX Dashboard Datenreset

Standard ist Vorschau ohne Löschen.

  npm run db:reset-data
    zeigt nur, welche Tabellen geleert würden

  npm run db:reset-data -- --confirm
    erstellt Backup und löscht Bewegungs-/Stammdaten

Optionen:
  --confirm                     Reset wirklich ausführen
  --no-backup                   kein DB-Backup erstellen
  --delete-uploads              Upload-/Exportordner zusätzlich leeren
  --delete-categories           Inventarkategorien ebenfalls löschen
  --delete-qualification-types  Führerschein-/Nachweisarten ebenfalls löschen

Bleibt standardmäßig erhalten:
  ${Array.from(keepTables).sort().join(", ")}
`);
}

if (!existsSync(dbPath)) {
  console.error(`Datenbank nicht gefunden: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  .all()
  .map((row) => row.name);
const hasSqliteSequence = Boolean(
  db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'",
    )
    .get(),
);

const rowsByTable = new Map(
  tables.map((table) => [
    table,
    db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get()
      .count,
  ]),
);

const tablesToClear = tables.filter((table) => !keepTables.has(table));
const keptTables = tables.filter((table) => keepTables.has(table));

console.log("Datenbank:", dbPath);
console.log("");
console.log("Bleibt erhalten:");
for (const table of keptTables) {
  console.log(`  ${table}: ${rowsByTable.get(table)} Datensätze`);
}

console.log("");
console.log("Wird geleert:");
for (const table of tablesToClear) {
  console.log(`  ${table}: ${rowsByTable.get(table)} Datensätze`);
}

if (!confirmed) {
  console.log("");
  console.log("Vorschau fertig. Es wurde nichts gelöscht.");
  printUsage();
  db.close();
  process.exit(0);
}

if (!skipBackup) {
  mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `dev-${timestamp()}-before-reset.db`);
  copyFileSync(dbPath, backupPath);
  console.log("");
  console.log("Backup erstellt:", backupPath);
}

db.pragma("foreign_keys = OFF");

const resetTransaction = db.transaction(() => {
  for (const table of tablesToClear) {
    db.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run();
  }

  if (hasSqliteSequence) {
    for (const table of tablesToClear) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(table);
    }
  }
});

resetTransaction();
db.pragma("foreign_keys = ON");
db.exec("VACUUM");
db.close();

if (deleteUploads) {
  console.log("");
  console.log("Upload-/Exportordner werden geleert:");
  for (const directory of uploadDirectories) {
    if (!existsSync(directory)) {
      continue;
    }

    rmSync(directory, { force: true, recursive: true });
    mkdirSync(directory, { recursive: true });
    console.log(`  ${directory}`);
  }
}

console.log("");
console.log("Reset abgeschlossen.");
