"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

type ImportType =
  | "employees"
  | "drivers"
  | "vehicles"
  | "materials"
  | "asphalt-types"
  | "tack-coat-types"
  | "concrete-types"
  | "options";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
};

type ExcelRow = Record<string, unknown>;

const LKW_DRIVER_POSITION_VALUE = "lkw_fahrer_in";
const TACK_COAT_CATEGORY = "Anspritzmittel";

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]/g, "");
}

function getRawCell(row: ExcelRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeHeader(key))) {
      return value;
    }
  }

  return "";
}

function getCell(row: ExcelRow, aliases: string[]) {
  const value = getRawCell(row, aliases);
  return String(value ?? "").trim();
}

function getOptional(row: ExcelRow, aliases: string[]) {
  const value = getCell(row, aliases);
  return value.length > 0 ? value : null;
}

function getBoolean(row: ExcelRow, aliases: string[]) {
  const value = getCell(row, aliases).toLowerCase();

  return ["ja", "yes", "true", "1", "x", "aktiv"].includes(value);
}

function getOptionalBoolean(row: ExcelRow, aliases: string[]) {
  const value = getCell(row, aliases).toLowerCase();

  if (!value) {
    return null;
  }

  if (["ja", "yes", "true", "1", "x", "aktiv"].includes(value)) {
    return true;
  }

  if (["nein", "no", "false", "0", "inaktiv"].includes(value)) {
    return false;
  }

  return null;
}

function getOptionalNumber(row: ExcelRow, aliases: string[]) {
  const value = getCell(row, aliases).replace(",", ".");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 0) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0],
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll("*", "")
    .replaceAll("/", "_")
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseExcelDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    );
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      return null;
    }

    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const raw = text(value);

  if (!raw) {
    return null;
  }

  const germanMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);

  if (germanMatch) {
    const day = Number(germanMatch[1]);
    const month = Number(germanMatch[2]);
    const year = Number(germanMatch[3]);

    return new Date(Date.UTC(year, month - 1, day));
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    return new Date(Date.UTC(year, month - 1, day));
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );
}

function splitPositions(value: unknown) {
  const raw = text(value);

  if (!raw) {
    return [];
  }

  return raw
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapKnownStatus(value: string) {
  const normalized = value.toLowerCase();

  if (["aktiv", "active", "ja", "beschäftigt", "beschaeftigt"].includes(normalized)) {
    return "active";
  }

  if (["inaktiv", "inactive", "pausiert"].includes(normalized)) {
    return "inactive";
  }

  if (["ausgetreten", "left", "austritt"].includes(normalized)) {
    return "left";
  }

  return null;
}

function mapKnownGender(value: string) {
  const normalized = value.toLowerCase();

  if (["m", "mann", "männlich", "maennlich", "male"].includes(normalized)) {
    return "male";
  }

  if (["w", "frau", "weiblich", "female"].includes(normalized)) {
    return "female";
  }

  if (["divers", "d", "diverse"].includes(normalized)) {
    return "diverse";
  }

  if (["keine angabe", "ohne angabe", "nicht angegeben"].includes(normalized)) {
    return "not_specified";
  }

  return null;
}

function mapKnownPosition(value: string) {
  const normalized = value
    .toLowerCase()
    .replaceAll("*", "")
    .replaceAll("-", " ")
    .replaceAll("/", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    [
      "lkw fahrer",
      "lkw fahrerin",
      "lkw fahrer in",
      "lkw fahrer in",
      "lkwfahrer",
      "lkwfahrerin",
    ].includes(normalized)
  ) {
    return LKW_DRIVER_POSITION_VALUE;
  }

  return null;
}

async function readExcelRows(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("Die Excel-Datei enthält kein Tabellenblatt.");
  }

  const worksheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
    defval: "",
  });

  return rows;
}

async function getNextSortOrder(groupKey: string) {
  const last = await prisma.adminOption.findFirst({
    where: {
      groupKey,
    },
    orderBy: {
      sortOrder: "desc",
    },
  });

  return (last?.sortOrder ?? 0) + 10;
}

