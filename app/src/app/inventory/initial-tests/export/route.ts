import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function validityStatus(validUntil: Date | null) {
  if (!validUntil) return "Gültigkeit fehlt";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const warningDate = new Date(today);
  warningDate.setUTCDate(warningDate.getUTCDate() + 90);
  if (validUntil < today) return "Abgelaufen";
  if (validUntil <= warningDate) return "Läuft innerhalb von 90 Tagen ab";
  return "Gültig";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const warningDate = new Date(today);
  warningDate.setUTCDate(warningDate.getUTCDate() + 90);

  const where: Prisma.InventoryInitialTestWhereInput = {
    ...(q
      ? {
          OR: [
            { productCode: { contains: q } },
            { productName: { contains: q } },
            { testNumber: { contains: q } },
            { description: { contains: q } },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
    ...(status === "valid" ? { validUntil: { gt: warningDate } } : {}),
    ...(status === "soon"
      ? { validUntil: { gte: today, lte: warningDate } }
      : {}),
    ...(status === "expired" ? { validUntil: { lt: today } } : {}),
    ...(status === "missing" ? { validUntil: null } : {}),
  };

  const tests = await prisma.inventoryInitialTest.findMany({
    orderBy: [{ category: "asc" }, { productName: "asc" }],
    where,
  });

  const rows = tests.map((test) => ({
    ID: test.productCode ?? "",
    "Asphalt-/Materialbezeichnung": test.productName,
    "Sorte / Schichtgruppe": test.category ?? "",
    "Gültig ab": test.validFrom ?? "",
    "Gültig bis": test.validUntil ?? "",
    Status: validityStatus(test.validUntil),
    Prüfungsnummer: test.testNumber ?? "",
    "Dichte t/m³": test.densityTonPerCubicMeter,
    Bezeichnung: test.description ?? "",
    Bemerkung: test.notes ?? "",
    "PDF-Link": test.pdfUrl ? new URL(test.pdfUrl, url.origin).toString() : "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 36 },
    { wch: 24 },
    { wch: 13 },
    { wch: 13 },
    { wch: 31 },
    { wch: 22 },
    { wch: 13 },
    { wch: 34 },
    { wch: 36 },
    { wch: 55 },
  ];
  worksheet["!autofilter"] = {
    ref: `A1:K${Math.max(rows.length + 1, 1)}`,
  };
  for (let row = 2; row <= rows.length + 1; row += 1) {
    for (const column of ["D", "E"]) {
      const cell = worksheet[`${column}${row}`];
      if (cell?.t === "d") cell.z = "dd.mm.yyyy";
    }
    const densityCell = worksheet[`H${row}`];
    if (densityCell?.t === "n") densityCell.z = "0.000";
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, "Erstprüfungen");

  const legend = XLSX.utils.aoa_to_sheet([
    ["Status", "Bedeutung"],
    ["Gültig", "Noch länger als 90 Tage gültig."],
    ["Läuft innerhalb von 90 Tagen ab", "Zeitnah erneuern."],
    ["Abgelaufen", "Das Gültigkeitsdatum ist überschritten."],
    ["Gültigkeit fehlt", "Es wurde kein Gültigkeitsdatum hinterlegt."],
  ]);
  legend["!cols"] = [{ wch: 34 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(workbook, legend, "Legende");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    cellDates: true,
    type: "buffer",
  });
  const fileDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
  }).format(new Date());

  return new Response(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="erstpruefungen-${fileDate}.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
