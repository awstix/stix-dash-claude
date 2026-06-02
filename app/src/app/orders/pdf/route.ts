import { NextRequest } from "next/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AsphaltOrderRow = {
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixNumber: string;
  asphaltMixName: string;
  quantityTons: number;
  isForeignMix: boolean;
  notes: string[];
};

type PdfContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  regularFont: PDFFont;
  boldFont: PDFFont;
  y: number;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function getBerlinDateInput(date = new Date()) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime());
}

function addDaysToDateInput(dateInput: string, days: number) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function dateInputToUtcDate(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

function formatGermanDate(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatGermanDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

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

function getAsphaltKey(entry: {
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  isForeignMix: boolean;
}) {
  return [
    entry.projectNumber || "-",
    entry.projectName || "-",
    entry.constructionManager || "",
    entry.asphaltMixNumber || "",
    entry.asphaltMixName || "",
    entry.isForeignMix ? "foreign" : "own",
  ].join("||");
}

function groupAsphaltEntries(
  entries: {
    projectNumber: string;
    projectName: string;
    constructionManager: string | null;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    quantityTons: number;
    isForeignMix: boolean;
    notes: string | null;
  }[]
) {
  const grouped = new Map<string, AsphaltOrderRow>();

  for (const entry of entries) {
    const key = getAsphaltKey(entry);
    const existing = grouped.get(key);

    if (existing) {
      existing.quantityTons += entry.quantityTons;

      if (entry.notes) {
        existing.notes.push(entry.notes);
      }

      continue;
    }

    grouped.set(key, {
      projectNumber: entry.projectNumber || "-",
      projectName: entry.projectName || "-",
      constructionManager: entry.constructionManager,
      asphaltMixNumber: entry.asphaltMixNumber || "-",
      asphaltMixName: entry.asphaltMixName || "-",
      quantityTons: entry.quantityTons,
      isForeignMix: entry.isForeignMix,
      notes: entry.notes ? [entry.notes] : [],
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const projectCompare = a.projectNumber.localeCompare(
      b.projectNumber,
      "de"
    );

    if (projectCompare !== 0) {
      return projectCompare;
    }

    return a.asphaltMixName.localeCompare(b.asphaltMixName, "de");
  });
}

function addPage(ctx: PdfContext) {
  ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: PdfContext, neededHeight: number) {
  if (ctx.y - neededHeight < MARGIN) {
    addPage(ctx);
  }
}

function drawText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  options?: {
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    maxWidth?: number;
  }
) {
  ctx.page.drawText(cleanPdfText(text), {
    x,
    y,
    size: options?.size ?? 10,
    font: options?.font ?? ctx.regularFont,
    color: options?.color ?? rgb(0.1, 0.1, 0.1),
    maxWidth: options?.maxWidth,
  });
}

function drawLine(ctx: PdfContext) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: 0.5,
    color: rgb(0.82, 0.82, 0.82),
  });

  ctx.y -= 12;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanPdfText(text || "-").split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, size);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ["-"];
}

function drawWrappedText(
  ctx: PdfContext,
  text: string,
  x: number,
  y: number,
  width: number,
  options?: {
    size?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  }
) {
  const size = options?.size ?? 8;
  const font = options?.font ?? ctx.regularFont;
  const lineHeight = options?.lineHeight ?? size + 3;
  const lines = wrapText(text, font, size, width);

  lines.forEach((line, index) => {
    drawText(ctx, line, x, y - index * lineHeight, {
      size,
      font,
      color: options?.color,
      maxWidth: width,
    });
  });

  return lines.length * lineHeight;
}

function drawSectionTitle(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 60);
  ctx.y -= 8;

  drawText(ctx, title, MARGIN, ctx.y, {
    size: 14,
    font: ctx.boldFont,
  });

  ctx.y -= 14;
  drawLine(ctx);
}

