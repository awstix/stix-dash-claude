import Database from "better-sqlite3";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { createZipArchive } from "@/lib/zip";

export type MaintenanceTableInfo = {
  count: number;
  name: string;
};

export type ResetPreview = {
  dbPath: string;
  keptTables: MaintenanceTableInfo[];
  tablesToClear: MaintenanceTableInfo[];
  uploadDirectories: string[];
};

export type ResetResult = ResetPreview & {
  backupPath: string;
  deletedRows: number;
  uploadsCleared: string[];
};

export type FullBackupArchive = {
  bytes: Buffer;
  fileName: string;
  savedDbBackupPath: string;
};

export type LegacyMasterDataCleanupResult = {
  backupPath: string;
  deletedRows: number;
  tablesCleared: MaintenanceTableInfo[];
};

const BASE_KEEP_TABLES = [
  "_prisma_migrations",
  "AdminOption",
  "CompanyInfo",
  "InventoryLabelTemplate",
  "ProjectFormTemplate",
  "WorkTimePreset",
  "WorkshopFormTemplate",
] as const;

const DEFAULT_KEEP_TABLES = [
  ...BASE_KEEP_TABLES,
  "EmployeeQualificationType",
  "InventoryCategory",
] as const;

const UPLOAD_DIRECTORY_PARTS = [
  ["public", "exports"],
  ["public", "uploads", "employee-photos"],
  ["public", "uploads", "employee-qualifications"],
  ["public", "uploads", "employee-training-certificates"],
  ["public", "uploads", "inventory-items"],
  ["public", "uploads", "project-documents"],
  ["public", "uploads", "project-forms"],
  ["public", "uploads", "project-photos"],
  ["public", "uploads", "workshop-forms"],
] as const;

function getAppRoot() {
  return process.cwd();
}

function getDbPath() {
  return path.resolve(getAppRoot(), "dev.db");
}

function getBackupDir() {
  return path.resolve(getAppRoot(), "backups");
}

function getUploadDirectories() {
  const appRoot = getAppRoot();

  return UPLOAD_DIRECTORY_PARTS.map((parts) => path.resolve(appRoot, ...parts));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getKeepTables(options?: {
  deleteCategories?: boolean;
  deleteQualificationTypes?: boolean;
}) {
  const keepTables = new Set<string>(DEFAULT_KEEP_TABLES);

  if (options?.deleteCategories) {
    keepTables.delete("InventoryCategory");
  }

  if (options?.deleteQualificationTypes) {
    keepTables.delete("EmployeeQualificationType");
  }

  return keepTables;
}

function getTables(db: Database) {
  return db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => String((row as { name: string }).name));
}