async function resolveOption({
  groupKey,
  input,
  fallbackValue,
}: {
  groupKey: string;
  input: unknown;
  fallbackValue?: string | null;
}) {
  const label = text(input);

  if (!label) {
    return {
      value: null,
      label: null,
    };
  }

  const mappedValue =
    fallbackValue ??
    (groupKey === "employee_status" ? mapKnownStatus(label) : null) ??
    (groupKey === "employee_gender" ? mapKnownGender(label) : null) ??
    (groupKey === "employee_position" ? mapKnownPosition(label) : null);

  const existingOptions = await prisma.adminOption.findMany({
    where: {
      groupKey,
    },
  });

  const normalizedLabel = label.toLowerCase();

  const existing = existingOptions.find((option) => {
    return (
      option.value.toLowerCase() === normalizedLabel ||
      option.label.toLowerCase() === normalizedLabel ||
      (mappedValue ? option.value === mappedValue : false)
    );
  });

  if (existing) {
    return {
      value: existing.value,
      label: existing.label,
    };
  }

  const value = mappedValue ?? slugify(label);
  const sortOrder = await getNextSortOrder(groupKey);

  const option = await prisma.adminOption.upsert({
    where: {
      groupKey_value: {
        groupKey,
        value,
      },
    },
    update: {
      label,
      isActive: true,
    },
    create: {
      groupKey,
      value,
      label,
      sortOrder,
      isActive: true,
    },
  });

  return {
    value: option.value,
    label: option.label,
  };
}

async function resolvePositions(value: unknown) {
  const rawPositions = splitPositions(value);
  const result: {
    positionValue: string;
    positionLabel: string;
    sortOrder: number;
  }[] = [];

  for (const [index, rawPosition] of rawPositions.entries()) {
    const resolved = await resolveOption({
      groupKey: "employee_position",
      input: rawPosition,
    });

    if (resolved.value && resolved.label) {
      result.push({
        positionValue: resolved.value,
        positionLabel: resolved.label,
        sortOrder: index,
      });
    }
  }

  return result;
}

function isActiveEmployee(statusValue: string) {
  return statusValue === "active";
}

async function syncDriverForEmployee({
  tx,
  employeeId,
  driverId,
  firstName,
  lastName,
  phone,
  statusValue,
  positions,
}: {
  tx: Prisma.TransactionClient;
  employeeId: string;
  driverId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  statusValue: string;
  positions: {
    positionValue: string;
    positionLabel: string;
    sortOrder: number;
  }[];
}) {
  const hasLkwDriverPosition = positions.some(
    (position) => position.positionValue === LKW_DRIVER_POSITION_VALUE
  );

  const shouldBeActiveDriver =
    hasLkwDriverPosition && isActiveEmployee(statusValue);

  if (!hasLkwDriverPosition) {
    if (driverId) {
      await tx.driver.update({
        where: {
          id: driverId,
        },
        data: {
          isActive: false,
          notes:
            "Automatisch deaktiviert, weil Mitarbeiter nicht mehr als LKW Fahrer*in geführt wird.",
        },
      });
    }

    return null;
  }

  if (driverId) {
    await tx.driver.update({
      where: {
        id: driverId,
      },
      data: {
        firstName,
        lastName,
        phone,
        isActive: shouldBeActiveDriver,
        notes: "Automatisch aus Mitarbeiterimport synchronisiert.",
      },
    });

    return driverId;
  }

  const driver = await tx.driver.create({
    data: {
      firstName,
      lastName,
      phone,
      isActive: shouldBeActiveDriver,
      notes: "Automatisch aus Mitarbeiterimport erstellt.",
    },
  });

  await tx.employee.update({
    where: {
      id: employeeId,
    },
    data: {
      driverId: driver.id,
    },
  });

  return driver.id;
}