function drawInfoBox(
  ctx: PdfContext,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  ctx.page.drawRectangle({
    x,
    y: y - 42,
    width,
    height: 42,
    borderWidth: 0.5,
    borderColor: rgb(0.85, 0.85, 0.85),
    color: rgb(0.97, 0.97, 0.97),
  });

  drawText(ctx, label, x + 8, y - 14, {
    size: 8,
    font: ctx.boldFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  drawText(ctx, value, x + 8, y - 30, {
    size: 11,
    font: ctx.boldFont,
  });
}

async function createPdfBuffer({
  selectedDateInput,
  asphaltRows,
}: {
  selectedDateInput: string;
  asphaltRows: AsphaltOrderRow[];
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfContext = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    regularFont,
    boldFont,
    y: PAGE_HEIGHT - MARGIN,
  };

  const asphaltTotal = asphaltRows.reduce(
    (sum, row) => sum + row.quantityTons,
    0
  );

  drawText(ctx, "Tagesbestellung", MARGIN, ctx.y, {
    size: 22,
    font: boldFont,
  });

  ctx.y -= 22;

  drawText(ctx, `Bestellung fuer: ${formatGermanDate(selectedDateInput)}`, MARGIN, ctx.y, {
    size: 10,
    color: rgb(0.35, 0.35, 0.35),
  });

  ctx.y -= 14;

  drawText(ctx, `Exportiert am: ${formatGermanDateTime()}`, MARGIN, ctx.y, {
    size: 10,
    color: rgb(0.35, 0.35, 0.35),
  });

  ctx.y -= 18;
  drawLine(ctx);

  const boxY = ctx.y;
  drawInfoBox(ctx, "Bearbeitbar bis", "16:00 Uhr", MARGIN, boxY, 150);
  drawInfoBox(
    ctx,
    "Asphalt gesamt",
    `${formatTons(asphaltTotal)} t`,
    MARGIN + 170,
    boxY,
    150
  );
  drawInfoBox(
    ctx,
    "PDF-Stand",
    "Aktuell angezeigter Tag",
    MARGIN + 340,
    boxY,
    180
  );

  ctx.y -= 58;

  drawSectionTitle(ctx, "1. Asphaltbestellung");

  if (asphaltRows.length === 0) {
    drawWrappedText(
      ctx,
      "Fuer das gewaehlte Datum sind keine Asphaltpositionen in der Asphaltdisposition vorhanden.",
      MARGIN,
      ctx.y,
      CONTENT_WIDTH,
      {
        size: 10,
        lineHeight: 14,
        color: rgb(0.35, 0.35, 0.35),
      }
    );

    ctx.y -= 28;
  } else {
    const columns = {
      project: { x: MARGIN, width: 62 },
      construction: { x: MARGIN + 62, width: 120 },
      mix: { x: MARGIN + 182, width: 155 },
      qty: { x: MARGIN + 337, width: 55 },
      plant: { x: MARGIN + 392, width: 65 },
      notes: { x: MARGIN + 457, width: 66 },
    };

    ensureSpace(ctx, 50);

    drawText(ctx, "Projekt", columns.project.x, ctx.y, {
      size: 8,
      font: boldFont,
    });
    drawText(ctx, "Baumassnahme", columns.construction.x, ctx.y, {
      size: 8,
      font: boldFont,
    });
    drawText(ctx, "Asphaltsorte", columns.mix.x, ctx.y, {
      size: 8,
      font: boldFont,
    });
    drawText(ctx, "Menge", columns.qty.x, ctx.y, {
      size: 8,
      font: boldFont,
    });
    drawText(ctx, "Mischgut", columns.plant.x, ctx.y, {
      size: 8,
      font: boldFont,
    });
    drawText(ctx, "Bemerkung", columns.notes.x, ctx.y, {
      size: 8,
      font: boldFont,
    });

    ctx.y -= 12;
    drawLine(ctx);

    for (const row of asphaltRows) {
      ensureSpace(ctx, 70);

      const startY = ctx.y;
      const mixText = `${row.asphaltMixNumber} - ${row.asphaltMixName}`;
      const plantText = row.isForeignMix ? "Fremd" : "Eigene";
      const notesText = row.notes.join(" | ") || "-";

      const heights = [
        drawWrappedText(ctx, row.projectNumber, columns.project.x, startY, columns.project.width, {
          size: 8,
          lineHeight: 11,
        }),
        drawWrappedText(ctx, row.projectName, columns.construction.x, startY, columns.construction.width, {
          size: 8,
          lineHeight: 11,
        }),
        drawWrappedText(ctx, mixText, columns.mix.x, startY, columns.mix.width, {
          size: 8,
          lineHeight: 11,
        }),
        drawWrappedText(ctx, `${formatTons(row.quantityTons)} t`, columns.qty.x, startY, columns.qty.width, {
          size: 8,
          lineHeight: 11,
          font: boldFont,
        }),
        drawWrappedText(ctx, plantText, columns.plant.x, startY, columns.plant.width, {
          size: 8,
          lineHeight: 11,
        }),
        drawWrappedText(ctx, notesText, columns.notes.x, startY, columns.notes.width, {
          size: 8,
          lineHeight: 11,
        }),
      ];

      ctx.y = startY - Math.max(...heights, 14) - 6;
      drawLine(ctx);
    }

    ensureSpace(ctx, 30);

    drawText(ctx, `Asphalt gesamt: ${formatTons(asphaltTotal)} t`, MARGIN, ctx.y, {
      size: 11,
      font: boldFont,
    });

    ctx.y -= 20;
  }

  drawSectionTitle(ctx, "2. Fremd-LKW / Transporte");

  drawWrappedText(
    ctx,
    "Dieser Abschnitt wird im naechsten Schritt aus der LKW-Einteilung angebunden.",
    MARGIN,
    ctx.y,
    CONTENT_WIDTH,
    {
      size: 10,
      lineHeight: 14,
      color: rgb(0.35, 0.35, 0.35),
    }
  );

  ctx.y -= 36;

  drawSectionTitle(ctx, "3. Betonbestellung");

  drawWrappedText(
    ctx,
    "Dieser Abschnitt wird im naechsten Schritt mit manuellen Betonpositionen angebunden.",
    MARGIN,
    ctx.y,
    CONTENT_WIDTH,
    {
      size: 10,
      lineHeight: 14,
      color: rgb(0.35, 0.35, 0.35),
    }
  );

  const pdfBytes = await pdfDoc.save();

  return Buffer.from(pdfBytes);
}

export async function GET(request: NextRequest) {
  const todayInput = getBerlinDateInput();
  const defaultOrderDateInput = addDaysToDateInput(todayInput, 1);

  const requestedDate = request.nextUrl.searchParams.get("date") ?? "";
  const selectedDateInput = isValidDateInput(requestedDate)
    ? requestedDate
    : defaultOrderDateInput;

  const nextDateInput = addDaysToDateInput(selectedDateInput, 1);

  const orderDateStart = dateInputToUtcDate(selectedDateInput);
  const orderDateEnd = dateInputToUtcDate(nextDateInput);

  const asphaltEntries = await prisma.asphaltDispatchEntry.findMany({
    where: {
      workDate: {
        gte: orderDateStart,
        lt: orderDateEnd,
      },
    },
    select: {
      projectNumber: true,
      projectName: true,
      constructionManager: true,
      asphaltMixNumber: true,
      asphaltMixName: true,
      quantityTons: true,
      isForeignMix: true,
      notes: true,
    },
    orderBy: [
      {
        projectNumber: "asc",
      },
      {
        asphaltMixName: "asc",
      },
    ],
  });

  const asphaltRows = groupAsphaltEntries(asphaltEntries);

  const buffer = await createPdfBuffer({
    selectedDateInput,
    asphaltRows,
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bestellung-${selectedDateInput}.pdf"`,
    },
  });
}