import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await params;
  const record = await prisma.safetyInstructionRecord.findUnique({
    include: {
      project: { select: { name: true, projectNumber: true } },
      signatures: { orderBy: { employeeName: "asc" } },
      template: true,
    },
    where: { id: recordId },
  });
  if (
    !record ||
    !["COMMISSION", "OPERATING_INSTRUCTION", "RISK_ASSESSMENT"].includes(
      record.template.type,
    )
  ) {
    return new NextResponse("Unterweisung nicht gefunden.", { status: 404 });
  }

  let pdf = await PDFDocument.create();
  const sourcePath = record.template.sourcePdfPath ?? record.template.content
    ?.split("\n")
    .find((line) => line.startsWith("SOURCE_PDF:"))
    ?.slice("SOURCE_PDF:".length);
  if (sourcePath?.startsWith("/templates/safety-commissions/")) {
    pdf = await PDFDocument.load(
      await fs.readFile(path.join(process.cwd(), "public", sourcePath)),
    );
    await fillCommissionOriginal(pdf, record);
    const bytes = await pdf.save();
    const fileName = `${slug(record.template.title)}-ausgefuellt.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      },
    });
  }
  if (
    sourcePath?.startsWith("/templates/operating-instructions/") ||
    sourcePath?.startsWith("/uploads/safety-templates/")
  ) {
    const source = await PDFDocument.load(
      await fs.readFile(path.join(process.cwd(), "public", sourcePath)),
    );
    const pages = await pdf.copyPages(source, source.getPageIndices());
    pages.forEach((page) => pdf.addPage(page));
  }

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const line = (text: string, size = 10, isBold = false, x = 48) => {
    page.drawText(safe(text), {
      color: rgb(0.08, 0.08, 0.08),
      font: isBold ? bold : regular,
      size,
      x,
      y,
    });
    y -= size + 7;
  };
  const ensureSpace = (height = 40) => {
    if (y >= height + 45) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
  };

  line(
    record.template.type === "RISK_ASSESSMENT"
      ? "Nachweis zur Gefährdungsbeurteilung"
      : "Unterweisungsnachweis zur Betriebsanweisung",
    16,
    true,
  );
  line(record.template.title, 13, true);
  y -= 8;
  line(
    `Datum: ${record.instructionDate.toLocaleDateString("de-DE")}   Projekt: ${
      record.project
        ? `${record.project.projectNumber} - ${record.project.name}`
        : record.projectSnapshot || "Ohne Projekt"
    }`,
  );
  line(`Unterwiesen durch: ${record.instructedByName || "-"}`);
  if (record.notes) line(`Notizen: ${record.notes}`);
  y -= 10;
  line("Behandelte Inhalte", 12, true);
  const sections = parseArray(record.checkedSectionsJson);
  for (const section of sections) {
    ensureSpace();
    line(`[X] ${section}`, 9);
  }
  y -= 10;
  line("Teilnehmende Mitarbeiter", 12, true);
  for (const signature of record.signatures) {
    ensureSpace(80);
    page.drawLine({
      color: rgb(0.25, 0.25, 0.25),
      end: { x: 547, y: y + 8 },
      start: { x: 48, y: y + 8 },
      thickness: 0.5,
    });
    line(signature.employeeName, 10, true);
    line(
      signature.signedAt
        ? `Unterschrieben am ${signature.signedAt.toLocaleString("de-DE")}`
        : "Unterschrift offen",
      8,
    );
    if (signature.signatureDataUrl?.startsWith("data:image/")) {
      try {
        const bytes = Buffer.from(
          signature.signatureDataUrl.split(",")[1],
          "base64",
        );
        const image = signature.signatureDataUrl.startsWith("data:image/jpeg")
          ? await pdf.embedJpg(bytes)
          : await pdf.embedPng(bytes);
        const scaled = image.scaleToFit(150, 38);
        page.drawImage(image, {
          height: scaled.height,
          width: scaled.width,
          x: 360,
          y: y - 8,
        });
      } catch {
        // Der Nachweis bleibt auch bei einer beschädigten Alt-Signatur exportierbar.
      }
    }
    y -= 35;
  }

  const bytes = await pdf.save();
  const fileName = `${slug(record.template.title)}-Unterweisungsnachweis.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

async function fillCommissionOriginal(
  pdf: PDFDocument,
  record: {
    instructionDate: Date;
    checkedSectionsJson: string;
    notes: string | null;
    signatures: Array<{
      employeeName: string;
      signatureDataUrl: string | null;
    }>;
    template: { title: string };
  },
) {
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const values = noteValues(record.notes);
  const company = values.get("Firma") || "Josef Stix GmbH & Co. KG";
  const authorized = record.signatures
    .find((signature) => signature.employeeName.startsWith("Unternehmen · "))
    ?.employeeName.replace("Unternehmen · ", "") ?? "";
  const commissioned = record.signatures
    .find((signature) => !signature.employeeName.startsWith("Unternehmen · "))
    ?.employeeName ?? "";
  const date = record.instructionDate.toLocaleDateString("de-DE");
  const title = record.template.title;

  const textFields: Array<[string, number, number, number]> = [];
  let signaturePositions: Array<[string, number, number, number]> = [];

  if (title.includes("Bestellung SiFa") || title.includes("Betriebsarzt")) {
    const isSifa = title.includes("SiFa");
    textFields.push(
      [company, 31.5, 14.15, 55.5],
      [authorized, 31.5, 17.55, 55.5],
      [commissioned, 31.5, isSifa ? 22.9 : 22.3, 55.5],
      [date, 8.2, isSifa ? 83.8 : 83.2, 18],
    );
    signaturePositions = [
      ["authorized", 30.2, isSifa ? 81.1 : 80.5, 26.7],
      ["commissioned", 61.5, isSifa ? 81.1 : 80.5, 27.2],
    ];
  } else if (title.includes("Unternehmerpflichten")) {
    const isManagement = title.includes("Bauleitung");
    textFields.push(
      [commissioned, 9, 24.5, 78],
      [values.get("Ort") ?? "", 9, isManagement ? 72.2 : 70.5, 35],
      [date, 50.5, isManagement ? 72.2 : 70.5, 35],
    );
    signaturePositions = [
      ["authorized", 9, isManagement ? 75.8 : 74, 35],
      ["commissioned", 50.5, isManagement ? 75.8 : 74, 35],
    ];
  } else if (
    title.includes("Ersthelfer") ||
    title.includes("Brandschutzhelfer") ||
    title.includes("Sicherheitsbeauftragten")
  ) {
    const signatureTop = title.includes("Ersthelfer") ? 58 : 70;
    textFields.push(
      [company, 18, 15, 69],
      [commissioned, 18, 20, 48],
      [values.get("Geburtsdatum") ?? "", 68, 20, 19],
      [date, 8.5, signatureTop - 1.2, 18],
    );
    signaturePositions = [
      ["authorized", 29.5, signatureTop - 0.5, 27],
      ["commissioned", 61, signatureTop - 0.5, 27],
    ];
  } else if (title.includes("Erdbaumaschinen")) {
    textFields.push(
      [company, 20.5, 13, 66],
      [commissioned, 20.5, 16.6, 37],
      [values.get("Geburtsdatum") ?? "", 64, 16.6, 22.5],
      [values.get("Wohnort") ?? "", 20.5, 20, 66],
      [date, 9, 86.2, 18],
    );
    signaturePositions = [
      ["authorized", 31.5, 81.8, 26],
      ["commissioned", 62.5, 81.8, 27],
    ];
    const checked = new Set(parseArray(record.checkedSectionsJson));
    const checkboxPages = earthmovingCheckboxes();
    for (const [pageIndex, boxes] of checkboxPages.entries()) {
      const targetPage = pdf.getPage(pageIndex);
      for (const box of boxes) {
        if (checked.has(box.label)) {
          drawCheck(targetPage, box.left, box.top);
        }
      }
    }
    for (const appendix of [
      {
        page: 1,
        label: "Bemerkungen Sicherheitsunterweisung",
        top: 68,
        conducted: "Sicherheitsunterweisung durchgeführt",
        received: "Sicherheitsunterweisung erhalten",
      },
      {
        page: 2,
        label: "Bemerkungen Technische Einweisung",
        top: 62.4,
        conducted: "Technische Einweisung durchgeführt",
        received: "Technische Einweisung erhalten",
      },
      {
        page: 3,
        label: "Bemerkungen Fahrtraining",
        top: 59,
        conducted: "Fahrtraining / Eignungstest durchgeführt",
        received: "Fahrtraining / Eignungstest erhalten",
      },
    ]) {
      const appendixPage = pdf.getPage(appendix.page);
      const suffix = appendix.page;
      drawOverlayText(
        appendixPage,
        font,
        values.get(`Mitarbeiter Anlage ${suffix}`) ?? commissioned,
        20,
        appendix.page === 1 ? 27.7 : 29.4,
        41,
      );
      drawOverlayText(
        appendixPage,
        font,
        values.get(`Geburtsdatum Anlage ${suffix}`) ??
          values.get("Geburtsdatum") ??
          "",
        70,
        appendix.page === 1 ? 27.7 : 29.4,
        19,
      );
      drawOverlayText(
        appendixPage,
        font,
        values.get(appendix.label) ?? "",
        25.8,
        appendix.top,
        66.2,
      );
      drawOverlayText(
        appendixPage,
        font,
        values.get(`Ort Anlage ${suffix}`) ?? "",
        28,
        appendix.page === 3 ? 77.2 : 78,
        25.5,
      );
      drawOverlayText(
        appendixPage,
        font,
        values.get(`Datum Anlage ${suffix}`) ?? date,
        62.7,
        appendix.page === 3 ? 77.2 : 78,
        30,
      );
      await drawNamedSignature(
        pdf,
        appendixPage,
        record.signatures,
        appendix.conducted,
        18.5,
        appendix.page === 3 ? 79.5 : 79.8,
        35,
      );
      await drawNamedSignature(
        pdf,
        appendixPage,
        record.signatures,
        appendix.received,
        62.7,
        appendix.page === 3 ? 79.5 : 79.8,
        30,
      );
    }
  } else {
    const isTraining = title.includes("Einarbeitung");
    textFields.push(
      [company, 18, isTraining ? 13 : 12.5, 69],
      [commissioned, 18, isTraining ? 16.5 : 16, 48],
      [values.get("Geburtsdatum") ?? "", 68, isTraining ? 16.5 : 16, 19],
      [values.get("Wohnort") ?? "", 18, isTraining ? 20 : 19.5, 69],
      [
        values.get("Geräte / Fahrzeuge / Geltungsbereich") ?? "",
        18,
        isTraining ? 31 : 39,
        69,
      ],
      [values.get("Ort") ?? "", 9, isTraining ? 76.3 : 86.5, 30],
      [date, 43.5, isTraining ? 76.3 : 86.5, 25],
    );
    signaturePositions = [
      ["authorized", 29, isTraining ? 78.5 : 85.5, 27],
      ["commissioned", 61, isTraining ? 78.5 : 85.5, 27],
    ];
  }

  for (const [text, left, top, width] of textFields) {
    if (!text) continue;
    drawOverlayText(page, font, text, left, top, width);
  }

  for (const [kind, left, top, width] of signaturePositions) {
    const signature =
      kind === "authorized"
        ? record.signatures.find((entry) =>
            entry.employeeName.startsWith("Unternehmen · "),
          )
        : record.signatures.find(
            (entry) => !entry.employeeName.startsWith("Unternehmen · "),
          );
    if (signature?.signatureDataUrl) {
      await drawSignature(
        pdf,
        page,
        signature.signatureDataUrl,
        left,
        top,
        width,
      );
    }
  }
}

async function drawNamedSignature(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["getPage"]>,
  signatures: Array<{ employeeName: string; signatureDataUrl: string | null }>,
  employeeName: string,
  left: number,
  top: number,
  width: number,
) {
  const signature = signatures.find(
    (entry) =>
      entry.employeeName === employeeName ||
      entry.employeeName.startsWith(`${employeeName} · `),
  );
  if (signature?.signatureDataUrl) {
    await drawSignature(pdf, page, signature.signatureDataUrl, left, top, width);
  }
}

function drawCheck(
  page: ReturnType<PDFDocument["getPage"]>,
  left: number,
  top: number,
) {
  const { height, width } = page.getSize();
  const x = (left / 100) * width;
  const topY = height - (top / 100) * height;
  page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: x + 13, y: topY - 13 },
    start: { x: x + 3, y: topY - 3 },
    thickness: 2,
  });
  page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: x + 3, y: topY - 13 },
    start: { x: x + 13, y: topY - 3 },
    thickness: 2,
  });
}

