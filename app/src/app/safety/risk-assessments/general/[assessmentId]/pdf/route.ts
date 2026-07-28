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

import {
  getGeneralRiskAssessmentTemplate,
  parseGeneralRiskAssessmentAnswers,
} from "@/lib/general-risk-assessments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;
const WIDTH = A4[0] - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.82, 0.83, 0.84);
const LIGHT = rgb(0.95, 0.95, 0.95);
type Fonts = { bold: PDFFont; regular: PDFFont };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const { assessmentId } = await params;
  const record = await prisma.generalRiskAssessment.findUnique({
    include: {
      assessedEmployee: true,
      participants: {
        include: { employee: true },
        orderBy: [{ instructionDate: "asc" }, { createdAt: "asc" }],
      },
      project: true,
    },
    where: { id: assessmentId },
  });
  if (!record) {
    return new Response("Gefährdungsbeurteilung nicht gefunden.", {
      status: 404,
    });
  }
  const template = getGeneralRiskAssessmentTemplate(record.templateKey);
  if (!template) {
    return new Response("GBU-Vorlage nicht gefunden.", { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
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
  const detailedPictograms = new Map<string, PDFImage>();
  for (const pictogramPath of new Set(
    template.items.flatMap((item) => item.pictograms ?? []),
  )) {
    detailedPictograms.set(
      pictogramPath,
      await pdf.embedPng(
        await readFile(path.join(process.cwd(), "public", pictogramPath)),
      ),
    );
  }
  const answers = parseGeneralRiskAssessmentAnswers(record.answersJson);
  const summaryPages: PDFPage[] = [];
  const addSummaryPage = () => {
    const page = pdf.addPage(A4);
    summaryPages.push(page);
    drawHeader(page, fonts, logo, record);
    return page;
  };

  let page = addSummaryPage();
  let y = 705;
  if (template.contents?.length) {
    y = section(page, fonts, y, "Inhaltsverzeichnis");
    for (const entry of template.contents) {
      if (y < 75) {
        page = addSummaryPage();
        y = 705;
      }
      page.drawText(safe(entry), {
        color: BLACK,
        font: fonts.regular,
        size: 8,
        x: MARGIN + 7,
        y: y - 13,
      });
      y -= 18;
    }
    y -= 10;
  }
  if (template.introSections?.length) {
    for (const intro of template.introSections) {
      if (y < 125) {
        page = addSummaryPage();
        y = 705;
      }
      y = section(page, fonts, y, intro.title);
      for (const paragraph of intro.paragraphs) {
        const lines = wrap(paragraph, fonts.regular, 8, WIDTH - 14);
        const blockHeight = lines.length * 10 + 10;
        if (y - blockHeight < 65) {
          page = addSummaryPage();
          y = 705;
          y = subsection(page, fonts, y, `${intro.title} - Fortsetzung`);
        }
        lines.forEach((line, index) =>
          page.drawText(safe(line), {
            color: BLACK,
            font: paragraph.startsWith("§10")
              ? fonts.bold
              : fonts.regular,
            size: 8,
            x: MARGIN + 7,
            y: y - 12 - index * 10,
          }),
        );
        y -= blockHeight;
      }
      y -= 8;
    }
  }
  if (y < 190) {
    page = addSummaryPage();
    y = 705;
  }
  y = section(page, fonts, y, "Zuordnung und Verantwortlichkeit");
  y = infoRow(page, fonts, y, "Projekt", record.project
    ? `${record.project.projectNumber} - ${record.project.name}`
    : "Ohne Projektbezug");
  y = infoRow(
    page,
    fonts,
    y,
    "Datum / Ort",
    `${date(record.assessmentDate)} / ${record.location || "-"}`,
  );
  y = infoRow(
    page,
    fonts,
    y,
    "Verantwortliche Bauleitung",
    record.responsibleName || "-",
  );
  y = await signatureRow(
    pdf,
    page,
    fonts,
    y,
    "Unterschrift verantwortliche Bauleitung",
    record.responsibleSignatureDataUrl,
  );
  y -= 10;
  if (template.key === "muschg" || template.key === "buero") {
    page = addSummaryPage();
    y = 705;
  }
  y = section(
    page,
    fonts,
    y,
    template.key === "muschg"
      ? "6  Checkliste - Mutterschutzgesetz §10"
      : template.key === "buero"
        ? "6/7  Allgemeine Büro-, Büro- und Bildschirmarbeiten"
      : "Digital bewertete Gefährdungen und Schutzmaßnahmen",
  );

  let lastActivity = "";
  let lastChapterTitle = "";
  let lastSectionTitle = "";
  for (const item of template.items) {
    const answer = answers[item.id];
    if (y < 105) {
      page = addSummaryPage();
      y = 705;
      lastActivity = "";
    }
    if (
      item.chapterTitle &&
      item.chapterTitle !== lastChapterTitle
    ) {
      if (y < 200) {
        page = addSummaryPage();
        y = 705;
      }
      y = section(page, fonts, y, item.chapterTitle);
      lastChapterTitle = item.chapterTitle;
      lastActivity = "";
    }
    if (
      item.sectionTitle &&
      item.sectionTitle !== lastSectionTitle
    ) {
      if (y < 180) {
        page = addSummaryPage();
        y = 705;
      }
      y = subsection(page, fonts, y, item.sectionTitle);
      lastSectionTitle = item.sectionTitle;
      lastActivity = "";
    }
    if (item.activity !== lastActivity) {
      if (
        (template.key === "strassenwalze" ||
          template.key === "tiefbau" ||
          template.key === "asphaltbau") &&
        y < 160
      ) {
        page = addSummaryPage();
        y = 705;
      }
      y = subsection(page, fonts, y, item.activity);
      if (template.key === "muschg" || template.key === "buero") {
        const activityItems = template.items.filter(
          (activityItem) => activityItem.activity === item.activity,
        );
        y = statusHeader(
          page,
          fonts,
          y,
          activityItems.some(
            (activityItem) =>
              (activityItem.kind ?? "choice") === "choice" &&
              activityItem.options !== "YES_NO",
          ),
          template.key === "buero",
        );
      } else if (
        template.key === "strassenwalze" ||
        template.key === "tiefbau" ||
        template.key === "asphaltbau"
      ) {
        y = roadRollerHeader(page, fonts, y);
      }
      lastActivity = item.activity;
    }
    if (item.kind === "heading") {
      y = subsection(page, fonts, y, item.hazard);
      continue;
    }
    if (item.kind === "note") {
      const noteLines = wrap(item.hazard, fonts.regular, 7, WIDTH - 10).slice(
        0,
        5,
      );
      const noteHeight = Math.max(20, noteLines.length * 8 + 7);
      page.drawRectangle({
        borderColor: BLACK,
        borderWidth: 0.5,
        color: LIGHT,
        height: noteHeight,
        width: WIDTH,
        x: MARGIN,
        y: y - noteHeight,
      });
      noteLines.forEach((line, index) =>
        page.drawText(safe(line), {
          color: BLACK,
          font: fonts.regular,
          size: 7,
          x: MARGIN + 5,
          y: y - 10 - index * 8,
        }),
      );
      y -= noteHeight;
      continue;
    }
    if (item.kind === "text") {
      const textLines = wrap(
        `${item.hazard}: ${answer?.text || "-"}`,
        fonts.regular,
        7,
        WIDTH - 10,
      ).slice(0, 5);
      const textHeight = Math.max(23, textLines.length * 8 + 8);
      page.drawRectangle({
        borderColor: BLACK,
        borderWidth: 0.5,
        height: textHeight,
        width: WIDTH,
        x: MARGIN,
        y: y - textHeight,
      });
      textLines.forEach((line, index) =>
        page.drawText(safe(line), {
          color: BLACK,
          font: fonts.regular,
          size: 7,
          x: MARGIN + 5,
          y: y - 11 - index * 8,
        }),
      );
      y -= textHeight;
      continue;
    }
    const status =
      answer?.status === "YES"
        ? "ja"
        : answer?.status === "NO"
          ? "nein"
          : answer?.status === "NOT_APPLICABLE"
            ? "entfällt"
            : "offen";
    if (
      template.key === "strassenwalze" ||
      template.key === "tiefbau" ||
      template.key === "asphaltbau"
    ) {
      const activityLines = wrap(item.activity, fonts.regular, 5.6, 54);
      const hazardLines = wrap(
        item.hazard || "Allgemeine Gefährdung",
        fonts.regular,
        5.6,
        95,
      );
      const measureLines = wrap(item.measure || "-", fonts.regular, 5.6, 195);
      const referenceLines = wrap(item.reference || "-", fonts.regular, 5.2, 42);
      const pictograms = (item.pictograms ?? [])
        .map((pictogramPath) => detailedPictograms.get(pictogramPath))
        .filter((pictogram): pictogram is PDFImage => Boolean(pictogram));
      const hasPictograms = pictograms.length > 0;
      const pictogramsInMeasure =
        template.key === "tiefbau" ||
        item.id === "asphaltbau-26-1-3";
      const civilEngineeringPictogramHeight =
        pictogramsInMeasure && hasPictograms ? 78 : 0;
      const rollerHeight = Math.max(
        hasPictograms ? 68 : 25,
        activityLines.length * 6.4 + 8,
        hazardLines.length * 6.4 +
          8 +
          (!pictogramsInMeasure && hasPictograms ? 38 : 0),
        measureLines.length * 6.4 + 8 + civilEngineeringPictogramHeight,
        referenceLines.length * 6 + 8,
      );
      if (y - rollerHeight < 55) {
        page = addSummaryPage();
        y = subsection(page, fonts, 705, `${item.activity} - Fortsetzung`);
        y = roadRollerHeader(page, fonts, y);
      }
      drawRoadRollerRow(
        page,
        fonts,
        y,
        rollerHeight,
        activityLines,
        hazardLines,
        measureLines,
        referenceLines,
        status,
        Boolean(answer?.implemented),
        answer?.responsible || "",
        pictograms,
        pictogramsInMeasure,
      );
      y -= rollerHeight;
      continue;
    }
    if (template.key === "buero") {
      const officeHazardLines = wrap(
        item.hazard || "Allgemeine Gefährdung",
        fonts.regular,
        6.3,
        140,
      );
      const officeMeasureLines = wrap(
        item.measure || "-",
        fonts.regular,
        6.3,
        220,
      );
      const officeHeight = Math.max(
        25,
        Math.max(officeHazardLines.length, officeMeasureLines.length) * 7.2 + 9,
      );
      if (y - officeHeight < 55) {
        page = addSummaryPage();
        y = subsection(page, fonts, 705, `${item.activity} - Fortsetzung`);
        y = statusHeader(page, fonts, y, false, true);
      }
      page.drawRectangle({
        borderColor: BLACK,
        borderWidth: 0.5,
        height: officeHeight,
        width: WIDTH,
        x: MARGIN,
        y: y - officeHeight,
      });
      [192, 422, 482].forEach((x) =>
        page.drawLine({
          color: BLACK,
          end: { x, y },
          start: { x, y: y - officeHeight },
          thickness: 0.5,
        }),
      );
      officeHazardLines.forEach((line, index) =>
        page.drawText(safe(line), {
          color: BLACK,
          font: fonts.regular,
          size: 6.3,
          x: MARGIN + 5,
          y: y - 10 - index * 7.2,
        }),
      );
      officeMeasureLines.forEach((line, index) =>
        page.drawText(safe(line), {
          color: BLACK,
          font: fonts.regular,
          size: 6.3,
          x: 197,
          y: y - 10 - index * 7.2,
        }),
      );
      drawOfficeAssessmentStatus(
        page,
        fonts,
        y,
        officeHeight,
        status,
        Boolean(answer?.implemented),
        answer?.responsible || "",
      );
      y -= officeHeight;
      continue;
    }
    const hazardLines = wrap(
      item.hazard || "Allgemeine Gefährdung",
      fonts.regular,
      7,
      410,
    ).slice(0, 4);
    const height = Math.max(23, hazardLines.length * 8 + 8);
    page.drawRectangle({
      borderColor: BLACK,
      borderWidth: 0.5,
      height,
      width: WIDTH,
      x: MARGIN,
      y: y - height,
    });
    page.drawLine({
      color: BLACK,
      end: { x: 465, y: y },
      start: { x: 465, y: y - height },
      thickness: 0.5,
    });
    hazardLines.forEach((line, index) =>
      page.drawText(safe(line), {
        color: BLACK,
        font: fonts.regular,
        size: 7,
        x: MARGIN + 5,
        y: y - 11 - index * 8,
      }),
    );
    drawStatusOptions(
      page,
      fonts,
      y,
      height,
      status,
      item.options,
      template.key !== "muschg",
    );
    y -= height;
  }

  page = addSummaryPage();
  y = 705;
  y = section(
    page,
    fonts,
    y,
    template.key === "muschg"
      ? "9  Unterweisungsnachweis"
      : template.key === "tiefbau"
        ? "13  Unterweisungsnachweis"
        : template.key === "asphaltbau"
          ? "11  Unterweisungsnachweis"
      : "Unterweisung und Unterschriften",
  );
  y = infoRow(
    page,
    fonts,
    y,
    "Vortragende Person",
    record.presenterName || "-",
  );
  y = await signatureRow(
    pdf,
    page,
    fonts,
    y,
    "Unterschrift vortragend",
    record.presenterSignatureDataUrl,
  );
  y = infoRow(
    page,
    fonts,
    y,
    "Unterweisungsthemen",
    record.instructionTopics || "-",
  );
  y = infoRow(page, fonts, y, "Bemerkungen", record.notes || "-");
  y -= 10;
  y = subsection(page, fonts, y, "Teilnehmende Mitarbeiter");
  for (const participant of record.participants) {
    if (y < 95) {
      page = addSummaryPage();
      y = subsection(page, fonts, 705, "Teilnehmende Mitarbeiter - Fortsetzung");
    }
    const height = 48;
    page.drawRectangle({
      borderColor: BLACK,
      borderWidth: 0.5,
      height,
      width: WIDTH,
      x: MARGIN,
      y: y - height,
    });
    page.drawText(
      safe(
        participant.employee
          ? `${participant.employee.lastName}, ${participant.employee.firstName}`
          : `${participant.externalLastName ?? ""}, ${participant.externalFirstName ?? ""}`,
      ),
      { x: MARGIN + 5, y: y - 19, size: 8, font: fonts.bold, color: BLACK },
    );
    page.drawText(
      safe(
        `${participant.employee ? participant.companyDepartment || "-" : participant.externalCompany || "-"} / Unterwiesen am ${date(
          participant.instructionDate,
        )}`,
      ),
      { x: MARGIN + 5, y: y - 34, size: 7, font: fonts.regular, color: BLACK },
    );
    const signature = await embedSignature(pdf, participant.signatureDataUrl);
    if (signature) {
      page.drawImage(signature, {
        height: 30,
        width: 110,
        x: 430,
        y: y - 41,
      });
    }
    y -= height;
  }

  if (template.key === "tiefbau" || template.key === "asphaltbau") {
    page = addSummaryPage();
    y = 705;
    y = section(
      page,
      fonts,
      y,
      template.key === "tiefbau"
        ? "14  Änderungshistorie"
        : "12  Änderungshistorie",
    );
    if (template.key === "tiefbau") {
      y = historyRow(
        page,
        fonts,
        y,
        "03.07.2024",
        "Rev00 - 20240703 - Erstellung der Gefährdungsbeurteilung - SiFa R. Eglitis",
      );
      y = historyRow(
        page,
        fonts,
        y,
        "26.08.2025",
        "Rev01 - 20250826 - Anpassung der GBU - Erweiterung mit Kap. Stromleitungen / Freileitungen",
      );
    } else {
      y = historyRow(
        page,
        fonts,
        y,
        "18.08.2025",
        "Rev00 - 20250818 - Erstellung der Gefährdungsbeurteilung - SiFa R. Eglitis",
      );
    }
    y -= 18;
    const closingText =
      "Die zuständige Bauleitung prüft vor Beginn der Arbeiten die Gefährdungsbeurteilung auf Vollständigkeit und führt die Wirksamkeitskontrolle durch.";
    wrap(closingText, fonts.regular, 8, WIDTH - 14).forEach((line, index) =>
      page.drawText(safe(line), {
        color: BLACK,
        font: fonts.regular,
        size: 8,
        x: MARGIN + 7,
        y: y - index * 11,
      }),
    );
  }

  summaryPages.forEach((summaryPage, index) =>
    drawFooter(summaryPage, fonts, index + 1, summaryPages.length),
  );

  pdf.setTitle(
    `${record.templateCode} - ${record.templateTitle} - ${date(
      record.assessmentDate,
    )}`,
  );
  pdf.setSubject("Gefährdungsbeurteilung mit digitalem Ausfüllnachweis");
  pdf.setCreator("Dashboard Stix");

  return new Response(Buffer.from(await pdf.save()), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${record.templateCode}_${record.templateTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß]+/g, "_")}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

function drawHeader(
  page: PDFPage,
  fonts: Fonts,
  logo: PDFImage,
  record: {
    templateCode: string;
    templateRevision: string;
    templateTitle: string;
  },
) {
  page.drawText(safe(`Gefährdungsbeurteilung - ${record.templateTitle}`), {
    color: rgb(0.55, 0.55, 0.55),
    font: fonts.regular,
    size: 15,
    x: MARGIN,
    y: 797,
  });
  page.drawRectangle({ color: LIGHT, height: 14, width: 355, x: MARGIN, y: 770 });
  page.drawText(
    safe(
      `Interne Nummer: ${record.templateCode}     Revision: ${record.templateRevision}`,
    ),
    {
      color: rgb(0.45, 0.45, 0.45),
      font: fonts.regular,
      size: 7,
      x: MARGIN + 4,
      y: 775,
    },
  );
  page.drawImage(logo, { height: 39, width: 112, x: 441, y: 772 });
  page.drawText("Digitaler Ausfüllnachweis", {
    color: rgb(0.45, 0.45, 0.45),
    font: fonts.bold,
    size: 8,
    x: MARGIN,
    y: 744,
  });
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  pageNumber: number,
  pageCount: number,
) {
  page.drawText("Josef Stix GmbH & Co.KG", {
    color: rgb(0.55, 0.55, 0.55),
    font: fonts.regular,
    size: 7,
    x: MARGIN,
    y: 28,
  });
  page.drawText(
    `Ausfüllnachweis Seite ${pageNumber} von ${pageCount}`,
    {
      color: rgb(0.55, 0.55, 0.55),
      font: fonts.regular,
      size: 7,
      x: 420,
      y: 28,
    },
  );
}

function section(page: PDFPage, fonts: Fonts, y: number, title: string) {
  page.drawRectangle({ color: GRAY, height: 18, width: WIDTH, x: MARGIN, y: y - 18 });
  page.drawText(safe(title), {
    color: BLACK,
    font: fonts.bold,
    size: 10,
    x: MARGIN + 6,
    y: y - 13,
  });
  return y - 18;
}

function subsection(page: PDFPage, fonts: Fonts, y: number, title: string) {
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    color: LIGHT,
    height: 17,
    width: WIDTH,
    x: MARGIN,
    y: y - 17,
  });
  page.drawText(fit(safe(title), fonts.bold, 8, WIDTH - 12), {
    color: BLACK,
    font: fonts.bold,
    size: 8,
    x: MARGIN + 5,
    y: y - 12,
  });
  return y - 17;
}

function infoRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  value: string,
) {
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    height: 22,
    width: WIDTH,
    x: MARGIN,
    y: y - 22,
  });
  page.drawLine({
    color: BLACK,
    end: { x: 180, y },
    start: { x: 180, y: y - 22 },
    thickness: 0.5,
  });
  page.drawText(safe(label), {
    color: BLACK,
    font: fonts.bold,
    size: 8,
    x: MARGIN + 5,
    y: y - 14,
  });
  page.drawText(fit(safe(value), fonts.regular, 8, 360), {
    color: BLACK,
    font: fonts.regular,
    size: 8,
    x: 186,
    y: y - 14,
  });
  return y - 22;
}

function historyRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  historyDate: string,
  title: string,
) {
  const height = 34;
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    height,
    width: WIDTH,
    x: MARGIN,
    y: y - height,
  });
  page.drawLine({
    color: BLACK,
    end: { x: 125, y },
    start: { x: 125, y: y - height },
    thickness: 0.5,
  });
  page.drawText(historyDate, {
    color: BLACK,
    font: fonts.regular,
    size: 8,
    x: MARGIN + 5,
    y: y - 20,
  });
  wrap(title, fonts.regular, 8, WIDTH - 95).forEach((line, index) =>
    page.drawText(safe(line), {
      color: BLACK,
      font: fonts.regular,
      size: 8,
      x: 131,
      y: y - 13 - index * 10,
    }),
  );
  return y - height;
}

