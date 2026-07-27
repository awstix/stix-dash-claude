import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";
import {
  PROJECT_START_ACTIVITIES,
  PROJECT_START_ASSESSMENT_SECTIONS,
  PROJECT_START_CHECKLIST_TEMPLATE,
} from "@/lib/project-start-checklist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4: [number, number] = [595.28, 841.89];
const BLACK = rgb(0, 0, 0);
const BLUE = rgb(0.08, 0.2, 0.34);
const GRAY = rgb(0.82, 0.83, 0.84);
const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
const MUTED = rgb(0.55, 0.55, 0.55);
const MARGIN = 42;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;

type Fonts = { bold: PDFFont; italic: PDFFont; regular: PDFFont };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ checklistId: string }> },
) {
  const { checklistId } = await params;
  const item = await prisma.projectStartChecklist.findUnique({
    include: {
      project: true,
      participants: {
        include: { employee: true },
        orderBy: [{ instructionDate: "asc" }, { createdAt: "asc" }],
      },
    },
    where: { id: checklistId },
  });
  if (!item) return new Response("Checkliste nicht gefunden.", { status: 404 });

  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    regular: await pdf.embedFont(StandardFonts.Helvetica),
  };
  const logo = await pdf.embedPng(
    await readFile(
      path.join(
        process.cwd(),
        "public",
        "templates",
        "project-start-stix-logo.png",
      ),
    ),
  );
  const assessments = JSON.parse(item.assessmentsJson) as Record<string, string>;
  const activities = JSON.parse(item.activitiesJson) as string[];
  const pages: PDFPage[] = [];
  const addPage = () => {
    const page = pdf.addPage(A4);
    pages.push(page);
    drawHeader(page, fonts, logo, item.templateCode, item.templateRevision);
    return page;
  };

  const page1 = addPage();
  let y = 708;
  y = drawSectionTitle(page1, fonts, y, "A  Allgemeine Angaben");
  y = drawInformationGrid(page1, fonts, y, [
    ["1.", "Firma:", "Josef Stix GmbH & Co.KG", "Straße:", "Depotstraße 2"],
    [
      "2.",
      "Verantwortliche Bauleitung:",
      item.responsibleManager || item.project.constructionManager || "—",
      "Tel./Mobil:",
      [item.responsiblePhone, item.responsibleMobile].filter(Boolean).join(" / ") ||
        "—",
    ],
    ["3.", "Projekt:", `${item.project.projectNumber} · ${item.project.name}`, "", ""],
  ]);
  y -= 7;
  y = drawSectionTitle(page1, fonts, y, "B  Ort / Datum");
  y = drawInformationGrid(page1, fonts, y, [
    ["1.", "Baustelle / Auftrags-Nr.:", item.project.projectNumber, "", ""],
    ["2.", "Straße:", item.siteStreet || item.project.siteAddress || "—", "", ""],
    ["3.", "PLZ / Ort:", item.sitePostalCity || "—", "", ""],
    [
      "4.",
      "Dauer / Datum:",
      `Von ${date(item.startDate)}  bis ${date(item.endDate)}`,
      "Erstellt:",
      date(item.checklistDate),
    ],
  ]);
  y -= 8;
  y = drawSectionTitle(page1, fonts, y, "C  Auszuführende Arbeiten");
  y = drawActivities(page1, fonts, y, activities);
  y = drawLinedText(
    page1,
    fonts,
    y - 4,
    "Sonstiges / Details:",
    item.otherActivities || "",
    3,
  );
  y -= 5;
  y = drawSectionTitle(
    page1,
    fonts,
    y,
    "D  Erforderliche Maßnahmen / LMRA (Last Minute Risk Analysis):",
  );
  y = drawAssessmentSection(
    page1,
    fonts,
    y,
    PROJECT_START_ASSESSMENT_SECTIONS[0],
    assessments,
  );
  drawLegend(page1, fonts, y - 12);

  const page2 = addPage();
  y = 708;
  for (const section of PROJECT_START_ASSESSMENT_SECTIONS.slice(1)) {
    y = drawAssessmentSection(page2, fonts, y, section, assessments);
    y -= 7;
  }
  drawLegend(page2, fonts, y - 5);

  const page3 = addPage();
  y = 708;
  y = drawSectionTitle(page3, fonts, y, "E  Unterweisung / Teilnehmer");
  y = drawLinedText(
    page3,
    fonts,
    y,
    "Projektspezifische Unterweisungsthemen:",
    item.instructionTopics || "",
    4,
  );
  y -= 7;
  y = drawSectionTitle(page3, fonts, y, "Vortragende Person");
  y = await drawPresenter(
    page3,
    fonts,
    y,
    item.presenterName,
    item.presenterSignatureDataUrl,
    pdf,
  );
  y -= 8;
  y = drawSectionTitle(page3, fonts, y, "Teilnehmende Mitarbeiter");
  for (const participant of item.participants) {
    if (y < 92) {
      const continuation = addPage();
      y = drawSectionTitle(
        continuation,
        fonts,
        708,
        "E  Teilnehmende Mitarbeiter – Fortsetzung",
      );
    }
    const activePage = pages.at(-1)!;
    y = await drawParticipant(activePage, fonts, y, participant, pdf);
  }

  pages.forEach((page, index) => drawFooter(page, fonts, index + 1, pages.length));
  pdf.setTitle(
    `${item.project.projectNumber} – ${PROJECT_START_CHECKLIST_TEMPLATE.title}`,
  );
  pdf.setSubject("Gefährdungsbeurteilung Projektstart");
  pdf.setCreator("Dashboard Stix");

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${item.project.projectNumber}_Projektstart_Checkliste.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  code: string,
  revision: string,
) {
  page.drawText(PROJECT_START_CHECKLIST_TEMPLATE.title.replace("–", "-"), {
    x: MARGIN,
    y: 798,
    size: 16,
    font: fonts.regular,
    color: MUTED,
  });
  const labels = ["Interne Nummer:", "Ausgabestand:", "Layout-Rev.:", "Ersteller:"];
  const values = [code, PROJECT_START_CHECKLIST_TEMPLATE.issuedAt, revision, "EGRO S+C – RE"];
  const widths = [96, 96, 82, 137];
  let x = MARGIN;
  labels.forEach((label, index) => {
    page.drawRectangle({ x, y: 771, width: widths[index], height: 13, color: LIGHT_GRAY });
    page.drawText(label, { x: x + 4, y: 775, size: 6.5, font: fonts.regular, color: MUTED });
    page.drawText(values[index], { x: x + 4, y: 760, size: 7.5, font: fonts.regular, color: MUTED });
    x += widths[index];
  });
  page.drawImage(logo, { x: 441, y: 772, width: 112, height: 39 });
}

