import { NextRequest } from "next/server";
import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/auth-access";
import {
  parseConstructionManagersJson,
  parseSiteContactsJson,
} from "@/lib/construction-managers";
import {
  drawCompanyHeader,
  embedCompanyLogo,
  loadFormPdfFonts,
  normalizeFormPdfCompany,
} from "@/lib/formPdf";
import {
  renderSiteMapImage,
  SITE_MARKER_COLORS,
  SITE_MARKER_LABELS,
  type SiteMarkerType,
} from "@/lib/site-map-image";

export const runtime = "nodejs";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 78;
const FOOTER_RESERVED = 24;
const MAP_DISPLAY_HEIGHT = 170;

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
      mapZoom: true,
      name: true,
      projectNumber: true,
      siteAddress: true,
      siteBoundaryGeoJson: true,
      siteContactsJson: true,
      siteDirectionsNote: true,
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
  const siteContacts = parseSiteContactsJson(project.siteContactsJson);
  const siteContactEmployeeIds = siteContacts
    .map((contact) => contact.employeeId)
    .filter((employeeId): employeeId is string => employeeId !== null);

  const [managerEmployee, siteContactEmployees, companyInfoRow] = await Promise.all([
    primaryManager?.employeeId
      ? prisma.employee.findUnique({
          where: { id: primaryManager.employeeId },
          select: { mobilePhone: true },
        })
      : null,
    siteContactEmployeeIds.length
      ? prisma.employee.findMany({
          include: {
            positions: {
              orderBy: [{ sortOrder: "asc" }, { positionLabel: "asc" }],
            },
          },
          where: { id: { in: siteContactEmployeeIds } },
        })
      : [],
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
  ]);
  const companyInfo = normalizeFormPdfCompany(companyInfoRow);
  const siteContactEmployeeById = new Map(
    siteContactEmployees.map((employee) => [employee.id, employee]),
  );

  const contactBoxes: { label: string; name: string | null; phone: string | null }[] = [
    {
      label: "Zuständiger Bauleiter",
      name: primaryManager?.name ?? null,
      phone: managerEmployee?.mobilePhone ?? null,
    },
    ...siteContacts.map((contact) => {
      const employee = contact.employeeId
        ? siteContactEmployeeById.get(contact.employeeId)
        : null;
      const positionsLabel = employee?.positions
        .map((position) => position.positionLabel)
        .join(", ");
      return {
        label: positionsLabel || contact.role || "Kontaktperson",
        name: contact.name,
        phone: employee?.mobilePhone ?? contact.phone ?? null,
      };
    }),
  ];

  const hasCoordinates = project.mapLatitude !== null && project.mapLongitude !== null;
  const directionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${project.mapLatitude},${project.mapLongitude}`
    : project.siteAddress
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(project.siteAddress)}`
      : null;

  const mapImagePromise = renderSiteMapImage({
    boundaryGeoJson: project.siteBoundaryGeoJson,
    height: Math.round(MAP_DISPLAY_HEIGHT * 2),
    latitude: project.mapLatitude,
    longitude: project.mapLongitude,
    width: Math.round(CONTENT_WIDTH * 2),
    zoom: project.mapZoom,
  });

  const pdfDoc = await PDFDocument.create();
  const { bold, regular } = await loadFormPdfFonts(pdfDoc);
  const companyLogo = await embedCompanyLogo(pdfDoc, companyInfo.logoPublicUrl);

  let page = addPage();
  let y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;

  function addPage() {
    const nextPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawCompanyHeader(nextPage, bold, regular, MARGIN, PAGE_WIDTH, companyInfo, companyLogo);
    drawLine(nextPage, PAGE_HEIGHT - MARGIN - HEADER_HEIGHT + 18);
    return nextPage;
  }

  function ensureSpace(needed: number) {
    if (y - needed < FOOTER_RESERVED + MARGIN) {
      page = addPage();
      y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;
    }
  }

  // Title
  page.drawText("Wegbeschreibung zur Baustelle", {
    color: textColor,
    font: bold,
    size: 16,
    x: MARGIN,
    y,
  });
  y -= 22;

  // Project number + name
  const projectTitle = [project.projectNumber, project.name].filter(Boolean).join(" · ");
  wrapText(projectTitle, bold, 12.5, CONTENT_WIDTH).forEach((line) => {
    page.drawText(line, { color: accentColor, font: bold, size: 12.5, x: MARGIN, y });
    y -= 16;
  });
  y -= 2;

  // Address
  if (project.siteAddress) {
    const addressLine = [
      project.siteAddress,
      hasCoordinates
        ? `(${project.mapLatitude!.toFixed(5)}, ${project.mapLongitude!.toFixed(5)})`
        : null,
    ]
      .filter(Boolean)
      .join("  ");
    wrapText(addressLine, regular, 9.5, CONTENT_WIDTH).forEach((line) => {
      page.drawText(line, { color: textColor, font: regular, size: 9.5, x: MARGIN, y });
      y -= 13;
    });
  } else if (hasCoordinates) {
    page.drawText(
      `Koordinaten: ${project.mapLatitude!.toFixed(6)}, ${project.mapLongitude!.toFixed(6)}`,
      { color: mutedColor, font: regular, size: 9, x: MARGIN, y },
    );
    y -= 13;
  }
  y -= 6;

  // Kontaktpersonen (Bauleiter + Kontaktpersonen), compact - stacked
  const contactRowHeight = 25;
  const contactRowGap = 4;
  for (const contact of contactBoxes) {
    ensureSpace(contactRowHeight + contactRowGap);
    drawContactRow(page, {
      boldFont: bold,
      font: regular,
      height: contactRowHeight,
      label: contact.label,
      name: contact.name,
      phone: contact.phone,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: y - contactRowHeight,
    });
    y -= contactRowHeight + contactRowGap;
  }
  y -= 10;

  // Kartenausschnitt mit Symbolen + Legende
  const mapImage = await mapImagePromise;
  if (mapImage) {
    ensureSpace(MAP_DISPLAY_HEIGHT + 34);
    const mapPdfImage = await pdfDoc.embedPng(mapImage.png);
    page.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      height: MAP_DISPLAY_HEIGHT,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: y - MAP_DISPLAY_HEIGHT,
    });
    page.drawImage(mapPdfImage, {
      height: MAP_DISPLAY_HEIGHT,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: y - MAP_DISPLAY_HEIGHT,
    });
    y -= MAP_DISPLAY_HEIGHT + 8;

    // Legende: Baufeld + alle Symboltypen
    const legendEntries: { color: string; label: string }[] = [
      { color: "#ea580c", label: "Baufeld" },
      ...(Object.keys(SITE_MARKER_LABELS) as SiteMarkerType[]).map((type) => ({
        color: SITE_MARKER_COLORS[type],
        label: SITE_MARKER_LABELS[type],
      })),
    ];
    ensureSpace(24);
    let legendX = MARGIN;
    let legendY = y - 8;
    legendEntries.forEach((entry) => {
      const labelWidth = regular.widthOfTextAtSize(entry.label, 7.5);
      const entryWidth = 11 + labelWidth + 13;
      if (legendX + entryWidth - 13 > MARGIN + CONTENT_WIDTH) {
        legendX = MARGIN;
        legendY -= 13;
      }
      page.drawRectangle({
        color: rgb(
          parseInt(entry.color.slice(1, 3), 16) / 255,
          parseInt(entry.color.slice(3, 5), 16) / 255,
          parseInt(entry.color.slice(5, 7), 16) / 255,
        ),
        height: 8,
        width: 8,
        x: legendX,
        y: legendY,
      });
      page.drawText(entry.label, {
        color: mutedColor,
        font: regular,
        size: 7.5,
        x: legendX + 11,
        y: legendY + 1,
      });
      legendX += entryWidth;
    });
    y = legendY - 12;
  }

  // Wegbeschreibung
  if (project.siteDirectionsNote) {
    const lines = project.siteDirectionsNote
      .split("\n")
      .flatMap((paragraph) => wrapText(paragraph, regular, 9.5, CONTENT_WIDTH - 20));
    const boxHeightNote = Math.max(30, lines.length * 12.5 + 14);
    ensureSpace(boxHeightNote + 22);
    page.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      color: lightFill,
      height: boxHeightNote,
      width: CONTENT_WIDTH,
      x: MARGIN,
      y: y - boxHeightNote,
    });
    let noteY = y - 12;
    lines.forEach((line) => {
      page.drawText(line, {
        color: textColor,
        font: regular,
        size: 9.5,
        x: MARGIN + 10,
        y: noteY,
      });
      noteY -= 12.5;
    });
    y -= boxHeightNote + 14;
  }

  // QR code + link
  if (directionsUrl) {
    const qrSize = 66;
    ensureSpace(qrSize + 12);
    const qrPng = await QRCode.toBuffer(directionsUrl, {
      color: { dark: "#111827", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      type: "png",
      width: 320,
    });
    const qrImage = await pdfDoc.embedPng(qrPng);
    const qrY = y - qrSize;
    page.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      height: qrSize + 10,
      width: qrSize + 10,
      x: MARGIN,
      y: qrY - 5,
    });
    page.drawImage(qrImage, {
      height: qrSize,
      width: qrSize,
      x: MARGIN + 5,
      y: qrY,
    });

    const textX = MARGIN + qrSize + 24;
    page.drawText("Route direkt öffnen", {
      color: textColor,
      font: bold,
      size: 10,
      x: textX,
      y: y - 14,
    });
    page.drawText("QR-Code scannen oder Link antippen.", {
      color: mutedColor,
      font: regular,
      size: 8.5,
      x: textX,
      y: y - 29,
    });

    const linkLabel = "Route in Google Maps öffnen";
    const linkWidth = bold.widthOfTextAtSize(linkLabel, 9.5);
    const linkY = y - 46;
    page.drawText(linkLabel, {
      color: accentColor,
      font: bold,
      size: 9.5,
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
      height: 12,
    });
  }

  // Footer on every page
  const generatedAt = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());
  pdfDoc.getPages().forEach((pdfPage) => {
    pdfPage.drawText(`Erstellt am ${generatedAt}`, {
      color: mutedColor,
      font: regular,
      size: 7,
      x: MARGIN,
      y: 16,
    });
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

function drawContactRow(
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
  const textY = box.y + box.height / 2 - 3.2;
  const name = box.name ?? "Nicht hinterlegt";
  page.drawText(name, {
    color: textColor,
    font: box.boldFont,
    size: 9.5,
    x: box.x + 9,
    y: textY,
  });
  const nameWidth = box.boldFont.widthOfTextAtSize(name, 9.5);
  const labelText = `  ·  ${box.label}`;
  page.drawText(labelText, {
    color: mutedColor,
    font: box.font,
    size: 8,
    x: box.x + 9 + nameWidth,
    y: textY + 1,
  });
  const phoneText = box.phone ?? (box.name ? "Keine Handynummer hinterlegt" : "");
  if (phoneText) {
    const phoneWidth = box.font.widthOfTextAtSize(phoneText, 8.5);
    page.drawText(phoneText, {
      color: box.phone ? accentColor : mutedColor,
      font: box.font,
      size: 8.5,
      x: box.x + box.width - 9 - phoneWidth,
      y: textY,
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
