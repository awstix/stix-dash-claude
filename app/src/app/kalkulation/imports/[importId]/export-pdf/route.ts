import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { requireSession } from "@/lib/auth-access";
import { loadLvExportData } from "@/lib/kalkulation-export";

export const runtime = "nodejs";

// Querformat A4 - bei Bill-of-Quantities-Tabellen mit langen Kurztexten
// reicht Hochformat nicht, ohne die Spalten unleserlich schmal zu machen.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLUMNS = {
  oz: { x: MARGIN, width: 46 },
  text: { x: MARGIN + 50, width: 400 },
  menge: { x: MARGIN + 458, width: 60 },
  einheit: { x: MARGIN + 522, width: 50 },
  ep: { x: MARGIN + 576, width: 90 },
  gp: { x: MARGIN + 670, width: 100 },
};

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  regularFont: PDFFont;
  boldFont: PDFFont;
  italicFont: PDFFont;
  y: number;
};

// StandardFonts (WinAnsi) stellen Umlaute/ß im Prinzip dar, aber pdf-lib
// wirft bei manchen Zeichen aus kopierten Word-/PDF-Quellen (geschützte
// Leerzeichen, Sonderstriche) - gleiche defensive Bereinigung wie im
// bestehenden Tagesbestellung-PDF-Export (orders/pdf/route.ts).
function cleanPdfText(value: string) {
  return value
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ß", "ss")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("„", '"')
    .replaceAll("“", '"')
    .replaceAll("’", "'");
}

function formatEuro(cents: number | null) {
  if (cents == null) return "-";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatQuantity(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(value);
}

function addPage(ctx: PdfContext) {
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: PdfContext, neededHeight: number) {
  if (ctx.y - neededHeight < MARGIN) addPage(ctx);
}

function drawText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  options?: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; maxWidth?: number },
) {
  ctx.page.drawText(cleanPdfText(text), {
    x,
    y,
    size: options?.size ?? 9,
    font: options?.font ?? ctx.regularFont,
    color: options?.color ?? rgb(0.1, 0.1, 0.1),
    maxWidth: options?.maxWidth,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanPdfText(text || "-").split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : ["-"];
}

function drawWrappedText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; lineHeight?: number },
) {
  const size = options?.size ?? 9;
  const font = options?.font ?? ctx.regularFont;
  const lineHeight = options?.lineHeight ?? size + 3;
  const lines = wrapText(text, font, size, width);
  lines.forEach((line, index) => {
    drawText(ctx, line, x, y - index * lineHeight, { size, font, color: options?.color, maxWidth: width });
  });
  return lines.length * lineHeight;
}

function drawTableHeader(ctx: PdfContext) {
  ensureSpace(ctx, 30);
  drawText(ctx, "OZ", COLUMNS.oz.x, ctx.y, { size: 8, font: ctx.boldFont });
  drawText(ctx, "Kurztext", COLUMNS.text.x, ctx.y, { size: 8, font: ctx.boldFont });
  drawText(ctx, "Menge", COLUMNS.menge.x, ctx.y, { size: 8, font: ctx.boldFont });
  drawText(ctx, "Einheit", COLUMNS.einheit.x, ctx.y, { size: 8, font: ctx.boldFont });
  drawText(ctx, "EP", COLUMNS.ep.x, ctx.y, { size: 8, font: ctx.boldFont });
  drawText(ctx, "GP", COLUMNS.gp.x, ctx.y, { size: 8, font: ctx.boldFont });
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  ctx.y -= 12;
}

