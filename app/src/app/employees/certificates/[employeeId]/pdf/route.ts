import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { prisma } from "@/lib/prisma";

const A4: [number, number] = [595.28, 841.89];
const margin = 38;
const width = A4[0] - margin * 2;
const black = rgb(0.08, 0.1, 0.13);
const gray = rgb(0.38, 0.42, 0.47);
const light = rgb(0.95, 0.96, 0.97);
const amber = rgb(1, 0.97, 0.88);

function date(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("de-DE").format(value)
    : "-";
}

function number(value: number, unit: string) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

function safe(value: string | null | undefined) {
  return (value ?? "-")
    .replace(/[–—]/g, "-")
    .replace(/[„“]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    const words = safe(paragraph).split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : ["-"];
}

function drawHeader(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont },
  employeeName: string,
) {
  page.drawText("JOSEF STIX GMBH & CO. KG", {
    color: black,
    font: fonts.bold,
    size: 10,
    x: margin,
    y: A4[1] - 35,
  });
  page.drawText("Mitarbeiterakte", {
    color: black,
    font: fonts.bold,
    size: 17,
    x: margin,
    y: A4[1] - 61,
  });
  page.drawText(safe(employeeName), {
    color: gray,
    font: fonts.regular,
    size: 9,
    x: margin,
    y: A4[1] - 77,
  });
  page.drawLine({
    color: rgb(0.8, 0.82, 0.84),
    start: { x: margin, y: A4[1] - 88 },
    end: { x: A4[0] - margin, y: A4[1] - 88 },
    thickness: 0.7,
  });
}

