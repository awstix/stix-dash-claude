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

export type DailyReportPdfResult = {
  bytes: Uint8Array;
  fileName: string;
};

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

const materialLineY = [467, 452, 437, 422, 407] as const;
const sonstigesSlots = [347, 332, 317, 302, 287] as const;
const performanceLineY = [
  239, 221.25, 203.45, 185.9, 168.35, 150.8, 133.25, 117.95,
] as const;
const footerLabelY = 86;
const footerDateY = 66;
const footerSignatureY = 28;
const continuationLineHeight = 16;
const continuationLinesPerPage = 40;

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const dateKey = request.nextUrl.searchParams.get("date") ?? "";
  const sheetNumber = request.nextUrl.searchParams.get("blattnr") ?? "1";

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return new Response("Projekt und Datum sind Pflichtfelder.", {
      status: 400,
    });
  }

  const result = await generateDailyReportPdf({
    dateKey,
    projectId,
    sheetNumber,
  });

  if (!result) {
    return new Response("Projekt nicht gefunden.", {
      status: 404,
    });
  }

  return new Response(Buffer.from(result.bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

export async function generateDailyReportPdf({
  dateKey,
  projectId,
  sheetNumber,
}: {
  dateKey: string;
  projectId: string;
  sheetNumber: string;
}): Promise<DailyReportPdfResult | null> {
  const reportDate = toDailyReportDate(dateKey);
  const nextDate = addDailyReportDays(reportDate, 1);
  const project = await getDailyReportSourceProject(projectId, reportDate, nextDate);

  if (!project) return null;

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
  const performanceLines = buildPerformanceLines(
    fonts.regular,
    context.performanceLines,
    context.siteDiscussionNotes,
    context.siteDiscussionRoles,
    context.siteDiscussionThirdPartyName,
    context.weatherNotes,
  );
  const continuationLines = drawPerformanceLines(
    page,
    fonts.regular,
    performanceLines,
  );
  drawFooterLabels(page, fonts.regular, context.dateLabel);
  await drawSignatures(pdfDocument, page, context);
  drawPerformanceContinuationPages(
    pdfDocument,
    fonts,
    context,
    continuationLines,
  );

  const pdfBytes = await pdfDocument.save();
  const fileName = `Baubericht_${sanitizeFileName(
    context.projectNumber,
  )}_${dateKey}.pdf`;

  return {
    bytes: pdfBytes,
    fileName,
  };
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

function drawPerformanceLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
) {
  const hasContinuation = lines.length > performanceLineY.length;
  const visibleLineCount = hasContinuation
    ? performanceLineY.length - 1
    : performanceLineY.length;
  const visibleLines = lines.slice(0, visibleLineCount);

  visibleLines.forEach((line, index) => {
    drawSingleLine(
      page,
      font,
      line,
      48,
      performanceLineY[index],
      500,
      reportTextSize,
    );
  });

  if (hasContinuation) {
    drawSingleLine(
      page,
      font,
      "Fortsetzung siehe nächste Seite",
      48,
      performanceLineY[performanceLineY.length - 1],
      500,
      reportTextSize,
    );
  }

  return lines.slice(visibleLineCount);
}

function buildPerformanceLines(
  font: PDFFont,
  lines: string[],
  siteDiscussionNotes: string,
  siteDiscussionRoles: string[],
  siteDiscussionThirdPartyName: string,
  weatherNotes: string,
) {
  const siteDiscussionPrefix = formatSiteDiscussionRoles(
    siteDiscussionRoles,
    siteDiscussionThirdPartyName,
  );
  const supplementalTexts = [
    siteDiscussionNotes.trim()
      ? `${siteDiscussionPrefix}: ${siteDiscussionNotes.trim()}`
      : "",
    weatherNotes.trim() ? `Wetterbemerkung: ${weatherNotes.trim()}` : "",
  ].filter(Boolean);
  return wrapTextLines([...lines, ...supplementalTexts], font, 500);
}

function formatSiteDiscussionRoles(
  roles: string[],
  thirdPartyName: string,
) {
  const labels = roles
    .map((role) => {
      if (role === "CLIENT") return "AG";
      if (role === "SUPERVISOR") return "Bauüberwacher";
      if (role === "PLANNER") return "Planer";
      if (role === "THIRD_PARTY") {
        return thirdPartyName.trim()
          ? `Dritte (${thirdPartyName.trim()})`
          : "Dritte";
      }
      return "";
    })
    .filter(Boolean);

  return labels.length > 0
    ? labels.join(" / ")
    : "Auftraggeber/Bauüberwacher/Dritte";
}

function wrapTextLines(
  lines: string[],
  font: PDFFont,
  maxWidth: number,
) {
  const result: string[] = [];

  for (const line of lines) {
    result.push(...wrapSingleTextLine(String(line ?? ""), font, maxWidth));
  }

  return result;
}

function wrapSingleTextLine(
  value: string,
  font: PDFFont,
  maxWidth: number,
) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const wrappedLines: string[] = [];
  let currentLine = "";

  for (const sourceWord of text.split(" ")) {
    const wordParts = splitWordForWidth(
      sourceWord,
      font,
      reportTextSize,
      maxWidth,
    );

    for (const word of wordParts) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (font.widthOfTextAtSize(candidate, reportTextSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        wrappedLines.push(word);
      }
    }
  }

  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines;
}

function splitWordForWidth(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }

  const parts: string[] = [];
  let currentPart = "";

  for (const character of word) {
    const candidate = `${currentPart}${character}`;

    if (
      currentPart &&
      font.widthOfTextAtSize(`${candidate}-`, size) > maxWidth
    ) {
      parts.push(`${currentPart}-`);
      currentPart = character;
    } else {
      currentPart = candidate;
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
}

function drawPerformanceContinuationPages(
  pdfDocument: PDFDocument,
  fonts: ReportFonts,
  context: ReturnType<typeof buildDailyReportContext>,
  lines: string[],
) {
  if (lines.length === 0) return;

  const totalContinuationPages = Math.ceil(
    lines.length / continuationLinesPerPage,
  );

  for (let pageIndex = 0; pageIndex < totalContinuationPages; pageIndex += 1) {
    const page = pdfDocument.addPage([595.28, 841.89]);
    const pageLines = lines.slice(
      pageIndex * continuationLinesPerPage,
      (pageIndex + 1) * continuationLinesPerPage,
    );

    page.drawText("Baubericht – Fortsetzung", {
      color: textColor,
      font: fonts.bold,
      size: 16,
      x: 48,
      y: 786,
    });
    page.drawText(
      `${context.projectNumber} · ${context.projectName} · ${context.dateLabel}`,
      {
        color: textColor,
        font: fonts.regular,
        size: 11,
        x: 48,
        y: 764,
      },
    );
    page.drawText("Sonstige Bauleistung / Bemerkungen", {
      color: textColor,
      font: fonts.bold,
      size: 12,
      x: 48,
      y: 730,
    });
    page.drawLine({
      color: rgb(0.75, 0.75, 0.75),
      end: { x: 547, y: 720 },
      start: { x: 48, y: 720 },
      thickness: 0.75,
    });

    pageLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        color: textColor,
        font: fonts.regular,
        size: reportTextSize,
        x: 48,
        y: 695 - lineIndex * continuationLineHeight,
      });
    });

    page.drawText(
      `Seite ${pageIndex + 2} von ${totalContinuationPages + 1}`,
      {
        color: textColor,
        font: fonts.regular,
        size: 9,
        x: 470,
        y: 34,
      },
    );
  }
}

