#!/usr/bin/env node

import Database from "better-sqlite3";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(appRoot, "dev.db");
const backupDir = path.join(appRoot, "backups");
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = path.join(backupDir, `before-inventory-test-seed-${stamp}.db`);
copyFileSync(dbPath, backupPath);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const currentCount = db.prepare("SELECT COUNT(*) AS count FROM InventoryItem").get().count;
if (currentCount > 0) {
  throw new Error(
    `Inventar enthält bereits ${currentCount} Objekte. Bitte zuerst über „Inventar löschen“ leeren.`,
  );
}

const categories = db
  .prepare(`
    SELECT c.*, p.name AS parentName,
      p.useInSpecialVehicleDisposition AS parentSpecial,
      p.useInTeamManagement AS parentTeamManagement,
      p.asphaltDispositionUsage AS parentAsphaltUsage
    FROM InventoryCategory c
    LEFT JOIN InventoryCategory p ON p.id = c.parentCategoryId
    WHERE c.isActive = 1
      AND NOT EXISTS (
        SELECT 1 FROM InventoryCategory ch
        WHERE ch.parentCategoryId = c.id AND ch.isActive = 1
      )
    ORDER BY COALESCE(p.name, c.name), c.sortOrder, c.name
  `)
  .all();
const employees = db
  .prepare(`
    SELECT e.id, e.firstName, e.lastName, e.driverId, e.departmentLabel,
      GROUP_CONCAT(DISTINCT p.positionLabel) AS positionLabels
    FROM Employee e
    LEFT JOIN EmployeePositionAssignment p ON p.employeeId = e.id
    WHERE e.statusValue IS NULL OR e.statusValue NOT IN ('left', 'ausgeschieden')
    GROUP BY e.id
    ORDER BY e.lastName, e.firstName
  `)
  .all();

if (employees.length === 0) {
  throw new Error("Keine aktiven Mitarbeiter für Testzuordnungen vorhanden.");
}

