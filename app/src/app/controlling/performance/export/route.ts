import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function formatDate(value: Date | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function euros(cents: number | null | undefined) {
  return (cents ?? 0) / 100;
}

function fileSafe(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9äöüß_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function getReport(reportId: string) {
  return prisma.controllingPerformanceReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      detailEntries: {
        orderBy: {
          entryDate: "asc",
        },
      },
      hourEntries: {
        orderBy: {
          entryDate: "asc",
        },
      },
      invoiceItems: {
        orderBy: {
          createdAt: "asc",
        },
      },
      project: true,
    },
  });
}

function buildWorkbook(report: NonNullable<Awaited<ReturnType<typeof getReport>>>) {
  const workbook = XLSX.utils.book_new();
  const contractCents =
    report.contractValueNetCents + report.changeOrdersNetCents;
  const detailCostCents = report.detailEntries.reduce(
    (sum, entry) => sum + entry.amountCents,
    0,
  );
  const hourCostCents = report.hourEntries.reduce(
    (sum, entry) => sum + entry.realCostCents,
    0,
  );
  const invoiceRevenueCents = report.invoiceItems.reduce(
    (sum, entry) => sum + entry.revenueCents,
    0,
  );
  const invoiceCostCents = report.invoiceItems.reduce(
    (sum, entry) => sum + entry.costCents,
    0,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        Projekt: `${report.project.projectNumber} · ${report.project.name}`,
        Leistungsmeldung: report.title ?? "Leistungsmeldung",
        "Zeitraum von": formatDate(report.periodStart ?? report.reportDate),
        "Zeitraum bis": formatDate(report.periodEnd ?? report.reportDate),
        Status: report.status,
        "Gesamtauftrag €": euros(contractCents),
        "Leistungsstand %": report.progressPercent,
        "Bisher abgerechnet €": euros(invoiceRevenueCents),
        "Istkosten Detail €": euros(detailCostCents),
        "Istkosten Stunden €": euros(hourCostCents),
        "iTWO Kosten €": euros(invoiceCostCents),
      },
    ]),
    "Schnellcheck",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.detailEntries.map((entry) => ({
        Datum: formatDate(entry.entryDate),
        Art: entry.costType,
        Beschreibung: entry.description,
        Menge: entry.quantity,
        Einheit: entry.unit,
        "Satz €": euros(entry.unitPriceCents),
        "Betrag €": euros(entry.amountCents),
        Status: entry.status,
        Herkunft: entry.source,
        Bemerkung: entry.notes ?? "",
      })),
    ),
    "Detail",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.hourEntries.map((entry) => ({
        Datum: formatDate(entry.entryDate),
        Bezeichnung: entry.label,
        "Beginn": entry.startsAt ?? "",
        "Ende": entry.endsAt ?? "",
        "Pause h": entry.breakHours,
        "Anzahl MA": entry.employeeCount,
        "Std je MA": entry.hoursPerEmployee,
        "Std gesamt": entry.totalHours,
        "EK real €/h": euros(entry.realRateCents),
        "Kosten real €": euros(entry.realCostCents),
        Herkunft: entry.source,
        Bemerkung: entry.notes ?? "",
      })),
    ),
    "Stunden",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      report.invoiceItems.map((entry) => ({
        OZ: entry.positionCode ?? "",
        Kurztext: entry.shortText,
        Menge: entry.billedQuantity,
        ME: entry.unit ?? "",
        "EP €": euros(entry.unitPriceCents),
        "Kosten/ME €": euros(entry.costPerUnitCents),
        "Lohn €": euros(entry.laborCostCents),
        "Geräte €": euros(entry.equipmentCostCents),
        "Material €": euros(entry.materialCostCents),
        "NU €": euros(entry.subcontractorCostCents),
        "Sonstiges €": euros(entry.otherCostCents),
        "Kosten €": euros(entry.costCents),
        "Umsatz €": euros(entry.revenueCents),
        Herkunft: entry.source,
        Bemerkung: entry.notes ?? "",
      })),
    ),
    "iTWO",
  );

  return workbook;
}

