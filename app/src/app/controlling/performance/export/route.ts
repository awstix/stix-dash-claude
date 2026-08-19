import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import {
  drawCompanyHeader,
  embedCompanyLogo,
  loadFormPdfFonts,
  normalizeFormPdfCompany,
} from "@/lib/formPdf";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 78;
const FOOTER_RESERVED = 24;

const textColor = rgb(0.08, 0.08, 0.08);
const mutedColor = rgb(0.38, 0.4, 0.44);
const lineColor = rgb(0.82, 0.83, 0.85);
const lightFill = rgb(0.965, 0.968, 0.972);
const accentColor = rgb(0.11, 0.31, 0.85);
const goodColor = rgb(0.09, 0.45, 0.27);
const badColor = rgb(0.7, 0.15, 0.15);

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

/** Zentrale Kennzahlen-Berechnung, gemeinsam für Excel- und PDF-Export -
 * exakt dieselbe Logik wie im Live-Seiten-Rendering unter
 * controlling/performance/page.tsx, damit die Exporte nicht von der
 * angezeigten Seite abweichen. Rechnet bewusst mit den AKTUELLEN
 * Projektwerten (report.project.contractValueNet etc.), nicht mit den beim
 * Anlegen der Meldung eingefrorenen contractValueNetCents-Spalten auf dem
 * Report selbst - sonst würden spätere Korrekturen an der Auftragssumme
 * im Export nicht ankommen. */
function computeReportMetrics(
  report: NonNullable<Awaited<ReturnType<typeof getReport>>>,
) {
  const project = report.project;
  const contractValueNetCents = Math.round(project.contractValueNet * 100);
  const changeOrdersNetCents = Math.round(project.changeOrdersNet * 100);
  const contractCents = contractValueNetCents + changeOrdersNetCents;

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
  const actualCostCents = detailCostCents + hourCostCents;
  const performanceValueCents = Math.round(
    contractCents * (report.progressPercent / 100),
  );

  // Nachlass mindert den Nettopreis, Skonto wird vom (bereits um
  // Nachlass reduzierten) Bruttobetrag abgezogen - nacheinander, nicht
  // addiert. Die MwSt kürzt sich beim Zurückrechnen auf netto wieder
  // heraus, der Skonto-Prozentsatz wirkt also gleich, egal ob auf netto
  // oder brutto gerechnet - nur eben auf den nachlassreduzierten Betrag.
  const skontoPercent = project.skontoPercent;
  const nachlassPercent = project.nachlassPercent;
  const skontoNachlassPercent = skontoPercent + nachlassPercent;
  const revenueAfterNachlassCents = invoiceRevenueCents * (1 - nachlassPercent / 100);
  const effectiveInvoiceRevenueCents = Math.round(
    revenueAfterNachlassCents * (1 - skontoPercent / 100),
  );

  const resultBaseCents = Math.max(performanceValueCents, effectiveInvoiceRevenueCents);
  const forecastCents = resultBaseCents - actualCostCents;
  const forecastPercent = resultBaseCents > 0 ? forecastCents / resultBaseCents : 0;

  const costCoverageCents = effectiveInvoiceRevenueCents - actualCostCents;
  const marginPercent =
    effectiveInvoiceRevenueCents > 0 ? costCoverageCents / effectiveInvoiceRevenueCents : 0;

  const normalUmlagePercent =
    project.normalAgkPercent +
    project.normalWugPercent +
    project.normalBgkPercent +
    project.normalFreierZuschlagPercent;
  const actualUmlagePercent =
    project.actualAgkPercent +
    project.actualWugPercent +
    project.actualBgkPercent +
    project.actualFreierZuschlagPercent;
  const umlageCostBasisCents =
    actualUmlagePercent > -100
      ? contractCents / (1 + actualUmlagePercent / 100)
      : contractCents;
  const normalContractCents = Math.round(
    umlageCostBasisCents * (1 + normalUmlagePercent / 100),
  );
  const umlageGewinnCents = contractCents - normalContractCents;
  // Ergebnis vor Umlage: dieselbe Rückrechnung wie beim Umlage-Vergleich,
  // aber auf den tatsächlich abgerechneten (um Skonto/Nachlass bereinigten)
  // Umsatz statt auf die Auftragssumme.
  const umsatzVorUmlageCents =
    actualUmlagePercent > -100
      ? Math.round(effectiveInvoiceRevenueCents / (1 + actualUmlagePercent / 100))
      : effectiveInvoiceRevenueCents;
  const ergebnisVorUmlageCents = umsatzVorUmlageCents - actualCostCents;
  const dbVorUmlagePercent =
    umsatzVorUmlageCents > 0 ? ergebnisVorUmlageCents / umsatzVorUmlageCents : 0;

  return {
    actualCostCents,
    actualUmlagePercent,
    contractCents,
    costCoverageCents,
    dbVorUmlagePercent,
    detailCostCents,
    effectiveInvoiceRevenueCents,
    ergebnisVorUmlageCents,
    forecastCents,
    forecastPercent,
    hourCostCents,
    invoiceCostCents,
    invoiceRevenueCents,
    marginPercent,
    nachlassPercent,
    normalUmlagePercent,
    performanceValueCents,
    skontoNachlassPercent,
    skontoPercent,
    umlageGewinnCents,
    umsatzVorUmlageCents,
  };
}

