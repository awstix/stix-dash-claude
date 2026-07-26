import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";
import {
  PDFDocument,
  PDFName,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AccidentPdfFonts = {
  bold: PDFFont;
  regular: PDFFont;
};

const black = rgb(0, 0, 0);
const blue = rgb(0.02, 0.11, 0.9);
const white = rgb(1, 1, 1);

async function getAccidentReportForPdf(reportId: string) {
  return prisma.safetyAccidentReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      project: {
        select: {
          name: true,
          projectNumber: true,
        },
      },
      notifications: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          recipientEmail: true,
          recipientName: true,
          sentAt: true,
          status: true,
        },
      },
    },
  });
}

type AccidentReportForPdf = NonNullable<
  Awaited<ReturnType<typeof getAccidentReportForPdf>>
>;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const { reportId } = await params;
  const report = await getAccidentReportForPdf(reportId);

  if (!report) {
    return new Response("Unfallmeldung nicht gefunden.", {
      status: 404,
    });
  }

  const templateBytes = await readFile(
    path.join(process.cwd(), "public", "templates", "unfallsofortmeldung.pdf"),
  );
  const pdf = await PDFDocument.load(templateBytes);
  const page = pdf.getPages()[0];
  page.node.delete(PDFName.of("Annots"));
  const fonts = await loadFonts(pdf);

  await drawReport(pdf, page, fonts, report);

  const bytes = await pdf.save();
  const fileName = `Unfallsofortmeldung_${safeFileName(
    report.project?.projectNumber ?? "ohne-projekt",
  )}_${formatIsoDate(report.accidentDate)}.pdf`;

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

