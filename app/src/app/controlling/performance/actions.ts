"use server";
import type { Prisma } from "@prisma/client";

import * as XLSX from "xlsx";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

type ExcelRow = Record<string, unknown>;

function text(value: FormDataEntryValue | null) {
  const result = String(value ?? "").trim();
  return result.length > 0 ? result : null;
}

function requiredText(value: FormDataEntryValue | null, label: string) {
  const result = text(value);

  if (!result) {
    throw new Error(`${label} fehlt.`);
  }

  return result;
}

function optionalDate(value: FormDataEntryValue | null) {
  const result = text(value);
  return result ? new Date(`${result}T00:00:00`) : null;
}

function requiredDate(value: FormDataEntryValue | null, label: string) {
  const result = optionalDate(value);

  if (!result || Number.isNaN(result.getTime())) {
    throw new Error(`${label} fehlt oder ist ungültig.`);
  }

  return result;
}

function numberValue(value: FormDataEntryValue | null, label: string) {
  const result = normalizeNumberText(text(value));

  if (!result) {
    return 0;
  }

  const number = Number(result);

  if (Number.isNaN(number)) {
    throw new Error(`${label} muss eine Zahl sein.`);
  }

  return number;
}

// Defaults to 100 (voller Satz) statt 0, wenn leer - anders als bei
// numberValue wäre 0% als "leer bedeutet nichts angegeben" hier eine
// versehentliche Reduzierung auf 0 € statt keine Änderung.
function percentValue(value: FormDataEntryValue | null) {
  const result = normalizeNumberText(text(value));

  if (!result) {
    return 100;
  }

  const number = Number(result);

  if (Number.isNaN(number) || number < 0) {
    return 100;
  }

  return Math.round(number);
}

function normalizeNumberText(value: string | null) {
  if (!value) return null;

  const trimmed = value.trim();

  if (trimmed === "-" || trimmed === "—") return null;

  let normalized = trimmed
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || normalized === "-" || normalized === "—") return null;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  return normalized;
}

function moneyCents(value: FormDataEntryValue | null, label: string) {
  const number = numberValue(value, label);
  return Math.round(number * 100);
}

function optionalExcelNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value instanceof Date) {
    return 0;
  }

  const normalized = normalizeNumberText(String(value ?? "").trim());

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/€/g, "eur")
    .replace(/[^a-z0-9äöüß]/gi, "");
}

function getRowValue(row: ExcelRow, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  let fallbackValue: unknown = null;

  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(key))) {
      if (fallbackValue === null) {
        fallbackValue = value;
      }

      if (value === 0 || String(value ?? "").trim()) {
        return value;
      }
    }
  }

  return fallbackValue;
}

function getRowText(row: ExcelRow, aliases: string[]) {
  const value = getRowValue(row, aliases);
  const result = String(value ?? "").trim();
  return result.length > 0 ? result : null;
}

function parseTimeToHours(value: string | null | undefined) {
  if (!value) return null;
  const [hoursText, minutesText = "0"] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours + minutes / 60;
}

function timeRangeHours(startTime: string | null | undefined, endTime: string | null | undefined) {
  const start = parseTimeToHours(startTime);
  const end = parseTimeToHours(endTime);

  if (start === null || end === null) {
    return 0;
  }

  return Math.max(0, end - start);
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { end, start };
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pathFor(
  reportId?: string | null,
  projectId?: string | null,
  notice?: {
    message: string;
    type: "error" | "success";
  },
) {
  const params = new URLSearchParams();

  if (projectId) params.set("projectId", projectId);
  if (reportId) params.set("reportId", reportId);
  if (notice) {
    params.set("notice", notice.message);
    params.set("noticeType", notice.type);
  }

  return `/controlling/performance${params.toString() ? `?${params}` : ""}`;
}

function revalidateControlling() {
  revalidatePath("/controlling/performance");
}

async function rateSetForPerformancePeriod(periodEnd: Date | null, reportDate: Date) {
  const rateYear = (periodEnd ?? reportDate).getFullYear();
  const rateSet = await prisma.controllingRateSet.findUnique({
    where: {
      year: rateYear,
    },
  });

  return rateSet;
}

async function resolvePerformanceRateSet(rateSetId: string | null, periodEnd: Date, reportDate: Date) {
  if (rateSetId) {
    return prisma.controllingRateSet.findUnique({
      where: {
        id: rateSetId,
      },
    });
  }

  return rateSetForPerformancePeriod(periodEnd, reportDate);
}

export async function createPerformanceReport(formData: FormData) {
  await requireSession();
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const periodStart = requiredDate(formData.get("periodStart"), "Zeitraum von");
  const periodEnd = requiredDate(formData.get("periodEnd"), "Zeitraum bis");
  const rateSetId = text(formData.get("rateSetId"));
  const title = text(formData.get("title"));

  if (periodStart > periodEnd) {
    throw new Error("Zeitraum von darf nicht nach Zeitraum bis liegen.");
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: {
      id: projectId,
    },
  });

  const report = await prisma.controllingPerformanceReport.create({
    data: {
      project: {
        connect: {
          id: projectId,
        },
      },
      periodEnd,
      periodStart,
      reportDate: periodEnd,
      title,
      // contractValueNet/changeOrdersNet/paymentsNet are Floats now (real
      // cent precision, e.g. 6765.91) - Math.round guards against binary
      // floating-point drift (6765.91 * 100 can land on
      // 676590.9999999999) before it hits these Int Cents columns.
      contractValueNetCents: Math.round(project.contractValueNet * 100),
      changeOrdersNetCents: Math.round(project.changeOrdersNet * 100),
      progressPercent: project.progressPercent,
      paymentsNetCents: Math.round(project.paymentsNet * 100),
      createdByName: "System",
      rateSet: rateSetId
        ? {
            connect: {
              id: rateSetId,
            },
          }
        : undefined,
    },
  });

  // Neue Leistungsmeldung soll nicht leer starten - direkt mit den zum
  // Zeitraum passenden Dispo-/Zeiterfassungsdaten vorbefüllen (derselbe
  // Import wie beim manuellen Knopf "aus Planung/Disposition
  // übernehmen"), sonst müsste das für jede neue Meldung extra angestoßen
  // werden.
  const importResult = await runDispositionImport(report.id, projectId);

  revalidateControlling();
  redirect(
    pathFor(report.id, projectId, {
      message: dispositionImportMessage(importResult),
      type: importResult.ok ? "success" : "error",
    }),
  );
}