function drawFooter(page: PDFPage, fonts: Fonts, pageNumber: number, total: number) {
  page.drawText("A-30-30 - Checklisten", { x: MARGIN, y: 28, size: 7, font: fonts.regular, color: MUTED });
  const pageLabel = `Seite ${pageNumber}${total ? ` von ${total}` : ""}`;
  page.drawText(pageLabel, { x: 278, y: 28, size: 7, font: fonts.regular, color: MUTED });
  page.drawText("Josef Stix GmbH & Co.KG", { x: 445, y: 28, size: 7, font: fonts.regular, color: MUTED });
}

function drawSectionTitle(page: PDFPage, fonts: Fonts, y: number, title: string) {
  page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_WIDTH, height: 16, color: GRAY });
  page.drawText(title, { x: MARGIN + 6, y: y - 12, size: 10, font: fonts.bold, color: BLACK });
  return y - 16;
}

function drawInformationGrid(page: PDFPage, fonts: Fonts, y: number, rows: string[][]) {
  const rowHeight = 18;
  const columns = [25, 138, 160, 72, 116];
  rows.forEach((row, rowIndex) => {
    let x = MARGIN;
    columns.forEach((width, columnIndex) => {
      page.drawRectangle({ x, y: y - rowHeight, width, height: rowHeight, borderColor: BLACK, borderWidth: 0.5 });
      const value = row[columnIndex] || "";
      page.drawText(fit(value, fonts.regular, 7.5, width - 6), {
        x: x + 4,
        y: y - 12,
        size: 7.5,
        font: columnIndex === 1 || columnIndex === 3 ? fonts.regular : fonts.regular,
        color: BLACK,
      });
      x += width;
    });
    y -= rowHeight;
    if (rowIndex === rows.length - 1) y -= 0;
  });
  return y;
}