function earthmovingCheckboxes() {
  const positioned = (
    labels: string[],
    left: number,
    top: number,
    step: number,
  ) => labels.map((label, index) => ({ label, left, top: top + index * step }));
  return [
    positioned(
      ["Kettenbagger bis 5 t", "Mobilbagger bis 5 t", "Radlader bis 5 t", "Straßenwalzen", "Asphaltfräsen"],
      10,
      38,
      2.5,
    ).concat(
      positioned(["Kettenbagger über 5 t", "Mobilbagger über 5 t", "Radlader über 5 t", "Erdbauwalzen", "Asphaltfertiger"], 55.4, 38, 2.5),
      positioned(["Sicherheitsunterweisung durchgeführt", "Eignungstest und Fahrtraining durchgeführt"], 10, 54, 3),
      positioned(["Technische Einweisung durchgeführt"], 55.4, 54, 3),
    ),
    positioned(["Bestimmungsgemäße Verwendung", "Gefahrenbereiche am Gerät", "Einsatz von Einweisern", "Wahrung der Standsicherheit", "Bedieneinrichtungen am Gerät", "Anbaugeräte", "Verhalten bei Störungen", "Einsatz der PSA", "Verhalten bei Stromübertritt"], 11.2, 40.1, 2.75).concat(
      [
        "Betriebsanleitung Hersteller übergeben",
        "Befördern von Personen verboten",
        "KMS Kamera-Monitor-System",
        "Fahrbetrieb angepasst",
        "Lasttabellen / Hebebetrieb",
        "Höhenbegrenzung",
        "Not-Aus-Schalter",
        "Montage / Wartung / Instandsetzung",
      ].map((label, index) => ({
        label,
        left: 55.4,
        top: [40.2, 43, 45.8, 48.5, 51.3, 54.1, 56.9, 62.4][index],
      })),
    ),
    positioned(["Technik: Bestimmungsgemäße Verwendung", "Technik: Fahrbetrieb", "Technik: Standsicherheit", "Technik: Bedieneinrichtungen", "Technik: Anbaugeräte / Schnellwechseleinrichtungen", "Technik: Verhalten bei Störungen"], 11.2, 42.2, 2.85).concat(
      positioned(["Technik: Betriebsanleitung übergeben", "Technik: Lasttabellen / Hebebetrieb", "Technik: KMS Kamera-Monitor-System", "Technik: Anzeigen / Warnhinweise", "Technik: Höhenbegrenzung", "Technik: Not-Aus-Schalter", "Technik: Montage / Wartung / Instandsetzung"], 56, 42.2, 2.85),
    ),
    positioned(["Fahrtraining: Ein- und Ausstieg sicher", "Fahrtraining: Bedienelemente erreichbar", "Fahrtraining: Rückhalteeinrichtungen benutzt", "Fahrtraining: Sichtprüfung", "Fahrtraining: Fahrbewegungen in Ordnung"], 11.2, 43.7, 2.8).concat(
      positioned(["Fahrtraining: Standsicherheit beachtet", "Fahrtraining: Anbaugerät geprüft", "Fahrtraining: umsichtig gearbeitet", "Fahrtraining: sicher gearbeitet", "Fahrtraining: Maschine gesichert abgestellt"], 56, 43.7, 2.8),
    ),
  ];
}