function drawPerformanceHeading(page: PDFPage, font: PDFFont) {
  clearTemplateText(page, 40, 251, 210, 18);
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

function drawFooterLabels(page: PDFPage, font: PDFFont, dateLabel: string) {
  clearTemplateText(page, 40, 90, 505, 22);
  drawSingleLine(page, font, "Datum", 48, footerLabelY, 88, reportTextSize);
  drawSingleLine(
    page,
    font,
    "Josef Stix GmbH & Co. KG",
    183,
    footerLabelY,
    190,
    reportTextSize,
  );
  drawSingleLine(
    page,
    font,
    "Auftraggeber",
    378,
    footerLabelY,
    150,
    reportTextSize,
  );
  drawSingleLine(page, font, dateLabel, 48, footerDateY, 88, reportTextSize);
}

async function drawSignatures(
  pdfDocument: PDFDocument,
  page: PDFPage,
  context: ReturnType<typeof buildDailyReportContext>,
) {
  await drawSignatureImage(
    pdfDocument,
    page,
    context.contractorSignatureDataUrl,
    165,
    footerSignatureY,
    195,
    52,
  );
  await drawSignatureImage(
    pdfDocument,
    page,
    context.clientSignatureDataUrl,
    364,
    footerSignatureY,
    180,
    52,
  );
}

async function drawSignatureImage(
  pdfDocument: PDFDocument,
  page: PDFPage,
  dataUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const pngBytes = getPngBytesFromDataUrl(dataUrl);

  if (!pngBytes) return;

  const image = await pdfDocument.embedPng(pngBytes);
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawImage(image, {
    height,
    width,
    x: x + (maxWidth - width) / 2,
    y: y + (maxHeight - height) / 2,
  });
}

function getPngBytesFromDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/png;base64,")) return null;

  return Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
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