async function createPdfBuffer(input: {
  title: string;
  fileName: string;
  rows: {
    entryType: string;
    positionNumber: string | null;
    shortText: string | null;
    rawText: string;
    unit: string | null;
    quantity: number | null;
    unitPriceCents: number | null;
    totalPriceCents: number | null;
    infoLine: string | null;
  }[];
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const ctx: PdfContext = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regularFont,
    boldFont,
    italicFont,
    y: PAGE_HEIGHT - MARGIN,
  };

  drawText(ctx, input.title, MARGIN, ctx.y, { size: 16, font: boldFont });
  ctx.y -= 20;
  drawText(
    ctx,
    `Exportiert am: ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date())}`,
    MARGIN,
    ctx.y,
    { size: 9, color: rgb(0.4, 0.4, 0.4) },
  );
  ctx.y -= 18;

  drawTableHeader(ctx);

  for (const row of input.rows) {
    if (row.entryType === "TITLE") {
      ensureSpace(ctx, 30);
      ctx.page.drawRectangle({
        x: MARGIN,
        y: ctx.y - 4,
        width: CONTENT_WIDTH,
        height: 16,
        color: rgb(0.13, 0.13, 0.13),
      });
      drawText(ctx, row.rawText, MARGIN + 6, ctx.y, { size: 9, font: boldFont, color: rgb(1, 1, 1), maxWidth: CONTENT_WIDTH - 12 });
      ctx.y -= 22;
      continue;
    }

    if (row.entryType === "REMARK") {
      ensureSpace(ctx, 30);
      const height = drawWrappedText(ctx, `Vorbemerkung: ${row.rawText}`, MARGIN, ctx.y, CONTENT_WIDTH, {
        size: 8,
        font: italicFont,
        color: rgb(0.45, 0.35, 0.1),
        lineHeight: 11,
      });
      ctx.y -= height + 8;
      continue;
    }

    ensureSpace(ctx, 40);
    const startY = ctx.y;
    const text = row.shortText ?? row.rawText;
    const heights = [
      drawWrappedText(ctx, row.positionNumber ?? "-", COLUMNS.oz.x, startY, COLUMNS.oz.width, { size: 8, lineHeight: 11 }),
      drawWrappedText(ctx, text, COLUMNS.text.x, startY, COLUMNS.text.width, { size: 8, lineHeight: 11 }),
      drawWrappedText(ctx, formatQuantity(row.quantity), COLUMNS.menge.x, startY, COLUMNS.menge.width, { size: 8, lineHeight: 11 }),
      drawWrappedText(ctx, row.unit ?? "-", COLUMNS.einheit.x, startY, COLUMNS.einheit.width, { size: 8, lineHeight: 11 }),
      drawWrappedText(ctx, formatEuro(row.unitPriceCents), COLUMNS.ep.x, startY, COLUMNS.ep.width, { size: 8, lineHeight: 11 }),
      drawWrappedText(ctx, formatEuro(row.totalPriceCents), COLUMNS.gp.x, startY, COLUMNS.gp.width, { size: 8, lineHeight: 11, font: boldFont }),
    ];
    let rowHeight = Math.max(...heights, 11);

    if (row.infoLine) {
      rowHeight += drawWrappedText(ctx, row.infoLine, COLUMNS.text.x, startY - rowHeight - 1, COLUMNS.text.width, {
        size: 7,
        color: rgb(0.2, 0.45, 0.2),
        lineHeight: 9,
      });
    }

    ctx.y = startY - rowHeight - 6;
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y + 3 },
      end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 3 },
      thickness: 0.3,
      color: rgb(0.9, 0.9, 0.9),
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  await requireSession();
  const { importId } = await params;

  const data = await loadLvExportData(importId);
  if (!data) {
    return NextResponse.json({ error: "Import nicht gefunden." }, { status: 404 });
  }
  const { lvImport, lineItems, infoLineByItemId } = data;

  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" - ");
  const title = projectLabel ? `LV: ${projectLabel}` : lvImport.fileName;
  const fileName = `${lvImport.fileName.replace(/\.[^.]+$/, "")}_vorkalkuliert.pdf`;

  const buffer = await createPdfBuffer({
    title,
    fileName,
    rows: lineItems.map((item) => ({
      entryType: item.entryType,
      positionNumber: item.positionNumber,
      shortText: item.shortText,
      rawText: item.rawText,
      unit: item.unit,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      infoLine: infoLineByItemId.get(item.id) ?? null,
    })),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
      "Content-Type": "application/pdf",
    },
  });
}