function drawActivities(page: PDFPage, fonts: Fonts, y: number, selected: string[]) {
  const columns = 3;
  const cellWidth = CONTENT_WIDTH / columns;
  const rowHeight = 17;
  PROJECT_START_ACTIVITIES.forEach((activity, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * cellWidth;
    const top = y - row * rowHeight;
    page.drawRectangle({ x, y: top - rowHeight, width: cellWidth, height: rowHeight, borderColor: BLACK, borderWidth: 0.5 });
    page.drawText(selected.includes(activity) ? "X" : "", {
      x: x + 7,
      y: top - 12,
      size: 8,
      font: fonts.bold,
      color: BLACK,
    });
    page.drawText(`- ${activity}`, {
      x: x + 24,
      y: top - 12,
      size: 7,
      font: fonts.regular,
      color: BLACK,
    });
  });
  return y - Math.ceil(PROJECT_START_ACTIVITIES.length / columns) * rowHeight;
}

function drawLinedText(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  value: string,
  lines: number,
) {
  page.drawText(label, { x: MARGIN + 4, y: y - 12, size: 8, font: fonts.regular, color: BLACK });
  const wrapped = wrap(value, fonts.regular, 8, CONTENT_WIDTH - 12);
  for (let index = 0; index < lines; index += 1) {
    const lineY = y - 25 - index * 19;
    page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + CONTENT_WIDTH, y: lineY }, thickness: 0.5, color: BLACK });
    if (wrapped[index]) page.drawText(wrapped[index], { x: MARGIN + 4, y: lineY + 5, size: 8, font: fonts.regular, color: BLACK });
  }
  return y - 25 - lines * 19;
}

function drawAssessmentSection(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  section: (typeof PROJECT_START_ASSESSMENT_SECTIONS)[number],
  assessments: Record<string, string>,
) {
  const widths = [29, 355, 49, 26, 26, 26];
  const headingHeight = 19;
  page.drawRectangle({ x: MARGIN, y: y - headingHeight, width: CONTENT_WIDTH, height: headingHeight, borderColor: BLACK, borderWidth: 0.6 });
  page.drawText(`${section.id} - ${section.title}:`, { x: MARGIN + 6, y: y - 13, size: 9, font: fonts.italic, color: BLACK });
  ["i.O.", "n.i.O.", "n.r."].forEach((label, index) => {
    const x = MARGIN + widths.slice(0, 3 + index).reduce((sum, width) => sum + width, 0);
    page.drawText(label, { x: x + 4, y: y - 13, size: 6.5, font: fonts.regular, color: BLACK });
  });
  y -= headingHeight;
  for (const [number, question, reference] of section.questions) {
    const questionLines = wrap(question, fonts.regular, 7.1, widths[1] - 8);
    const rowHeight = Math.max(18, questionLines.length * 9 + 5);
    let x = MARGIN;
    widths.forEach((width) => {
      page.drawRectangle({ x, y: y - rowHeight, width, height: rowHeight, borderColor: BLACK, borderWidth: 0.5 });
      x += width;
    });
    page.drawText(number, { x: MARGIN + 5, y: y - 12, size: 7, font: fonts.regular, color: BLACK });
    questionLines.forEach((text, index) => page.drawText(text, { x: MARGIN + widths[0] + 4, y: y - 11 - index * 9, size: 7.1, font: fonts.regular, color: BLACK }));
    page.drawText(fit(reference, fonts.italic, 6.7, widths[2] - 6), {
      x: MARGIN + widths[0] + widths[1] + 3,
      y: y - 12,
      size: 6.7,
      font: fonts.italic,
      color: BLUE,
    });
    const status = assessments[number];
    const statusIndex = status === "OK" ? 0 : status === "NOT_OK" ? 1 : status === "NOT_RELEVANT" ? 2 : -1;
    if (statusIndex >= 0) {
      const statusX = MARGIN + widths[0] + widths[1] + widths[2] + statusIndex * 26;
      page.drawText("X", { x: statusX + 9, y: y - 13, size: 8, font: fonts.bold, color: BLACK });
    }
    y -= rowHeight;
  }
  return y;
}