async function findExistingEmployee({
  firstName,
  lastName,
  birthDate,
  mobilePhone,
}: {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  mobilePhone: string | null;
}) {
  const orConditions = [];

  if (mobilePhone) {
    orConditions.push({
      mobilePhone,
    });
  }

  if (birthDate) {
    orConditions.push({
      firstName,
      lastName,
      birthDate,
    });
  }

  orConditions.push({
    firstName,
    lastName,
  });

  return prisma.employee.findFirst({
    where: {
      OR: orConditions,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function importEmployees(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const isCompletelyEmpty = Object.values(row).every((value) => !text(value));

    if (isCompletelyEmpty) {
      continue;
    }

    const firstName = getCell(row, ["Vorname", "firstName", "FirstName"]);
    const lastName = getCell(row, ["Nachname", "lastName", "LastName"]);

    if (!firstName || !lastName) {
      result.skipped++;
      continue;
    }

    const rawStatus = getCell(row, ["Status"]) || "Aktiv";

    const status = await resolveOption({
      groupKey: "employee_status",
      input: rawStatus,
      fallbackValue: mapKnownStatus(rawStatus),
    });

    const company = await resolveOption({
      groupKey: "employee_company",
      input:
        getCell(row, ["Firma", "Firmenzugehörigkeit", "Firmenzugehoerigkeit"]) ||
        "Stix",
    });

    const department = await resolveOption({
      groupKey: "employee_department",
      input: getCell(row, ["Abteilung"]),
    });

    const gender = await resolveOption({
      groupKey: "employee_gender",
      input: getCell(row, ["Geschlecht"]),
    });

    const positions = await resolvePositions(
      getCell(row, ["Berufsgruppen", "Berufsbezeichnung", "Berufgruppen"])
    );

    const entryDate = parseExcelDate(getRawCell(row, ["Eintritt"]));
    const exitDate = parseExcelDate(getRawCell(row, ["Austritt"]));
    const birthDate = parseExcelDate(getRawCell(row, ["Geburtsdatum"]));

    const mobilePhone =
      getOptional(row, ["Handynummer", "Mobil", "Telefon", "Handy"]) || null;

    const employeePayload = {
      statusValue: status.value ?? "active",
      statusLabel: status.label ?? "Aktiv",
      entryDate,
      exitDate,
      companyValue: company.value,
      companyLabel: company.label,
      departmentValue: department.value,
      departmentLabel: department.label,
      firstName,
      lastName,
      isLeadership: getBoolean(row, [
        "Leitung",
        "Fuehrungskraft",
        "Führungskraft",
        "Leiter",
        "Leiterin",
      ]),
      birthDate,
      genderValue: gender.value,
      genderLabel: gender.label,
      mobilePhone,
      emergencyPhone:
        getOptional(row, [
          "Notfallkontakt",
          "Notfallkontakt Handy",
          "Handynummer Notfallkontakt",
          "Handynummer notfallkontakt",
        ]) || null,
      street: getOptional(row, ["Straße", "Strasse"]),
      postalCode: getOptional(row, ["PLZ", "Postleitzahl"]),
      city: getOptional(row, ["Ort", "Stadt"]),
      notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
    };

    const existingEmployee = await findExistingEmployee({
      firstName,
      lastName,
      birthDate,
      mobilePhone,
    });

    await prisma.$transaction(async (tx) => {
      let employeeId: string;
      let driverId: string | null = null;

      if (existingEmployee) {
        await tx.employee.update({
          where: {
            id: existingEmployee.id,
          },
          data: employeePayload,
        });

        await tx.employeePositionAssignment.deleteMany({
          where: {
            employeeId: existingEmployee.id,
          },
        });

        if (positions.length > 0) {
          await tx.employeePositionAssignment.createMany({
            data: positions.map((position) => ({
              ...position,
              employeeId: existingEmployee.id,
            })),
          });
        }

        employeeId = existingEmployee.id;
        driverId = existingEmployee.driverId;
        result.updated++;
      } else {
        const employee = await tx.employee.create({
          data: {
            ...employeePayload,
            positions:
              positions.length > 0
                ? {
                    create: positions,
                  }
                : undefined,
          },
        });

        employeeId = employee.id;
        result.created++;
      }

      await syncDriverForEmployee({
        tx,
        employeeId,
        driverId,
        firstName,
        lastName,
        phone: mobilePhone,
        statusValue: employeePayload.statusValue,
        positions,
      });
    });
  }

  return result;
}

async function importDrivers(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    let firstName = getCell(row, ["Vorname", "First Name", "firstName"]);
    let lastName = getCell(row, ["Nachname", "Name", "Last Name", "lastName"]);

    const fullName = getCell(row, ["Fahrer", "Fahrername", "Mitarbeiter"]);

    if ((!firstName || !lastName) && fullName) {
      const split = splitFullName(fullName);
      firstName = firstName || split.firstName;
      lastName = lastName || split.lastName;
    }

    if (!firstName || !lastName) {
      result.skipped++;
      continue;
    }

    const shortcut = getOptional(row, ["Kürzel", "Kuerzel", "Shortcut"]);
    const normalizedShortcut = shortcut ? normalizeCode(shortcut) : null;

    if (normalizedShortcut) {
      const existing = await prisma.driver.findUnique({
        where: {
          shortcut: normalizedShortcut,
        },
      });

      if (existing) {
        await prisma.driver.update({
          where: {
            id: existing.id,
          },
          data: {
            firstName,
            lastName,
            phone: getOptional(row, ["Telefon", "Phone", "Handy"]),
            notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
          },
        });

        result.updated++;
        continue;
      }
    }

    await prisma.driver.create({
      data: {
        firstName,
        lastName,
        shortcut: normalizedShortcut,
        phone: getOptional(row, ["Telefon", "Phone", "Handy"]),
        notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
      },
    });

    result.created++;
  }

  return result;
}

async function importVehicles(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const vehicleNumber = getCell(row, [
      "Fahrzeugnummer",
      "Fahrzeugnr",
      "Nummer",
      "vehicleNumber",
    ]);

    if (!vehicleNumber) {
      result.skipped++;
      continue;
    }

    const licensePlate = getOptional(row, [
      "Kennzeichen",
      "LKW-Kennzeichen",
      "Nummernschild",
      "licensePlate",
    ]);

    const vehicleType =
      getCell(row, ["Fahrzeugtyp", "Typ", "vehicleType"]) || "LKW";

    const category =
      getCell(row, ["Kategorie", "Fahrzeugklasse", "category"]) || "Sonstiges";

    const existing = await prisma.vehicle.findUnique({
      where: {
        vehicleNumber,
      },
    });

    const asphaltPayloadTons = getOptionalNumber(row, [
      "Nutzlast",
      "Nutzlast t",
      "NutzlastT",
      "asphaltPayloadTons",
    ]);
    const tackCoatTankLiters = getOptionalNumber(row, [
      "Arbeitsmitteltank",
      "Arbeitsmitteltank l",
      "ArbeitsmitteltankLiter",
      "Tank",
      "Tank l",
      "tackCoatTankLiters",
    ]);
    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    if (existing) {
      await prisma.vehicle.update({
        where: {
          id: existing.id,
        },
        data: {
          licensePlate: licensePlate ? normalizeCode(licensePlate) : null,
          vehicleType,
          category,
          asphaltPayloadTons: asphaltPayloadTons ?? existing.asphaltPayloadTons,
          tackCoatTankLiters:
            tackCoatTankLiters ?? existing.tackCoatTankLiters,
          isSpecialVehicle: getBoolean(row, [
            "Sonderfahrzeug",
            "Special",
            "isSpecialVehicle",
          ]),
          isActive: isActive ?? existing.isActive,
          notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
        },
      });

      result.updated++;
      continue;
    }

    await prisma.vehicle.create({
      data: {
        vehicleNumber,
        licensePlate: licensePlate ? normalizeCode(licensePlate) : null,
        vehicleType,
        category,
        asphaltPayloadTons: asphaltPayloadTons ?? 0,
        tackCoatTankLiters: tackCoatTankLiters ?? 0,
        isSpecialVehicle: getBoolean(row, [
          "Sonderfahrzeug",
          "Special",
          "isSpecialVehicle",
        ]),
        isActive: isActive ?? true,
        notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
      },
    });

    result.created++;
  }

  return result;
}

async function importMaterials(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const materialNumber = getOptional(row, [
      "Materialnummer",
      "Materialnr",
      "Nummer",
      "materialNumber",
    ]);

    const name = getCell(row, [
      "Materialname",
      "Material",
      "Bezeichnung",
      "Name",
    ]);

    if (!name) {
      result.skipped++;
      continue;
    }

    const data = {
      materialNumber: materialNumber ? normalizeCode(materialNumber) : null,
      name,
      category: getOptional(row, ["Kategorie", "category"]),
      unit: getCell(row, ["Einheit", "unit"]) || "t",
      notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
    };

    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    if (data.materialNumber) {
      const existing = await prisma.materialType.findUnique({
        where: {
          materialNumber: data.materialNumber,
        },
      });

      if (existing) {
        await prisma.materialType.update({
          where: {
            id: existing.id,
          },
          data: {
            ...data,
            isActive: isActive ?? existing.isActive,
          },
        });

        result.updated++;
        continue;
      }
    }

    await prisma.materialType.create({
      data: {
        ...data,
        isActive: isActive ?? true,
      },
    });

    result.created++;
  }

  return result;
}