async function buildPdf(report: NonNullable<Awaited<ReturnType<typeof getReport>>>) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([842, 595]);
  const { height, width } = page.getSize();
  let y = height - 48;

  function textLine(
    value: string,
    options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {},
  ) {
    page.drawText(value.slice(0, 140), {
      x: 42,
      y,
      size: options.size ?? 10,
      font: options.bold ? bold : font,
      color: options.color ?? rgb(0.08, 0.1, 0.16),
    });
    y -= (options.size ?? 10) + 8;
  }

  const contractCents =
    report.contractValueNetCents + report.changeOrdersNetCents;
  const detailCostCents = report.detailEntries.reduce(
    (sum, entry) => sum + entry.amountCents,
    0,
  );
  const hourCostCents = report.hourEntries.reduce(
    (sum, entry) => sum + entry.realCostCents,
    0,
  );
  const invoiceRevenueCents = report.invoiceItems.reduce(
    (sum, entry) => sum + entry.revenueCents,
    0,
  );
  const invoiceCostCents = report.invoiceItems.reduce(
    (sum, entry) => sum + entry.costCents,
    0,
  );

  textLine("Leistungsmeldung", { bold: true, size: 22 });
  textLine(`${report.project.projectNumber} · ${report.project.name}`, {
    bold: true,
    size: 14,
  });
  textLine(
    `${formatDate(report.periodStart ?? report.reportDate)} – ${formatDate(
      report.periodEnd ?? report.reportDate,
    )} · ${report.status}`,
  );
  y -= 8;

  const summary = [
    ["Gesamtauftrag", contractCents],
    ["Bisher abgerechnet", invoiceRevenueCents],
    ["Istkosten Detail", detailCostCents],
    ["Istkosten Stunden", hourCostCents],
    ["iTWO Kosten", invoiceCostCents],
  ];

  summary.forEach(([label, cents], index) => {
    const x = 42 + (index % 5) * 150;
    page.drawText(String(label), {
      x,
      y,
      size: 8,
      font: bold,
      color: rgb(0.42, 0.46, 0.54),
    });
    page.drawText(`${euros(Number(cents)).toLocaleString("de-DE")} EUR`, {
      x,
      y: y - 18,
      size: 12,
      font: bold,
      color: rgb(0.05, 0.06, 0.1),
    });
  });
  y -= 58;

  page.drawLine({
    start: { x: 42, y },
    end: { x: width - 42, y },
    thickness: 1,
    color: rgb(0.82, 0.84, 0.88),
  });
  y -= 24;

  textLine("iTWO / Rechnungsmengen", { bold: true, size: 13 });
  report.invoiceItems.slice(0, 18).forEach((entry) => {
    textLine(
      `${entry.positionCode ?? ""} · ${entry.shortText} · ${entry.billedQuantity} ${
        entry.unit ?? ""
      } · Umsatz ${euros(entry.revenueCents).toLocaleString("de-DE")} EUR`,
      { size: 8 },
    );
  });

  if (report.invoiceItems.length > 18) {
    textLine(`+ ${report.invoiceItems.length - 18} weitere iTWO-Positionen`, {
      size: 8,
    });
  }

  return pdf.save();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");
  const format = searchParams.get("format") ?? "xlsx";

  if (!reportId) {
    return NextResponse.json({ error: "reportId fehlt." }, { status: 400 });
  }

  const report = await getReport(reportId);

  if (!report) {
    return NextResponse.json(
      { error: "Leistungsmeldung nicht gefunden." },
      { status: 404 },
    );
  }

  const baseName = fileSafe(
    `leistungsmeldung-${report.project.projectNumber}-${formatDate(
      report.periodEnd ?? report.reportDate,
    )}`,
  );

  if (format === "pdf") {
    const bytes = await buildPdf(report);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  }

  const workbook = buildWorkbook(report);
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return new NextResponse(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
