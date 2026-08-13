import {
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type MaintenanceTableInfo = {
  count: number;
  name: string;
};

export type ResetPreview = {
  keptTables: MaintenanceTableInfo[];
  tablesToClear: MaintenanceTableInfo[];
  uploadDirectories: string[];
};

export type ResetResult = ResetPreview & {
  deletedRows: number;
  uploadsCleared: string[];
};

export type LegacyMasterDataCleanupResult = {
  deletedRows: number;
  tablesCleared: MaintenanceTableInfo[];
};

// Muss mit den Modellnamen in prisma/schema.prisma übereinstimmen (kein
// @@map dort verwendet, daher entspricht der Postgres-Tabellenname 1:1 dem
// Modellnamen).
const ALL_MODEL_TABLES = [
  "CompanyInfo",
  "TimeTrackingSettings",
  "DispositionCategoryCredit",
  "Project",
  "ProjectNote",
  "ProjectRequirementItem",
  "ProjectWeatherLog",
  "ProjectDailyReport",
  "ProjectPhoto",
  "ProjectDailyReportPhoto",
  "ProjectDocumentFolder",
  "ProjectDocument",
  "ProjectFormTemplate",
  "ProjectFormSubmission",
  "Driver",
  "Vehicle",
  "WorkshopRepairOrder",
  "WorkshopFormTemplate",
  "WorkshopFormSubmission",
  "DriverVehicleAssignment",
  "MaterialType",
  "AsphaltMixType",
  "ConcreteType",
  "AdminOption",
  "AsphaltDispatchEntry",
  "TruckLongHaulEntry",
  "TruckLongHaulTruckAssignment",
  "ShortHaulAssignment",
  "ShortHaulTour",
  "SpecialVehicleTask",
  "SpecialVehicleDispatchAssignment",
  "AsphaltLoadAllocation",
  "TackCoatLoadAllocation",
  "Employee",
  "User",
  "UserProjectAccess",
  "UserFeatureAccess",
  "Session",
  "Account",
  "Verification",
  "DashboardWidgetPreference",
  "EmployeeDispositionEntry",
  "Notification",
  "LeaveRequest",
  "DispositionDayOff",
  "InventoryInitialTest",
  "EmployeePositionAssignment",
  "EmployeeQualificationType",
  "EmployeeQualification",
  "EmployeeQualificationDocument",
  "EmployeeTrainingType",
  "EmployeeTrainingRecord",
  "EmployeeTrainingRecordDocument",
  "WorkTimePreset",
  "WorkTimeDayType",
  "WorkTimeCalendar",
  "WorkTimeCalendarDay",
  "WorkTimeCalendarAssignment",
  "CrewTimeEntry",
  "CrewTimeEmployee",
  "CrewTimeEntryRevision",
  "CrewTeamPreference",
  "CrewTeamPreferenceMember",
  "CrewTimeActivity",
  "Crew",
  "CrewMember",
  "CrewDefaultVehicle",
  "EquipmentDispatchAssignment",
  "CrewPlanningRow",
  "CrewPlanningAssignment",
  "CrewPlanningAssignmentEmployee",
  "CrewPlanningAssignmentVehicle",
  "InventoryCategory",
  "InventoryItem",
  "InventoryItemEmployeeAssignment",
  "InventoryPersonalAssignment",
  "InventoryIdlePeriod",
  "InventoryPhoto",
  "InventoryDocument",
  "InventoryContact",
  "InventoryUsageHistory",
  "InventoryScanLog",
  "InventoryLocationAlert",
  "InventoryLabelTemplate",
  "ControllingPerformanceReport",
  "ControllingDetailEntry",
  "ControllingHourEntry",
  "ControllingInvoiceItem",
  "ControllingEmployeeGroupRate",
  "ControllingRateSet",
  "ControllingInventoryCategoryRate",
  "ControllingInventoryItemRate",
  "ControllingEmployeeRate",
  "ControllingRateChangeLog",
  "SafetyAccidentReport",
  "SafetyAccidentOfficer",
  "SafetyAccidentNotification",
  "SafetyAccidentPhoto",
  "SafetyFormTemplate",
  "SafetyInstructionTemplate",
  "SafetyTemplateFolder",
  "SafetyInstructionRecord",
  "SafetyInstructionSignature",
  "SafetyHazardousSubstance",
  "SafetyHazardRule",
  "ProjectStartChecklist",
  "ProjectStartChecklistParticipant",
  "GeneralRiskAssessment",
  "GeneralRiskAssessmentParticipant",
  "SafetyDataSheet",
  "PortalPermission",
  "PortalRole",
  "ImportProgress",
] as const;

const BASE_KEEP_TABLES = [
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

function getUploadDirectories() {
  const appRoot = getAppRoot();

  return UPLOAD_DIRECTORY_PARTS.map((parts) => path.resolve(appRoot, ...parts));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
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

async function getTableCount(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`,
  );

  return Number(rows[0]?.count ?? 0);
}

async function readTableCounts(tables: readonly string[]) {
  return Promise.all(
    tables.map(async (name) => ({
      count: await getTableCount(name),
      name,
    })),
  );
}

export async function getResetPreview(options?: {
  deleteCategories?: boolean;
  deleteQualificationTypes?: boolean;
}): Promise<ResetPreview> {
  const keepTables = getKeepTables(options);
  const tableInfos = await readTableCounts(ALL_MODEL_TABLES);

  return {
    keptTables: tableInfos.filter((table) => keepTables.has(table.name)),
    tablesToClear: tableInfos.filter((table) => !keepTables.has(table.name)),
    uploadDirectories: getUploadDirectories(),
  };
}

export async function resetDashboardData(options?: {
  deleteCategories?: boolean;
  deleteQualificationTypes?: boolean;
  deleteUploads?: boolean;
}): Promise<ResetResult> {
  const keepTables = getKeepTables(options);
  const tableInfos = await readTableCounts(ALL_MODEL_TABLES);
  const keptTables = tableInfos.filter((table) => keepTables.has(table.name));
  const tablesToClear = tableInfos.filter(
    (table) => !keepTables.has(table.name),
  );
  const deletedRows = tablesToClear.reduce(
    (sum, table) => sum + table.count,
    0,
  );

  if (tablesToClear.length > 0) {
    const identifiers = tablesToClear
      .map((table) => quoteIdentifier(table.name))
      .join(", ");

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`,
    );
  }

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
    deletedRows,
    keptTables,
    tablesToClear,
    uploadDirectories: getUploadDirectories(),
    uploadsCleared,
  };
}

export async function cleanupLegacyMasterData(): Promise<LegacyMasterDataCleanupResult> {
  const legacyTables = ["MaterialType", "AsphaltMixType", "ConcreteType"];
  const tablesCleared = await readTableCounts(legacyTables);
  const deletedRows = tablesCleared.reduce(
    (sum, table) => sum + table.count,
    0,
  );

  if (tablesCleared.length > 0) {
    const identifiers = tablesCleared
      .map((table) => quoteIdentifier(table.name))
      .join(", ");

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`,
    );
  }

  return {
    deletedRows,
    tablesCleared,
  };
}
