import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import {
  addDailyReportDays,
  buildDailyReportContext,
  getDailyReportSourceProject,
  toDailyReportDate,
  type DailyReportCountRow,
  type DailyReportMaterialRow,
} from "../../dailyReportContext";

export const dynamic = "force-dynamic";

const textColor = rgb(0.08, 0.08, 0.08);
const white = rgb(1, 1, 1);
const headerValueOffsetY = 0.35;
const sheetNumberOffsetY = 0;
const reportTextSize = 12;
const reportTitleSize = 16;

const calibriRegularPaths = [
  "/Applications/Microsoft Word.app/Contents/Resources/DFonts/Calibri.ttf",
  "/Applications/Microsoft Excel.app/Contents/Resources/DFonts/Calibri.ttf",
  "/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts/Calibri.ttf",
] as const;

const calibriBoldPaths = [
  "/Applications/Microsoft Word.app/Contents/Resources/DFonts/Calibrib.ttf",
  "/Applications/Microsoft Excel.app/Contents/Resources/DFonts/Calibrib.ttf",
  "/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts/Calibrib.ttf",
] as const;

type ReportFonts = {
  bold: PDFFont;
  regular: PDFFont;
};

const laborSlots = [
  { label: "Polier", y: 573 },
  { label: "Vorarbeiter", y: 558 },
  { label: "Facharbeiter", y: 543 },
  { label: "Fachwerker", y: 528 },
  { label: "LKW-Fahrer", y: 513 },
  { label: "Baugeräteführer", y: 498 },
] as const;

const groupedMachineSlots = [
  { label: "Mobilbagger", y: 437 },
  { label: "Kettenbagger", y: 422 },
  { label: "LKW 2-Achser", y: 407 },
  { label: "LKW 3-Achser", y: 392 },
  { label: "LKW 4-Achser", y: 377 },
  { label: "LKW Abrollkipper", y: 362 },
  { label: "LKW Sattelzug", y: 347 },
  { label: "Planierraupe / Grader", sourceLabels: ["Planierraupe", "Grader"], y: 332 },
  { label: "Erdbauwalze / Walzenzug", y: 317 },
  { label: "Radlader", y: 302 },
] as const;

const realMachineSlots = [
  437, 422, 407, 392, 377, 362, 347, 332, 317, 302, 287, 272,
] as const;