function getTableCount(db: Database, table: string) {
  const result = db
    .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`)
    .get() as { count: number };

  return Number(result.count ?? 0);
}

function readPreview(db: Database, keepTables: Set<string>) {
  const tables = getTables(db);
  const tableInfos = tables.map((name) => ({
    count: getTableCount(db, name),
    name,
  }));

  return {
    keptTables: tableInfos.filter((table) => keepTables.has(table.name)),
    tablesToClear: tableInfos.filter((table) => !keepTables.has(table.name)),
  };
}

export function getResetPreview(options?: {
  deleteCategories?: boolean;
  deleteQualificationTypes?: boolean;
}): ResetPreview {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    throw new Error(`Datenbank nicht gefunden: ${dbPath}`);
  }

  const db = new Database(dbPath, {
    readonly: true,
  });

  try {
    const preview = readPreview(db, getKeepTables(options));

    return {
      dbPath,
      keptTables: preview.keptTables,
      tablesToClear: preview.tablesToClear,
      uploadDirectories: getUploadDirectories(),
    };
  } finally {
    db.close();
  }
}

export function createDatabaseBackup() {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    throw new Error(`Datenbank nicht gefunden: ${dbPath}`);
  }

  const backupDir = getBackupDir();
  mkdirSync(backupDir, {
    recursive: true,
  });

  const backupPath = path.join(backupDir, `dev-${timestamp()}-backup.db`);
  copyFileSync(dbPath, backupPath);

  return {
    backupPath,
    dbPath,
  };
}

function collectDirectoryEntries(directory: string, baseDirectory: string) {
  if (!existsSync(directory)) {
    return [];
  }

  const entries: {
    bytes: Uint8Array;
    fileName: string;
  }[] = [];

  for (const entry of readdirSync(directory)) {
    const absolutePath = path.join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      entries.push(...collectDirectoryEntries(absolutePath, baseDirectory));
      continue;
    }

    if (!stats.isFile()) {
      continue;
    }

    entries.push({
      bytes: readFileSync(absolutePath),
      fileName: path
        .relative(baseDirectory, absolutePath)
        .split(path.sep)
        .join("/"),
    });
  }

  return entries;
}

export function createFullBackupArchive(): FullBackupArchive {
  const { backupPath } = createDatabaseBackup();
  const appRoot = getAppRoot();
  const fileName = `stix-dashboard-backup-${timestamp()}.zip`;
  const uploadEntries = getUploadDirectories().flatMap((directory) =>
    collectDirectoryEntries(directory, appRoot),
  );
  const zipEntries = [
    {
      bytes: readFileSync(backupPath),
      fileName: `database/${path.basename(backupPath)}`,
    },
    {
      bytes: Buffer.from(
        [
          "STIX Dashboard Backup",
          "",
          `Erstellt am: ${new Date().toLocaleString("de-DE")}`,
          `Datenbank-Sicherung: database/${path.basename(backupPath)}`,
          "",
          "Enthalten sind die aktuelle SQLite-Datenbank sowie vorhandene Upload-/Exportdateien aus public/uploads und public/exports.",
        ].join("\n"),
        "utf8",
      ),
      fileName: "README.txt",
    },
    ...uploadEntries,
  ];

  return {
    bytes: createZipArchive(zipEntries),
    fileName,
    savedDbBackupPath: backupPath,
  };
}

export function resetDashboardData(options?: {
  deleteCategories?: boolean;
  deleteQualificationTypes?: boolean;
  deleteUploads?: boolean;
}): ResetResult {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    throw new Error(`Datenbank nicht gefunden: ${dbPath}`);
  }

  const { backupPath } = createDatabaseBackup();
  const keepTables = getKeepTables(options);
  const db = new Database(dbPath);

  try {
    const preview = readPreview(db, keepTables);
    const tablesToClear = preview.tablesToClear.map((table) => table.name);
    const deletedRows = preview.tablesToClear.reduce(
      (sum, table) => sum + table.count,
      0,
    );
    const hasSqliteSequence = Boolean(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'",
        )
        .get(),
    );

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

    const uploadsCleared: string[] = [];

    if (options?.deleteUploads) {
      for (const directory of getUploadDirectories()) {
        if (!existsSync(directory)) {
          continue;
        }

        rmSync(directory, {
          force: true,
          recursive: true,
        });
        mkdirSync(directory, {
          recursive: true,
        });
        uploadsCleared.push(directory);
      }
    }

    return {
      backupPath,
      dbPath,
      deletedRows,
      keptTables: preview.keptTables,
      tablesToClear: preview.tablesToClear,
      uploadDirectories: getUploadDirectories(),
      uploadsCleared,
    };
  } finally {
    db.close();
  }
}

export function cleanupLegacyMasterData(): LegacyMasterDataCleanupResult {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    throw new Error(`Datenbank nicht gefunden: ${dbPath}`);
  }

  const legacyTables = ["MaterialType", "AsphaltMixType", "ConcreteType"];
  const { backupPath } = createDatabaseBackup();
  const db = new Database(dbPath);

  try {
    const availableTables = new Set(getTables(db));
    const tablesCleared = legacyTables
      .filter((table) => availableTables.has(table))
      .map((name) => ({
        count: getTableCount(db, name),
        name,
      }));
    const deletedRows = tablesCleared.reduce(
      (sum, table) => sum + table.count,
      0,
    );
    const hasSqliteSequence = Boolean(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'",
        )
        .get(),
    );

    db.pragma("foreign_keys = OFF");

    const cleanupTransaction = db.transaction(() => {
      for (const table of tablesCleared) {
        db.prepare(`DELETE FROM ${quoteIdentifier(table.name)}`).run();
      }

      if (hasSqliteSequence) {
        for (const table of tablesCleared) {
          db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(
            table.name,
          );
        }
      }
    });

    cleanupTransaction();
    db.pragma("foreign_keys = ON");
    db.exec("VACUUM");

    return {
      backupPath,
      deletedRows,
      tablesCleared,
    };
  } finally {
    db.close();
  }
}