function drawOverlayText(
  page: ReturnType<PDFDocument["getPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  text: string,
  left: number,
  top: number,
  width: number,
) {
  const { height, width: pageWidth } = page.getSize();
  const x = (left / 100) * pageWidth;
  const fieldWidth = (width / 100) * pageWidth;
  const y = height - (top / 100) * height - 12;
  page.drawRectangle({
    color: rgb(1, 1, 1),
    height: 17,
    width: fieldWidth,
    x,
    y: y - 2,
  });
  page.drawText(safe(text).slice(0, 90), {
    color: rgb(0.04, 0.04, 0.04),
    font,
    maxWidth: fieldWidth - 4,
    size: 9,
    x: x + 2,
    y,
  });
}

async function drawSignature(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["getPage"]>,
  dataUrl: string,
  left: number,
  top: number,
  width: number,
) {
  try {
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    const image = dataUrl.startsWith("data:image/jpeg")
      ? await pdf.embedJpg(bytes)
      : await pdf.embedPng(bytes);
    const pageSize = page.getSize();
    const maxWidth = (width / 100) * pageSize.width;
    const scaled = image.scaleToFit(maxWidth, 42);
    page.drawImage(image, {
      height: scaled.height,
      width: scaled.width,
      x: (left / 100) * pageSize.width,
      y: pageSize.height - (top / 100) * pageSize.height - scaled.height,
    });
  } catch {
    // Der Export bleibt auch bei einer beschädigten Signatur verfügbar.
  }
}

function noteValues(notes: string | null) {
  const values = new Map<string, string>();
  for (const line of notes?.split("\n") ?? []) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      values.set(line.slice(0, separator), line.slice(separator + 1).trim());
    }
  }
  return values;
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safe(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[„“]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "");
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
