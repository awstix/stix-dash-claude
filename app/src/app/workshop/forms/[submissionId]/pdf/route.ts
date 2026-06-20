import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFCheckBox,
  type PDFForm,
} from "pdf-lib";
import { prisma } from "@/lib/prisma";
import {
  parseWorkshopFormValues,
  parseWorkshopSnapshotFields,
} from "../../../workshopFormTypes";
import { createFormPdf, normalizeFormPdfCompany } from "@/lib/formPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await context.params;
  const [submission, rawCompany] = await Promise.all([
    prisma.workshopFormSubmission.findUnique({
      where: { id: submissionId },
      include: { template: true, vehicle: true },
    }),
    prisma.companyInfo.findUnique({ where: { id: "default" } }),
  ]);
  if (!submission) return new Response("Formular nicht gefunden.", { status: 404 });

  const values = parseWorkshopFormValues(submission.valuesJson);
  const bytes =
    submission.templateKind === "CUSTOM"
      ? await createFormPdf({
          companyInfo: normalizeFormPdfCompany(rawCompany),
          createdByName: submission.createdByName,
          fields: parseWorkshopSnapshotFields(
            submission.templateSnapshotJson,
            submission.template?.fieldsJson,
          ),
          formDate: submission.formDate,
          paperOrientation: getSnapshotSetting(
            submission.templateSnapshotJson,
            "paperOrientation",
            submission.template?.paperOrientation,
          ) === "LANDSCAPE"
            ? "LANDSCAPE"
            : "PORTRAIT",
          paperSize:
            getSnapshotSetting(
              submission.templateSnapshotJson,
              "paperSize",
              submission.template?.paperSize,
            ) === "A5"
              ? "A5"
              : "A4",
          project: {
            constructionManager: null,
            name: "Werkstatt",
            projectNumber: "",
            siteAddress: null,
          },
          templateName:
            submission.template?.name ??
            getSnapshotSetting(
              submission.templateSnapshotJson,
              "name",
              "Werkstattformular",
            ),
          title: submission.title,
          values,
        })
      : await fillOriginalPdf(submission.templateKind, values);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${safeName(submission.title)}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}