async function importAsphaltTypes(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const mixNumber = getCell(row, [
      "Sortennummer",
      "Sortennr",
      "Nummer",
      "mixNumber",
    ]);

    const name = getCell(row, [
      "Bezeichnung",
      "Material",
      "Materialname",
      "Name",
    ]);

    if (!mixNumber || !name) {
      result.skipped++;
      continue;
    }

    const data = {
      mixNumber: normalizeCode(mixNumber),
      name,
      shortName: getOptional(row, ["Kurzbezeichnung", "Kurzbez", "shortName"]),
      unit: getCell(row, ["Einheit", "unit"]) || "t",
      category: getOptional(row, ["Kategorie", "category"]),
      plant: getOptional(row, ["Mischanlage", "Standort", "plant"]),
      notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
    };
    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    const existing = await prisma.asphaltMixType.findUnique({
      where: {
        mixNumber: data.mixNumber,
      },
    });

    if (existing) {
      await prisma.asphaltMixType.update({
          where: {
            id: existing.id,
          },
          data: {
            ...data,
            isActive: isActive ?? existing.isActive,
          },
        });

      result.updated++;
      continue;
    }

    await prisma.asphaltMixType.create({
      data: {
        ...data,
        isActive: isActive ?? true,
      },
    });

    result.created++;
  }

  return result;
}