function drawStatusOptions(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  height: number,
  selected: "ja" | "nein" | "entfällt" | "offen",
  optionType?: "YES_NO" | "YES_NO_NA",
  showLabels = true,
) {
  const includeNotApplicable =
    optionType !== "YES_NO" || selected === "entfällt";
  const labels = includeNotApplicable
    ? ["ja", "nein", "entfällt"]
    : ["ja", "nein"];
  const startX = includeNotApplicable ? 469 : 478;
  const gap = includeNotApplicable ? 28 : 39;
  labels.forEach((label, index) => {
    const x = startX + index * gap;
    const boxY = y - Math.min(17, height - 5);
    page.drawRectangle({
      borderColor: BLACK,
      borderWidth: 0.6,
      height: 8,
      width: 8,
      x,
      y: boxY,
    });
    if (selected === label) {
      page.drawText("X", {
        color: BLACK,
        font: fonts.bold,
        size: 7,
        x: x + 1.2,
        y: boxY + 0.8,
      });
    }
    if (showLabels) {
      page.drawText(label === "entfällt" ? "entf." : label, {
        color: BLACK,
        font: fonts.regular,
        size: 5.5,
        x: x - 1,
        y: boxY - 7,
      });
    }
  });
}

function drawOfficeAssessmentStatus(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  height: number,
  selected: "ja" | "nein" | "entfällt" | "offen",
  implemented: boolean,
  responsible: string,
) {
  const boxY = y - Math.min(17, height - 5);
  [
    { label: "ja", x: 432 },
    { label: "nein", x: 458 },
  ].forEach(({ label, x }) => {
    page.drawRectangle({
      borderColor: BLACK,
      borderWidth: 0.6,
      height: 8,
      width: 8,
      x,
      y: boxY,
    });
    if (selected === label) {
      page.drawText("X", {
        color: BLACK,
        font: fonts.bold,
        size: 7,
        x: x + 1.2,
        y: boxY + 0.8,
      });
    }
  });
  if (selected === "entfällt") {
    page.drawText("nicht relevant", {
      color: BLACK,
      font: fonts.bold,
      size: 5,
      x: 476,
      y: boxY + 1,
    });
  }
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.6,
    height: 8,
    width: 8,
    x: 488,
    y: boxY,
  });
  if (implemented) {
    page.drawText("X", {
      color: BLACK,
      font: fonts.bold,
      size: 7,
      x: 489.2,
      y: boxY + 0.8,
    });
  }
  page.drawText(fit(safe(responsible || "-"), fonts.regular, 6, 47), {
    color: BLACK,
    font: fonts.regular,
    size: 6,
    x: 503,
    y: boxY + 1,
  });
}

