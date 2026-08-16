import { NextRequest } from "next/server";
import {
  PDFDocument,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth-access";
import { parseConstructionManagersJson } from "@/lib/construction-managers";
import { normalizeFormPdfCompany } from "@/lib/formPdf";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const textColor = rgb(0.08, 0.08, 0.08);
const mutedColor = rgb(0.38, 0.4, 0.44);
const lineColor = rgb(0.82, 0.83, 0.85);
const lightFill = rgb(0.965, 0.968, 0.972);
const accentColor = rgb(0.11, 0.31, 0.85);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await requireProjectAccess(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      constructionManager: true,
      constructionManagersJson: true,
      mapLatitude: true,
      mapLongitude: true,
      name: true,
      projectNumber: true,
      siteAddress: true,
      siteDirectionsNote: true,
      siteForemanEmployeeId: true,
    },
  });

  if (!project) {
    return new Response("Projekt nicht gefunden.", { status: 404 });
  }

  const constructionManagers = parseConstructionManagersJson(
    project.constructionManagersJson,
  );
  const primaryManager =
    constructionManagers[0] ??
    (project.constructionManager
      ? { employeeId: null, name: project.constructionManager }
      : null);

  const [foreman, managerEmployee, companyInfoRow] = await Promise.all([
    project.siteForemanEmployeeId
      ? prisma.employee.findUnique({
          where: { id: project.siteForemanEmployeeId },
          select: { firstName: true, lastName: true, mobilePhone: true },
        })
      : null,
    primaryManager?.employeeId
      ? prisma.employee.findUnique({
          where: { id: primaryManager.employeeId },
          select: { mobilePhone: true },
        })
      : null,
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
  ]);
  const companyInfo = normalizeFormPdfCompany(companyInfoRow);

  const hasCoordinates = project.mapLatitude !== null && project.mapLongitude !== null;
  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${project.mapLatitude},${project.mapLongitude}`
    : project.siteAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(project.siteAddress)}`
      : null;

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Company header
  page.drawText(companyInfo.companyName, {
    color: textColor,
    font: bold,
    size: 12,
    x: MARGIN,
    y,
  });
  const companyLine = [
    [companyInfo.street, [companyInfo.postalCode, companyInfo.city].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(" · "),
    companyInfo.phone,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (companyLine) {
    page.drawText(companyLine, {
      color: mutedColor,
      font: regular,
      size: 8,
      x: MARGIN,
      y: y - 13,
    });
  }
  y -= 34;
  drawLine(page, y);
  y -= 26;

  // Title
  page.drawText("Wegbeschreibung zur Baustelle", {
    color: textColor,
    font: bold,
    size: 20,
    x: MARGIN,
    y,
  });
  y -= 30;

  // Project number + name
  const projectTitle = [project.projectNumber, project.name].filter(Boolean).join(" · ");
  wrapText(projectTitle, bold, 15, CONTENT_WIDTH).forEach((line) => {
    page.drawText(line, { color: accentColor, font: bold, size: 15, x: MARGIN, y });
    y -= 19;
  });
  y -= 6;

  // Address
  if (project.siteAddress) {
    page.drawText("Baustellenadresse", {
      color: mutedColor,
      font: bold,
      size: 8.5,
      x: MARGIN,
      y,
    });
    y -= 14;
    wrapText(project.siteAddress, regular, 11, CONTENT_WIDTH).forEach((line) => {
      page.drawText(line, { color: textColor, font: regular, size: 11, x: MARGIN, y });
      y -= 15;
    });
    y -= 6;
  }

  if (hasCoordinates) {
    page.drawText(
      `Koordinaten: ${project.mapLatitude!.toFixed(6)}, ${project.mapLongitude!.toFixed(6)}`,
      { color: mutedColor, font: regular, size: 9, x: MARGIN, y },
    );
    y -= 20;
  }

  y -= 6;

  // Contact boxes: Bauleiter / Vorarbeiter-Polier
  const boxGap = 14;
  const boxWidth = (CONTENT_WIDTH - boxGap) / 2;
  const boxHeight = 62;
  drawContactBox(page, {
    x: MARGIN,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    label: "Zuständiger Bauleiter",
    name: primaryManager?.name ?? null,
    phone: managerEmployee?.mobilePhone ?? null,
    font: regular,
    boldFont: bold,
  });
  drawContactBox(page, {
    x: MARGIN + boxWidth + boxGap,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    label: "Zuständiger Vorarbeiter / Polier",
    name: foreman ? `${foreman.firstName} ${foreman.lastName}` : null,
    phone: foreman?.mobilePhone ?? null,
    font: regular,
    boldFont: bold,
  });
  y -= boxHeight + 26;

  // Wegbeschreibung
  if (project.siteDirectionsNote) {
    page.drawText("Wegbeschreibung", {
      color: mutedColor,
      font: bold,
      size: 8.5,
      x: MARGIN,
      y,
    });
    y -= 14;
    const lines = project.siteDirectionsNote
      .split("\n")
      .flatMap((paragraph) => wrapText(paragraph, regular, 10.5, CONTENT_WIDTH - 24));
    const boxHeightNote = Math.max(40, lines.length * 14 + 20);
    page.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      color: lightFill,
      height: boxHeightNote,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: y - boxHeightNote,
    });
    let noteY = y - 16;
    lines.forEach((line) => {
      page.drawText(line, {
        color: textColor,
        font: regular,
        size: 10.5,
        x: MARGIN + 12,
        y: noteY,
      });
      noteY -= 14;
    });
    y -= boxHeightNote + 26;
  }

  // QR code + link
  if (directionsUrl) {
    const qrPng = await QRCode.toBuffer(directionsUrl, {
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      type: "png",
      width: 480,
    });
    const qrImage = await pdfDoc.embedPng(qrPng);
    const qrSize = 120;
    const qrY = y - qrSize;
    page.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      height: qrSize + 16,
      width: qrSize + 16,
      x: MARGIN,
      y: qrY - 8,
    });
    page.drawImage(qrImage, {
      height: qrSize,
      width: qrSize,
      x: MARGIN + 8,
      y: qrY,
    });

    const textX = MARGIN + qrSize + 32;
    page.drawText("Route direkt öffnen", {
      color: textColor,
      font: bold,
      size: 11,
      x: textX,
      y: y - 18,
    });
    page.drawText("QR-Code scannen oder Link antippen -", {
      color: mutedColor,
      font: regular,
      size: 9,
      x: textX,
      y: y - 34,
    });
    page.drawText("öffnet Google Maps mit Route zur Baustelle.", {
      color: mutedColor,
      font: regular,
      size: 9,
      x: textX,
      y: y - 46,
    });

    const linkLabel = "Route in Google Maps öffnen";
    const linkWidth = bold.widthOfTextAtSize(linkLabel, 10);
    const linkY = y - 68;
    page.drawText(linkLabel, {
      color: accentColor,
      font: bold,
      size: 10,
      x: textX,
      y: linkY,
    });
    page.drawLine({
      color: accentColor,
      end: { x: textX + linkWidth, y: linkY - 2 },
      start: { x: textX, y: linkY - 2 },
      thickness: 0.8,
    });
    addLinkAnnotation(pdfDoc, page, directionsUrl, {
      x: textX,
      y: linkY - 3,
      width: linkWidth,
      height: 13,
    });
  }

  // Footer
  const generatedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  page.drawText(`Erstellt am ${generatedAt}`, {
    color: mutedColor,
    font: regular,
    size: 7.5,
    x: MARGIN,
    y: 24,
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `wegbeschreibung-${sanitizeFileName(project.projectNumber || project.name)}.pdf`;

  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

function drawLine(page: PDFPage, y: number) {
  page.drawLine({
    color: lineColor,
    end: { x: PAGE_WIDTH - MARGIN, y },
    start: { x: MARGIN, y },
    thickness: 0.8,
  });
}

function drawContactBox(
  page: PDFPage,
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    name: string | null;
    phone: string | null;
    font: PDFFont;
    boldFont: PDFFont;
  },
) {
  page.drawRectangle({
    borderColor: lineColor,
    borderWidth: 0.8,
    color: lightFill,
    height: box.height,
    width: box.width,
    x: box.x,
    y: box.y,
  });
  page.drawText(box.label, {
    color: mutedColor,
    font: box.boldFont,
    size: 8,
    x: box.x + 10,
    y: box.y + box.height - 16,
  });
  page.drawText(box.name ?? "Nicht hinterlegt", {
    color: textColor,
    font: box.boldFont,
    size: 11,
    x: box.x + 10,
    y: box.y + box.height - 33,
  });
  if (box.phone) {
    page.drawText(box.phone, {
      color: accentColor,
      font: box.font,
      size: 10,
      x: box.x + 10,
      y: box.y + box.height - 48,
    });
  } else if (box.name) {
    page.drawText("Keine Handynummer hinterlegt", {
      color: mutedColor,
      font: box.font,
      size: 8.5,
      x: box.x + 10,
      y: box.y + box.height - 48,
    });
  }
}

function addLinkAnnotation(
  pdfDoc: PDFDocument,
  page: PDFPage,
  url: string,
  box: { x: number; y: number; width: number; height: number },
) {
  const linkAnnotation = pdfDoc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [box.x, box.y, box.x + box.width, box.y + box.height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(url),
    },
  });
  const linkRef = pdfDoc.context.register(linkAnnotation);
  page.node.addAnnot(linkRef);
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

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "projekt";
}