async function loadFonts(pdf: PDFDocument): Promise<AccidentPdfFonts> {
  return {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    regular: await pdf.embedFont(StandardFonts.Helvetica),
  };
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function formatDate(date: Date | null) {
  if (!date) return "";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string | null | undefined,
  x: number,
  y: number,
  size = 8,
  maxWidth = 240,
  color = black,
  maxLines = 4,
) {
  const value = String(text ?? "").trim();
  if (!value) return;

  wrap(value, font, size, maxWidth)
    .slice(0, maxLines)
    .forEach((line, index) => {
      page.drawText(line, {
        color,
        font,
        size,
        x,
        y: y - index * (size + 2),
      });
    });
}

function drawCheck(page: PDFPage, checked: boolean, x: number, y: number) {
  if (!checked) return;

  page.drawLine({
    color: black,
    end: {
      x: x + 6.2,
      y: y + 6.2,
    },
    start: {
      x,
      y,
    },
    thickness: 0.85,
  });
  page.drawLine({
    color: black,
    end: {
      x,
      y: y + 6.2,
    },
    start: {
      x: x + 6.2,
      y,
    },
    thickness: 0.85,
  });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const words = rawLine.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}

async function drawSignature(
  pdf: PDFDocument,
  page: PDFPage,
  signatureDataUrl: string | null | undefined,
) {
  if (!signatureDataUrl?.startsWith("data:image/png;base64,")) {
    return;
  }

  const imageBytes = Buffer.from(
    signatureDataUrl.replace("data:image/png;base64,", ""),
    "base64",
  );
  const image = await pdf.embedPng(imageBytes);
  page.drawImage(image, {
    height: 18,
    width: 98,
    x: 212,
    y: 126,
  });
}

async function drawReport(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: AccidentPdfFonts,
  report: AccidentReportForPdf,
) {
  const person = report.employee
    ? `${report.employee.lastName}, ${report.employee.firstName}`
    : report.employeeSnapshot;
  const project = report.project
    ? `${report.project.projectNumber} · ${report.project.name}`
    : report.projectSnapshot;
  const accidentDateTime = `${formatDate(report.accidentDate)}${
    report.accidentTime ? ` · ${report.accidentTime} Uhr` : ""
  }`;
  const textUp = 4;
  const checkUp = 2.2;

  drawText(page, fonts.regular, report.employeeSalutation, 322, 704 + textUp, 8, 38);
  drawText(page, fonts.regular, person, 370, 704 + textUp, 8, 160);

  drawCheck(page, report.internalEmployeeStatus === "YES", 274.4, 679.2 + checkUp);
  drawCheck(page, report.internalEmployeeStatus === "NO", 274.4, 665.4 + checkUp);
  drawText(page, fonts.regular, report.externalCompany, 398, 666 + textUp, 8, 132);

  drawCheck(page, report.apprenticeStatus === "YES", 274.4, 643.2 + checkUp);
  drawCheck(page, report.apprenticeStatus === "NO", 274.4, 629.4 + checkUp);

  drawCheck(page, report.externalCauserStatus === "YES", 274.4, 613.2 + checkUp);
  drawCheck(page, report.externalCauserStatus === "NO", 274.4, 599.4 + checkUp);
  drawText(page, fonts.regular, report.externalCauserName, 382, 596 + textUp, 8, 148);

  drawText(page, fonts.regular, accidentDateTime, 273, 560 + textUp, 8, 250);
  drawText(page, fonts.regular, report.location || project, 273, 537 + textUp, 8, 250);
  drawText(page, fonts.regular, report.departmentCrew, 273, 514 + textUp, 8, 250);
  drawText(
    page,
    fonts.regular,
    report.constructionManagerName,
    322,
    489 + textUp,
    8,
    200,
  );
  drawText(page, fonts.regular, report.constructionManagerPhone, 322, 466 + textUp, 8, 200);
  drawText(page, fonts.regular, report.clientSafetyContact, 273, 443 + textUp, 8, 250);
  drawText(page, fonts.regular, report.description, 273, 420 + textUp, 8, 250, black, 5);
  drawText(
    page,
    fonts.regular,
    [report.bodyPart, report.injuryType].filter(Boolean).join(" · "),
    273,
    348 + textUp,
    8,
    250,
  );

  drawCheck(page, report.injurySeverity === "LIGHT", 277.4, 322.2 + checkUp);
  drawCheck(page, report.injurySeverity === "MEDIUM", 277.4, 309.8 + checkUp);
  drawCheck(page, report.injurySeverity === "SEVERE", 277.4, 297.8 + checkUp);

  drawText(page, fonts.regular, report.treatment, 273, 276.2 + textUp, 8, 250);

  drawCheck(page, report.propertyDamageStatus === "YES", 274.4, 247.2 + checkUp);
  drawCheck(page, report.propertyDamageStatus === "NO", 274.4, 226.4 + checkUp);
  drawText(page, fonts.regular, report.propertyDamageDescription, 390, 247 + textUp, 8, 140);

  drawCheck(page, report.externalSafetyAnalysisStatus === "YES", 274.4, 207.2 + checkUp);
  drawCheck(
    page,
    report.externalSafetyAnalysisStatus === "NOT_REQUIRED",
    274.4,
    191.7 + checkUp,
  );

  drawText(page, fonts.regular, formatDate(report.signatureDate), 52, 132, 8, 95);
  drawText(page, fonts.regular, report.reportedByName, 170, 132, 8, 130);
  await drawSignature(pdf, page, report.managerSignatureDataUrl);
  drawForwardingFooter(page, fonts, report);
}

function drawForwardingFooter(
  page: PDFPage,
  fonts: AccidentPdfFonts,
  report: AccidentReportForPdf,
) {
  const rows = [101, 83, 65];

  // Nur die festen Mailadressen aus der Vorlage entfernen. Rahmen und
  // Datumsspalte bleiben unverändert aus der Original-PDF erhalten.
  for (const y of rows) {
    page.drawRectangle({
      color: white,
      height: 12,
      width: 140,
      x: 343,
      y: y - 2,
    });
  }

  report.notifications.slice(0, rows.length).forEach((notification, index) => {
    const y = rows[index];
    drawText(page, fonts.regular, notification.recipientEmail, 345, y, 8, 135, blue);

    if (notification.status === "SENT" && notification.sentAt) {
      drawText(page, fonts.regular, formatDate(notification.sentAt), 491, y, 8, 52);
    }
  });
}