function roadRollerHeader(
  page: PDFPage,
  fonts: Fonts,
  y: number,
) {
  const height = 28;
  const columns = [102, 207, 412, 456, 504];
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    color: GRAY,
    height,
    width: WIDTH,
    x: MARGIN,
    y: y - height,
  });
  columns.forEach((x) =>
    page.drawLine({
      color: BLACK,
      end: { x, y },
      start: { x, y: y - height },
      thickness: 0.5,
    }),
  );
  [
    ["Tätigkeit", 46],
    ["Gefährdung", 108],
    ["Schutzmaßnahme", 213],
    ["Relevant?", 416],
    ["weitere Infos", 460],
    ["Realisierung", 508],
  ].forEach(([label, x]) =>
    page.drawText(label as string, {
      color: BLACK,
      font: fonts.bold,
      size: 5.7,
      x: x as number,
      y: y - 11,
    }),
  );
  page.drawText("ja   nein", {
    color: BLACK,
    font: fonts.regular,
    size: 5,
    x: 418,
    y: y - 22,
  });
  page.drawLine({
    color: BLACK,
    end: { x: 515, y: y - 18 },
    start: { x: 511, y: y - 21 },
    thickness: 0.7,
  });
  page.drawLine({
    color: BLACK,
    end: { x: 520, y: y - 14 },
    start: { x: 515, y: y - 18 },
    thickness: 0.7,
  });
  page.drawText("Wer", {
    color: BLACK,
    font: fonts.regular,
    size: 5,
    x: 526,
    y: y - 22,
  });
  return y - height;
}