async function importTackCoatTypes(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const materialNumber = getOptional(row, [
      "Nummer",
      "Materialnummer",
      "Materialnr",
      "materialNumber",
    ]);
    const name = getCell(row, [
      "Bezeichnung",
      "Anspritzmittel",
      "Materialname",
      "Name",
    ]);

    if (!name) {
      result.skipped++;
      continue;
    }

    const data = {
      materialNumber: materialNumber ? normalizeCode(materialNumber) : null,
      name,
      category: TACK_COAT_CATEGORY,
      unit: getCell(row, ["Einheit", "unit"]) || "l",
      notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
    };
    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    const existing = data.materialNumber
      ? await prisma.materialType.findUnique({
          where: {
            materialNumber: data.materialNumber,
          },
        })
      : await prisma.materialType.findFirst({
          where: {
            category: TACK_COAT_CATEGORY,
            name,
          },
        });

    if (existing) {
      await prisma.materialType.update({
        where: {
          id: existing.id,
        },
        data: {
          ...data,
          materialNumber: data.materialNumber ?? existing.materialNumber,
          isActive: isActive ?? existing.isActive,
        },
      });

      result.updated++;
      continue;
    }

    await prisma.materialType.create({
      data: {
        ...data,
        isActive: isActive ?? true,
      },
    });

    result.created++;
  }

  return result;
}