const insertItem = db.prepare(`
  INSERT INTO InventoryItem (
    id, name, categoryId, manufacturer, model, serialNumber, licensePlate,
    stixId, objectNumber, inventoryNumber, sourceType, sourceId,
    constructionYear, axleCount, grossWeightKg, payloadKg, driveType,
    attachmentType, isContainer, isStockManaged, stockUnit, openingStock,
    currentStock, responsibleType, responsibleEmployeeId, vehicleId,
    billingRateCents, idleBillingRateCents, notes, status,
    lastServiceAtDate, lastServiceOperatingHours, lastServiceMileageKm,
    nextServiceAtDate, nextServiceOperatingHours, nextServiceMileageKm,
    lastDguvInspectionDate, nextDguvInspectionDate,
    lastTuvInspectionDate, nextTuvInspectionDate,
    lastTachographInspectionDate, nextTachographInspectionDate,
    lastSafetyInspectionDate, nextSafetyInspectionDate,
    lastAdrInspectionDate, nextAdrInspectionDate,
    createdAt, updatedAt
  ) VALUES (
    @id, @name, @categoryId, @manufacturer, @model, @serialNumber, @licensePlate,
    @stixId, @objectNumber, @inventoryNumber, @sourceType, @sourceId,
    @constructionYear, @axleCount, @grossWeightKg, @payloadKg, @driveType,
    @attachmentType, @isContainer, @isStockManaged, @stockUnit, @openingStock,
    @currentStock, @responsibleType, @responsibleEmployeeId, @vehicleId,
    @billingRateCents, @idleBillingRateCents, @notes, 'ACTIVE',
    @lastServiceAtDate, @lastServiceOperatingHours, @lastServiceMileageKm,
    @nextServiceAtDate, @nextServiceOperatingHours, @nextServiceMileageKm,
    @lastDguvInspectionDate, @nextDguvInspectionDate,
    @lastTuvInspectionDate, @nextTuvInspectionDate,
    @lastTachographInspectionDate, @nextTachographInspectionDate,
    @lastSafetyInspectionDate, @nextSafetyInspectionDate,
    @lastAdrInspectionDate, @nextAdrInspectionDate,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
`);
const insertVehicle = db.prepare(`
  INSERT INTO Vehicle (
    id, vehicleNumber, licensePlate, vehicleType, category,
    isSpecialVehicle, isActive, notes, asphaltPayloadTons,
    tackCoatTankLiters, createdAt, updatedAt
  ) VALUES (
    @id, @vehicleNumber, @licensePlate, @vehicleType, @category,
    @isSpecialVehicle, 1, @notes, @asphaltPayloadTons,
    @tackCoatTankLiters, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
`);
const insertEmployeeAssignment = db.prepare(`
  INSERT OR IGNORE INTO InventoryItemEmployeeAssignment
    (id, itemId, employeeId, createdAt)
  VALUES (@id, @itemId, @employeeId, CURRENT_TIMESTAMP)
`);
const insertDriverVehicle = db.prepare(`
  INSERT OR IGNORE INTO DriverVehicleAssignment
    (id, driverId, vehicleId, isPrimary, isActive, createdAt, updatedAt)
  VALUES (@id, @driverId, @vehicleId, @isPrimary, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);
const insertMaterial = db.prepare(`
  INSERT INTO MaterialType
    (id, materialNumber, name, category, unit, isActive, notes, createdAt, updatedAt)
  VALUES (@id, @number, @name, 'Anspritzmittel', @unit, 1, @notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);
const insertAsphalt = db.prepare(`
  INSERT INTO AsphaltMixType
    (id, mixNumber, name, shortName, unit, category, isActive, notes, createdAt, updatedAt)
  VALUES (@id, @number, @name, @shortName, @unit, @category, 1, @notes, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`);
const updateCategory = db.prepare(
  "UPDATE InventoryCategory SET nextObjectNumber = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
);

const manufacturers = ["Volvo", "Mercedes-Benz", "MAN", "Caterpillar", "Liebherr", "Wacker Neuson", "Bomag", "Hamm", "Hitachi", "Kärcher"];
const specialNames = [
  "Anspritzmaschine",
  "Kehrmaschine",
  "Tieflader",
  "Bankettfertiger",
  "Kanalspülwagen",
  "Saugbagger",
  "Wasserwagen",
  "Winterdienstfahrzeug",
  "Werkstattwagen",
  "Tankfahrzeug",
];
const asphaltNames = {
  Anspritzmittel: ["C40 B5-S", "C60 BP1-S", "C60 B4-S", "C69 BP4-S", "Bitumenemulsion 40", "Bitumenemulsion 60", "Haftkleber Standard", "Haftkleber Polymer", "Anspritzmittel Sommer", "Anspritzmittel Winter"],
  Tragschichten: ["AC 32 T S", "AC 32 T N", "AC 22 T S", "AC 22 T N", "AC 16 T S", "AC 16 T N", "AC 11 T S", "AC 11 T N", "ATS 0/32", "ATS 0/22"],
  Tragdeckschichten: ["AC 16 TD", "AC 11 TD", "AC 8 TD", "AC 16 TD RC", "AC 11 TD RC", "Tragdeckschicht 0/16", "Tragdeckschicht 0/11", "Tragdeckschicht 0/8", "TDS Standard", "TDS Sondermischung"],
  Binder: ["AC 22 B S", "AC 22 B N", "AC 16 B S", "AC 16 B N", "AC 11 B S", "AC 11 B N", "Binder 0/22", "Binder 0/16", "Binder RC", "Binder hochstandfest"],
  Splittmastix: ["SMA 11 S", "SMA 11 N", "SMA 8 S", "SMA 8 N", "SMA 5 S", "SMA 5 N", "SMA LA 8", "SMA LA 11", "SMA 8 PMB", "SMA 11 PMB"],
  Deckschichten: ["AC 11 D S", "AC 11 D N", "AC 8 D S", "AC 8 D N", "AC 5 D L", "AC 5 D N", "DSH-V 5", "DSH-V 8", "Deckschicht PMB", "Deckschicht lärmarm"],
};

const employeeSearchText = (employee) =>
  `${employee.departmentLabel ?? ""} ${employee.positionLabels ?? ""}`.toLowerCase();
const truckDrivers = employees.filter((employee) =>
  employeeSearchText(employee).includes("lkw fahrer"),
);
const machineOperators = employees.filter((employee) =>
  employeeSearchText(employee).includes("maschinist"),
);
const officeEmployees = employees.filter((employee) =>
  employeeSearchText(employee).includes("büro"),
);

if (truckDrivers.length === 0 || machineOperators.length === 0 || officeEmployees.length === 0) {
  throw new Error(
    "Für realistische Testzuordnungen werden LKW-Fahrer, Maschinisten und Büro-Mitarbeiter benötigt.",
  );
}

function assignmentPool(categoryName) {
  if (categoryName.startsWith("LKW ")) return truckDrivers;
  if (categoryName === "PKW") return officeEmployees;
  if (categoryName.toLowerCase().includes("sonderfahr")) return machineOperators;
  return [];
}

function allowsTeamAssignment(category) {
  return Boolean(category.useInTeamManagement || category.parentTeamManagement);
}

function isMaterialCategory(category) {
  const text = `${category.parentName ?? ""} ${category.name}`.toLowerCase();
  return (
    text.includes("material") ||
    text.includes("magazin") ||
    category.asphaltDispositionUsage !== "NONE"
  );
}

function isVehicleCategory(category) {
  const text = `${category.parentName ?? ""} ${category.name}`.toLowerCase();
  return (
    text.includes("fahrzeug") ||
    text.includes("lkw") ||
    text.includes("pkw") ||
    text.includes("anhänger") ||
    text.includes("baumaschinen") ||
    text.includes("mischanlage")
  );
}

function isSpecialCategory(category) {
  return Boolean(
    category.useInSpecialVehicleDisposition ||
      category.parentSpecial ||
      category.name.toLowerCase().includes("sonderfahr"),
  );
}

function itemName(category, index) {
  if (asphaltNames[category.name]) return asphaltNames[category.name][index];
  if (isSpecialCategory(category)) return specialNames[index];
  return `${category.name} ${String(index + 1).padStart(2, "0")}`;
}

const seed = db.transaction(() => {
  let createdItems = 0;
  let createdVehicles = 0;
  let createdMaterials = 0;

  for (const [categoryIndex, category] of categories.entries()) {
    if (category.objectNumberStart == null || category.objectNumberEnd == null) {
      throw new Error(`Kategorie „${category.name}“ hat keinen Nummernkreis.`);
    }
    if (category.objectNumberStart + 9 > category.objectNumberEnd) {
      throw new Error(`Nummernkreis von „${category.name}“ ist für zehn Testobjekte zu klein.`);
    }

    const materialCategory = isMaterialCategory(category);
    const vehicleCategory = isVehicleCategory(category);
    const specialCategory = isSpecialCategory(category);

    for (let index = 0; index < 10; index += 1) {
      const number = String(category.objectNumberStart + index).padStart(6, "0");
      const id = `seed-item-${category.id}-${index}`;
      const name = itemName(category, index);
      const teamAssignable = allowsTeamAssignment(category);
      const isAssignableMachine = teamAssignable && category.parentName === "Baumaschinen";
      const employeePool = isAssignableMachine
        ? machineOperators
        : assignmentPool(category.name);
      const primaryEmployee =
        employeePool.length > 0 ? employeePool[(categoryIndex * 3 + index) % employeePool.length] : null;
      const additionalEmployee =
        teamAssignable &&
        category.name.startsWith("LKW ") &&
        employeePool.length > 1
          ? employeePool[(categoryIndex * 3 + index + 1) % employeePool.length]
          : null;
      const manufacturer = materialCategory ? null : manufacturers[(categoryIndex + index) % manufacturers.length];
      const isLkw = category.name.toLowerCase().includes("lkw");
      const isPkw = category.name.toLowerCase() === "pkw";
      const isTrailer = category.name.toLowerCase().includes("anhänger");
      const vehicleId = vehicleCategory ? `seed-vehicle-${category.id}-${index}` : null;
      const licensePlate = vehicleCategory
        ? `MIL-${isTrailer ? "AN" : isLkw ? "LK" : isPkw ? "PK" : "BA"} ${String(categoryIndex * 10 + index + 1).padStart(3, "0")}`
        : null;
      const stockUnit =
        category.asphaltDispositionUsage === "TACK_COAT"
          ? "l"
          : category.asphaltDispositionUsage === "ASPHALT_MIX"
            ? "t"
            : materialCategory
              ? "Stk."
              : "Stk.";
      let sourceType = null;
      let sourceId = null;

      if (category.asphaltDispositionUsage === "TACK_COAT") {
        sourceType = "MATERIAL";
        sourceId = `seed-material-${category.id}-${index}`;
        insertMaterial.run({
          id: sourceId,
          name,
          notes: "Automatisch aus Inventar-Testdaten erzeugt.",
          number,
          unit: stockUnit,
        });
        createdMaterials += 1;
      } else if (category.asphaltDispositionUsage === "ASPHALT_MIX") {
        sourceType = "ASPHALT_MIX";
        sourceId = `seed-asphalt-${category.id}-${index}`;
        insertAsphalt.run({
          category: category.name,
          id: sourceId,
          name,
          notes: "Automatisch aus Inventar-Testdaten erzeugt.",
          number,
          shortName: name,
          unit: stockUnit,
        });
        createdMaterials += 1;
      }

      if (vehicleId) {
        insertVehicle.run({
          asphaltPayloadTons: isLkw ? 10 + (index % 4) * 4 : 0,
          category: category.name,
          id: vehicleId,
          isSpecialVehicle: specialCategory ? 1 : 0,
          licensePlate,
          notes: `Inventarobjekt ${number} · automatisch erzeugte Testdaten`,
          tackCoatTankLiters: specialCategory && index === 0 ? 8000 : 0,
          vehicleNumber: number,
          vehicleType: name,
        });
        createdVehicles += 1;

        if (primaryEmployee?.driverId) {
          insertDriverVehicle.run({
            driverId: primaryEmployee.driverId,
            id: `seed-driver-vehicle-${category.id}-${index}`,
            isPrimary: 1,
            vehicleId,
          });
        }
      }

      const year = 2016 + (index % 10);
      insertItem.run({
        attachmentType:
          category.name.toLowerCase().includes("bagger") ? "OQ 70/55" : null,
        axleCount: isLkw ? Number(category.name.match(/\d/)?.[0] ?? 3) : isTrailer ? 2 : isPkw ? 2 : null,
        billingRateCents: materialCategory ? 0 : 3500 + index * 250,
        categoryId: category.id,
        constructionYear: year,
        driveType: category.name.toLowerCase().includes("kette") ? "TRACK" : vehicleCategory ? "WHEEL" : null,
        grossWeightKg: isLkw ? 18000 + index * 1000 : isPkw ? 3500 : isTrailer ? 12000 : null,
        id,
        idleBillingRateCents: materialCategory ? 0 : 1200 + index * 100,
        inventoryNumber: `INV-${number}`,
        isContainer: category.name.toLowerCase().includes("bagger") && index < 3 ? 1 : 0,
        isStockManaged: materialCategory ? 1 : 0,
        lastAdrInspectionDate: isLkw ? `2026-02-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        lastDguvInspectionDate: `2026-01-${String((index % 20) + 1).padStart(2, "0")} 00:00:00`,
        lastSafetyInspectionDate: isLkw ? `2026-03-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        lastServiceAtDate: `2026-04-${String((index % 20) + 1).padStart(2, "0")} 00:00:00`,
        lastServiceMileageKm: vehicleCategory ? 25000 + index * 3500 : null,
        lastServiceOperatingHours: vehicleCategory ? 1200 + index * 175 : 300 + index * 50,
        lastTachographInspectionDate: isLkw ? `2026-02-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        lastTuvInspectionDate: vehicleCategory ? `2026-01-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        licensePlate,
        manufacturer,
        model: materialCategory ? null : `${category.name}-${100 + index}`,
        name,
        nextAdrInspectionDate: isLkw ? `2027-02-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        nextDguvInspectionDate: `2027-01-${String((index % 20) + 1).padStart(2, "0")} 00:00:00`,
        nextSafetyInspectionDate: isLkw ? `2027-03-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        nextServiceAtDate: `2027-04-${String((index % 20) + 1).padStart(2, "0")} 00:00:00`,
        nextServiceMileageKm: vehicleCategory ? 40000 + index * 3500 : null,
        nextServiceOperatingHours: vehicleCategory ? 1500 + index * 175 : 500 + index * 50,
        nextTachographInspectionDate: isLkw ? `2027-02-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        nextTuvInspectionDate: vehicleCategory ? `2027-01-${String((index % 20) + 1).padStart(2, "0")} 00:00:00` : null,
        notes: `Automatisch erzeugtes Testobjekt für ${category.parentName ? `${category.parentName} / ` : ""}${category.name}.`,
        objectNumber: number,
        openingStock: materialCategory ? 100 + index * 25 : null,
        payloadKg: isLkw ? (10 + (index % 4) * 4) * 1000 : isTrailer ? 8000 + index * 500 : null,
        responsibleEmployeeId: primaryEmployee?.id ?? null,
        responsibleType:
          teamAssignable && primaryEmployee
          ? "EMPLOYEE"
          : null,
        serialNumber: `SN-${number}-${year}`,
        sourceId,
        sourceType,
        stixId: `STIX-${number}`,
        stockUnit,
        currentStock: materialCategory ? 100 + index * 25 : null,
        vehicleId,
      });
      createdItems += 1;

      if (
        additionalEmployee &&
        primaryEmployee &&
        additionalEmployee.id !== primaryEmployee.id
      ) {
        insertEmployeeAssignment.run({
          employeeId: additionalEmployee.id,
          id: `seed-item-employee-${category.id}-${index}`,
          itemId: id,
        });
        if (vehicleId && additionalEmployee.driverId) {
          insertDriverVehicle.run({
            driverId: additionalEmployee.driverId,
            id: `seed-driver-vehicle-additional-${category.id}-${index}`,
            isPrimary: 0,
            vehicleId,
          });
        }
      }
    }

    updateCategory.run(category.objectNumberStart + 10, category.id);
  }

  return { createdItems, createdMaterials, createdVehicles };
});

try {
  const result = seed();
  console.log(JSON.stringify({ backupPath, ...result }, null, 2));
} finally {
  db.close();
}