function drawRoadRollerRow(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  height: number,
  activityLines: string[],
  hazardLines: string[],
  measureLines: string[],
  referenceLines: string[],
  selected: "ja" | "nein" | "entfällt" | "offen",
  implemented: boolean,
  responsible: string,
  pictograms: PDFImage[],
  pictogramsInMeasure = false,
) {
  const columns = [102, 207, 412, 456, 504];
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    height,
    width: WIDTH,
    x: MARGIN,
    y: y - height,
  });
  columns.forEach((x) =>
    page.drawLine({
      color: BLACK,
      end: { x, y },
      start: { x, y: y - height },
      thickness: 0.5,
    }),
  );
  const drawLines = (
    lines: string[],
    x: number,
    size = 5.6,
    step = 6.4,
  ) =>
    lines.forEach((line, index) =>
      page.drawText(safe(line), {
        color: BLACK,
        font: fonts.regular,
        size,
        x,
        y: y - 9 - index * step,
      }),
    );
  drawLines(activityLines, 46);
  drawLines(hazardLines, 108);
  drawLines(measureLines, 213);
  drawLines(referenceLines, 460, 5.2, 6);

  if (pictograms.length) {
    pictograms.forEach((pictogram, index) => {
      const dimensions = pictogram.scaleToFit(
        pictogramsInMeasure
          ? pictograms.length > 1
            ? 88
            : 185
          : 33,
        pictogramsInMeasure ? 70 : 33,
      );
      page.drawImage(pictogram, {
        height: dimensions.height,
        width: dimensions.width,
        x: pictogramsInMeasure
          ? 218 + index * 94
          : 113 + index * 42,
        y: y - height + 5,
      });
    });
  }

  [
    { label: "ja", x: 419 },
    { label: "nein", x: 440 },
  ].forEach(({ label, x }) => {
    page.drawRectangle({
      borderColor: BLACK,
      borderWidth: 0.6,
      height: 8,
      width: 8,
      x,
      y: y - 15,
    });
    if (selected === label) {
      page.drawText("X", {
        color: BLACK,
        font: fonts.bold,
        size: 7,
        x: x + 1.2,
        y: y - 14.2,
      });
    }
  });
  if (selected === "entfällt") {
    page.drawText("n. rel.", {
      color: BLACK,
      font: fonts.bold,
      size: 5,
      x: 414,
      y: y - 24,
    });
  }
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.6,
    height: 8,
    width: 8,
    x: 510,
    y: y - 15,
  });
  if (implemented) {
    page.drawText("X", {
      color: BLACK,
      font: fonts.bold,
      size: 7,
      x: 511.2,
      y: y - 14.2,
    });
  }
  const whoLines = wrap(responsible || "-", fonts.regular, 5.2, 29).slice(0, 5);
  drawLines(whoLines, 521, 5.2, 6);
}