async function signatureImage(
  pdf: PDFDocument,
  value: string | null,
): Promise<PDFImage | null> {
  if (!value?.startsWith("data:image/")) return null;
  const match = value.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[2], "base64");
    return match[1] === "image/png"
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({
    include: {
      generalRiskAssessmentParticipants: {
        include: { assessment: true },
        orderBy: { instructionDate: "desc" },
      },
      inventoryAssignments: {
        include: {
          category: { include: { parentCategory: true } },
          currentProject: true,
          vehicle: true,
        },
        orderBy: { name: "asc" },
      },
      inventoryUsageHistory: {
        include: {
          item: {
            include: {
              category: { include: { parentCategory: true } },
            },
          },
          project: true,
        },
        orderBy: { createdAt: "desc" },
        take: 80,
        where: {
          item: {
            isStockManaged: true,
            category: {
              OR: [
                { useInEmployeeFile: true },
                { isPersonalInventory: true },
                { parentCategory: { useInEmployeeFile: true } },
                { parentCategory: { isPersonalInventory: true } },
              ],
            },
          },
        },
      },
      personalInventoryAssignments: {
        include: {
          item: {
            include: {
              category: { include: { parentCategory: true } },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
      },
      positions: { orderBy: { sortOrder: "asc" } },
      qualifications: {
        include: { qualificationType: true },
        orderBy: { lastReviewedAt: "desc" },
      },
      safetyInstructionSignatures: {
        include: { record: { include: { template: true } } },
        orderBy: { signedAt: "desc" },
      },
      trainingRecords: { orderBy: { trainingDate: "desc" } },
    },
    where: { id: employeeId },
  });
  if (!employee) return new Response("Mitarbeiter nicht gefunden.", { status: 404 });

  const pdf = await PDFDocument.create();
  const fonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    regular: await pdf.embedFont(StandardFonts.Helvetica),
  };
  const employeeName = `${employee.firstName} ${employee.lastName}`;
  let page!: PDFPage;
  let y = 0;

  function newPage() {
    page = pdf.addPage(A4);
    drawHeader(page, fonts, employeeName);
    y = A4[1] - 112;
  }

  function ensure(height: number) {
    if (y - height < 42) newPage();
  }

  function heading(title: string) {
    ensure(36);
    page.drawRectangle({
      color: light,
      height: 25,
      width,
      x: margin,
      y: y - 20,
    });
    page.drawText(safe(title), {
      color: black,
      font: fonts.bold,
      size: 11,
      x: margin + 8,
      y: y - 14,
    });
    y -= 34;
  }

  function row(label: string, value: string) {
    const lines = wrap(value, fonts.regular, 8.5, width - 153);
    const height = Math.max(18, lines.length * 11 + 4);
    ensure(height);
    page.drawText(safe(label), {
      color: gray,
      font: fonts.bold,
      size: 8,
      x: margin,
      y,
    });
    lines.forEach((line, index) => {
      page.drawText(line, {
        color: black,
        font: fonts.regular,
        size: 8.5,
        x: margin + 145,
        y: y - index * 11,
      });
    });
    y -= height;
  }

  function listRow(
    columns: Array<{ text: string; width: number }>,
    header = false,
  ) {
    const lineSets = columns.map((column) =>
      wrap(column.text, fonts.regular, 7.5, column.width - 8),
    );
    const height = Math.max(...lineSets.map((lines) => lines.length)) * 10 + 8;
    ensure(height);
    if (header) {
      page.drawRectangle({
        color: light,
        height,
        width,
        x: margin,
        y: y - height + 4,
      });
    }
    let x = margin;
    columns.forEach((column, index) => {
      lineSets[index].forEach((line, lineIndex) => {
        page.drawText(line, {
          color: black,
          font: header ? fonts.bold : fonts.regular,
          size: 7.5,
          x: x + 4,
          y: y - 7 - lineIndex * 10,
        });
      });
      x += column.width;
    });
    page.drawLine({
      color: rgb(0.75, 0.77, 0.8),
      start: { x: margin, y: y - height + 4 },
      end: { x: margin + width, y: y - height + 4 },
      thickness: 0.5,
    });
    y -= height - 4;
  }

  newPage();
  heading("Person");
  row("Name", employeeName);
  row("Firma / Abteilung", [employee.companyLabel, employee.departmentLabel].filter(Boolean).join(" / ") || "-");
  row("Status", employee.statusLabel);
  row("Eintritt", date(employee.entryDate));
  row("Austritt", date(employee.exitDate));
  row("Geburtsdatum", date(employee.birthDate));
  row("Geschlecht", employee.genderLabel ?? "-");
  row("Mobiltelefon", employee.mobilePhone ?? "-");
  row("Telefon (Haus)", employee.homePhone ?? "-");
  row("E-Mail", employee.email ?? "-");
  row(
    "Notfallkontakt",
    [
      [employee.emergencyFirstName, employee.emergencyLastName]
        .filter(Boolean)
        .join(" "),
      employee.emergencyPhone,
    ]
      .filter(Boolean)
      .join(" · ") || "-",
  );
  row(
    "Adresse",
    [
      employee.street,
      [employee.postalCode, employee.city].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", ") || "-",
  );
  row("Führungskraft", employee.isLeadership ? "Ja" : "Nein");
  row("Berufsgruppen", employee.positions.map((position) => position.positionLabel).join(", ") || "-");
  row("Notizen", employee.notes ?? "-");

  heading("Qualifikationen und Schulungen");
  listRow(
    [
      { text: "Nachweis / Schulung", width: 230 },
      { text: "Datum / Prüfung", width: 90 },
      { text: "Gültig bis", width: 90 },
      { text: "Art / Bemerkung", width: width - 410 },
    ],
    true,
  );
  if (!employee.qualifications.length && !employee.trainingRecords.length) {
    row("Nachweise", "Keine Einträge");
  }
  for (const qualification of employee.qualifications) {
    const validUntil = qualification.lastReviewedAt
      ? new Date(
          new Date(qualification.lastReviewedAt).setMonth(
            qualification.lastReviewedAt.getMonth() +
              qualification.qualificationType.reviewIntervalMonths,
          ),
        )
      : null;
    listRow([
      { text: qualification.qualificationType.name, width: 230 },
      { text: date(qualification.lastReviewedAt), width: 90 },
      { text: date(validUntil), width: 90 },
      { text: qualification.notes ?? "Qualifikation", width: width - 410 },
    ]);
  }
  for (const training of employee.trainingRecords) {
    listRow([
      { text: training.topic, width: 230 },
      { text: date(training.trainingDate), width: 90 },
      { text: date(training.validUntil), width: 90 },
      { text: training.type ?? "Schulung", width: width - 410 },
    ]);
  }

  heading("Arbeitssicherheitsnachweise");
  listRow(
    [
      { text: "Nachweis", width: 340 },
      { text: "Datum", width: 90 },
      { text: "Status", width: width - 430 },
    ],
    true,
  );
  const safetyRows = [
    ...employee.safetyInstructionSignatures.map((signature) => ({
      date: signature.signedAt,
      status: signature.signatureDataUrl ? "unterschrieben" : "offen",
      title: signature.record.template.title,
    })),
    ...employee.generalRiskAssessmentParticipants.map((participant) => ({
      date: participant.instructionDate,
      status: participant.signatureDataUrl ? "unterschrieben" : "offen",
      title: participant.assessment.templateTitle,
    })),
  ].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  if (!safetyRows.length) row("Nachweise", "Keine Einträge");
  for (const record of safetyRows) {
    listRow([
      { text: record.title, width: 340 },
      { text: date(record.date), width: 90 },
      { text: record.status, width: width - 430 },
    ]);
  }

  y -= 14;
  heading("Inventar / Fahrzeuge");
  listRow(
    [
      { text: "Objekt", width: 190 },
      { text: "Kategorie", width: 125 },
      { text: "Kennnummer", width: 95 },
      { text: "Baustelle / Status", width: width - 410 },
    ],
    true,
  );
  if (!employee.inventoryAssignments.length) {
    row("Inventar", "Keine aktuell zugeordneten Inventarobjekte");
  }
  for (const item of employee.inventoryAssignments) {
    const category = item.category?.parentCategory
      ? `${item.category.parentCategory.name} / ${item.category.name}`
      : item.category?.name ?? item.vehicle?.category ?? "-";
    const identifiers = [
      item.objectNumber,
      item.inventoryNumber,
      item.serialNumber,
      item.licensePlate ?? item.vehicle?.licensePlate,
    ]
      .filter(Boolean)
      .join(" / ");
    const projectStatus = [
      item.currentProject
        ? `${item.currentProject.projectNumber} ${item.currentProject.name}`
        : null,
      item.status,
    ]
      .filter(Boolean)
      .join(" / ");
    listRow([
      { text: item.name, width: 190 },
      { text: category, width: 125 },
      { text: identifiers || "-", width: 95 },
      { text: projectStatus || "-", width: width - 410 },
    ]);
  }

  y -= 14;
  heading("Ausgegebene Lagerobjekte");
  listRow(
    [
      { text: "Lagerobjekt", width: 150 },
      { text: "Bewegung", width: 80 },
      { text: "Menge / Bestand", width: 115 },
      { text: "Projekt / Datum", width: 90 },
      { text: "Bemerkung", width: width - 435 },
    ],
    true,
  );
  if (!employee.inventoryUsageHistory.length) {
    row("Lagerobjekte", "Keine freigegebenen Lagerbewegungen");
  }
  for (const movement of employee.inventoryUsageHistory) {
    const movementLabel =
      movement.eventType === "ISSUE"
        ? "Ausgabe"
        : movement.eventType === "RETURN"
          ? "Rücknahme"
          : movement.eventType === "PERSONAL_ISSUE"
            ? "Pers. Ausgabe"
            : movement.eventType === "PERSONAL_RETURN"
              ? "Pers. Rücknahme"
              : movement.eventType === "ADJUSTMENT"
                ? "Korrektur"
                : movement.eventType;
    const stock = [
      movement.quantity !== null
        ? number(movement.quantity, movement.item.stockUnit)
        : null,
      movement.stockBefore !== null && movement.stockAfter !== null
        ? `${movement.stockBefore} -> ${movement.stockAfter} ${movement.item.stockUnit}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    const projectDate = [
      movement.project
        ? `${movement.project.projectNumber} ${movement.project.name}`
        : null,
      date(movement.createdAt),
    ]
      .filter(Boolean)
      .join("\n");
    listRow([
      { text: movement.item.name, width: 150 },
      { text: movementLabel, width: 80 },
      { text: stock || "-", width: 115 },
      { text: projectDate, width: 90 },
      { text: movement.notes ?? "-", width: width - 435 },
    ]);
  }

  y -= 14;
  heading("Persönliches Inventar - Ausgabe und Rückgabe");
  if (!employee.personalInventoryAssignments.length) {
    row("Inventar", "Keine Einträge");
  }
  for (const assignment of employee.personalInventoryAssignments) {
    ensure(145);
    const category = assignment.item.category?.parentCategory
      ? `${assignment.item.category.parentCategory.name} / ${assignment.item.category.name}`
      : assignment.item.category?.name ?? "-";
    page.drawRectangle({
      color:
        assignment.status === "ISSUED" ? amber : rgb(0.9, 0.97, 0.92),
      height: 22,
      width,
      x: margin,
      y: y - 17,
    });
    page.drawText(
      safe(
        `${assignment.item.name} - ${category} - ${
          assignment.status === "ISSUED" ? "Rückgabe offen" : "zurückgegeben"
        }`,
      ),
      { color: black, font: fonts.bold, size: 8.5, x: margin + 6, y: y - 11 },
    );
    y -= 28;
    listRow([
      { text: `Ausgabe\n${date(assignment.issuedAt)}`, width: 68 },
      { text: `Menge\n${number(assignment.quantity, assignment.item.stockUnit)}`, width: 76 },
      { text: `Zustand\n${assignment.issuedCondition ?? "-"}`, width: 95 },
      { text: `Ausgegeben durch\n${assignment.issuedByName ?? "-"}`, width: 125 },
      { text: `Bemerkung\n${assignment.issueNotes ?? "-"}`, width: width - 364 },
    ]);
    listRow([
      { text: `Rückgabe\n${date(assignment.returnedAt)}`, width: 68 },
      { text: `Menge\n${number(assignment.returnedQuantity, assignment.item.stockUnit)}`, width: 76 },
      { text: `Zustand\n${assignment.returnedCondition ?? "-"}`, width: 95 },
      { text: `Zurückgenommen durch\n${assignment.returnedByName ?? "-"}`, width: 125 },
      { text: `Bemerkung\n${assignment.returnNotes ?? "-"}`, width: width - 364 },
    ]);

    ensure(63);
    y -= 6;
    const issueSignature = await signatureImage(pdf, assignment.issueSignatureDataUrl);
    const returnSignature = await signatureImage(pdf, assignment.returnSignatureDataUrl);
    page.drawText("Unterschrift Ausgabe", { color: gray, font: fonts.bold, size: 7, x: margin, y });
    page.drawText("Unterschrift Rückgabe", { color: gray, font: fonts.bold, size: 7, x: margin + width / 2, y });
    if (issueSignature) {
      page.drawImage(issueSignature, {
        height: 37,
        width: 150,
        x: margin,
        y: y - 42,
      });
    }
    if (returnSignature) {
      page.drawImage(returnSignature, {
        height: 37,
        width: 150,
        x: margin + width / 2,
        y: y - 42,
      });
    }
    y -= 57;
  }

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    const label = `Seite ${index + 1} / ${pages.length}`;
    currentPage.drawText(label, {
      color: gray,
      font: fonts.regular,
      size: 8,
      x: A4[0] - margin - fonts.regular.widthOfTextAtSize(label, 8),
      y: A4[1] - 35,
    });
  });

  const bytes = await pdf.save();
  const fileName = `mitarbeiterakte-${safe(employee.lastName).replace(/\s+/g, "-").toLowerCase()}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