const materialLineY = [452, 437, 422, 407, 392] as const;
const sonstigesSlots = [347, 332, 317, 302, 287] as const;
const performanceLineY = [209, 191, 173, 155, 137, 119] as const;

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const dateKey = request.nextUrl.searchParams.get("date") ?? "";
  const sheetNumber = request.nextUrl.searchParams.get("blattnr") ?? "1";

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return new Response("Projekt und Datum sind Pflichtfelder.", {
      status: 400,
    });
  }

  const reportDate = toDailyReportDate(dateKey);
  const nextDate = addDailyReportDays(reportDate, 1);
  const project = await getDailyReportSourceProject(projectId, reportDate, nextDate);

  if (!project) {
    return new Response("Projekt nicht gefunden.", {
      status: 404,
    });
  }

  const context = buildDailyReportContext(project, dateKey, sheetNumber);
  const templateFileName = context.showRealMachineNames
    ? "stix_baubericht_ohne_geraete.pdf"
    : "stix_baubericht_mit_geraete.pdf";
  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    templateFileName,
  );
  const templateBytes = await readFile(templatePath);
  const templateDocument = await PDFDocument.load(templateBytes);
  const pdfDocument = await PDFDocument.create();
  const [page] = await pdfDocument.copyPages(templateDocument, [0]);
  pdfDocument.addPage(page);

  const fonts = await loadReportFonts(pdfDocument);

  drawHeader(page, fonts, context);
  drawLaborRows(page, fonts.regular, context.laborRows);
  drawMachineRows(page, fonts.regular, context.machineRows, context.showRealMachineNames);
  drawMaterialRows(page, fonts.regular, context.materialRows);
  drawPerformanceHeading(page, fonts.bold);
  drawPerformanceLines(page, fonts.regular, context.performanceLines);
  drawSingleLine(page, fonts.regular, context.dateLabel, 48, 82, 88, reportTextSize);

  const pdfBytes = await pdfDocument.save();
  const fileName = `Baubericht_${sanitizeFileName(
    context.projectNumber,
  )}_${dateKey}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

function drawHeader(
  page: PDFPage,
  fonts: ReportFonts,
  context: ReturnType<typeof buildDailyReportContext>,
) {
  clearTemplateText(page, 206, 783, 132, 23);
  drawSingleLine(page, fonts.bold, "Baubericht", 207, 786, 130, reportTitleSize);
  drawHeaderValue(
    page,
    fonts.regular,
    context.sheetNumber,
    500,
    789,
    44,
    sheetNumberOffsetY,
  );
  drawHeaderValue(page, fonts.regular, context.projectName, 260, 768, 286);
  drawHeaderValue(page, fonts.regular, context.projectNumber, 262, 753, 104);
  drawHeaderValue(page, fonts.regular, context.weekday, 272, 738, 90);
  drawHeaderValue(page, fonts.regular, context.dateLabel, 434, 738, 86);
  drawHeaderValue(page, fonts.regular, context.tempMin, 382, 723, 46);
  drawHeaderValue(page, fonts.regular, context.tempMax, 482, 723, 46);
  drawHeaderValue(page, fonts.regular, context.weatherLabel, 250, 708, 284);
  drawHeaderValue(page, fonts.regular, context.workStart, 292, 693, 58);
  drawHeaderValue(page, fonts.regular, context.workEnd, 420, 693, 62);
  drawSingleLine(
    page,
    fonts.regular,
    context.trafficSafetyFirstCheckTime,
    344,
    678 + headerValueOffsetY,
    42,
    reportTextSize,
  );
  drawSingleLine(
    page,
    fonts.regular,
    context.trafficSafetySecondCheckTime,
    422,
    678 + headerValueOffsetY,
    58,
    reportTextSize,
  );
}

function drawHeaderValue(
  page: PDFPage,
  font: PDFFont,
  value: string | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  offsetY = headerValueOffsetY,
) {
  drawSingleLine(
    page,
    font,
    value,
    x,
    y + offsetY,
    maxWidth,
    reportTextSize,
  );
}

function drawLaborRows(
  page: PDFPage,
  font: PDFFont,
  rows: DailyReportCountRow[],
) {
  const rowByLabel = new Map(rows.map((row) => [row.label, row]));

  for (const slot of laborSlots) {
    const row = rowByLabel.get(slot.label);
    drawCountAndHours(page, font, row, slot.y, 48, 244);
  }
}

function drawMachineRows(
  page: PDFPage,
  font: PDFFont,
  rows: DailyReportCountRow[],
  showRealMachineNames: boolean,
) {
  if (showRealMachineNames) {
    drawRealMachineRows(page, font, rows);
    return;
  }

  const usedLabels = new Set<string>();
  const rowByLabel = new Map(rows.map((row) => [row.label, row]));

  for (const slot of groupedMachineSlots) {
    const sourceLabels = "sourceLabels" in slot ? slot.sourceLabels : [slot.label];
    const row = combineRows(rows, slot.label, sourceLabels);

    sourceLabels.forEach((label) => usedLabels.add(label));
    drawCountAndHours(page, font, row, slot.y, 48, 244);
  }

  const kompressor = rowByLabel.get("Kompressor");
  usedLabels.add("Kompressor");
  drawSonstigesRow(page, font, kompressor, "Kompressor", sonstigesSlots[0]);

  const overflowRows = rows
    .filter((row) => !usedLabels.has(row.label))
    .filter((row) => row.count > 0 || row.hours > 0)
    .slice(0, sonstigesSlots.length - 1);

  overflowRows.forEach((row, index) => {
    drawSonstigesRow(page, font, row, row.label, sonstigesSlots[index + 1]);
  });
}

function drawRealMachineRows(
  page: PDFPage,
  font: PDFFont,
  rows: DailyReportCountRow[],
) {
  const visibleRows = rows.filter((row) => row.count > 0 || row.hours > 0);

  realMachineSlots.forEach((y, index) => {
    const row = visibleRows[index];
    if (!row) return;

    drawAlignedLine(
      page,
      font,
      formatPositiveNumber(row.count),
      48,
      y,
      36,
      reportTextSize,
      "right",
    );
    drawSingleLine(
      page,
      font,
      formatMachineLabelForTemplate(row.label),
      98,
      y,
      138,
      reportTextSize,
    );
    drawAlignedLine(
      page,
      font,
      formatPositiveNumber(row.hours),
      244,
      y,
      40,
      reportTextSize,
      "right",
    );
  });
}

function drawPerformanceLines(page: PDFPage, font: PDFFont, lines: string[]) {
  lines.slice(0, performanceLineY.length).forEach((line, index) => {
    drawSingleLine(page, font, line, 48, performanceLineY[index], 500, reportTextSize);
  });
}

function drawPerformanceHeading(page: PDFPage, font: PDFFont) {
  clearTemplateText(page, 40, 242, 210, 36);
  drawSingleLine(
    page,
    font,
    "Sonstige Bauleistung",
    48,
    254,
    200,
    reportTextSize,
  );
}

function drawMaterialRows(
  page: PDFPage,
  font: PDFFont,
  rows: DailyReportMaterialRow[],
) {
  rows
    .filter((row) => row.quantity > 0 && row.label)
    .slice(0, materialLineY.length)
    .forEach((row, index) => {
      const y = materialLineY[index];

      drawAlignedLine(
        page,
        font,
        formatPositiveNumber(row.quantity),
        308,
        y,
        36,
        reportTextSize,
        "right",
      );
      drawSingleLine(page, font, row.label, 356, y, 136, reportTextSize);
      drawSingleLine(page, font, row.unit, 510, y, 36, reportTextSize);
    });
}

function drawCountAndHours(
  page: PDFPage,
  font: PDFFont,
  row: DailyReportCountRow | null | undefined,
  y: number,
  countX: number,
  hoursX: number,
) {
  if (!row || (row.count <= 0 && row.hours <= 0)) return;

  drawAlignedLine(
    page,
    font,
    formatPositiveNumber(row.count),
    countX,
    y,
    36,
    reportTextSize,
    "right",
  );
  drawAlignedLine(
    page,
    font,
    formatPositiveNumber(row.hours),
    hoursX,
    y,
    40,
    reportTextSize,
    "right",
  );
}

function drawSonstigesRow(
  page: PDFPage,
  font: PDFFont,
  row: DailyReportCountRow | null | undefined,
  label: string,
  y: number,
) {
  if (!row || (row.count <= 0 && row.hours <= 0)) return;

  drawAlignedLine(
    page,
    font,
    formatPositiveNumber(row.count),
    308,
    y,
    36,
    reportTextSize,
    "right",
  );
  if (label !== "Kompressor") {
    drawSingleLine(page, font, label, 356, y, 136, reportTextSize);
  }
  drawAlignedLine(
    page,
    font,
    row.hours > 0 ? `${formatPositiveNumber(row.hours)} Std.` : "",
    506,
    y,
    42,
    reportTextSize,
    "right",
  );
}

function combineRows(
  rows: DailyReportCountRow[],
  label: string,
  sourceLabels: readonly string[],
) {
  const matchingRows = rows.filter((row) => sourceLabels.includes(row.label));
  if (!matchingRows.length) return null;

  return {
    count: matchingRows.reduce((sum, row) => sum + row.count, 0),
    hours: matchingRows.reduce((sum, row) => sum + row.hours, 0),
    key: label,
    label,
  };
}

function formatMachineLabelForTemplate(label: string) {
  const parts = label
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 2) return label;

  const category = parts[0];
  const realName = parts[1];
  const licensePlate = parts[2].includes("-") ? parts[2] : "";

  return [category, realName, licensePlate].filter(Boolean).join(" · ");
}

function clearTemplateText(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    color: white,
    height,
    width,
    x,
    y,
  });
}

async function loadReportFonts(pdfDocument: PDFDocument): Promise<ReportFonts> {
  try {
    pdfDocument.registerFontkit(fontkit);

    const [regularBytes, boldBytes] = await Promise.all([
      readFirstAvailableFont(calibriRegularPaths),
      readFirstAvailableFont(calibriBoldPaths),
    ]);

    return {
      bold: await pdfDocument.embedFont(boldBytes, { subset: true }),
      regular: await pdfDocument.embedFont(regularBytes, { subset: true }),
    };
  } catch {
    return {
      bold: await pdfDocument.embedFont(StandardFonts.HelveticaBold),
      regular: await pdfDocument.embedFont(StandardFonts.Helvetica),
    };
  }
}

async function readFirstAvailableFont(fontPaths: readonly string[]) {
  let lastError: unknown = null;

  for (const fontPath of fontPaths) {
    try {
      return await readFile(fontPath);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Keine passende Schriftdatei gefunden.");
}

function drawSingleLine(
  page: PDFPage,
  font: PDFFont,
  value: string | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
) {
  drawAlignedLine(page, font, value, x, y, maxWidth, size, "left");
}

function drawAlignedLine(
  page: PDFPage,
  font: PDFFont,
  value: string | number | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  align: "left" | "right",
) {
  const text = String(value ?? "").trim();
  if (!text) return;

  const fittedText = fitText(text, font, size, maxWidth);
  const width = font.widthOfTextAtSize(fittedText, size);

  page.drawText(fittedText, {
    color: textColor,
    font,
    size,
    x: align === "right" ? x + Math.max(0, maxWidth - width) : x,
    y,
  });
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) {
    return normalized;
  }

  const ellipsis = "...";
  let result = normalized;
  while (
    result.length > 0 &&
    font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth
  ) {
    result = result.slice(0, -1).trimEnd();
  }

  return `${result}${ellipsis}`;
}

function formatPositiveNumber(value: number) {
  return value > 0 ? formatDecimal(value) : "";
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_");
}