function statusHeader(
  page: PDFPage,
  fonts: Fonts,
  y: number,
  includeNotApplicable: boolean,
  officeLayout = false,
) {
  const height = 18;
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    color: LIGHT,
    height,
    width: WIDTH,
    x: MARGIN,
    y: y - height,
  });
  page.drawLine({
    color: BLACK,
    end: { x: officeLayout ? 422 : 465, y },
    start: { x: officeLayout ? 422 : 465, y: y - height },
    thickness: 0.5,
  });
  if (officeLayout) {
    [192, 482].forEach((x) =>
      page.drawLine({
        color: BLACK,
        end: { x, y },
        start: { x, y: y - height },
        thickness: 0.5,
      }),
    );
  }
  page.drawText(officeLayout ? "Gefährdung" : "Beurteilung", {
    color: BLACK,
    font: fonts.bold,
    size: 7,
    x: MARGIN + 5,
    y: y - 12,
  });
  if (officeLayout) {
    page.drawText("Schutzmaßnahme", {
      color: BLACK,
      font: fonts.bold,
      size: 7,
      x: 197,
      y: y - 12,
    });
    page.drawText("Relevant?   ja     nein", {
      color: BLACK,
      font: fonts.bold,
      size: 5.6,
      x: 426,
      y: y - 12,
    });
    page.drawText("Realisierung   X   Wer", {
      color: BLACK,
      font: fonts.bold,
      size: 5.6,
      x: 486,
      y: y - 12,
    });
    return y - height;
  }
  const labels = includeNotApplicable ? ["ja", "nein", "entfällt"] : ["ja", "nein"];
  const startX = includeNotApplicable ? 469 : 478;
  const gap = includeNotApplicable ? 28 : 39;
  labels.forEach((label, index) =>
    page.drawText(label, {
      color: BLACK,
      font: fonts.bold,
      size: 6,
      x: startX + index * gap - (label === "entfällt" ? 4 : 0),
      y: y - 12,
    }),
  );
  return y - height;
}

