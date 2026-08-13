"use server";
import type { Prisma } from "@prisma/client";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import {
  formatInventoryObjectNumber,
  getNextInventoryObjectNumber,
} from "@/lib/inventory-object-numbers";
import { prisma } from "@/lib/prisma";
import { inventoryCategoryAllowsAssignment } from "@/lib/inventory-assignment-policy";
import { putFile, signedUrl } from "@/lib/storage";
import { getInventoryActor } from "../actions";

const STORAGE_BUCKET = "uploads";

type ExcelRow = Record<string, unknown>;

function text(value: unknown) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length > 0 ? stringValue : null;
}

function lower(value: unknown) {
  return text(value)?.toLowerCase() ?? "";
}

function bool(value: unknown) {
  const normalized = lower(value);
  return ["1", "ja", "j", "true", "wahr", "x"].includes(normalized);
}

function intValue(value: unknown) {
  const normalized = text(value)?.replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function floatValue(value: unknown) {
  const normalized = text(value)?.replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function moneyCents(value: unknown) {
  const number = floatValue(value);
  return number === null ? null : Math.round(number * 100);
}

function tonsToKilograms(value: unknown) {
  const number = floatValue(value);
  return number === null ? null : Math.round(number * 1000);
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const raw = text(value);
  if (!raw) return null;

  const germanDate = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanDate) {
    const day = Number(germanDate[1]);
    const month = Number(germanDate[2]);
    const year =
      germanDate[3].length === 2
        ? Number(`20${germanDate[3]}`)
        : Number(germanDate[3]);

    return new Date(Date.UTC(year, month - 1, day));
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function objectNumber(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const number = Number.parseInt(raw.replace(/\D/g, ""), 10);
  return Number.isInteger(number) ? formatInventoryObjectNumber(number) : null;
}

function statusValue(value: unknown) {
  const normalized = lower(value);
  if (normalized === "defekt") return "DEFECT";
  if (normalized === "in wartung" || normalized === "wartung") return "IN_SERVICE";
  if (normalized === "gesperrt") return "LOCKED";
  if (normalized === "gestohlen") return "STOLEN";
  return "ACTIVE";
}

function driveType(value: unknown) {
  const normalized = lower(value);
  if (normalized === "kette") return "TRACK";
  if (normalized === "rad") return "WHEEL";
  if (normalized === "rad+kette" || normalized === "rad und kette") {
    return "WHEEL_AND_TRACK";
  }
  if (normalized === "anhänger" || normalized === "anhaenger") return "TRAILER";
  if (normalized) return "OTHER";
  return null;
}

function resolveFuelType(
  value: unknown,
  options: { label: string; value: string }[],
) {
  const raw = text(value);
  if (!raw) return { fuelTypeLabel: null, fuelTypeValue: null };

  const normalized = raw.toLowerCase();
  const match = options.find(
    (option) =>
      option.label.toLowerCase() === normalized ||
      option.value.toLowerCase() === normalized,
  );

  return match
    ? { fuelTypeLabel: match.label, fuelTypeValue: match.value }
    : { fuelTypeLabel: null, fuelTypeValue: null };
}

function resolveInsuranceProvider(
  value: unknown,
  options: { label: string; value: string }[],
) {
  const raw = text(value);
  if (!raw) return { insuranceProviderLabel: null, insuranceProviderValue: null };

  const normalized = raw.toLowerCase();
  const match = options.find(
    (option) =>
      option.label.toLowerCase() === normalized ||
      option.value.toLowerCase() === normalized,
  );

  return match
    ? { insuranceProviderLabel: match.label, insuranceProviderValue: match.value }
    : { insuranceProviderLabel: null, insuranceProviderValue: null };
}

function rowValue(row: ExcelRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
      return row[key];
    }
  }

  return null;
}

type ImportCategoryRecord = {
  id: string;
  name: string;
  objectNumberEnd: number | null;
  objectNumberStart: number | null;
  useInTeamManagement: boolean;
  parentCategory: { name: string; useInTeamManagement: boolean } | null;
  parentCategoryId: string | null;
};

function resolveCategory(row: ExcelRow, categories: ImportCategoryRecord[]) {
  const categoryName = text(rowValue(row, "Kategorie"));
  const subcategoryName = text(rowValue(row, "Unterkategorie"));

  if (!categoryName && !subcategoryName) return null;

  const selectedCategory =
    subcategoryName && categoryName
      ? categories.find(
          (category) =>
            category.name.toLowerCase() === subcategoryName.toLowerCase() &&
            category.parentCategory?.name.toLowerCase() ===
              categoryName.toLowerCase(),
        )
      : subcategoryName
        ? categories.find(
            (category) =>
              category.name.toLowerCase() === subcategoryName.toLowerCase(),
          )
        : categories.find(
            (category) =>
              category.name.toLowerCase() === categoryName?.toLowerCase(),
          );

  if (!selectedCategory) {
    throw new Error(
      `Kategorie nicht gefunden: ${[categoryName, subcategoryName]
        .filter(Boolean)
        .join(" / ")}`,
    );
  }

  if (
    selectedCategory.objectNumberStart === null ||
    selectedCategory.objectNumberEnd === null
  ) {
    throw new Error(
      `Kategorie „${selectedCategory.name}“ hat noch keinen Nummernkreis.`,
    );
  }

  return selectedCategory;
}

type ImportEmployeeRecord = { firstName: string; id: string; lastName: string };

function resolveResponsibleEmployee(
  row: ExcelRow,
  employees: ImportEmployeeRecord[],
) {
  const firstName = text(rowValue(row, "Mitarbeiter Vorname"));
  const lastName = text(rowValue(row, "Mitarbeiter Nachname"));

  if (!firstName && !lastName) return null;

  const normalizedFirstName = firstName?.toLowerCase();
  const normalizedLastName = lastName?.toLowerCase();

  return (
    employees.find(
      (candidate) =>
        (!normalizedFirstName ||
          candidate.firstName.toLowerCase().includes(normalizedFirstName)) &&
        (!normalizedLastName ||
          candidate.lastName.toLowerCase().includes(normalizedLastName)),
    ) ?? null
  );
}

function resolveAdditionalEmployees(
  row: ExcelRow,
  primaryEmployeeId: string | null,
  employees: ImportEmployeeRecord[],
) {
  const requestedNames = ([1, 2, 3] as const)
    .map((slot) => {
      const firstName = text(
        rowValue(row, `Weiterer Mitarbeiter ${slot} Vorname`),
      );
      const lastName = text(
        rowValue(row, `Weiterer Mitarbeiter ${slot} Nachname`),
      );
      if (!firstName && !lastName) return null;
      return `${firstName ?? ""} ${lastName ?? ""}`.trim();
    })
    .filter((name): name is string => Boolean(name));

  if (requestedNames.length === 0) return [];

  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const resolvedIds: string[] = [];
  const missingNames: string[] = [];

  for (const requestedName of requestedNames) {
    const normalizedRequestedName = normalize(requestedName);
    const employee = employees.find(
      (candidate) =>
        normalize(`${candidate.firstName} ${candidate.lastName}`) ===
        normalizedRequestedName,
    );

    if (!employee) {
      missingNames.push(requestedName);
    } else if (employee.id !== primaryEmployeeId) {
      resolvedIds.push(employee.id);
    }
  }

  if (missingNames.length > 0) {
    throw new Error(
      `Weitere Mitarbeiter nicht gefunden: ${missingNames.join(", ")}.`,
    );
  }

  return Array.from(new Set(resolvedIds));
}

function resolveResponsibleCrew(
  row: ExcelRow,
  crews: { id: string; name: string }[],
) {
  const crewName = text(rowValue(row, "Kolonne"));
  if (!crewName) return null;

  const normalizedCrewName = crewName.toLowerCase();

  return (
    crews.find((crew) => crew.name.toLowerCase().includes(normalizedCrewName)) ??
    null
  );
}

async function resolveProject(row: ExcelRow) {
  const projectNumber = text(rowValue(row, "Baustelle Projektnummer"));
  if (!projectNumber) return null;

  return prisma.project.findFirst({
    where: {
      projectNumber,
    },
    select: {
      id: true,
    },
  });
}

function getContact(row: ExcelRow) {
  const company = text(rowValue(row, "Ansprechpartner Firma"));
  const role = text(rowValue(row, "Ansprechpartner Rolle"));
  const salutation = text(rowValue(row, "Ansprechpartner Anrede"));
  const firstName = text(rowValue(row, "Ansprechpartner Vorname"));
  const lastName = text(rowValue(row, "Ansprechpartner Nachname"));
  const phone = text(rowValue(row, "Ansprechpartner Telefon"));
  const mobilePhone = text(rowValue(row, "Ansprechpartner Mobil"));
  const email = text(rowValue(row, "Ansprechpartner E-Mail"));
  const website = text(rowValue(row, "Ansprechpartner Webseite"));
  const notes = text(rowValue(row, "Ansprechpartner Notizen"));

  if (
    !company &&
    !role &&
    !salutation &&
    !firstName &&
    !lastName &&
    !phone &&
    !mobilePhone &&
    !email &&
    !website &&
    !notes
  ) {
    return null;
  }

  return {
    company,
    email,
    firstName,
    lastName,
    mobilePhone,
    name: null,
    notes,
    phone,
    role: role ?? "Ansprechpartner",
    salutation,
    website,
  };
}

export async function importInventoryItems(formData: FormData) {
  const actor = await getInventoryActor();
  const importRunId = text(formData.get("importRunId"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Excel-Datei auswählen.");
  }

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    cellDates: true,
    type: "buffer",
  });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  // Newer template downloads have a group-title row above the actual field
  // headers ("Kennzeichnung", "Zuordnung", …); older already-filled files
  // still have the field headers directly in row 1. Detect which row the
  // real headers are in instead of assuming a fixed position.
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    defval: "",
    header: 1,
  });
  const looksLikeHeaderRow = (row: unknown[] | undefined) =>
    Array.isArray(row) && row.includes("Objekt-ID") && row.includes("Name");
  const headerRowIndex = looksLikeHeaderRow(rawRows[0])
    ? 0
    : looksLikeHeaderRow(rawRows[1])
      ? 1
      : 0;

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: "",
    range: headerRowIndex,
  });

  if (importRunId) {
    await prisma.importProgress.upsert({
      where: { id: importRunId },
      create: { id: importRunId, total: rows.length },
      update: { processed: 0, status: "running", total: rows.length },
    });
  }

  const fuelTypeOptions = await prisma.adminOption.findMany({
    where: {
      groupKey: "vehicle_fuel_type",
      isActive: true,
    },
    select: {
      label: true,
      value: true,
    },
  });
  const insuranceProviderOptions = await prisma.adminOption.findMany({
    where: {
      groupKey: "insurance_provider",
      isActive: true,
    },
    select: {
      label: true,
      value: true,
    },
  });

  // Fetched once instead of on every row - the previous per-row lookups
  // (especially re-fetching all categories and all employees on every
  // single row) added up to minutes for a few hundred rows and reliably
  // timed out / crashed the import.
  const allCategories = await prisma.inventoryCategory.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      objectNumberEnd: true,
      objectNumberStart: true,
      useInTeamManagement: true,
      parentCategory: {
        select: {
          name: true,
          useInTeamManagement: true,
        },
      },
      parentCategoryId: true,
    },
  });
  const allEmployees = await prisma.employee.findMany({
    select: {
      firstName: true,
      id: true,
      lastName: true,
    },
  });
  const allCrews = await prisma.crew.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorRows: Record<string, unknown>[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    if (importRunId && rowIndex % 3 === 0) {
      await prisma.importProgress
        .update({
          where: { id: importRunId },
          data: { processed: rowIndex },
        })
        .catch(() => undefined);
    }

    const excelRow = rowIndex + headerRowIndex + 2;
    const name = text(rowValue(row, "Name", "Objektname"));

    if (!name) {
      skipped += 1;
      errorRows.push({
        "Excel-Zeile": excelRow,
        Fehler: "Name / Objektname fehlt.",
        ...row,
      });
      continue;
    }

    try {
      const category = resolveCategory(row, allCategories);
      if (!category) {
        skipped += 1;
        errorRows.push({
          "Excel-Zeile": excelRow,
          Fehler: "Kategorie oder Unterkategorie fehlt.",
          ...row,
        });
        continue;
      }

      const requestedObjectNumber = objectNumber(rowValue(row, "Objekt-ID"));
      const inventoryNumber = text(rowValue(row, "Inventarnummer"));
      const stixId = text(rowValue(row, "STIX-ID"));
      const responsibleTypeRaw = lower(rowValue(row, "Verantwortlich Typ"));
      const hasMitarbeiterName =
        Boolean(text(rowValue(row, "Mitarbeiter Vorname"))) ||
        Boolean(text(rowValue(row, "Mitarbeiter Nachname")));
      const hasKolonneName = Boolean(text(rowValue(row, "Kolonne")));
      // "Verantwortlich Typ" wins if it's set explicitly; otherwise infer it
      // from whichever of "Mitarbeiter …" / "Kolonne" columns actually has a
      // value, so people don't have to fill in a separate type column too.
      const responsibleType =
        responsibleTypeRaw === "mitarbeiter" || responsibleTypeRaw === "person"
          ? "mitarbeiter"
          : responsibleTypeRaw === "kolonne" || responsibleTypeRaw === "team"
            ? "kolonne"
            : hasMitarbeiterName
              ? "mitarbeiter"
              : hasKolonneName
                ? "kolonne"
                : "";
      const allowsAssignment = inventoryCategoryAllowsAssignment(category);
      const responsibleEmployee =
        allowsAssignment && responsibleType === "mitarbeiter"
          ? resolveResponsibleEmployee(row, allEmployees)
          : null;
      const responsibleCrew =
        allowsAssignment && responsibleType === "kolonne"
          ? resolveResponsibleCrew(row, allCrews)
          : null;
      const additionalEmployeeIds = allowsAssignment
        ? resolveAdditionalEmployees(row, responsibleEmployee?.id ?? null, allEmployees)
        : [];
      const project = await resolveProject(row);
      const parentObjectNumber = objectNumber(
        rowValue(row, "Liegt in Container Objekt-ID"),
      );
      const parentItem = parentObjectNumber
        ? await prisma.inventoryItem.findUnique({
            where: {
              objectNumber: parentObjectNumber,
            },
            select: {
              id: true,
            },
          })
        : null;
      const contact = getContact(row);
      const stockManaged = bool(rowValue(row, "Lagerobjekt"));
      const openingStock = stockManaged
        ? floatValue(rowValue(row, "Anfangsbestand"))
        : null;
      const currentStock = stockManaged
        ? (floatValue(rowValue(row, "Aktueller Bestand")) ?? openingStock)
        : null;

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const existingByObjectNumber = requestedObjectNumber
          ? await tx.inventoryItem.findUnique({
              where: {
                objectNumber: requestedObjectNumber,
              },
              select: {
                id: true,
              },
            })
          : null;
        const existingByInventoryNumber =
          inventoryNumber && !existingByObjectNumber
            ? await tx.inventoryItem.findUnique({
                where: {
                  inventoryNumber,
                },
                select: {
                  id: true,
                },
              })
            : null;
        const existingByStixId =
          stixId && !existingByObjectNumber && !existingByInventoryNumber
            ? await tx.inventoryItem.findUnique({
                where: {
                  stixId,
                },
                select: {
                  id: true,
                },
              })
            : null;
        const existingItem =
          existingByObjectNumber ?? existingByInventoryNumber ?? existingByStixId;
        const objectNumberToSave =
          requestedObjectNumber ??
          (existingItem
            ? undefined
            : await getNextInventoryObjectNumber(tx, category.id));

        const data = {
          attachmentType: text(rowValue(row, "Aufnahmetyp")),
          axleCount: intValue(rowValue(row, "Achsen")),
          billingRateCents: moneyCents(
            rowValue(row, "Verrechnungssatz EUR je Einheit", "Verrechnungssatz EUR"),
          ),
          idleBillingRateCents: moneyCents(
            rowValue(
              row,
              "Verrechnungssatz stillgelegt EUR je Einheit",
              "Verrechnungssatz stillgelegt EUR",
            ),
          ),
          insuranceAnnualPremiumCents: moneyCents(
            rowValue(row, "Versicherung p.a. netto EUR"),
          ),
          ...resolveInsuranceProvider(
            rowValue(row, "Versichert bei"),
            insuranceProviderOptions,
          ),
          category: {
            connect: {
              id: category.id,
            },
          },
          constructionDate: dateValue(rowValue(row, "Baujahr/Datum")),
          firstRegistrationDate: dateValue(rowValue(row, "Erstzulassung")),
          currentProject: project
            ? {
                connect: {
                  id: project.id,
                },
              }
            : undefined,
          currentStock,
          deliveryNoteNumber: text(rowValue(row, "Lieferscheinnummer")),
          driveType: driveType(rowValue(row, "Antrieb")),
          fuelTankLiters: floatValue(rowValue(row, "Kraftstofftank l")),
          ...resolveFuelType(rowValue(row, "Kraftstoffart"), fuelTypeOptions),
          grossWeightKg: intValue(
            rowValue(row, "Zul. Gesamtmasse (F1) kg", "ZGG kg"),
          ),
          inventoryNumber,
          invoiceNumber: text(rowValue(row, "Rechnungsnummer")),
          isContainer: bool(rowValue(row, "Containerobjekt")),
          isStockManaged: stockManaged,
          lastDguvInspectionDate: dateValue(rowValue(row, "Letzte DGUV")),
          lastServiceAtDate: dateValue(rowValue(row, "Letzter Service Datum")),
          lastServiceMileageKm: intValue(rowValue(row, "Letzter Service KM")),
          lastServiceOperatingHours: floatValue(
            rowValue(row, "Letzter Service H"),
          ),
          lastTuvInspectionDate: dateValue(rowValue(row, "Letzte TÜV")),
          lastHuInspectionDate: dateValue(rowValue(row, "Letzte HU")),
          lastTachographInspectionDate: dateValue(
            rowValue(row, "Letzte Tachoprüfung"),
          ),
          lastSafetyInspectionDate: dateValue(rowValue(row, "Letzte SP")),
          lastAdrInspectionDate: dateValue(rowValue(row, "Letzte ADR")),
          licensePlate: text(rowValue(row, "Kennzeichen")),
          manufacturer: text(rowValue(row, "Hersteller")),
          model: text(rowValue(row, "Typ/Modell")),
          name,
          nextDguvInspectionDate: dateValue(rowValue(row, "Nächste DGUV")),
          nextServiceAtDate: dateValue(rowValue(row, "Nächster Service Datum")),
          nextServiceMileageKm: intValue(rowValue(row, "Nächster Service KM")),
          nextServiceOperatingHours: floatValue(
            rowValue(row, "Nächster Service H"),
          ),
          nextTuvInspectionDate: dateValue(rowValue(row, "Nächste TÜV")),
          nextHuInspectionDate: dateValue(rowValue(row, "Nächste HU")),
          nextTachographInspectionDate: dateValue(
            rowValue(row, "Nächste Tachoprüfung"),
          ),
          nextSafetyInspectionDate: dateValue(rowValue(row, "Nächste SP")),
          nextAdrInspectionDate: dateValue(rowValue(row, "Nächste ADR")),
          notes: text(rowValue(row, "Notizen")),
          openingStock,
          parentItem: parentItem
            ? {
                connect: {
                  id: parentItem.id,
                },
              }
            : undefined,
          payloadKg: tonsToKilograms(rowValue(row, "Nutzlast t")),
          purchasedAt: dateValue(rowValue(row, "Gekauft am")),
          purchasedFrom: text(rowValue(row, "Gekauft bei")),
          receivedAt: dateValue(rowValue(row, "Erhalten am")),
          responsibleCrew: responsibleCrew
            ? {
                connect: {
                  id: responsibleCrew.id,
                },
              }
            : undefined,
          responsibleEmployee: responsibleEmployee
            ? {
                connect: {
                  id: responsibleEmployee.id,
                },
              }
            : undefined,
          responsibleType: responsibleEmployee
            ? "EMPLOYEE"
            : responsibleCrew
              ? "CREW"
              : null,
          serialNumber: text(rowValue(row, "Seriennummer")),
          vehicleIdentNumber: text(
            rowValue(row, "Fahrzeug-Ident.-Nr.", "Fahrzeug-Ident-Nr", "FIN"),
          ),
          status: statusValue(rowValue(row, "Status")),
          stockUnit: text(rowValue(row, "Einheit")) ?? "Stk.",
          stixId,
          workMaterialTankLiters: floatValue(
            rowValue(row, "Arbeitsmitteltank l", "Arbeitsmitteltank"),
          ),
        };

        if (existingItem) {
          await tx.inventoryItem.update({
            where: {
              id: existingItem.id,
            },
            data,
          });
          await tx.inventoryItemEmployeeAssignment.deleteMany({
            where: {
              itemId: existingItem.id,
            },
          });
          if (additionalEmployeeIds.length > 0) {
            await tx.inventoryItemEmployeeAssignment.createMany({
              data: additionalEmployeeIds.map((employeeId) => ({
                employeeId,
                itemId: existingItem.id,
              })),
            });
          }
          updated += 1;
          return;
        }

        await tx.inventoryItem.create({
          data: {
            ...data,
            objectNumber: objectNumberToSave,
            createdByName: actor.name,
            createdByUserId: actor.userId,
            employeeAssignments: additionalEmployeeIds.length
              ? {
                  create: additionalEmployeeIds.map((employeeId) => ({
                    employee: {
                      connect: {
                        id: employeeId,
                      },
                    },
                  })),
                }
              : undefined,
            contacts: contact
              ? {
                  create: [contact],
                }
              : undefined,
          },
        });
        created += 1;
      });
    } catch (error) {
      skipped += 1;
      errorRows.push({
        "Excel-Zeile": excelRow,
        Fehler:
          error instanceof Error
            ? error.message
            : "Unbekannter Fehler beim Import.",
        ...row,
      });
    }
  }

  if (importRunId) {
    await prisma.importProgress
      .update({
        where: { id: importRunId },
        data: { processed: rows.length, status: "done" },
      })
      .catch(() => undefined);
  }

  let reportUrl = "";
  if (errorRows.length > 0) {
    const reportWorkbook = XLSX.utils.book_new();
    const reportSheet = XLSX.utils.json_to_sheet(errorRows);
    reportSheet["!cols"] = Object.keys(errorRows[0]).map((key) => ({
      wch: Math.max(14, Math.min(48, key.length + 4)),
    }));
    XLSX.utils.book_append_sheet(reportWorkbook, reportSheet, "Importfehler");

    const reportFileName = `inventar-importfehler-${new Date()
      .toISOString()
      .slice(0, 10)}-${randomUUID().slice(0, 8)}.xlsx`;
    const reportStoragePath = `inventory-import-errors/${reportFileName}`;
    await putFile(
      STORAGE_BUCKET,
      reportStoragePath,
      XLSX.write(reportWorkbook, {
        bookType: "xlsx",
        type: "buffer",
      }),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    reportUrl = await signedUrl(STORAGE_BUCKET, reportStoragePath, 60 * 60);
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
  redirect(
    `/inventory/imports?created=${created}&updated=${updated}&skipped=${skipped}${
      reportUrl ? `&report=${encodeURIComponent(reportUrl)}` : ""
    }`,
  );
}