export async function updatePerformanceReport(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const periodStart = requiredDate(formData.get("periodStart"), "Zeitraum von");
  const periodEnd = requiredDate(formData.get("periodEnd"), "Zeitraum bis");
  const rateSetId = text(formData.get("rateSetId"));
  const status = requiredText(formData.get("status"), "Status");
  const progressPercent = numberValue(formData.get("progressPercent"), "Leistungsstand");
  const hoursSource =
    text(formData.get("hoursSource")) === "APPROVED_TIME" ? "APPROVED_TIME" : "PLANNED";

  if (periodStart > periodEnd) {
    throw new Error("Zeitraum von darf nicht nach Zeitraum bis liegen.");
  }

  await prisma.controllingPerformanceReport.update({
    where: {
      id: reportId,
    },
    data: {
      periodEnd,
      periodStart,
      reportDate: periodEnd,
      title: text(formData.get("title")),
      status,
      hoursSource,
      note: text(formData.get("note")),
      contractValueNetCents: moneyCents(formData.get("contractValueNet"), "Hauptauftrag"),
      changeOrdersNetCents: moneyCents(formData.get("changeOrdersNet"), "Nachträge"),
      progressPercent,
      paymentsNetCents: moneyCents(formData.get("paymentsNet"), "Zahlungen"),
      rateSet: rateSetId
        ? {
            connect: {
              id: rateSetId,
            },
          }
        : {
            disconnect: true,
          },
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

/** Eigene, schlanke Aktion nur für den Leistungsmeldung-nach-Disposition/
 * -Leistung-Umschalter (HoursSourceToggle) - kein redirect(), damit das
 * Umschalten die Kolonnen-Vorschläge (die von report.hoursSource abhängen)
 * per router.refresh() live neu berechnet, ohne die Seite über eine
 * echte Navigation neu zu laden und dabei nach oben zu springen. */
export async function updateReportHoursSource(input: {
  hoursSource: string;
  reportId: string;
}) {
  await requireSession();
  const hoursSource = input.hoursSource === "APPROVED_TIME" ? "APPROVED_TIME" : "PLANNED";

  await prisma.controllingPerformanceReport.update({
    data: {
      hoursSource,
    },
    where: {
      id: input.reportId,
    },
  });

  revalidateControlling();
}

export async function deletePerformanceReport(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");

  await prisma.controllingPerformanceReport.delete({
    where: {
      id: reportId,
    },
  });

  revalidateControlling();
  redirect(pathFor(null, projectId));
}

export async function deleteControllingDetailEntry(formData: FormData) {
  await requireSession();
  const id = requiredText(formData.get("id"), "Eintrag");
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");

  await prisma.controllingDetailEntry.delete({
    where: {
      id,
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function deleteControllingHourEntry(formData: FormData) {
  await requireSession();
  const id = requiredText(formData.get("id"), "Eintrag");
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");

  await prisma.controllingHourEntry.delete({
    where: {
      id,
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function deleteControllingInvoiceItem(formData: FormData) {
  await requireSession();
  const id = requiredText(formData.get("id"), "Eintrag");
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");

  await prisma.controllingInvoiceItem.delete({
    where: {
      id,
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function addControllingDetailEntry(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const quantity = numberValue(formData.get("quantity"), "Menge");
  const unitPriceCents = moneyCents(formData.get("unitPrice"), "EP netto");
  const utilizationPercent = percentValue(formData.get("utilizationPercent"));
  const amountCents = Math.round(
    (quantity * unitPriceCents * utilizationPercent) / 100,
  );

  await prisma.controllingDetailEntry.create({
    data: {
      report: {
        connect: {
          id: reportId,
        },
      },
      project: {
        connect: {
          id: projectId,
        },
      },
      entryDate: requiredDate(formData.get("entryDate"), "Datum"),
      costType: requiredText(formData.get("costType"), "Kostenart"),
      description: requiredText(formData.get("description"), "Beschreibung"),
      quantity,
      unit: requiredText(formData.get("unit"), "Einheit"),
      unitPriceCents,
      utilizationPercent,
      amountCents,
      status: requiredText(formData.get("status"), "Status"),
      source: "MANUAL",
      notes: text(formData.get("notes")),
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function updateControllingDetailEntry(formData: FormData) {
  await requireSession();
  const id = requiredText(formData.get("id"), "Eintrag");
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const quantity = numberValue(formData.get("quantity"), "Menge");
  const unitPriceCents = moneyCents(formData.get("unitPrice"), "EP netto");
  const utilizationPercent = percentValue(formData.get("utilizationPercent"));
  const amountCents = Math.round(
    (quantity * unitPriceCents * utilizationPercent) / 100,
  );

  await prisma.controllingDetailEntry.update({
    where: {
      id,
    },
    data: {
      entryDate: requiredDate(formData.get("entryDate"), "Datum"),
      costType: requiredText(formData.get("costType"), "Kostenart"),
      description: requiredText(formData.get("description"), "Beschreibung"),
      quantity,
      unit: requiredText(formData.get("unit"), "Einheit"),
      unitPriceCents,
      utilizationPercent,
      amountCents,
      status: requiredText(formData.get("status"), "Status"),
      notes: text(formData.get("notes")),
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function addControllingHourEntry(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const labelType = text(formData.get("labelType")) || "CREW";
  const hoursPerEmployee = numberValue(formData.get("hoursPerEmployee"), "Std je MA");
  const employeeCount = numberValue(formData.get("employeeCount"), "Anzahl MA") || 1;
  const selectedEmployeeLabels = formData
    .getAll("employeeLabels")
    .map((value) => text(value))
    .filter(Boolean);
  const label =
    labelType === "CREW"
      ? requiredText(formData.get("crewLabel"), "Kolonne")
      : labelType === "EMPLOYEE"
        ? selectedEmployeeLabels.length >= employeeCount
          ? selectedEmployeeLabels.slice(0, employeeCount).join("; ")
          : requiredText(null, `${employeeCount} Mitarbeiter`)
        : requiredText(formData.get("label"), "Freitext");
  const totalHours = Math.round(hoursPerEmployee * employeeCount * 100) / 100;
  const realRateCents = moneyCents(formData.get("realRate"), "EK real");
  const internalRateCents = moneyCents(formData.get("internalRate"), "Interner Satz");
  const costCategory =
    text(formData.get("costCategory")) === "GEHALT_SONSTIGES" ? "GEHALT_SONSTIGES" : "LOHN";

  await prisma.controllingHourEntry.create({
    data: {
      report: {
        connect: {
          id: reportId,
        },
      },
      project: {
        connect: {
          id: projectId,
        },
      },
      entryDate: requiredDate(formData.get("entryDate"), "Datum"),
      label,
      startsAt: text(formData.get("startsAt")),
      endsAt: text(formData.get("endsAt")),
      breakHours: numberValue(formData.get("breakHours"), "Pause"),
      employeeCount,
      hoursPerEmployee,
      totalHours,
      realRateCents,
      internalRateCents,
      realCostCents: Math.round(totalHours * realRateCents),
      internalCostCents: Math.round(totalHours * internalRateCents),
      costCategory,
      source: "MANUAL",
      notes: text(formData.get("notes")),
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function addControllingInvoiceItem(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const billedQuantity = numberValue(formData.get("billedQuantity"), "RE-Menge");
  const hoursPerUnit = numberValue(formData.get("hoursPerUnit"), "Std/ME");
  const unitPriceCents = moneyCents(formData.get("unitPrice"), "EP");
  const costPerUnitCents = moneyCents(formData.get("costPerUnit"), "Kosten/ME");

  await prisma.controllingInvoiceItem.create({
    data: {
      report: {
        connect: {
          id: reportId,
        },
      },
      project: {
        connect: {
          id: projectId,
        },
      },
      positionCode: text(formData.get("positionCode")),
      shortText: requiredText(formData.get("shortText"), "Kurztext"),
      unit: text(formData.get("unit")),
      contractQuantity: numberValue(formData.get("contractQuantity"), "LV-Menge"),
      billedQuantity,
      hoursPerUnit,
      billedHours: Math.round(billedQuantity * hoursPerUnit * 100) / 100,
      unitPriceCents,
      revenueCents: Math.round(billedQuantity * unitPriceCents),
      costPerUnitCents,
      costCents: Math.round(billedQuantity * costPerUnitCents),
      source: "MANUAL",
      notes: text(formData.get("notes")),
    },
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function importItwoInvoiceItems(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const file = formData.get("itwoFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine iTWO-Excel-Datei auswählen.");
  }

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    cellDates: true,
    cellFormula: false,
    raw: true,
    type: "buffer",
  });

  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes("itwo")) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Die Excel-Datei enthält kein Tabellenblatt.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
    defval: "",
    raw: true,
  });

  const importedItems = rows
    .map((row) => {
      const positionCode = getRowText(row, ["OZ", "Position", "Pos.", "Ordnungszahl"]);
      const shortText =
        getRowText(row, ["Kurztext", "Kurz-Info", "Beschreibung", "Leistung"]) ?? "";
      const unit = getRowText(row, ["ME", "Einheit"]);
      const billedQuantity = optionalExcelNumber(
        getRowValue(row, ["RE-Menge", "RE Menge", "Abrechnungsmenge", "Menge"]),
      );

      if (!positionCode || !shortText || !unit || billedQuantity === 0) {
        return null;
      }

      const contractQuantity = optionalExcelNumber(
        getRowValue(row, ["LV-Menge", "LV Menge", "Auftragsmenge"]),
      );
      const hoursPerUnit = optionalExcelNumber(
        getRowValue(row, ["Std/ME", "Std ME", "Stunden je ME"]),
      );
      const unitPrice = optionalExcelNumber(
        getRowValue(row, ["Einheitspreis", "EP", "EP netto", "EP netto €"]),
      );
      const costPerUnit = optionalExcelNumber(
        getRowValue(row, ["Kosten/ME", "Kosten ME", "Kosten je ME"]),
      );
      const laborCostPerUnit = optionalExcelNumber(
        getRowValue(row, ["1 Personalkosten", "Personalkosten", "Lohn"]),
      );
      const equipmentCostPerUnit = optionalExcelNumber(
        getRowValue(row, ["2 Geräte (o.Bedienung. / o. Montage)", "2 Geräte", "Geräte"]),
      );
      const materialCostPerUnit = optionalExcelNumber(
        getRowValue(row, ["3 Material - AB WERK", "3 Material", "Material"]),
      );
      const subcontractorCostPerUnit = optionalExcelNumber(
        getRowValue(row, ["4 Nachunternehmer", "Nachunternehmer", "NU"]),
      );
      const otherCostPerUnit = optionalExcelNumber(
        getRowValue(row, ["5 Gehalt / Sonstiges", "5 Sonstiges", "Sonstiges"]),
      );
      const laborCostCents = Math.round(billedQuantity * laborCostPerUnit * 100);
      const equipmentCostCents = Math.round(billedQuantity * equipmentCostPerUnit * 100);
      const materialCostCents = Math.round(billedQuantity * materialCostPerUnit * 100);
      const subcontractorCostCents = Math.round(
        billedQuantity * subcontractorCostPerUnit * 100,
      );
      const otherCostCents = Math.round(billedQuantity * otherCostPerUnit * 100);
      const splitCostCents =
        laborCostCents +
        equipmentCostCents +
        materialCostCents +
        subcontractorCostCents +
        otherCostCents;

      return {
        billedHours: Math.round(billedQuantity * hoursPerUnit * 100) / 100,
        billedQuantity,
        contractQuantity,
        costCents: splitCostCents || Math.round(billedQuantity * costPerUnit * 100),
        costPerUnitCents: Math.round(costPerUnit * 100),
        equipmentCostCents,
        laborCostCents,
        materialCostCents,
        notes: `Import aus ${file.name}`,
        otherCostCents,
        positionCode,
        revenueCents: Math.round(billedQuantity * unitPrice * 100),
        shortText,
        source: "ITWO_IMPORT",
        subcontractorCostCents,
        unit,
        unitPriceCents: Math.round(unitPrice * 100),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (importedItems.length === 0) {
    throw new Error(
      "Es wurden keine iTWO-Rechnungsmengen gefunden. Erwartet werden mindestens OZ, Kurztext, RE-Menge und ME.",
    );
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (formData.get("replaceItwoItems") === "on") {
      await tx.controllingInvoiceItem.deleteMany({
        where: {
          reportId,
          source: "ITWO_IMPORT",
        },
      });
    }

    await tx.controllingInvoiceItem.createMany({
      data: importedItems.map((item) => ({
        ...item,
        projectId,
        reportId,
      })),
    });
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

export async function importDetailEntriesFromExcel(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");
  const file = formData.get("detailFile");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Detailerfassungs-Excel-Datei auswählen.");
  }

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    cellDates: true,
    cellFormula: false,
    raw: true,
    type: "buffer",
  });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes("detail")) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Die Excel-Datei enthält kein Tabellenblatt.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
    defval: "",
    raw: true,
  });

  const importedEntries = rows
    .map((row) => {
      const description = getRowText(row, ["Beschreibung", "Bezeichnung", "Text"]);
      const costType = getRowText(row, ["Kostenart", "Art", "Kategorie"]);

      if (!description || !costType) return null;

      const rawDate = getRowValue(row, ["Datum", "Leistungsdatum", "Tag"]);
      const entryDate =
        rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
          ? rawDate
          : rawDate
            ? new Date(String(rawDate))
            : new Date();
      const quantity = optionalExcelNumber(getRowValue(row, ["Menge", "Anzahl"]));
      const unit = getRowText(row, ["Einheit", "ME"]) ?? "Stk.";
      const unitPrice = optionalExcelNumber(
        getRowValue(row, ["EP netto", "EP", "Einheitspreis", "Preis"]),
      );
      const amount =
        optionalExcelNumber(getRowValue(row, ["Betrag netto", "Betrag", "Summe"])) ||
        quantity * unitPrice;

      return {
        amountCents: Math.round(amount * 100),
        costType,
        description,
        entryDate:
          entryDate && !Number.isNaN(entryDate.getTime()) ? entryDate : new Date(),
        notes: getRowText(row, ["Bemerkung", "Notiz", "Hinweis"]) ?? `Import aus ${file.name}`,
        quantity,
        source: "DETAIL_EXCEL_IMPORT",
        status: getRowText(row, ["Status"]) ?? "geschätzt",
        unit,
        unitPriceCents: Math.round(unitPrice * 100),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (importedEntries.length === 0) {
    throw new Error(
      "Es wurden keine Detailpositionen gefunden. Erwartet werden mindestens Kostenart und Beschreibung.",
    );
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (formData.get("replaceDetailImport") === "on") {
      await tx.controllingDetailEntry.deleteMany({
        where: {
          reportId,
          source: "DETAIL_EXCEL_IMPORT",
        },
      });
    }

    await tx.controllingDetailEntry.createMany({
      data: importedEntries.map((entry) => ({
        ...entry,
        projectId,
        reportId,
      })),
    });
  });

  revalidateControlling();
  redirect(pathFor(reportId, projectId));
}

type DispositionImportResult =
  | {
      detailCount: number;
      hourCount: number;
      ok: true;
      rateSetName: string;
      rateSetYear: number;
      useActualHours: boolean;
    }
  | { ok: false; reason: string };

/** Kernlogik des Dispo-Imports, ohne redirect() - wird sowohl vom
 * manuellen Knopf (importDispositionIntoPerformanceReport) als auch beim
 * Anlegen einer neuen Leistungsmeldung (createPerformanceReport)
 * aufgerufen, damit eine frische Meldung sofort mit den zum Zeitraum
 * passenden Dispo-/Zeiterfassungsdaten vorbefüllt ist statt leer zu
 * starten. */
async function runDispositionImport(
  reportId: string,
  projectId: string,
): Promise<DispositionImportResult> {
  const report = await prisma.controllingPerformanceReport.findUniqueOrThrow({
    where: {
      id: reportId,
    },
  });
  // Derselbe Modus wie "Leistungsmeldungsdaten" -> Leistungsmeldung nach
  // Leistung/Disposition (report.hoursSource) - eine eigene Auswahl an
  // dieser Stelle gab es früher zusätzlich, das war dieselbe Entscheidung
  // zweimal an zwei verschiedenen Stellen auf derselben Seite.
  const useActualHours = report.hoursSource === "APPROVED_TIME";
  const { start } = dayBounds(report.periodStart ?? report.reportDate);
  const { end } = dayBounds(report.periodEnd ?? report.reportDate);
  const rateSet = await resolvePerformanceRateSet(
    report.rateSetId,
    report.periodEnd ?? report.reportDate,
    report.reportDate,
  );

  if (!rateSet) {
    const rateYear = (report.periodEnd ?? report.reportDate).getFullYear();

    return {
      ok: false,
      reason: `Für ${rateYear} ist noch kein Satzstand angelegt. Bitte unter Controlling > Verrechnungssätze zuerst den Satzstand ${rateYear} erstellen.`,
    };
  }

  const [
    crewAssignments,
    crewTimeEntries,
    equipmentAssignments,
    asphaltDispatchEntries,
    asphaltCrews,
    asphaltLoads,
    tackCoatLoads,
    specialVehicleAssignments,
    longHaulEntries,
    projectInventoryItems,
    employeeGroupRates,
    employeesForDriverNames,
  ] = await Promise.all([
    prisma.crewPlanningAssignment.findMany({
      where: {
        endDate: {
          gte: start,
        },
        row: {
          projectId,
        },
        startDate: {
          lte: end,
        },
      },
      include: {
        crew: {
          include: {
            defaultVehicles: {
              include: {
                inventoryItem: true,
                vehicle: true,
              },
              where: {
                isActive: true,
              },
            },
            members: {
              where: {
                isActive: true,
              },
            },
          },
        },
        extraVehicles: {
          include: {
            inventoryItem: true,
            vehicle: true,
          },
        },
        extraEmployees: true,
        row: true,
      },
    }),
    prisma.crewTimeEntry.findMany({
      include: {
        employees: true,
      },
      where: {
        projectId,
        status: "APPROVED",
        workDate: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.equipmentDispatchAssignment.findMany({
      where: {
        endDate: {
          gte: start,
        },
        projectId,
        startDate: {
          lte: end,
        },
      },
      include: {
        inventoryItem: true,
        vehicle: true,
      },
    }),
    prisma.asphaltDispatchEntry.findMany({
      where: {
        projectId,
        workDate: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.crew.findMany({
      where: {
        isActive: true,
        isAsphaltDispatchCrew: true,
      },
      include: {
        members: {
          include: {
            employee: {
              include: {
                positions: true,
              },
            },
          },
          where: {
            isActive: true,
          },
        },
      },
    }),
    prisma.asphaltLoadAllocation.findMany({
      where: {
        projectId,
        workDate: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.tackCoatLoadAllocation.findMany({
      where: {
        projectId,
        workDate: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.specialVehicleDispatchAssignment.findMany({
      where: {
        projectId,
        workDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        vehicleInventoryItem: true,
      },
    }),
    prisma.truckLongHaulEntry.findMany({
      where: {
        projectId,
        workDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        truckAssignments: true,
      },
    }),
    prisma.inventoryItem.findMany({
      where: {
        currentProjectId: projectId,
        status: {
          notIn: ["INACTIVE", "DELETED"],
        },
      },
      include: {
        category: true,
      },
    }),
    prisma.controllingEmployeeGroupRate.findMany({
      where: {
        isActive: true,
        rateSetId: rateSet.id,
      },
    }),
    prisma.employee.findMany({
      include: {
        driver: true,
        positions: true,
      },
      where: {
        statusValue: {
          not: "ausgeschieden",
        },
      },
    }),
  ]);

  type ImportedHourEntry = {
    employeeCount: number;
    employeeId?: string | null;
    endsAt: string | null;
    entryDate: Date;
    hoursPerEmployee: number;
    internalCostCents: number;
    internalRateCents: number;
    label: string;
    notes: string;
    realCostCents: number;
    realRateCents: number;
    source: string;
    startsAt: string | null;
    totalHours: number;
  };

  const employeeGroupRateByName = new Map(
    employeeGroupRates.map((rate) => [rate.name, rate]),
  );

  function employeeRateFor(
    employee: {
      isLeadership: boolean;
      positions: Array<{
        positionLabel: string;
      }>;
    } | null | undefined,
  ) {
    if (!employee) {
      return {
        internalRateCents: 0,
        realRateCents: 0,
      };
    }

    const candidates = [
      ...employee.positions.map((position) => position.positionLabel),
      ...(employee.isLeadership ? ["Führung / Bauleitung / Polier"] : []),
      employee.positions.length === 0 ? "Ohne Positionsgruppe" : null,
    ].filter((name): name is string => Boolean(name));

    for (const name of candidates) {
      const rate = employeeGroupRateByName.get(name);

      if (rate) {
        return {
          internalRateCents: rate.internalRateCents,
          realRateCents: rate.realRateCents,
        };
      }
    }

    return {
      internalRateCents: 0,
      realRateCents: 0,
    };
  }

  function costedHourEntry(entry: Omit<ImportedHourEntry, "internalCostCents" | "realCostCents">): ImportedHourEntry {
    return {
      ...entry,
      internalCostCents: Math.round(entry.totalHours * entry.internalRateCents),
      realCostCents: Math.round(entry.totalHours * entry.realRateCents),
    };
  }

  function normalizePersonName(value: string | null | undefined) {
    return (value ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  const employeeByName = new Map<string, (typeof employeesForDriverNames)[number]>();

  for (const employee of employeesForDriverNames) {
    const variants = [
      `${employee.firstName} ${employee.lastName}`,
      `${employee.lastName} ${employee.firstName}`,
      `${employee.lastName}, ${employee.firstName}`,
      employee.driver ? `${employee.driver.firstName} ${employee.driver.lastName}` : "",
      employee.driver ? `${employee.driver.lastName} ${employee.driver.firstName}` : "",
      employee.driver ? `${employee.driver.lastName}, ${employee.driver.firstName}` : "",
    ];

    for (const variant of variants) {
      const normalized = normalizePersonName(variant);

      if (normalized) {
        employeeByName.set(normalized, employee);
      }
    }
  }

  function employeeForName(name: string | null | undefined) {
    return employeeByName.get(normalizePersonName(name));
  }

  const employeeById = new Map(employeesForDriverNames.map((employee) => [employee.id, employee]));

  function resolveAssignmentEmployeeIds(assignment: (typeof crewAssignments)[number]) {
    const excluded = new Set(
      assignment.extraEmployees.filter((item) => item.mode === "EXCLUDE").map((item) => item.employeeId),
    );
    const ids = new Set<string>();

    for (const member of assignment.crew?.members ?? []) {
      if (!excluded.has(member.employeeId)) ids.add(member.employeeId);
    }

    for (const item of assignment.extraEmployees) {
      if (item.mode !== "EXCLUDE") ids.add(item.employeeId);
    }

    return [...ids];
  }

  const hourEntries: ImportedHourEntry[] = useActualHours
    ? crewTimeEntries.flatMap((entry) =>
        entry.employees
          .filter((employee) => employee.isPresent && employee.netHours > 0)
          .map((employee) => {
            const rates = employeeRateFor(employeeById.get(employee.employeeId));

            return costedHourEntry({
              employeeCount: 1,
              employeeId: employee.employeeId,
              endsAt: employee.endTime,
              entryDate: entry.workDate,
              hoursPerEmployee: employee.netHours,
              internalRateCents: rates.internalRateCents,
              label: employee.employeeName,
              notes: `aus Zeiterfassung übernommen, freigegeben (${formatIsoDate(entry.workDate)})`,
              realRateCents: rates.realRateCents,
              source: "DISPOSITION_IMPORT",
              startsAt: employee.startTime,
              totalHours: Math.round(employee.netHours * 100) / 100,
            });
          }),
      )
    : crewAssignments.flatMap((assignment) => {
        const hoursPerEmployee = timeRangeHours(assignment.startTime, assignment.endTime);
        const crewLabel =
          assignment.crewName || assignment.crew?.name || assignment.row.rowTitle || "Kolonne";
        const employeeIds = resolveAssignmentEmployeeIds(assignment);

        if (employeeIds.length === 0) {
          return [
            costedHourEntry({
              employeeCount: 1,
              endsAt: assignment.endTime,
              entryDate: start,
              hoursPerEmployee,
              internalRateCents: 0,
              label: crewLabel,
              notes: `aus Planung übernommen, keine Mitarbeiter zugeordnet (${formatIsoDate(start)})`,
              realRateCents: 0,
              source: "DISPOSITION_IMPORT",
              startsAt: assignment.startTime,
              totalHours: Math.round(hoursPerEmployee * 100) / 100,
            }),
          ];
        }

        return employeeIds.map((employeeId) => {
          const employee = employeeById.get(employeeId);
          const rates = employeeRateFor(employee);
          const label = employee ? `${employee.lastName}, ${employee.firstName}` : crewLabel;

          return costedHourEntry({
            employeeCount: 1,
            employeeId,
            endsAt: assignment.endTime,
            entryDate: start,
            hoursPerEmployee,
            internalRateCents: rates.internalRateCents,
            label,
            notes: `aus Planung übernommen, ${crewLabel} (${formatIsoDate(start)})`,
            realRateCents: rates.realRateCents,
            source: "DISPOSITION_IMPORT",
            startsAt: assignment.startTime,
            totalHours: Math.round(hoursPerEmployee * 100) / 100,
          });
        });
      });
  const importedHourKeys = new Set(
    hourEntries.map((entry) => `${entry.entryDate.toISOString()}|${entry.label}`),
  );

  function pushHourEntry(entry: (typeof hourEntries)[number]) {
    const key = `${entry.entryDate.toISOString()}|${entry.label}`;

    if (importedHourKeys.has(key)) {
      return;
    }

    importedHourKeys.add(key);
    hourEntries.push(entry);
  }

  // Kolonnen-/Fahrer-Stunden aus Asphalt-/LKW-/Sonderfahrzeugdisposition sind
  // Planungs-/Dispo-Annahmen, keine bestätigten Ist-Stunden - bei "Tatsächlich
  // gebuchte Stunden" (useActualHours) sollen ausschließlich die oben aus
  // crewTimeEntries (freigegebene Zeiterfassung) übernommenen Stunden zählen.
  // Ein Fahrer ohne eigenen Zeiterfassungseintrag darf dort also fehlen,
  // statt aus der Disposition nachgetragen zu werden.
  if (!useActualHours) {
    const asphaltCrewByName = new Map(asphaltCrews.map((crew) => [crew.name, crew]));

    for (const asphaltEntry of asphaltDispatchEntries) {
      const crew = asphaltCrewByName.get(asphaltEntry.crew);
      const employeeCount = crew?.members.length ?? 0;
      const hoursPerEmployee = 10.5;

      if (crew?.members.length) {
        for (const member of crew.members) {
          const employee = member.employee;
          const rates = employeeRateFor(employee);
          const label = [employee.lastName, employee.firstName]
            .filter(Boolean)
            .join(", ");

          pushHourEntry(costedHourEntry({
            employeeCount: 1,
            employeeId: employee.id,
            endsAt: "17:00",
            entryDate: asphaltEntry.workDate,
            hoursPerEmployee,
            internalRateCents: rates.internalRateCents,
            label: label || asphaltEntry.crew || "Asphaltkolonne",
            notes: `aus Asphaltdisposition übernommen · ${asphaltEntry.crew} · ${asphaltEntry.projectNumber} ${asphaltEntry.projectName}`.trim(),
            realRateCents: rates.realRateCents,
            source: "DISPOSITION_IMPORT",
            startsAt: "06:30",
            totalHours: hoursPerEmployee,
          }));
        }

        continue;
      }

      pushHourEntry(costedHourEntry({
        employeeCount: employeeCount || 1,
        endsAt: "17:00",
        entryDate: asphaltEntry.workDate,
        hoursPerEmployee,
        internalRateCents: 0,
        label: asphaltEntry.crew || "Asphaltkolonne",
        notes: `aus Asphaltdisposition übernommen · ${asphaltEntry.projectNumber} ${asphaltEntry.projectName}`.trim(),
        realRateCents: 0,
        source: "DISPOSITION_IMPORT",
        startsAt: "06:30",
        totalHours: Math.round((employeeCount || 1) * hoursPerEmployee * 100) / 100,
      }));
    }

    // Ein Fahrer kann an einem Tag mehrere Touren fahren (mehrere
    // Zuteilungs-Zeilen mit demselben Namen/Datum) - pushHourEntry dedupliziert
    // nach Datum+Bezeichnung, ohne Aggregation würde daher nur die erste Tour
    // des Tages gezählt und alle weiteren Touren stillschweigend verworfen.
    // Deshalb hier je Fahrer/Tag erst alle Touren aufsummieren, dann eine
    // einzige Stundenzeile mit der Gesamtstundenzahl anlegen.
    function aggregateLoadsByDriverDay<T extends { driverName: string | null; endTime: string; startTime: string; workDate: Date }>(
      loads: T[],
      quantityOf: (load: T) => number,
    ) {
      const groups = new Map<
        string,
        { driverName: string; earliestStart: string; latestEnd: string; totalHours: number; totalQuantity: number; tourCount: number; workDate: Date }
      >();

      for (const load of loads) {
        if (!load.driverName) continue;
        const key = `${load.driverName}|${load.workDate.toISOString()}`;
        const hours = timeRangeHours(load.startTime, load.endTime);
        const existing = groups.get(key);

        if (existing) {
          existing.totalHours += hours;
          existing.totalQuantity += quantityOf(load);
          existing.tourCount += 1;
          if (load.startTime < existing.earliestStart) existing.earliestStart = load.startTime;
          if (load.endTime > existing.latestEnd) existing.latestEnd = load.endTime;
        } else {
          groups.set(key, {
            driverName: load.driverName,
            earliestStart: load.startTime,
            latestEnd: load.endTime,
            totalHours: hours,
            totalQuantity: quantityOf(load),
            tourCount: 1,
            workDate: load.workDate,
          });
        }
      }

      return [...groups.values()];
    }

    for (const group of aggregateLoadsByDriverDay(asphaltLoads, (load) => load.totalTons)) {
      const employee = employeeForName(group.driverName);
      const rates = employeeRateFor(employee);
      const totalHours = Math.round(group.totalHours * 100) / 100;

      pushHourEntry(costedHourEntry({
        employeeCount: 1,
        employeeId: employee?.id,
        endsAt: group.latestEnd,
        entryDate: group.workDate,
        hoursPerEmployee: totalHours,
        internalRateCents: rates.internalRateCents,
        label: `LKW-Fahrer ${group.driverName}`,
        notes: `aus Asphalt-/LKW-Zuteilung übernommen · ${group.tourCount} Tour${group.tourCount === 1 ? "" : "en"} · ${Math.round(group.totalQuantity * 100) / 100} t`,
        realRateCents: rates.realRateCents,
        source: "DISPOSITION_IMPORT",
        startsAt: group.earliestStart,
        totalHours,
      }));
    }

    for (const group of aggregateLoadsByDriverDay(tackCoatLoads, (load) => load.totalLiters)) {
      const employee = employeeForName(group.driverName);
      const rates = employeeRateFor(employee);
      const totalHours = Math.round(group.totalHours * 100) / 100;
      const unit = tackCoatLoads.find((load) => load.driverName === group.driverName)?.quantityUnit ?? "l";

      pushHourEntry(costedHourEntry({
        employeeCount: 1,
        employeeId: employee?.id,
        endsAt: group.latestEnd,
        entryDate: group.workDate,
        hoursPerEmployee: totalHours,
        internalRateCents: rates.internalRateCents,
        label: `LKW-Fahrer ${group.driverName}`,
        notes: `aus Anspritzmittel-Zuteilung übernommen · ${group.tourCount} Tour${group.tourCount === 1 ? "" : "en"} · ${Math.round(group.totalQuantity * 100) / 100} ${unit}`,
        realRateCents: rates.realRateCents,
        source: "DISPOSITION_IMPORT",
        startsAt: group.earliestStart,
        totalHours,
      }));
    }

    for (const assignment of specialVehicleAssignments) {
      if (!assignment.operatorDriverName) {
        continue;
      }

      const hoursPerEmployee = timeRangeHours(assignment.startTime, assignment.endTime);
      const employee = employeeForName(assignment.operatorDriverName);
      const rates = employeeRateFor(employee);

      pushHourEntry(costedHourEntry({
        employeeCount: 1,
        employeeId: employee?.id,
        endsAt: assignment.endTime,
        entryDate: assignment.workDate,
        hoursPerEmployee,
        internalRateCents: rates.internalRateCents,
        label: `Bediener ${assignment.operatorDriverName}`,
        notes: `aus Sonderfahrzeugdisposition übernommen · ${assignment.vehicleName}`,
        realRateCents: rates.realRateCents,
        source: "DISPOSITION_IMPORT",
        startsAt: assignment.startTime,
        totalHours: hoursPerEmployee,
      }));
    }
  }

  const detailEntries: Array<{
    amountCents: number;
    costType: string;
    description: string;
    entryDate: Date;
    inventoryItemId?: string | null;
    notes: string;
    quantity: number;
    source: string;
    status: string;
    unit: string;
    unitPriceCents: number;
  }> = [];
  const importedInventoryItemIds = new Set<string>();

  function pushDetailEntry(entry: (typeof detailEntries)[number]) {
    if (entry.inventoryItemId) {
      const inventoryKey = `${entry.inventoryItemId}|${entry.entryDate.toISOString()}|${entry.costType}`;

      if (importedInventoryItemIds.has(inventoryKey)) {
        return;
      }

      importedInventoryItemIds.add(inventoryKey);
    }

    detailEntries.push(entry);
  }

  for (const assignment of equipmentAssignments) {
      const description =
        assignment.inventoryItem?.name ??
        assignment.vehicle.vehicleNumber ??
        assignment.vehicle.licensePlate ??
        "Gerät";
      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description,
        entryDate: start,
        inventoryItemId: assignment.inventoryItemId,
        notes: "aus Gerätedisposition übernommen",
        quantity: 1,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "Tag",
        unitPriceCents: 0,
      });
  }

  for (const assignment of crewAssignments) {
    for (const vehicle of assignment.crew?.defaultVehicles ?? []) {
      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description:
          vehicle.inventoryItem?.name ??
          vehicle.vehicle.vehicleNumber ??
          vehicle.vehicle.licensePlate ??
          "Kolonnengerät",
        entryDate: start,
        inventoryItemId: vehicle.inventoryItemId,
        notes: `aus Team-/Kolonnenzuordnung übernommen · ${assignment.crewName || assignment.crew?.name || "Kolonne"}`,
        quantity: 1,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "Tag",
        unitPriceCents: 0,
      });
    }

    for (const vehicle of assignment.extraVehicles) {
      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description:
          vehicle.inventoryItem?.name ??
          vehicle.vehicle.vehicleNumber ??
          vehicle.vehicle.licensePlate ??
          "Zusatzgerät",
        entryDate: start,
        inventoryItemId: vehicle.inventoryItemId,
        notes: `aus Planung extra zugeordnet · ${assignment.crewName || assignment.crew?.name || "Kolonne"}`,
        quantity: 1,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "Tag",
        unitPriceCents: 0,
      });
    }
  }

  for (const allocation of asphaltLoads) {
    if (allocation.vehicleInventoryItemId) {
      const vehicleHours = timeRangeHours(allocation.startTime, allocation.endTime);

      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description:
          allocation.vehicleNumber ||
          allocation.licensePlate ||
          allocation.vehicleType ||
          "LKW",
        entryDate: allocation.workDate,
        inventoryItemId: allocation.vehicleInventoryItemId,
        notes: `LKW aus Asphalt-Zuteilung übernommen${allocation.driverName ? ` · ${allocation.driverName}` : ""}`,
        quantity: vehicleHours,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "h",
        unitPriceCents: 0,
      });
    }

    pushDetailEntry({
      amountCents: 0,
      costType: "Material",
      description: allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
      entryDate: allocation.workDate,
      inventoryItemId: allocation.asphaltInventoryItemId,
      notes: `aus LKW-/Asphaltdisposition übernommen${allocation.driverName ? ` · ${allocation.driverName}` : ""}`,
      quantity: allocation.totalTons,
      source: "DISPOSITION_IMPORT",
      status: "geschätzt",
      unit: "t",
      unitPriceCents: 0,
    });
  }

  for (const allocation of tackCoatLoads) {
    if (allocation.vehicleInventoryItemId) {
      const vehicleHours = timeRangeHours(allocation.startTime, allocation.endTime);

      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description:
          allocation.vehicleNumber ||
          allocation.licensePlate ||
          allocation.vehicleType ||
          "LKW",
        entryDate: allocation.workDate,
        inventoryItemId: allocation.vehicleInventoryItemId,
        notes: `LKW aus Anspritzmittel-Zuteilung übernommen${allocation.driverName ? ` · ${allocation.driverName}` : ""}`,
        quantity: vehicleHours,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "h",
        unitPriceCents: 0,
      });
    }

    pushDetailEntry({
      amountCents: 0,
      costType: "Material",
      description: allocation.materialName || "Anspritzmittel",
      entryDate: allocation.workDate,
      inventoryItemId: allocation.tackCoatInventoryItemId,
      notes: `aus LKW-/Sonderfahrzeugdisposition übernommen${allocation.driverName ? ` · ${allocation.driverName}` : ""}`,
      quantity: allocation.totalLiters,
      source: "DISPOSITION_IMPORT",
      status: "geschätzt",
      unit: allocation.quantityUnit || "l",
      unitPriceCents: 0,
    });
  }

  const allocatedLongHaulEntryIds = new Set(
    asphaltLoads
      .map((allocation) => allocation.longHaulEntryId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const entry of longHaulEntries) {
    if (allocatedLongHaulEntryIds.has(entry.id)) {
      continue;
    }

    if (!entry.materialName || entry.materialQuantity === 0) {
      continue;
    }

    pushDetailEntry({
      amountCents: 0,
      costType: "Material",
      description: entry.materialName,
      entryDate: entry.workDate,
      inventoryItemId: entry.materialInventoryItemId,
      notes: `aus LKW-Einteilung übernommen${entry.truckAssignments.length ? ` · ${entry.truckAssignments.length} Fahrzeug(e)` : ""}`,
      quantity: entry.materialQuantity,
      source: "DISPOSITION_IMPORT",
      status: "geschätzt",
      unit: entry.materialUnit || "Stk.",
      unitPriceCents: 0,
    });

    for (const assignment of entry.truckAssignments) {
      if (!assignment.vehicleInventoryItemId) {
        continue;
      }

      const vehicleHours = timeRangeHours(
        assignment.plannedStartTime,
        assignment.plannedEndTime,
      );

      pushDetailEntry({
        amountCents: 0,
        costType: "Geräte",
        description:
          assignment.vehicleNumber ||
          assignment.licensePlate ||
          assignment.vehicleType ||
          assignment.vehicleCategory ||
          "LKW",
        entryDate: entry.workDate,
        inventoryItemId: assignment.vehicleInventoryItemId,
        notes: `LKW aus LKW-Einteilung übernommen${assignment.driverName ? ` · ${assignment.driverName}` : ""}`,
        quantity: vehicleHours,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: "h",
        unitPriceCents: 0,
      });
    }
  }

  const specialVehicleObjectNumbers = [
    ...new Set(
      specialVehicleAssignments
        .filter((assignment) => !assignment.vehicleInventoryItemId)
        .map((assignment) => assignment.vehicleName.match(/^(\d{6})\b/)?.[1])
        .filter((objectNumber): objectNumber is string => Boolean(objectNumber)),
    ),
  ];
  const specialVehicleItemsByObjectNumber = new Map(
    (
      specialVehicleObjectNumbers.length
        ? await prisma.inventoryItem.findMany({
            where: {
              objectNumber: {
                in: specialVehicleObjectNumbers,
              },
              status: {
                notIn: ["INACTIVE", "DELETED"],
              },
            },
            select: {
              categoryId: true,
              id: true,
              name: true,
              objectNumber: true,
            },
          })
        : []
    ).map((item) => [item.objectNumber ?? "", item]),
  );
  const specialMaterialNames = [
    ...new Set(
      specialVehicleAssignments
        .map((assignment) => assignment.materialName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const specialMaterialItemsByName = new Map(
    (
      specialMaterialNames.length
        ? await prisma.inventoryItem.findMany({
            where: {
              name: {
                in: specialMaterialNames,
              },
              status: {
                notIn: ["INACTIVE", "DELETED"],
              },
              category: {
                dailyReportSection: "MATERIAL",
              },
            },
            select: {
              id: true,
              name: true,
            },
          })
        : []
    ).map((item) => [item.name, item]),
  );

  for (const assignment of specialVehicleAssignments) {
    const objectNumberFromVehicleName = assignment.vehicleName.match(/^(\d{6})\b/)?.[1];
    const resolvedVehicleItem =
      assignment.vehicleInventoryItem ??
      (objectNumberFromVehicleName
        ? specialVehicleItemsByObjectNumber.get(objectNumberFromVehicleName)
        : null);

    if (objectNumberFromVehicleName && !resolvedVehicleItem) {
      continue;
    }

    const vehicleHours = timeRangeHours(assignment.startTime, assignment.endTime);

    pushDetailEntry({
      amountCents: 0,
      costType: resolvedVehicleItem?.categoryId ? "Geräte" : "Sonstiges",
      description:
        resolvedVehicleItem?.name ||
        assignment.vehicleName ||
        assignment.taskText ||
        "Sonderfahrzeug",
      entryDate: assignment.workDate,
      inventoryItemId: assignment.vehicleInventoryItemId ?? resolvedVehicleItem?.id,
      notes: `aus Sonderfahrzeugdisposition übernommen${assignment.materialName ? ` · ${assignment.materialName}` : ""}`,
      quantity: resolvedVehicleItem
        ? vehicleHours
        : (assignment.quantity ?? vehicleHours),
      source: "DISPOSITION_IMPORT",
      status: "geschätzt",
      unit: resolvedVehicleItem ? "h" : assignment.quantityUnit || "h",
      unitPriceCents: 0,
    });

    const materialName = assignment.materialName?.trim();
    const materialQuantity = assignment.quantity ?? 0;

    if (materialName && materialQuantity > 0) {
      const materialItem = specialMaterialItemsByName.get(materialName);

      pushDetailEntry({
        amountCents: 0,
        costType: "Material",
        description: materialName,
        entryDate: assignment.workDate,
        inventoryItemId: materialItem?.id,
        notes: `aus Sonderfahrzeugdisposition übernommen · ${assignment.vehicleName || assignment.taskText || "Sonderfahrzeug"}`,
        quantity: materialQuantity,
        source: "DISPOSITION_IMPORT",
        status: "geschätzt",
        unit: assignment.quantityUnit || "Stk.",
        unitPriceCents: 0,
      });
    }
  }

  for (const item of projectInventoryItems) {
    pushDetailEntry({
      amountCents: 0,
      costType: item.category?.dailyReportSection === "MATERIAL" ? "Material" : "Geräte",
      description: item.name,
      entryDate: start,
      inventoryItemId: item.id,
      notes: `aus Inventar-Zuweisung zur Maßnahme übernommen${item.currentLocationLabel ? ` · Standort: ${item.currentLocationLabel}` : ""}`,
      quantity: item.isStockManaged ? (item.currentStock ?? 0) : 1,
      source: "DISPOSITION_IMPORT",
      status: "geschätzt",
      unit: item.stockUnit || "Stk.",
      unitPriceCents: 0,
    });
  }

  const inventoryRateItemIds = [
    ...new Set(
      detailEntries
        .map((entry) => entry.inventoryItemId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const inventoryRateItems = inventoryRateItemIds.length
    ? await prisma.inventoryItem.findMany({
        where: {
          id: {
            in: inventoryRateItemIds,
          },
        },
        select: {
          billingRateCents: true,
          id: true,
          name: true,
        },
      })
    : [];
  const inventoryYearRates = inventoryRateItemIds.length
    ? await prisma.controllingInventoryItemRate.findMany({
        where: {
          itemId: {
            in: inventoryRateItemIds,
          },
          rateSetId: rateSet.id,
        },
      })
    : [];
  const inventoryYearRateByItemId = new Map(
    inventoryYearRates.map((rate) => [rate.itemId, rate.billingRateCents ?? 0]),
  );
  const inventoryRateById = new Map(
    inventoryRateItems.map((item) => [
      item.id,
      inventoryYearRateByItemId.get(item.id) ?? item.billingRateCents ?? 0,
    ]),
  );
  const inventoryNameById = new Map(
    inventoryRateItems.map((item) => [item.id, item.name]),
  );

  for (const entry of detailEntries) {
    if (!entry.inventoryItemId) {
      continue;
    }

    entry.description = inventoryNameById.get(entry.inventoryItemId) ?? entry.description;

    const rate = inventoryRateById.get(entry.inventoryItemId) ?? 0;

    if (rate <= 0) {
      continue;
    }

    entry.unitPriceCents = rate;
    entry.amountCents = Math.round(entry.quantity * rate);
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.controllingHourEntry.deleteMany({
      where: {
        reportId,
        source: "DISPOSITION_IMPORT",
      },
    });
    await tx.controllingDetailEntry.deleteMany({
      where: {
        reportId,
        source: "DISPOSITION_IMPORT",
      },
    });

    if (hourEntries.length) {
      await tx.controllingHourEntry.createMany({
        data: hourEntries.map((entry) => ({
          ...entry,
          projectId,
          reportId,
        })),
      });
    }

    if (detailEntries.length) {
      await tx.controllingDetailEntry.createMany({
        data: detailEntries.map((entry) => ({
          ...entry,
          projectId,
          reportId,
        })),
      });
    }
  });

  return {
    detailCount: detailEntries.length,
    hourCount: hourEntries.length,
    ok: true,
    rateSetName: rateSet.name,
    rateSetYear: rateSet.year,
    useActualHours,
  };
}

function dispositionImportMessage(result: DispositionImportResult) {
  if (!result.ok) return result.reason;

  return `Übernommen: ${result.hourCount} Stundenzeilen (${result.useActualHours ? "aus Zeiterfassung, freigegeben" : "aus Planung/Disposition"}) und ${result.detailCount} Positionszeilen aus Planung/Disposition. Verwendeter Satzstand: ${result.rateSetName} (${result.rateSetYear}).`;
}

export async function importDispositionIntoPerformanceReport(formData: FormData) {
  await requireSession();
  const reportId = requiredText(formData.get("reportId"), "Leistungsmeldung");
  const projectId = requiredText(formData.get("projectId"), "Projekt");

  const result = await runDispositionImport(reportId, projectId);

  if (result.ok) {
    revalidateControlling();
  }

  redirect(
    pathFor(reportId, projectId, {
      message: dispositionImportMessage(result),
      type: result.ok ? "success" : "error",
    }),
  );
}

export async function saveEmployeeGroupRates(formData: FormData) {
  await requireSession();
  const names = formData.getAll("rateName").map((value) => requiredText(value, "Gruppe"));
  const descriptions = formData.getAll("rateDescription");
  const realRates = formData.getAll("rateReal");
  const internalRates = formData.getAll("rateInternal");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [index, name] of names.entries()) {
      const existing = await tx.controllingEmployeeGroupRate.findFirst({
        where: {
          name,
        },
        orderBy: {
          validFrom: "desc",
        },
      });
      const data = {
        description: text(descriptions[index] ?? null),
        internalRateCents: moneyCents(
          internalRates[index] ?? null,
          `Interner Satz ${name}`,
        ),
        isActive: true,
        realRateCents: moneyCents(realRates[index] ?? null, `EK real ${name}`),
        sortOrder: index,
        visibilityLevel: "CONTROLLING",
      };

      if (existing) {
        await tx.controllingEmployeeGroupRate.update({
          data,
          where: {
            id: existing.id,
          },
        });
      } else {
        await tx.controllingEmployeeGroupRate.create({
          data: {
            ...data,
            name,
          },
        });
      }
    }
  });

  revalidateControlling();
}