async function fillOriginalPdf(
  kind: string,
  values: Record<string, boolean | string>,
) {
  const fileName =
    kind === "TIRE_ORDER"
      ? "reifen-auftrag.pdf"
      : kind === "MACHINE_ORDER"
        ? "maschinen-auftrag.pdf"
        : "fahrzeug-auftrag.pdf";
  const pdf = await PDFDocument.load(
    await readFile(path.join(process.cwd(), "public", "templates", "workshop", fileName)),
  );
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "public", "fonts", "Montserrat-Regular.ttf")),
    { subset: true },
  );
  const form = pdf.getForm();

  if (kind === "TIRE_ORDER") {
    setText(form, "Kennzeichen", values.licensePlate);
    setText(form, "km", values.km);
    setText(form, "Datum", formatGermanDate(values.inspectionDate));
    setText(form, "Datum_es_:date", formatGermanDate(values.inspectionDate));
    setText(form, "Unterschrift Monteur_es_:signature", values.mechanic);
    const notes = splitLines(String(values.notes ?? ""), 82, 5);
    [
      "Notizen Zeile 1",
      "notizen Zeile 2",
      "Notizen Zeile 3",
      "Notizen Zeile 4",
      "Notizen Zeile 5",
    ].forEach((name, index) => setText(form, name, notes[index]));
    const tireFields: Record<string, string> = {
      axle1_la: "Kontrollkästchen 1-1_es_:signature",
      axle1_ra: "Kontrollkästchen1-2_es_:signature",
    };
    for (let axle = 2; axle <= 6; axle += 1) {
      tireFields[`axle${axle}_la`] = `Kontrollkästchen ${axle}-1_es_:signature`;
      tireFields[`axle${axle}_li`] = `Kontrollkästchen${axle}-2_es_:signature`;
      tireFields[`axle${axle}_ri`] = `Kontrollkästchen ${axle}-3_es_:signature`;
      tireFields[`axle${axle}_ra`] = `Kontrollkästchen ${axle}-4_es_:signature`;
    }
    Object.entries(tireFields).forEach(([key, name]) =>
      setCheck(form, name, values[key] === true),
    );
    await drawSignatureDataUrl(pdf, pdf.getPages()[0], values.mechanicSignature, {
      height: 22,
      width: 150,
      x: 215,
      y: 157,
    });
  } else {
    setCheck(form, "Intern", values.internal === true);
    setCheck(form, "Extern", values.external === true);
    setCheck(form, "Liefertermin", values.deliveryRequired === true);
    setText(form, "Fahrer", values.driver);
    setText(form, "Firma", values.signatureCompany);
    setText(form, "Datum", formatGermanDate(values.deliveryDate));
    if (kind === "MACHINE_ORDER") {
      setText(form, "Seriennr", values.serialNumber);
      setText(form, "Interne Nr", values.internalNumber);
      setText(form, "Betriebsstd", values.operatingHours);
    } else {
      setText(form, "Fahrgstlnr", values.vin);
      setText(form, "Kennzeichen", values.licensePlate);
      setText(form, "KM", values.km);
    }
    const information = splitLines(String(values.information ?? ""), 94, 11);
    information.forEach((line, index) =>
      setText(form, index === 0 ? "Informationen 1" : `Informationen ${index + 1}`, line),
    );
    const checks = [
      ["cleaned", "Gereinigt", "Gereinigt durch"],
      ["lubricated", "Abgeschmiert", "Abgeschmiert durch"],
      ["accepted", "Angenommen", "Angenommen durch"],
      [
        "finalInspection",
        "Endkontrolle",
        kind === "MACHINE_ORDER" ? "Endkontrolle druch" : "Endkontrolle durch",
      ],
    ] as const;
    checks.forEach(([key, checkName, byName]) => {
      setCheck(form, checkName, values[key] === true);
      setText(form, byName, values[`${key}By`]);
    });

    const page = pdf.getPages()[0];
    page.drawText(String(values.company ?? ""), { x: 360, y: 714, size: 8, font, color: rgb(0.12, 0.12, 0.12) });
    page.drawText(formatGermanDate(values.signatureDate), { x: 220, y: 61, size: 8, font, color: rgb(0.12, 0.12, 0.12) });
    await drawSignatureDataUrl(pdf, page, values.signatureDataUrl, {
      height: 30,
      width: 145,
      x: 385,
      y: 58,
    });
    if (!String(values.signatureDataUrl ?? "")) {
      page.drawText(String(values.signatureName ?? ""), { x: 385, y: 61, size: 8, font, color: rgb(0.12, 0.12, 0.12) });
    }
  }

  form.updateFieldAppearances(font);
  form.flatten();
  return pdf.save();
}

async function drawSignatureDataUrl(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument["getPages"]>[number],
  value: boolean | string | undefined,
  placement: { height: number; width: number; x: number; y: number },
) {
  if (!isPngDataUrl(value)) return;
  try {
    const bytes = Buffer.from(String(value).split(",", 2)[1], "base64");
    const image = await pdf.embedPng(bytes);
    const scale = Math.min(
      placement.width / image.width,
      placement.height / image.height,
    );
    page.drawImage(image, {
      height: image.height * scale,
      width: image.width * scale,
      x: placement.x,
      y: placement.y,
    });
  } catch {
    // Eine beschädigte Unterschrift blockiert den übrigen PDF-Export nicht.
  }
}

function isPngDataUrl(value: boolean | string | undefined) {
  return typeof value === "string" && value.startsWith("data:image/png;base64,");
}

function setText(form: PDFForm, name: string, value: boolean | string | undefined) {
  try {
    form.getTextField(name).setText(String(value ?? ""));
  } catch {
    // Optionale Felder älterer Vorlagen werden übersprungen.
  }
}

function setCheck(form: PDFForm, name: string, checked: boolean) {
  try {
    const field = form.getCheckBox(name) as PDFCheckBox;
    if (checked) field.check();
    else field.uncheck();
  } catch {
    // Optionale Felder älterer Vorlagen werden übersprungen.
  }
}

function splitLines(value: string, maxLength: number, maxLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (!last || last.length + word.length + 1 > maxLength) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
  }
  return lines.slice(0, maxLines);
}

function formatGermanDate(value: boolean | string | undefined) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const [year, month, day] = text.split("-");
  return `${day}.${month}.${year}`;
}

function getSnapshotSetting(
  snapshot: string | null,
  key: string,
  fallback: string | null | undefined,
) {
  try {
    const parsed = JSON.parse(snapshot ?? "{}") as Record<string, unknown>;
    const value = parsed[key];
    return typeof value === "string" && value.trim() ? value : fallback ?? "";
  } catch {
    return fallback ?? "";
  }
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]+/g, "_").slice(0, 100);
}