function buildWorkbook(report: NonNullable<Awaited<ReturnType<typeof getReport>>>) {
  const workbook = XLSX.utils.book_new();
  const metrics = computeReportMetrics(report);

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet([
      {
        Projekt: `${report.project.projectNumber} · ${report.project.name}`,
        Leistungsmeldung: report.title ?? "Leistungsmeldung",
        "Zeitraum von": formatDate(report.periodStart ?? report.reportDate),
        "Zeitraum bis": formatDate(report.periodEnd ?? report.reportDate),
        Status: report.status,
        "Gesamtauftrag €": euros(metrics.contractCents),
        "Leistungsstand %": report.progressPercent,
        "Bisher abgerechnet €": euros(metrics.invoiceRevenueCents),
        "Istkosten Detail €": euros(metrics.detailCostCents),
        "Istkosten Stunden €": euros(metrics.hourCostCents),
        "iTWO Kosten €": euros(metrics.invoiceCostCents),
        "Ergebnis aktuell €": euros(metrics.forecastCents),
        "DB aktuell %": metrics.forecastPercent * 100,
        "Ergebnis nach Istkosten €": euros(metrics.costCoverageCents),
        "DB nach Istkosten %": metrics.marginPercent * 100,
        "Tatsächliche Umlage %": metrics.actualUmlagePercent,
        "Normale Umlage %": metrics.normalUmlagePercent,
        "Zusätzlicher Gewinn durch Umlage €": euros(metrics.umlageGewinnCents),
        "Umsatz vor Umlage €": euros(metrics.umsatzVorUmlageCents),
        "Ergebnis vor Umlage €": euros(metrics.ergebnisVorUmlageCents),
        "DB vor Umlage %": metrics.dbVorUmlagePercent * 100,
        "Skonto %": metrics.skontoPercent,
        "Nachlass %": metrics.nachlassPercent,
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
        Status: entry.status,
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  const ellipsis = "…";
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}${ellipsis}`;
}

function formatEuro(cents: number) {
  return `${(cents / 100).toLocaleString("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })} €`;
}

function formatPercent(ratio: number) {
  return `${(ratio * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

type TableColumn = { align?: "left" | "right"; header: string; width: number };

async function buildPdf(report: NonNullable<Awaited<ReturnType<typeof getReport>>>) {
  const metrics = computeReportMetrics(report);
  const companyInfoRow = await prisma.companyInfo.findUnique({ where: { id: "default" } });
  const companyInfo = normalizeFormPdfCompany(companyInfoRow);

  const pdfDoc = await PDFDocument.create();
  const { bold, regular } = await loadFormPdfFonts(pdfDoc);
  const companyLogo = await embedCompanyLogo(pdfDoc, companyInfo.logoPublicUrl);

  let page: PDFPage;
  let y = 0;

  function newPage() {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawCompanyHeader(page, bold, regular, MARGIN, PAGE_WIDTH, companyInfo, companyLogo);
    page.drawLine({
      color: lineColor,
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - HEADER_HEIGHT + 18 },
      start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - HEADER_HEIGHT + 18 },
      thickness: 0.8,
    });
    y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;
  }

  function ensureSpace(needed: number) {
    if (y - needed < FOOTER_RESERVED + MARGIN) {
      newPage();
    }
  }

  newPage();

  page!.drawText("Leistungsmeldung", { color: textColor, font: bold, size: 16, x: MARGIN, y });
  y -= 22;

  const projectTitle = `${report.project.projectNumber} · ${report.project.name}`;
  wrapText(projectTitle, bold, 12.5, CONTENT_WIDTH).forEach((line) => {
    page!.drawText(line, { color: accentColor, font: bold, size: 12.5, x: MARGIN, y });
    y -= 16;
  });

  const periodLabel = `${formatDate(report.periodStart ?? report.reportDate)} – ${formatDate(
    report.periodEnd ?? report.reportDate,
  )} · ${report.status}`;
  page!.drawText(periodLabel, { color: mutedColor, font: regular, size: 9.5, x: MARGIN, y });
  y -= 18;

  // Kennzahlen-Kacheln
  const tileMetrics: { label: string; tone?: "good" | "bad"; value: string }[] = [
    { label: "Gesamtauftrag", value: formatEuro(metrics.contractCents) },
    { label: "Leistungsstand", value: `${report.progressPercent.toLocaleString("de-DE")} %` },
    { label: "Bisher abgerechnet", value: formatEuro(metrics.invoiceRevenueCents) },
    { label: "Istkosten gesamt", value: formatEuro(metrics.actualCostCents) },
    {
      label: `Ergebnis aktuell · DB ${formatPercent(metrics.forecastPercent)}`,
      tone: metrics.forecastCents >= 0 ? "good" : "bad",
      value: formatEuro(metrics.forecastCents),
    },
    {
      label: `Ergebnis nach Istkosten · DB ${formatPercent(metrics.marginPercent)}`,
      tone: metrics.costCoverageCents >= 0 ? "good" : "bad",
      value: formatEuro(metrics.costCoverageCents),
    },
  ];

  const tileCols = 3;
  const tileGap = 8;
  const tileWidth = (CONTENT_WIDTH - tileGap * (tileCols - 1)) / tileCols;
  const tileHeight = 40;
  ensureSpace(tileHeight * 2 + tileGap + 10);
  tileMetrics.forEach((tile, index) => {
    const col = index % tileCols;
    const row = Math.floor(index / tileCols);
    const x = MARGIN + col * (tileWidth + tileGap);
    const tileY = y - row * (tileHeight + tileGap) - tileHeight;
    page!.drawRectangle({
      color: lightFill,
      height: tileHeight,
      width: tileWidth,
      x,
      y: tileY,
    });
    wrapText(tile.label, bold, 6.5, tileWidth - 12).slice(0, 2).forEach((line, lineIndex) => {
      page!.drawText(line, {
        color: mutedColor,
        font: bold,
        size: 6.5,
        x: x + 6,
        y: tileY + tileHeight - 12 - lineIndex * 8,
      });
    });
    page!.drawText(tile.value, {
      color: tile.tone === "good" ? goodColor : tile.tone === "bad" ? badColor : textColor,
      font: bold,
      size: 11,
      x: x + 6,
      y: tileY + 6,
    });
  });
  y -= Math.ceil(tileMetrics.length / tileCols) * (tileHeight + tileGap) + 6;

  // Umlage-Vergleich - nur wenn tatsächliche und normale Umlage voneinander abweichen
  if (Math.abs(metrics.actualUmlagePercent - metrics.normalUmlagePercent) > 0.001) {
    ensureSpace(34);
    page!.drawText(
      `Umlage-Vergleich: tatsächlich ${metrics.actualUmlagePercent.toLocaleString("de-DE")} % · normal ${metrics.normalUmlagePercent.toLocaleString(
        "de-DE",
      )} % · zusätzlicher Gewinn durch Umlage ${formatEuro(metrics.umlageGewinnCents)}`,
      { color: textColor, font: bold, size: 8.5, x: MARGIN, y },
    );
    y -= 16;
  }

  // Ergebnis vor Umlage - Umsatz um die tatsächliche Umlage bereinigt
  ensureSpace(20);
  page!.drawText(
    `Ergebnis vor Umlage: ${formatEuro(metrics.ergebnisVorUmlageCents)} (DB ${formatPercent(
      metrics.dbVorUmlagePercent,
    )}) · Umsatz vor Umlage ${formatEuro(metrics.umsatzVorUmlageCents)}`,
    { color: mutedColor, font: regular, size: 8, x: MARGIN, y },
  );
  y -= 16;

  // Skonto/Nachlass-Hinweis
  if (metrics.skontoNachlassPercent > 0) {
    ensureSpace(20);
    page!.drawText(
      `Skonto ${metrics.skontoPercent.toLocaleString("de-DE")} % + Nachlass ${metrics.nachlassPercent.toLocaleString(
        "de-DE",
      )} % bereits im Ergebnis nach Istkosten berücksichtigt (effektiver Umsatz ${formatEuro(
        metrics.effectiveInvoiceRevenueCents,
      )}).`,
      { color: mutedColor, font: regular, size: 8, x: MARGIN, y },
    );
    y -= 16;
  }

  // Kostenaufschlüsselung
  const detailByType = new Map<string, number>();
  report.detailEntries.forEach((entry) => {
    detailByType.set(entry.costType, (detailByType.get(entry.costType) ?? 0) + entry.amountCents);
  });
  const hourByCategory = new Map<string, number>();
  report.hourEntries.forEach((entry) => {
    hourByCategory.set(
      entry.costCategory,
      (hourByCategory.get(entry.costCategory) ?? 0) + entry.realCostCents,
    );
  });

  if (detailByType.size > 0 || hourByCategory.size > 0) {
    ensureSpace(24);
    page!.drawText("Kostenaufschlüsselung (Istkosten)", {
      color: textColor,
      font: bold,
      size: 11,
      x: MARGIN,
      y,
    });
    y -= 16;

    const breakdownRows = [
      ...Array.from(hourByCategory.entries()).map(([label, cents]) => [
        `Stunden · ${label}`,
        formatEuro(cents),
      ]),
      ...Array.from(detailByType.entries()).map(([label, cents]) => [
        `Detail · ${label}`,
        formatEuro(cents),
      ]),
    ];
    breakdownRows.forEach(([label, value]) => {
      ensureSpace(13);
      page!.drawText(label, { color: textColor, font: regular, size: 8.5, x: MARGIN, y });
      page!.drawText(value, {
        color: textColor,
        font: bold,
        size: 8.5,
        x: PAGE_WIDTH - MARGIN - 80,
        y,
      });
      y -= 13;
    });
    y -= 8;
  }

  // Vollständige iTWO/Rechnungsmengen-Tabelle, paginiert (nicht mehr auf 18 Zeilen gekappt)
  const invoiceColumns: TableColumn[] = [
    { header: "OZ", width: 42 },
    { header: "Kurztext", width: 155 },
    { header: "Menge", width: 55, align: "right" },
    { header: "ME", width: 32 },
    { header: "EP €", width: 55, align: "right" },
    { header: "Kosten €", width: 60, align: "right" },
    { header: "Umsatz €", width: 60, align: "right" },
    { header: "Herkunft", width: 56 },
  ];

  function drawTableHeader(columns: TableColumn[]) {
    ensureSpace(20);
    let x = MARGIN;
    page!.drawRectangle({ color: lightFill, height: 16, width: CONTENT_WIDTH, x: MARGIN, y: y - 12 });
    columns.forEach((column) => {
      page!.drawText(column.header, {
        color: mutedColor,
        font: bold,
        size: 6.5,
        x: x + 3,
        y: y - 9,
      });
      x += column.width;
    });
    y -= 16;
  }

  if (report.invoiceItems.length > 0) {
    ensureSpace(40);
    page!.drawText("iTWO / Rechnungsmengen", { color: textColor, font: bold, size: 11, x: MARGIN, y });
    y -= 14;
    drawTableHeader(invoiceColumns);

    report.invoiceItems.forEach((entry, index) => {
      ensureSpace(14);
      if (y === PAGE_HEIGHT - MARGIN - HEADER_HEIGHT) {
        drawTableHeader(invoiceColumns);
      }
      if (index % 2 === 1) {
        page!.drawRectangle({
          color: lightFill,
          height: 13,
          width: CONTENT_WIDTH,
          x: MARGIN,
          y: y - 10,
        });
      }
      const cells = [
        entry.positionCode ?? "—",
        entry.shortText,
        String(entry.billedQuantity),
        entry.unit ?? "",
        formatEuro(entry.unitPriceCents),
        formatEuro(entry.costCents),
        formatEuro(entry.revenueCents),
        entry.source,
      ];
      let x = MARGIN;
      cells.forEach((cellValue, columnIndex) => {
        const column = invoiceColumns[columnIndex];
        const text = truncateToWidth(cellValue, regular, 7, column.width - 6);
        const textWidth = regular.widthOfTextAtSize(text, 7);
        page!.drawText(text, {
          color: textColor,
          font: regular,
          size: 7,
          x: column.align === "right" ? x + column.width - 4 - textWidth : x + 3,
          y: y - 9,
        });
        x += column.width;
      });
      y -= 13;
    });
  }

  // Footer auf jeder Seite
  const generatedAt = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Erstellt am ${generatedAt}`, {
      color: mutedColor,
      font: regular,
      size: 7,
      x: MARGIN,
      y: 16,
    });
    const pageLabel = `Seite ${index + 1} von ${pages.length}`;
    const labelWidth = regular.widthOfTextAtSize(pageLabel, 7);
    pdfPage.drawText(pageLabel, {
      color: mutedColor,
      font: regular,
      size: 7,
      x: PAGE_WIDTH - MARGIN - labelWidth,
      y: 16,
    });
  });

  return pdfDoc.save();
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
