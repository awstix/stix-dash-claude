import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatGermanDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getWeekday(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
  }).format(date);
}

function getIsoWeekInfo(date: Date) {
  const tempDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const dayNumber = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNumber);

  const weekYear = tempDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));

  const week = Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return {
    week,
    year: weekYear,
  };
}

function formatTons(value: number) {
  return Number(value.toFixed(2));
}

function makeWorksheet<T extends Record<string, unknown>>(
  rows: T[],
  headers: string[]
) {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([headers]);
  }

  return XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const fromDate = parseDate(fromParam);
  const toDate = parseDate(toParam);

  const where =
    fromDate && toDate
      ? {
          workDate: {
            gte: fromDate,
            lt: addDays(toDate, 1),
          },
        }
      : fromDate
        ? {
            workDate: {
              gte: fromDate,
            },
          }
        : toDate
          ? {
              workDate: {
                lt: addDays(toDate, 1),
              },
            }
          : {};

  const entries = await prisma.asphaltDispatchEntry.findMany({
    where,
    orderBy: [{ workDate: "asc" }, { crew: "asc" }, { createdAt: "asc" }],
  });

  const workbook = XLSX.utils.book_new();

  const exportInfoRows = [
    {
      Feld: "Export",
      Wert: "Asphaltdisposition",
    },
    {
      Feld: "Zeitraum von",
      Wert: fromDate ? formatGermanDate(fromDate) : "Kompletter Export",
    },
    {
      Feld: "Zeitraum bis",
      Wert: toDate ? formatGermanDate(toDate) : "Kompletter Export",
    },
    {
      Feld: "Anzahl Einträge",
      Wert: entries.length,
    },
    {
      Feld: "Gesamtmenge",
      Wert: `${formatTons(
        entries.reduce((sum, entry) => sum + entry.quantityTons, 0)
      )} t`,
    },
    {
      Feld: "Erstellt am",
      Wert: formatGermanDateTime(new Date()),
    },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(exportInfoRows, ["Feld", "Wert"]),
    "Exportinfo"
  );

  const detailRows = entries.map((entry) => {
    const weekInfo = getIsoWeekInfo(entry.workDate);

    return {
      Datum: formatGermanDate(entry.workDate),
      Wochentag: getWeekday(entry.workDate),
      KW: `KW ${weekInfo.week}/${weekInfo.year}`,
      Kolonne: entry.crew,
      Projektnummer: entry.projectNumber,
      Projektname: entry.projectName,
      Bauleiter: entry.constructionManager ?? "",
      Sortennummer: entry.asphaltMixNumber ?? "",
      Asphaltsorte: entry.asphaltMixName ?? "",
      "Menge t": formatTons(entry.quantityTons),
      Fremdmischgut: entry.isForeignMix ? "ja" : "nein",
      Bemerkung: entry.notes ?? "",
      Erstellt: formatGermanDateTime(entry.createdAt),
      Geändert: formatGermanDateTime(entry.updatedAt),
    };
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(detailRows, [
      "Datum",
      "Wochentag",
      "KW",
      "Kolonne",
      "Projektnummer",
      "Projektname",
      "Bauleiter",
      "Sortennummer",
      "Asphaltsorte",
      "Menge t",
      "Fremdmischgut",
      "Bemerkung",
      "Erstellt",
      "Geändert",
    ]),
    "Details"
  );

  const daySummaryMap = new Map<string, { date: Date; quantityTons: number; count: number }>();

  for (const entry of entries) {
    const key = formatDateInput(entry.workDate);

    const current = daySummaryMap.get(key) ?? {
      date: entry.workDate,
      quantityTons: 0,
      count: 0,
    };

    current.quantityTons += entry.quantityTons;
    current.count += 1;

    daySummaryMap.set(key, current);
  }

  const daySummaryRows = Array.from(daySummaryMap.values()).map((item) => {
    const weekInfo = getIsoWeekInfo(item.date);

    return {
      Datum: formatGermanDate(item.date),
      Wochentag: getWeekday(item.date),
      KW: `KW ${weekInfo.week}/${weekInfo.year}`,
      Einträge: item.count,
      "Menge t": formatTons(item.quantityTons),
    };
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(daySummaryRows, ["Datum", "Wochentag", "KW", "Einträge", "Menge t"]),
    "Tagesmengen"
  );

  const crewSummaryMap = new Map<
    string,
    { date: Date; crew: string; quantityTons: number; count: number }
  >();

  for (const entry of entries) {
    const key = `${formatDateInput(entry.workDate)}-${entry.crew}`;

    const current = crewSummaryMap.get(key) ?? {
      date: entry.workDate,
      crew: entry.crew,
      quantityTons: 0,
      count: 0,
    };

    current.quantityTons += entry.quantityTons;
    current.count += 1;

    crewSummaryMap.set(key, current);
  }

  const crewSummaryRows = Array.from(crewSummaryMap.values()).map((item) => {
    const weekInfo = getIsoWeekInfo(item.date);

    return {
      Datum: formatGermanDate(item.date),
      Wochentag: getWeekday(item.date),
      KW: `KW ${weekInfo.week}/${weekInfo.year}`,
      Kolonne: item.crew,
      Einträge: item.count,
      "Menge t": formatTons(item.quantityTons),
    };
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(crewSummaryRows, [
      "Datum",
      "Wochentag",
      "KW",
      "Kolonne",
      "Einträge",
      "Menge t",
    ]),
    "Kolonnenmengen"
  );

  const mixSummaryMap = new Map<
    string,
    { mixNumber: string; mixName: string; quantityTons: number; count: number }
  >();

  for (const entry of entries) {
    const mixNumber = entry.asphaltMixNumber ?? "Ohne Sortennummer";
    const mixName = entry.asphaltMixName ?? "Ohne Bezeichnung";
    const key = `${mixNumber}-${mixName}`;

    const current = mixSummaryMap.get(key) ?? {
      mixNumber,
      mixName,
      quantityTons: 0,
      count: 0,
    };

    current.quantityTons += entry.quantityTons;
    current.count += 1;

    mixSummaryMap.set(key, current);
  }

  const mixSummaryRows = Array.from(mixSummaryMap.values())
    .sort((a, b) => a.mixNumber.localeCompare(b.mixNumber, "de-DE"))
    .map((item) => ({
      Sortennummer: item.mixNumber,
      Asphaltsorte: item.mixName,
      Einträge: item.count,
      "Menge t": formatTons(item.quantityTons),
    }));

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(mixSummaryRows, [
      "Sortennummer",
      "Asphaltsorte",
      "Einträge",
      "Menge t",
    ]),
    "Sortenmengen"
  );

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    sheet["!cols"] = Array.from({ length: 16 }).map(() => ({
      wch: 22,
    }));
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  const rangeName =
    fromDate || toDate
      ? `${fromDate ? formatDateInput(fromDate) : "start"}_bis_${
          toDate ? formatDateInput(toDate) : "ende"
        }`
      : "komplett";

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asphaltdisposition-${rangeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}