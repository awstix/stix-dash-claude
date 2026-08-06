"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import {
  formatInventoryObjectNumber,
  getNextInventoryObjectNumber,
} from "@/lib/inventory-object-numbers";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { inventoryCategoryAllowsAssignment } from "@/lib/inventory-assignment-policy";
import { putFile, signedUrl } from "@/lib/storage";

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

function rowValue(row: ExcelRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
      return row[key];
    }
  }

  return null;
}

async function resolveCategory(row: ExcelRow) {
  const categoryName = text(rowValue(row, "Kategorie"));
  const subcategoryName = text(rowValue(row, "Unterkategorie"));

  if (!categoryName && !subcategoryName) return null;

  const categories = await prisma.inventoryCategory.findMany({
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

async function resolveResponsibleEmployee(row: ExcelRow) {
  const firstName = text(rowValue(row, "Mitarbeiter Vorname"));
  const lastName = text(rowValue(row, "Mitarbeiter Nachname"));

  if (!firstName && !lastName) return null;

  return prisma.employee.findFirst({
    where: {
      ...(firstName ? { firstName: { contains: firstName } } : {}),
      ...(lastName ? { lastName: { contains: lastName } } : {}),
    },
    select: {
      id: true,
    },
  });
}

async function resolveAdditionalEmployees(
  row: ExcelRow,
  primaryEmployeeId: string | null,
) {
  const raw = text(
    rowValue(
      row,
      "Weitere Mitarbeiter / Fahrer",
      "Weitere Mitarbeiter",
      "Weitere Fahrer",
    ),
  );
  if (!raw) return [];

  const requestedNames = raw
    .split(/[;|]/)
    .map((name) => name.trim())
    .filter(Boolean);
  const employees = await prisma.employee.findMany({
    select: {
      firstName: true,
      id: true,
      lastName: true,
    },
  });
  const normalize = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const resolvedIds: string[] = [];
  const missingNames: string[] = [];

  for (const requestedName of requestedNames) {
    const normalizedRequestedName = normalize(requestedName);
    const employee = employees.find((candidate) => {
      const firstLast = normalize(
        `${candidate.firstName} ${candidate.lastName}`,
      );
      const lastFirst = normalize(
        `${candidate.lastName}, ${candidate.firstName}`,
      );
      return (
        normalizedRequestedName === firstLast ||
        normalizedRequestedName === lastFirst
      );
    });

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

async function resolveResponsibleCrew(row: ExcelRow) {
  const crewName = text(rowValue(row, "Kolonne"));
  if (!crewName) return null;

  return prisma.crew.findFirst({
    where: {
      name: {
        contains: crewName,
      },
    },
    select: {
      id: true,
    },
  });
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
  await requireSession();
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
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    defval: "",
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorRows: Record<string, unknown>[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const excelRow = rowIndex + 2;
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
      const category = await resolveCategory(row);
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
      const responsibleType = lower(rowValue(row, "Verantwortlich Typ"));
      const allowsAssignment = inventoryCategoryAllowsAssignment(category);
      const responsibleEmployee =
        allowsAssignment &&
        (responsibleType === "mitarbeiter" || responsibleType === "person")
          ? await resolveResponsibleEmployee(row)
          : null;
      const responsibleCrew =
        allowsAssignment &&
        (responsibleType === "kolonne" || responsibleType === "team")
          ? await resolveResponsibleCrew(row)
          : null;
      const additionalEmployeeIds = allowsAssignment
        ? await resolveAdditionalEmployees(row, responsibleEmployee?.id ?? null)
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

      await prisma.$transaction(async (tx) => {
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
          category: {
            connect: {
              id: category.id,
            },
          },
          constructionDate: dateValue(rowValue(row, "Baujahr/Datum")),
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
          grossWeightKg: intValue(rowValue(row, "ZGG kg")),
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