async function signatureRow(
  pdf: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  y: number,
  label: string,
  value: string | null,
) {
  const height = 42;
  page.drawRectangle({
    borderColor: BLACK,
    borderWidth: 0.5,
    height,
    width: WIDTH,
    x: MARGIN,
    y: y - height,
  });
  page.drawLine({
    color: BLACK,
    end: { x: 180, y },
    start: { x: 180, y: y - height },
    thickness: 0.5,
  });
  page.drawText(safe(label), {
    color: BLACK,
    font: fonts.bold,
    size: 8,
    x: MARGIN + 5,
    y: y - 24,
  });
  const signature = await embedSignature(pdf, value);
  if (signature) {
    page.drawImage(signature, {
      height: 32,
      width: 128,
      x: 186,
      y: y - 37,
    });
  } else {
    page.drawText("-", {
      color: BLACK,
      font: fonts.regular,
      size: 8,
      x: 186,
      y: y - 24,
    });
  }
  return y - height;
}

async function embedSignature(pdf: PDFDocument, value: string | null) {
  if (!value?.startsWith("data:image/")) return null;
  const [, mime, encoded] =
    value.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/) || [];
  if (!encoded) return null;
  const bytes = Buffer.from(encoded, "base64");
  return mime === "image/png" ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}

function date(value: Date | null) {
  return value?.toLocaleDateString("de-DE") ?? "-";
}

function safe(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E\u00C0-\u00FF]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safe(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
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
  while (
    result &&
    font.widthOfTextAtSize(`${result}...`, size) > maxWidth
  ) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}