async function importConcreteTypes(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const typeNumber = getCell(row, [
      "Sortennummer",
      "Sortennr",
      "Nummer",
      "typeNumber",
    ]);

    const name = getCell(row, ["Bezeichnung", "Betonsorte", "Name"]);

    if (!typeNumber || !name) {
      result.skipped++;
      continue;
    }

    const data = {
      typeNumber: normalizeCode(typeNumber),
      name,
      strengthClass: getOptional(row, [
        "Festigkeitsklasse",
        "Festigkeit",
        "strengthClass",
      ]),
      exposureClass: getOptional(row, [
        "Expositionsklasse",
        "Exposition",
        "exposureClass",
      ]),
      aggregate: getOptional(row, ["Körnung", "Koernung", "aggregate"]),
      consistency: getOptional(row, ["Konsistenz", "consistency"]),
      unit: getCell(row, ["Einheit", "unit"]) || "m³",
      notes: getOptional(row, ["Bemerkung", "Notiz", "Notes"]),
    };
    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    const existing = await prisma.concreteType.findUnique({
      where: {
        typeNumber: data.typeNumber,
      },
    });

    if (existing) {
      await prisma.concreteType.update({
          where: {
            id: existing.id,
          },
          data: {
            ...data,
            isActive: isActive ?? existing.isActive,
          },
        });

      result.updated++;
      continue;
    }

    await prisma.concreteType.create({
      data: {
        ...data,
        isActive: isActive ?? true,
      },
    });

    result.created++;
  }

  return result;
}

async function importOptions(rows: ExcelRow[]): Promise<ImportResult> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    const isCompletelyEmpty = Object.values(row).every((value) => !text(value));

    if (isCompletelyEmpty) {
      continue;
    }

    const groupKey = getCell(row, [
      "Gruppe",
      "Auswahlliste",
      "groupKey",
      "GroupKey",
    ]);
    const label = getCell(row, ["Bezeichnung", "Label", "label", "Name"]);

    if (!groupKey || !label) {
      result.skipped++;
      continue;
    }

    const valueInput = getCell(row, [
      "Interner Wert",
      "InternerWert",
      "Wert",
      "value",
      "Value",
    ]);
    const value = valueInput || slugify(label);
    const sortOrder = getOptionalNumber(row, [
      "Position",
      "Sortierung",
      "sortOrder",
      "SortOrder",
    ]);
    const isActive = getOptionalBoolean(row, ["Aktiv", "active", "isActive"]);

    const existing = await prisma.adminOption.findUnique({
      where: {
        groupKey_value: {
          groupKey,
          value,
        },
      },
    });

    if (existing) {
      await prisma.adminOption.update({
        where: {
          id: existing.id,
        },
        data: {
          label,
          sortOrder: sortOrder ?? existing.sortOrder,
          isActive: isActive ?? existing.isActive,
        },
      });

      result.updated++;
      continue;
    }

    await prisma.adminOption.create({
      data: {
        groupKey,
        value,
        label,
        sortOrder: sortOrder ?? (await getNextSortOrder(groupKey)),
        isActive: isActive ?? true,
      },
    });

    result.created++;
  }

  return result;
}

export async function importExcel(formData: FormData) {
  const importType = String(formData.get("importType") ?? "") as ImportType;
  const file = formData.get("file");

  if (!importType) {
    throw new Error("Bitte einen Importtyp auswählen.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Excel-Datei auswählen.");
  }

  const rows = await readExcelRows(file);

  let result: ImportResult;

  if (importType === "employees") {
    result = await importEmployees(rows);
  } else if (importType === "drivers") {
    result = await importDrivers(rows);
  } else if (importType === "vehicles") {
    result = await importVehicles(rows);
  } else if (importType === "materials") {
    result = await importMaterials(rows);
  } else if (importType === "asphalt-types") {
    result = await importAsphaltTypes(rows);
  } else if (importType === "tack-coat-types") {
    result = await importTackCoatTypes(rows);
  } else if (importType === "concrete-types") {
    result = await importConcreteTypes(rows);
  } else if (importType === "options") {
    result = await importOptions(rows);
  } else {
    throw new Error("Unbekannter Importtyp.");
  }

  revalidatePath("/admin/imports");
  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/vehicles");
  revalidatePath("/admin/materials");
  revalidatePath("/admin/asphalt-types");
  revalidatePath("/admin/tack-coat-types");
  revalidatePath("/admin/concrete-types");
  revalidatePath("/admin/options");

  redirect(
    `/admin/imports?type=${importType}&created=${result.created}&updated=${result.updated}&skipped=${result.skipped}`
  );
}