function drawLegend(page: PDFPage, fonts: Fonts, y: number) {
  page.drawText("i.O = in Ordnung   /   n.i.O = nicht in Ordnung   /   n.r = nicht relevant", {
    x: 302,
    y,
    size: 7,
    font: fonts.italic,
    color: BLACK,
  });
}

async function drawPresenter(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  name: string | null,
  signatureDataUrl: string | null,
  pdf: PDFDocument,
) {
  page.drawRectangle({ x: MARGIN, y: y - 54, width: 250, height: 54, borderColor: BLACK, borderWidth: 0.5 });
  page.drawRectangle({ x: MARGIN + 250, y: y - 54, width: CONTENT_WIDTH - 250, height: 54, borderColor: BLACK, borderWidth: 0.5 });
  page.drawText("Name / Funktion", { x: MARGIN + 5, y: y - 12, size: 7, font: fonts.regular, color: MUTED });
  page.drawText(name || "—", { x: MARGIN + 5, y: y - 31, size: 10, font: fonts.bold, color: BLACK });
  page.drawText("Unterschrift", { x: MARGIN + 255, y: y - 12, size: 7, font: fonts.regular, color: MUTED });
  const image = await embedSignature(pdf, signatureDataUrl);
  if (image) page.drawImage(image, { x: MARGIN + 260, y: y - 49, width: 115, height: 32 });
  return y - 54;
}

async function drawParticipant(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  participant: {
    companyDepartment: string | null;
    employee: { firstName: string; lastName: string };
    instructionDate: Date | null;
    signatureDataUrl: string | null;
  },
  pdf: PDFDocument,
) {
  const height = 48;
  const widths = [190, 115, 75, 131];
  let x = MARGIN;
  widths.forEach((width) => {
    page.drawRectangle({ x, y: y - height, width, height, borderColor: BLACK, borderWidth: 0.5 });
    x += width;
  });
  page.drawText("Name", { x: MARGIN + 4, y: y - 10, size: 6.5, font: fonts.regular, color: MUTED });
  page.drawText(`${participant.employee.lastName}, ${participant.employee.firstName}`, { x: MARGIN + 4, y: y - 29, size: 8.5, font: fonts.bold, color: BLACK });
  page.drawText("Firma / Abteilung", { x: MARGIN + 194, y: y - 10, size: 6.5, font: fonts.regular, color: MUTED });
  page.drawText(fit(participant.companyDepartment || "—", fonts.regular, 7.5, 107), { x: MARGIN + 194, y: y - 29, size: 7.5, font: fonts.regular, color: BLACK });
  page.drawText("Datum", { x: MARGIN + 309, y: y - 10, size: 6.5, font: fonts.regular, color: MUTED });
  page.drawText(date(participant.instructionDate), { x: MARGIN + 309, y: y - 29, size: 8, font: fonts.regular, color: BLACK });
  page.drawText("Unterschrift", { x: MARGIN + 384, y: y - 10, size: 6.5, font: fonts.regular, color: MUTED });
  const image = await embedSignature(pdf, participant.signatureDataUrl);
  if (image) page.drawImage(image, { x: MARGIN + 389, y: y - 43, width: 105, height: 28 });
  return y - height;
}

async function embedSignature(pdf: PDFDocument, value: string | null) {
  if (!value?.startsWith("data:image/")) return null;
  const [, mime, encoded] = value.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/) || [];
  if (!encoded) return null;
  const bytes = Buffer.from(encoded, "base64");
  return mime === "image/png" ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

function date(value: Date | null) {
  return value?.toLocaleDateString("de-DE") ?? "—";
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (!text) return [];
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}
