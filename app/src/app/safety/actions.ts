"use server";

import { randomUUID } from "crypto";
import path from "path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth-access";
import {
  nextHazardSequentialNumber,
  readHazardRegisterTemplate,
} from "@/lib/hazard-register";
import { deleteFile, putFile } from "@/lib/storage";

const STORAGE_BUCKET = "uploads";
import {
  PROJECT_FORM_FIELD_TYPES,
  type ProjectFormFieldDefinition,
  type ProjectFormFieldType,
} from "@/app/projects/projectFormTypes";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);
  if (!text) {
    throw new Error(`${label} ist ein Pflichtfeld.`);
  }
  return text;
}

function dateValue(value: FormDataEntryValue | null, label: string) {
  const text = requiredString(value, label);
  const date = new Date(`${text}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} ist kein gültiges Datum.`);
  }

  return date;
}

function optionalDateValue(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) {
    return null;
  }

  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function checked(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = optionalString(value)?.replace(/\./g, "").replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function positiveIntegerOrNull(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;
  const number = Number.parseInt(text, 10);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error("Die Gültigkeit muss mindestens einen Monat betragen.");
  }
  return number;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function optionalInteger(value: FormDataEntryValue | null) {
  const number = optionalNumber(value);
  return number === null ? null : Math.max(0, Math.trunc(number));
}

type SafetyFormTemplateInput = {
  category: string;
  description: string;
  emailRecipients?: string[];
  fields: Array<{
    description?: string;
    id?: string;
    label: string;
    options?: string[];
    required?: boolean;
    type: ProjectFormFieldType;
    width?: number;
  }>;
  id?: string;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

function cleanSafetyFormText(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function cleanSafetyFormEmailRecipients(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .flatMap((value) => String(value ?? "").split(/[\n,;]/))
        .map((value) => cleanSafetyFormText(value, 180).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function cleanSafetyFormFields(
  fields: SafetyFormTemplateInput["fields"],
): ProjectFormFieldDefinition[] {
  return fields
    .map((field, index) => {
      const label = cleanSafetyFormText(field.label, 120);
      const type = PROJECT_FORM_FIELD_TYPES.includes(field.type)
        ? field.type
        : "text";

      return {
        description: cleanSafetyFormText(field.description, 500),
        id:
          cleanSafetyFormText(field.id, 100) ||
          `safety-field-${Date.now().toString(36)}-${index + 1}`,
        label,
        options: (field.options ?? [])
          .map((option) => cleanSafetyFormText(option, 100))
          .filter(Boolean),
        required: Boolean(field.required),
        type,
        width:
          Number.isInteger(field.width) &&
          Number(field.width) >= 1 &&
          Number(field.width) <= 6
            ? Number(field.width)
            : 6,
      } satisfies ProjectFormFieldDefinition;
    })
    .filter((field) => field.label);
}

function choiceValue(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  return text && ["YES", "NO", "NOT_REQUIRED"].includes(text) ? text : null;
}

function fileExtension(file: File) {
  const nameExtension = path.extname(file.name || "").toLowerCase();
  if (nameExtension) {
    return nameExtension;
  }

  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/heic") return ".heic";
  return ".jpg";
}

async function replaceTemplatePdf(file: File, fileName: string) {
  if (!file || file.size === 0) {
    throw new Error("Bitte eine PDF-Datei auswählen.");
  }

  if (file.type && file.type !== "application/pdf") {
    throw new Error("Bitte eine PDF-Datei hochladen.");
  }

  await putFile(
    STORAGE_BUCKET,
    `safety-templates-admin/${fileName}`,
    Buffer.from(await file.arrayBuffer()),
    "application/pdf",
  );
}

export async function replaceSafetyPdfTemplate(formData: FormData) {
  await requireSession();
  const templateKey = requiredString(formData.get("templateKey"), "Vorlage");
  const file = formData.get("templateFile");

  if (!(file instanceof File)) {
    throw new Error("Bitte eine PDF-Datei auswählen.");
  }

  if (templateKey === "ACCIDENT_PROCESS") {
    await replaceTemplatePdf(file, "unfallmeldeprozess.pdf");
  } else if (templateKey === "ACCIDENT_REPORT") {
    await replaceTemplatePdf(file, "unfallsofortmeldung.pdf");
  } else {
    throw new Error("Unbekannte Vorlage.");
  }

  revalidatePath("/safety/accidents");
}

export async function saveSafetyFormTemplate(input: SafetyFormTemplateInput) {
  await requireSession();
  const name = cleanSafetyFormText(input.name, 120);
  const fields = cleanSafetyFormFields(input.fields);

  if (!name) {
    throw new Error("Bitte einen Namen für die Formularvorlage eintragen.");
  }

  if (fields.length === 0) {
    throw new Error("Bitte mindestens ein Feld anlegen.");
  }

  const data = {
    category: cleanSafetyFormText(input.category, 80) || null,
    description: cleanSafetyFormText(input.description, 500) || null,
    emailRecipientsJson: JSON.stringify(
      cleanSafetyFormEmailRecipients(input.emailRecipients),
    ),
    fieldsJson: JSON.stringify(fields),
    name,
    paperOrientation:
      input.paperOrientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
    paperSize: input.paperSize === "A5" ? "A5" : "A4",
  };

  if (input.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE SafetyFormTemplate
       SET name = ?, category = ?, description = ?, emailRecipientsJson = ?,
           fieldsJson = ?, paperOrientation = ?, paperSize = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.name,
      data.category,
      data.description,
      data.emailRecipientsJson,
      data.fieldsJson,
      data.paperOrientation,
      data.paperSize,
      input.id,
    );
  } else {
    const maxRows = await prisma.$queryRawUnsafe<
      Array<{ maxSortOrder: number | null }>
    >(`SELECT MAX(sortOrder) AS maxSortOrder FROM SafetyFormTemplate`);

    await prisma.$executeRawUnsafe(
      `INSERT INTO SafetyFormTemplate
       (id, name, category, description, emailRecipientsJson, fieldsJson,
        isActive, sortOrder, paperSize, paperOrientation, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      data.name,
      data.category,
      data.description,
      data.emailRecipientsJson,
      data.fieldsJson,
      (maxRows[0]?.maxSortOrder ?? 0) + 10,
      data.paperSize,
      data.paperOrientation,
    );
  }

  revalidatePath("/safety");
  revalidatePath("/safety/forms");
}

export async function deleteSafetyFormTemplate(id: string) {
  await requireSession();
  const templateId = cleanSafetyFormText(id, 100);
  if (!templateId) return;

  await prisma.$executeRawUnsafe(
    `DELETE FROM SafetyFormTemplate WHERE id = ?`,
    templateId,
  );

  revalidatePath("/safety");
  revalidatePath("/safety/forms");
}

async function saveAccidentPhotos(reportId: string, files: File[]) {
  const usableFiles = files.filter((file) => file.size > 0);

  if (usableFiles.length === 0) {
    return;
  }

  const photoRows = [];

  for (const file of usableFiles) {
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${fileExtension(file)}`;
    const storagePath = `safety-accidents/${reportId}/${fileName}`;

    const uploaded = await putFile(
      STORAGE_BUCKET,
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
    const publicUrl = uploaded.publicUrl;

    photoRows.push({
      accidentReportId: reportId,
      fileName,
      originalFileName: file.name || null,
      publicUrl,
      storagePath,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
      uploadedByName: "System",
    });
  }

  await prisma.safetyAccidentPhoto.createMany({
    data: photoRows,
  });
}

async function saveSafetyDocuments(
  substanceId: string,
  files: File[],
  versionDate: Date | null,
  documentType: "BA" | "SDB",
) {
  const usableFiles = files.filter((file) => file.size > 0);

  if (usableFiles.length === 0) {
    return;
  }

  const documentFolder =
    documentType === "BA" ? "safety-operating-instructions" : "safety-data-sheets";

  const rows = [];

  for (const file of usableFiles) {
    const originalExtension = path.extname(file.name || "").toLowerCase();
    const extension = originalExtension || (file.type === "application/pdf" ? ".pdf" : fileExtension(file));
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;
    const storagePath = `${documentFolder}/${substanceId}/${fileName}`;

    const uploaded = await putFile(
      STORAGE_BUCKET,
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
    const publicUrl = uploaded.publicUrl;

    rows.push({
      displayName:
        file.name ||
        (documentType === "BA" ? "Betriebsanweisung" : "Sicherheitsdatenblatt"),
      documentType,
      fileName,
      fileSizeBytes: file.size,
      hazardousSubstanceId: substanceId,
      mimeType: file.type || null,
      originalFileName: file.name || null,
      publicUrl,
      storagePath,
      uploadedByName: "System",
      versionDate,
    });
  }

  await prisma.safetyDataSheet.createMany({
    data: rows,
  });
}

async function createAccidentNotificationRows(accidentReportId: string) {
  const officers = await prisma.safetyAccidentOfficer.findMany({
    where: {
      isActive: true,
    },
    orderBy: [
      {
        name: "asc",
      },
    ],
  });

  if (officers.length === 0) {
    return;
  }

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_FROM,
  );

  await prisma.safetyAccidentNotification.createMany({
    data: officers.map((officer) => ({
      accidentReportId,
      errorMessage: smtpConfigured
        ? null
        : "E-Mail-Versand vorbereitet. SMTP_HOST und SMTP_FROM sind noch nicht konfiguriert.",
      recipientEmail: officer.email,
      recipientName: officer.name,
      status: smtpConfigured ? "READY_TO_SEND" : "PENDING_SMTP_CONFIG",
    })),
  });
}

export async function createSafetyAccidentOfficer(formData: FormData) {
  await requireSession();
  await prisma.safetyAccidentOfficer.upsert({
    create: {
      email: requiredString(formData.get("email"), "E-Mail"),
      name: requiredString(formData.get("name"), "Name"),
      role: optionalString(formData.get("role")),
    },
    update: {
      isActive: true,
      name: requiredString(formData.get("name"), "Name"),
      role: optionalString(formData.get("role")),
    },
    where: {
      email: requiredString(formData.get("email"), "E-Mail"),
    },
  });

  revalidatePath("/safety/accidents");
}

async function accidentReportData(formData: FormData) {
  const projectId = optionalString(formData.get("projectId"));
  const employeeId = optionalString(formData.get("employeeId"));

  const [project, employee] = await Promise.all([
    projectId
      ? prisma.project.findUnique({
          where: {
            id: projectId,
          },
          select: {
            name: true,
            projectNumber: true,
          },
        })
      : null,
    employeeId
      ? prisma.employee.findUnique({
          where: {
            id: employeeId,
          },
          select: {
            firstName: true,
            lastName: true,
          },
        })
      : null,
  ]);

  return {
      accidentDate: dateValue(formData.get("accidentDate"), "Unfalldatum"),
      accidentTime: optionalString(formData.get("accidentTime")),
      accidentType: optionalString(formData.get("accidentType")),
      apprenticeStatus: choiceValue(formData.get("apprenticeStatus")),
      bodyPart: optionalString(formData.get("bodyPart")),
      clientSafetyContact: optionalString(formData.get("clientSafetyContact")),
      constructionManagerName: optionalString(formData.get("constructionManagerName")),
      constructionManagerPhone: optionalString(formData.get("constructionManagerPhone")),
      constructionManagerSalutation: optionalString(formData.get("constructionManagerSalutation")),
      departmentCrew: optionalString(formData.get("departmentCrew")),
      description: optionalString(formData.get("description")),
      doctorVisit: checked(formData.get("doctorVisit")),
      emergencyCalled: checked(formData.get("emergencyCalled")),
      employeeSalutation: optionalString(formData.get("employeeSalutation")),
      employeeSnapshot: employee
        ? `${employee.lastName}, ${employee.firstName}`
        : optionalString(formData.get("employeeSnapshot")),
      externalCauserName: optionalString(formData.get("externalCauserName")),
      externalCauserStatus: choiceValue(formData.get("externalCauserStatus")),
      externalCompany: optionalString(formData.get("externalCompany")),
      externalSafetyAnalysisStatus: choiceValue(
        formData.get("externalSafetyAnalysisStatus"),
      ),
      immediateMeasures: optionalString(formData.get("immediateMeasures")),
      injurySeverity: optionalString(formData.get("injurySeverity")),
      injuryType: optionalString(formData.get("injuryType")),
      internalEmployeeStatus: choiceValue(formData.get("internalEmployeeStatus")),
      location: optionalString(formData.get("location")),
      managerSignatureDataUrl: optionalString(formData.get("managerSignatureDataUrl")),
      notes: optionalString(formData.get("notes")),
      policeReportNotes: optionalString(formData.get("policeReportNotes")),
      policeReportStatus: choiceValue(formData.get("policeReportStatus")),
      projectSnapshot: project
        ? `${project.projectNumber} · ${project.name}`
        : optionalString(formData.get("projectSnapshot")),
      reportedByName: optionalString(formData.get("reportedByName")),
      reportDate: new Date(),
      signatureDate: optionalDateValue(formData.get("signatureDate")),
      status: "OPEN",
      treatment: optionalString(formData.get("treatment")),
      propertyDamageDescription: optionalString(
        formData.get("propertyDamageDescription"),
      ),
      propertyDamageStatus: choiceValue(formData.get("propertyDamageStatus")),
      witnessNames: optionalString(formData.get("witnessNames")),
      workStopped: checked(formData.get("workStopped")),
      employeeRelation: employeeId
        ? {
            connect: {
              id: employeeId,
            },
          }
        : {
            disconnect: true,
          },
      projectRelation: projectId
        ? {
            connect: {
              id: projectId,
            },
          }
        : {
            disconnect: true,
          },
    };
}

export async function createSafetyAccidentReport(formData: FormData) {
  await requireSession();
  const data = await accidentReportData(formData);
  const { employeeRelation, projectRelation, ...reportData } = data;

  const report = await prisma.safetyAccidentReport.create({
    data: {
      ...reportData,
      ...("connect" in employeeRelation ? { employee: employeeRelation } : {}),
      ...("connect" in projectRelation ? { project: projectRelation } : {}),
      reportDate: new Date(),
      status: "OPEN",
    },
  });

  const photos = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File);

  await saveAccidentPhotos(report.id, photos);
  await createAccidentNotificationRows(report.id);

  revalidatePath("/safety");
  revalidatePath("/safety/accidents");
  redirect(`/safety/accidents/${report.id}`);
}

export async function updateSafetyAccidentReport(
  reportId: string,
  formData: FormData,
) {
  await requireSession();
  const data = await accidentReportData(formData);
  const { employeeRelation, projectRelation, ...reportData } = data;

  await prisma.safetyAccidentReport.update({
    data: {
      ...reportData,
      employee: employeeRelation,
      project: projectRelation,
    },
    where: {
      id: reportId,
    },
  });

  const photos = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File);

  await saveAccidentPhotos(reportId, photos);

  revalidatePath("/safety");
  revalidatePath("/safety/accidents");
  revalidatePath(`/safety/accidents/${reportId}`);
  redirect(`/safety/accidents/${reportId}`);
}

export async function deleteSafetyAccidentReport(formData: FormData) {
  await requireSession();
  const reportId = requiredString(formData.get("reportId"), "Unfallmeldung");

  await prisma.safetyAccidentReport.delete({
    where: {
      id: reportId,
    },
  });

  revalidatePath("/safety");
  revalidatePath("/safety/accidents");
  redirect("/safety/accidents");
}

async function hazardousSubstanceSequentialNumber(
  requestedValue: FormDataEntryValue | null,
  currentId?: string,
  templateRowId?: string | null,
) {
  const requested = optionalString(requestedValue);
  const templateNumbers = readHazardRegisterTemplate().rows
    .filter((row) => row.id !== templateRowId)
    .map((row) => row.sequentialNumber);
  const databaseRows = await prisma.safetyHazardousSubstance.findMany({
    select: {
      id: true,
      sequentialNumber: true,
    },
  });
  const otherDatabaseRows = databaseRows.filter((row) => row.id !== currentId);
  const occupied = [
    ...templateNumbers,
    ...otherDatabaseRows.map((row) => row.sequentialNumber),
  ];

  if (!requested) {
    return nextHazardSequentialNumber(occupied);
  }

  if (!/^[1-9]\d*$/.test(requested)) {
    throw new Error("Die laufende Nummer muss eine positive ganze Zahl sein.");
  }

  if (occupied.some((value) => String(value ?? "").trim() === requested)) {
    throw new Error(`Die laufende Nummer ${requested} ist bereits vergeben.`);
  }

  return requested;
}

function hazardousSubstanceData(
  formData: FormData,
  safetyDataSheetFiles: File[],
  operatingInstructionFiles: File[],
  safetyDataSheetDate: Date | null,
  sequentialNumber: string,
  existingSdbPresent = false,
  existingBaPresent = false,
) {
  const operatingInstructionTemplateIds = formData
    .getAll("operatingInstructionTemplateId")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const usageAreas = [
    ...formData.getAll("usageArea"),
    ...formData.getAll("customUsageArea"),
  ]
    .map((value) => String(value).trim())
    .filter(Boolean);

  return {
    category: optionalString(formData.get("category")),
    disposalNotes: optionalString(formData.get("disposalNotes")),
    firstAidMeasures: optionalString(formData.get("firstAidMeasures")),
    hStatements: optionalString(formData.get("hStatements")),
    hazardSymbols: formData
      .getAll("hazardSymbol")
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(", "),
    isActive: true,
    manufacturer: optionalString(formData.get("manufacturer")),
    name: requiredString(formData.get("name"), "Gefahrstoff"),
    nextReviewDate: optionalDateValue(formData.get("nextReviewDate")),
    notes: optionalString(formData.get("notes")),
    operatingInstructionPresent:
      existingBaPresent ||
      operatingInstructionFiles.length > 0 ||
      operatingInstructionTemplateIds.length > 0,
    operatingInstructionTemplateIds:
      operatingInstructionTemplateIds.join(", ") || null,
    packageUnit: optionalString(formData.get("packageUnit")),
    pStatements: optionalString(formData.get("pStatements")),
    protectiveMeasures: optionalString(formData.get("protectiveMeasures")),
    quantity: optionalNumber(formData.get("quantity")),
    registerSection:
      optionalString(formData.get("registerSection")) === "WITHOUT_BA"
        ? "WITHOUT_BA"
        : "HAZARDOUS",
    repeatDays: optionalInteger(formData.get("repeatDays")),
    repeatMonths: optionalInteger(formData.get("repeatMonths")),
    repeatYears: optionalInteger(formData.get("repeatYears")),
    responsibleName: optionalString(formData.get("responsibleName")),
    safetyDataSheetDate,
    safetyDataSheetPresent:
      existingSdbPresent ||
      checked(formData.get("safetyDataSheetPresent")) ||
      safetyDataSheetFiles.length > 0,
    sequentialNumber,
    signalWord: optionalString(formData.get("signalWord")),
    storagePlace: optionalString(formData.get("storagePlace")),
    substanceType: optionalString(formData.get("substanceType")),
    templateRowId: optionalString(formData.get("templateRowId")),
    usageArea: Array.from(new Set(usageAreas)).join(" + ") || null,
  };
}

export async function createHazardousSubstance(formData: FormData) {
  await requireSession();
  const files = formData
    .getAll("safetyDataSheets")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const operatingInstructionFiles = formData
    .getAll("operatingInstructionFiles")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const safetyDataSheetDate = optionalDateValue(
    formData.get("safetyDataSheetDate"),
  );
  const sequentialNumber = await hazardousSubstanceSequentialNumber(
    formData.get("sequentialNumber"),
    undefined,
    optionalString(formData.get("templateRowId")),
  );

  const substance = await prisma.safetyHazardousSubstance.create({
    data: hazardousSubstanceData(
      formData,
      files,
      operatingInstructionFiles,
      safetyDataSheetDate,
      sequentialNumber,
    ),
  });

  await saveSafetyDocuments(
    substance.id,
    files,
    safetyDataSheetDate,
    "SDB",
  );
  await saveSafetyDocuments(
    substance.id,
    operatingInstructionFiles,
    null,
    "BA",
  );

  revalidatePath("/safety");
  revalidatePath("/safety/hazardous-substances");
}

export async function updateHazardousSubstance(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  const existing = await prisma.safetyHazardousSubstance.findUnique({
    where: { id },
  });
  if (!existing?.isActive) {
    throw new Error("Der Gefahrstoff ist nicht aktiv oder wurde nicht gefunden.");
  }

  const files = formData
    .getAll("safetyDataSheets")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const operatingInstructionFiles = formData
    .getAll("operatingInstructionFiles")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const existingDocuments = await prisma.safetyDataSheet.findMany({
    select: { documentType: true },
    where: { hazardousSubstanceId: id },
  });
  const safetyDataSheetDate = optionalDateValue(
    formData.get("safetyDataSheetDate"),
  );
  const sequentialNumber = await hazardousSubstanceSequentialNumber(
    formData.get("sequentialNumber"),
    id,
  );

  await prisma.safetyHazardousSubstance.update({
    data: hazardousSubstanceData(
      formData,
      files,
      operatingInstructionFiles,
      safetyDataSheetDate,
      sequentialNumber,
      existingDocuments.some((document) => document.documentType === "SDB"),
      existingDocuments.some((document) => document.documentType === "BA"),
    ),
    where: { id },
  });
  await saveSafetyDocuments(id, files, safetyDataSheetDate, "SDB");
  await saveSafetyDocuments(id, operatingInstructionFiles, null, "BA");

  revalidatePath("/safety/hazardous-substances");
}

export async function archiveHazardousSubstance(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  await prisma.safetyHazardousSubstance.update({
    data: { isActive: false },
    where: { id },
  });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function archiveTemplateHazardousSubstance(formData: FormData) {
  await requireSession();
  const templateRowId = requiredString(
    formData.get("templateRowId"),
    "Excel-Zeile",
  );
  const sequentialNumber = requiredString(
    formData.get("sequentialNumber"),
    "Laufende Nummer",
  );
  await prisma.safetyHazardousSubstance.create({
    data: {
      category: optionalString(formData.get("category")),
      hazardSymbols: optionalString(formData.get("hazardSymbols")),
      isActive: false,
      manufacturer: optionalString(formData.get("manufacturer")),
      name: requiredString(formData.get("name"), "Gefahrstoff"),
      operatingInstructionPresent: checked(
        formData.get("operatingInstructionPresent"),
      ),
      packageUnit: optionalString(formData.get("packageUnit")),
      quantity: optionalNumber(formData.get("quantity")),
      registerSection:
        optionalString(formData.get("registerSection")) === "WITHOUT_BA"
          ? "WITHOUT_BA"
          : "HAZARDOUS",
      repeatDays: optionalInteger(formData.get("repeatDays")),
      repeatMonths: optionalInteger(formData.get("repeatMonths")),
      repeatYears: optionalInteger(formData.get("repeatYears")),
      safetyDataSheetDate: optionalDateValue(formData.get("safetyDataSheetDate")),
      safetyDataSheetPresent: checked(formData.get("safetyDataSheetPresent")),
      sequentialNumber,
      substanceType: optionalString(formData.get("substanceType")),
      templateRowId,
      usageArea: optionalString(formData.get("usageArea")),
    },
  });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function restoreHazardousSubstance(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  await prisma.safetyHazardousSubstance.update({
    data: { isActive: true },
    where: { id },
  });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function deleteHazardousSubstancePermanently(formData: FormData) {
  await requireAdmin();
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  const substance = await prisma.safetyHazardousSubstance.findUnique({
    select: { isActive: true },
    where: { id },
  });
  if (!substance) return;
  if (substance.isActive) {
    throw new Error(
      "Der Gefahrstoff muss vor dem endgültigen Löschen archiviert werden.",
    );
  }

  await prisma.safetyHazardousSubstance.delete({ where: { id } });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function deleteSafetyDataSheet(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Sicherheitsdatenblatt");
  const document = await prisma.safetyDataSheet.findUnique({
    select: {
      documentType: true,
      hazardousSubstanceId: true,
      storagePath: true,
    },
    where: { id },
  });
  if (!document) return;

  const allowedPrefixes = ["safety-data-sheets/", "safety-operating-instructions/"];
  if (!allowedPrefixes.some((prefix) => document.storagePath.startsWith(prefix))) {
    throw new Error("Ungültiger Speicherort des Sicherheitsdatenblatts.");
  }

  await prisma.safetyDataSheet.delete({ where: { id } });
  await deleteFile(STORAGE_BUCKET, document.storagePath).catch(() => undefined);

  const remaining = await prisma.safetyDataSheet.count({
    where: {
      documentType: document.documentType,
      hazardousSubstanceId: document.hazardousSubstanceId,
    },
  });
  if (remaining === 0) {
    const substance =
      document.documentType === "BA"
        ? await prisma.safetyHazardousSubstance.findUnique({
            select: { operatingInstructionTemplateIds: true },
            where: { id: document.hazardousSubstanceId },
          })
        : null;
    await prisma.safetyHazardousSubstance.update({
      data:
        document.documentType === "BA"
          ? {
              operatingInstructionPresent: Boolean(
                substance?.operatingInstructionTemplateIds?.trim(),
              ),
            }
          : { safetyDataSheetPresent: false },
      where: { id: document.hazardousSubstanceId },
    });
  }

  revalidatePath("/safety/hazardous-substances");
}

export async function createSafetyHazardRule(formData: FormData) {
  await requireSession();
  await prisma.safetyHazardRule.create({
    data: {
      implementation: optionalString(formData.get("implementation")),
      section: optionalString(formData.get("section")),
      source: requiredString(formData.get("source"), "Quelle"),
      text: requiredString(formData.get("text"), "Text"),
      topic: requiredString(formData.get("topic"), "Thema"),
    },
  });

  revalidatePath("/safety/hazardous-substances");
}

export async function createSafetyInstructionTemplate(formData: FormData) {
  await requireSession();
  const type = requiredString(formData.get("type"), "Art");
  const sections = String(formData.get("sections") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  await prisma.safetyInstructionTemplate.create({
    data: {
      content: optionalString(formData.get("content")),
      description: optionalString(formData.get("description")),
      sectionsJson: JSON.stringify(sections),
      title: requiredString(formData.get("title"), "Titel"),
      type,
    },
  });

  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/operating-instructions");
}

export async function createSafetyInstructionRecord(formData: FormData) {
  await requireSession();
  const templateId = requiredString(formData.get("templateId"), "Vorlage");
  const employeeIds = formData
    .getAll("employeeIds")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const commissionedPersonName = optionalString(
    formData.get("commissionedPersonName"),
  ) ?? optionalString(formData.get("commissionedPersonSignatureSignerName"));
  const externalFirstNames = formData
    .getAll("externalParticipantFirstName")
    .map((value) => String(value).trim());
  const externalLastNames = formData
    .getAll("externalParticipantLastName")
    .map((value) => String(value).trim());
  const externalCompanies = formData
    .getAll("externalParticipantCompany")
    .map((value) => String(value).trim());
  const externalParticipantSignatures = formData
    .getAll("externalParticipantSignature")
    .map((value) => String(value).trim());
  const externalParticipants = externalFirstNames
    .map((firstName, index) => ({
      company: externalCompanies[index] ?? "",
      firstName,
      lastName: externalLastNames[index] ?? "",
      signatureDataUrl: externalParticipantSignatures[index] || null,
    }))
    .filter(({ firstName, lastName }) => firstName || lastName);
  if (
    employeeIds.length === 0 &&
    externalParticipants.length === 0 &&
    !commissionedPersonName
  ) {
    throw new Error(
      "Bitte mindestens einen internen Mitarbeiter oder eine externe Person eintragen.",
    );
  }

  const [template, project, employees] = await Promise.all([
    prisma.safetyInstructionTemplate.findUniqueOrThrow({
      where: {
        id: templateId,
      },
      select: {
        folderId: true,
        title: true,
        type: true,
      },
    }),
    optionalString(formData.get("projectId"))
      ? prisma.project.findUnique({
          where: {
            id: String(formData.get("projectId")),
          },
          select: {
            name: true,
            projectNumber: true,
          },
        })
      : null,
    prisma.employee.findMany({
      where: {
        id: {
          in: employeeIds,
        },
      },
      orderBy: [
        {
          lastName: "asc",
        },
        {
          firstName: "asc",
        },
      ],
      select: {
        firstName: true,
        id: true,
        lastName: true,
      },
    }),
  ]);
  const previousVersionId = optionalString(formData.get("previousVersionId"));
  if (previousVersionId) {
    const previous = await prisma.safetyInstructionRecord.findFirst({
      select: { id: true },
      where: { id: previousVersionId, templateId },
    });
    if (!previous) {
      throw new Error("Die vorherige Version gehört nicht zu dieser Vorlage.");
    }
  }

  const projectId = optionalString(formData.get("projectId"));
  const instructionDate = dateValue(formData.get("instructionDate"), "Datum");
  const validityMonths =
    positiveIntegerOrNull(formData.get("validityMonths")) ??
    (await safetyValidityMonths(template.folderId));
  const validUntil = addMonths(instructionDate, validityMonths);
  const originalFormFields = Array.from(formData.entries())
    .filter(
      ([key, value]) =>
        key.startsWith("commissionField.") &&
        typeof value === "string" &&
        value.trim(),
    )
    .map(
      ([key, value]) =>
        `${key.slice("commissionField.".length)}: ${String(value).trim()}`,
    );
  const commissionDetails =
    template.type === "COMMISSION"
      ? [
          ["Firma", optionalString(formData.get("companyName"))],
          ["Geburtsdatum", optionalString(formData.get("birthDate"))],
          ["Wohnort", optionalString(formData.get("residence"))],
          [
            "Geräte / Fahrzeuge / Geltungsbereich",
            optionalString(formData.get("commissionScope")),
          ],
          ["Befristung / Gültigkeit", optionalString(formData.get("validity"))],
        ]
          .filter((entry) => entry[1])
          .map((entry) => `${entry[0]}: ${entry[1]}`)
      : [];
  const recordNotes = [
    ...commissionDetails,
    ...originalFormFields,
    optionalString(formData.get("notes")),
  ]
    .filter(Boolean)
    .join("\n");
  const checkedSections = formData
    .getAll("checkedSections")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const employeesWithSignatures = employees.map((employee) => {
    const signatureDataUrl = optionalString(
      formData.get(`participantSignature_${employee.id}`),
    );

    return {
      employee,
      signatureDataUrl,
    };
  });
  const externalSignatures = (
    template.type === "COMMISSION"
      ? [
          commissionedPersonName
            ? {
                employeeName: commissionedPersonName,
                signatureDataUrl: optionalString(
                  formData.get("commissionedPersonSignature"),
                ),
              }
            : null,
          optionalString(formData.get("authorizedPersonName")) ||
          optionalString(formData.get("authorizedPersonSignatureSignerName")) ||
          optionalString(formData.get("authorizedPersonSignature"))
            ? {
                employeeName: `Unternehmen · ${
                  optionalString(formData.get("authorizedPersonName")) ??
                  optionalString(
                    formData.get("authorizedPersonSignatureSignerName"),
                  )
                }`,
                signatureDataUrl: optionalString(
                  formData.get("authorizedPersonSignature"),
                ),
              }
            : null,
          ...[
            ["Sicherheitsunterweisung durchgeführt", "earthSafetyConductedSignature"],
            ["Sicherheitsunterweisung erhalten", "earthSafetyReceivedSignature"],
            ["Technische Einweisung durchgeführt", "earthTechnicalConductedSignature"],
            ["Technische Einweisung erhalten", "earthTechnicalReceivedSignature"],
            ["Fahrtraining / Eignungstest durchgeführt", "earthTrainingConductedSignature"],
            ["Fahrtraining / Eignungstest erhalten", "earthTrainingReceivedSignature"],
          ].map(([employeeName, fieldName]) => {
            const signatureDataUrl = optionalString(formData.get(fieldName));
            const signerName = optionalString(
              formData.get(`${fieldName}SignerName`),
            );
            return signatureDataUrl
              ? {
                  employeeName: signerName
                    ? `${employeeName} · ${signerName}`
                    : employeeName,
                  signatureDataUrl,
                }
              : null;
          }),
        ]
      : [
          ...externalParticipants.map((participant) => ({
            employeeName: `Extern · ${participant.company || "Ohne Firmenangabe"} · ${participant.lastName}, ${participant.firstName}`,
            signatureDataUrl: participant.signatureDataUrl,
          })),
          optionalString(formData.get("presenterSignatureDataUrl"))
            ? {
                employeeName: `Vortragende Person · ${
                  optionalString(formData.get("instructedByName")) ??
                  "Nicht angegeben"
                }`,
                signatureDataUrl: optionalString(
                  formData.get("presenterSignatureDataUrl"),
                ),
              }
            : null,
        ]
  ).filter(
          (
            entry,
          ): entry is {
            employeeName: string;
            signatureDataUrl: string | null;
          } => Boolean(entry),
        );
  const isFullySigned =
    employeesWithSignatures.every(
      ({ signatureDataUrl }) => Boolean(signatureDataUrl),
    ) &&
    externalSignatures.every(({ signatureDataUrl }) =>
      Boolean(signatureDataUrl),
    );

  const record = await prisma.safetyInstructionRecord.create({
    data: {
      checkedSectionsJson: JSON.stringify(checkedSections),
      instructedByName: optionalString(formData.get("instructedByName")),
      instructionDate,
      notes: recordNotes || null,
      previousVersion: previousVersionId
        ? { connect: { id: previousVersionId } }
        : undefined,
      project: projectId
        ? {
            connect: {
              id: projectId,
            },
          }
        : undefined,
      projectSnapshot: project
        ? `${project.projectNumber} · ${project.name}`
        : null,
      signatures: {
        create: [
          ...employeesWithSignatures.map(
            ({ employee, signatureDataUrl }) => ({
              employee: {
                connect: {
                  id: employee.id,
                },
              },
              employeeName: `${employee.lastName}, ${employee.firstName}`,
              signatureDataUrl,
              signedAt: signatureDataUrl ? new Date() : null,
            }),
          ),
          ...externalSignatures.map((entry) => ({
            employeeName: entry.employeeName,
            signatureDataUrl: entry.signatureDataUrl,
            signedAt: entry.signatureDataUrl ? new Date() : null,
          })),
        ],
      },
      status: isFullySigned ? "SIGNED" : "OPEN",
      validityMonths,
      validUntil,
      template: {
        connect: {
          id: templateId,
        },
      },
    },
  });

  await Promise.all(
    employeesWithSignatures
      .filter(({ signatureDataUrl }) => Boolean(signatureDataUrl))
      .map(({ employee }) =>
        prisma.employeeTrainingRecord.upsert({
          create: {
            employeeId: employee.id,
            notes: `Automatisch aus Arbeitssicherheit · /safety/instruction-records/${record.id}`,
            safetySourceKey: `safety-record:${record.id}:${employee.id}`,
            topic: template.title,
            trainingDate: instructionDate,
            type:
              template.type === "COMMISSION"
                ? "Beauftragung"
                : template.type === "RISK_ASSESSMENT"
                  ? "Gefährdungsbeurteilung"
                  : "Betriebsanweisung / Unterweisung",
            validityMonths,
            validUntil,
          },
          update: {
            topic: template.title,
            trainingDate: instructionDate,
            validityMonths,
            validUntil,
          },
          where: {
            safetySourceKey: `safety-record:${record.id}:${employee.id}`,
          },
        }),
      ),
  );

  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/operating-instructions");
  revalidatePath("/safety/commissions");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
  for (const employee of employees) {
    revalidatePath(`/employees/certificates/${employee.id}`);
  }

  const redirectTo = optionalString(formData.get("redirectTo"));
  if (
    isFullySigned &&
    (redirectTo === "/safety/operating-instructions" ||
      redirectTo === "/safety/risk-assessments" ||
      redirectTo === "/safety/commissions")
  ) {
    redirect(redirectTo);
  }
  redirect(`/safety/instruction-records/${record.id}`);
}

async function safetyValidityMonths(folderId: string | null) {
  let currentId = folderId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = await prisma.safetyTemplateFolder.findUnique({
      select: { defaultValidityMonths: true, parentId: true },
      where: { id: currentId },
    });
    if (!folder) break;
    if (folder.defaultValidityMonths) return folder.defaultValidityMonths;
    currentId = folder.parentId;
  }
  return 12;
}

export async function archiveSafetyInstructionRecord(formData: FormData) {
  await requireSession();
  const recordId = requiredString(formData.get("recordId"), "Nachweis");
  await prisma.safetyInstructionRecord.update({
    data: { archivedAt: new Date() },
    where: { id: recordId },
  });
  revalidatePath("/safety/commissions");
  revalidatePath("/safety/commissions/archive");
}

export async function restoreSafetyInstructionRecord(formData: FormData) {
  await requireSession();
  const recordId = requiredString(formData.get("recordId"), "Nachweis");
  await prisma.safetyInstructionRecord.update({
    data: { archivedAt: null },
    where: { id: recordId },
  });
  revalidatePath("/safety/commissions");
  revalidatePath("/safety/commissions/archive");
}

export async function permanentlyDeleteSafetyInstructionRecord(formData: FormData) {
  await requireAdmin();
  const recordId = requiredString(formData.get("recordId"), "Nachweis");
  const record = await prisma.safetyInstructionRecord.findUnique({
    select: { archivedAt: true },
    where: { id: recordId },
  });
  if (!record?.archivedAt) {
    throw new Error("Nur archivierte Nachweise können endgültig gelöscht werden.");
  }
  await prisma.safetyInstructionRecord.delete({ where: { id: recordId } });
  revalidatePath("/safety/commissions/archive");
}

export async function saveSafetyInstructionSignature(
  recordId: string,
  signatureId: string,
  formData: FormData,
) {
  await requireSession();
  const signatureDataUrl = requiredString(
    formData.get("signatureDataUrl"),
    "Unterschrift",
  );

  await prisma.safetyInstructionSignature.update({
    where: {
      id: signatureId,
    },
    data: {
      signatureDataUrl,
      signedAt: new Date(),
    },
  });

  const openSignatures = await prisma.safetyInstructionSignature.count({
    where: {
      recordId,
      signatureDataUrl: null,
    },
  });

  if (openSignatures === 0) {
    await prisma.safetyInstructionRecord.update({
      where: {
        id: recordId,
      },
      data: {
        status: "SIGNED",
      },
    });
  }

  revalidatePath(`/safety/instruction-records/${recordId}`);
}

export async function addSafetyInstructionParticipants(
  recordId: string,
  formData: FormData,
) {
  await requireSession();
  const employeeIds = Array.from(
    new Set(
      formData
        .getAll("employeeIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  if (!employeeIds.length) return;
  const [existing, employees] = await Promise.all([
    prisma.safetyInstructionSignature.findMany({
      select: { employeeId: true },
      where: { recordId },
    }),
    prisma.employee.findMany({
      select: { firstName: true, id: true, lastName: true },
      where: { id: { in: employeeIds } },
    }),
  ]);
  const existingIds = new Set(existing.map((entry) => entry.employeeId));
  const additions = employees.filter((employee) => !existingIds.has(employee.id));
  if (additions.length) {
    await prisma.$transaction([
      prisma.safetyInstructionSignature.createMany({
        data: additions.map((employee) => ({
          employeeId: employee.id,
          employeeName: `${employee.lastName}, ${employee.firstName}`,
          recordId,
        })),
      }),
      prisma.safetyInstructionRecord.update({
        data: { status: "OPEN" },
        where: { id: recordId },
      }),
    ]);
  }
  revalidatePath(`/safety/instruction-records/${recordId}`);
  revalidatePath("/safety/operating-instructions");
}

const safetyTemplateAreas = [
  "COMMISSION",
  "OPERATING_INSTRUCTION",
  "RISK_ASSESSMENT",
] as const;

function safetyTemplateArea(value: FormDataEntryValue | null) {
  const area = requiredString(value, "Bereich");
  if (!safetyTemplateAreas.includes(area as (typeof safetyTemplateAreas)[number])) {
    throw new Error("Unbekannter Vorlagenbereich.");
  }
  return area;
}

function safeUploadName(value: string) {
  const extension = path.extname(value).toLowerCase();
  const stem = path
    .basename(value, extension)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${stem || "vorlage"}-${randomUUID()}${extension}`;
}

function revalidateSafetyLibraries() {
  revalidatePath("/safety/commissions");
  revalidatePath("/safety/operating-instructions");
  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/risk-assessments/templates");
}

export async function createSafetyTemplateFolder(formData: FormData) {
  await requireSession();
  const area = safetyTemplateArea(formData.get("area"));
  const name = requiredString(formData.get("name"), "Ordnername");
  const parentId = optionalString(formData.get("parentId"));

  if (parentId) {
    const parent = await prisma.safetyTemplateFolder.findUnique({
      select: { area: true },
      where: { id: parentId },
    });
    if (!parent || parent.area !== area) {
      throw new Error("Der übergeordnete Ordner gehört nicht zu diesem Bereich.");
    }
  }

  const defaultValidityMonths = positiveIntegerOrNull(
    formData.get("defaultValidityMonths"),
  );
  await prisma.safetyTemplateFolder.create({
    data: { area, defaultValidityMonths, name, parentId },
  });
  revalidateSafetyLibraries();
}

export async function updateSafetyTemplateFolderValidity(formData: FormData) {
  await requireSession();
  const folderId = requiredString(formData.get("folderId"), "Ordner");
  await prisma.safetyTemplateFolder.update({
    data: {
      defaultValidityMonths: positiveIntegerOrNull(
        formData.get("defaultValidityMonths"),
      ),
    },
    where: { id: folderId },
  });
  revalidateSafetyLibraries();
}

export async function renameSafetyTemplateFolder(formData: FormData) {
  await requireSession();
  const folderId = requiredString(formData.get("folderId"), "Ordner");
  const name = requiredString(formData.get("name"), "Ordnername");
  await prisma.safetyTemplateFolder.update({
    data: { name },
    where: { id: folderId },
  });
  revalidateSafetyLibraries();
}

export async function moveSafetyTemplateFolder(formData: FormData) {
  await requireSession();
  const folderId = requiredString(formData.get("folderId"), "Ordner");
  const parentId = optionalString(formData.get("parentId"));
  if (parentId === folderId) {
    throw new Error("Ein Ordner kann nicht in sich selbst verschoben werden.");
  }
  const folder = await prisma.safetyTemplateFolder.findUniqueOrThrow({
    select: { area: true },
    where: { id: folderId },
  });
  if (parentId) {
    let currentId: string | null = parentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === folderId) {
        throw new Error(
          "Ein Ordner kann nicht in einen eigenen Unterordner verschoben werden.",
        );
      }
      if (visited.has(currentId)) {
        throw new Error("Die Ordnerstruktur enthält bereits einen Kreis.");
      }
      visited.add(currentId);
      const current: { area: string; parentId: string | null } | null =
        await prisma.safetyTemplateFolder.findUnique({
          select: { area: true, parentId: true },
          where: { id: currentId },
        });
      if (!current || current.area !== folder.area) {
        throw new Error("Der Zielordner gehört nicht zum selben Bereich.");
      }
      currentId = current.parentId;
    }
  }
  await prisma.safetyTemplateFolder.update({
    data: { parentId },
    where: { id: folderId },
  });
  revalidateSafetyLibraries();
}

export async function deleteSafetyTemplateFolder(formData: FormData) {
  await requireSession();
  const folderId = requiredString(formData.get("folderId"), "Ordner");
  const folder = await prisma.safetyTemplateFolder.findUniqueOrThrow({
    include: {
      _count: {
        select: { children: true, templates: true },
      },
    },
    where: { id: folderId },
  });
  if (folder._count.children || folder._count.templates) {
    throw new Error(
      "Der Ordner ist nicht leer. Verschiebe oder entferne zuerst alle Unterordner und Vorlagen.",
    );
  }
  if (folder.systemKey) {
    await prisma.safetyTemplateFolder.update({
      data: { isDeleted: true },
      where: { id: folderId },
    });
  } else {
    await prisma.safetyTemplateFolder.delete({ where: { id: folderId } });
  }
  revalidateSafetyLibraries();
}

export async function moveSafetyDocumentTemplate(formData: FormData) {
  await requireSession();
  const templateId = requiredString(formData.get("templateId"), "Vorlage");
  const folderId = requiredString(formData.get("folderId"), "Zielordner");
  const [template, folder] = await Promise.all([
    prisma.safetyInstructionTemplate.findUnique({
      select: { type: true },
      where: { id: templateId },
    }),
    prisma.safetyTemplateFolder.findUnique({
      select: { area: true },
      where: { id: folderId },
    }),
  ]);
  if (!template || !folder || template.type !== folder.area) {
    throw new Error("Vorlage und Zielordner gehören nicht zum selben Bereich.");
  }
  await prisma.safetyInstructionTemplate.update({
    data: { folderId },
    where: { id: templateId },
  });
  revalidateSafetyLibraries();
}

export async function uploadSafetyDocumentTemplate(formData: FormData) {
  await requireSession();
  const area = safetyTemplateArea(formData.get("area"));
  const title = requiredString(formData.get("title"), "Titel");
  const folderId = requiredString(formData.get("folderId"), "Ordner");
  const pdf = formData.get("pdfFile");
  const docx = formData.get("docxFile");
  if (!(pdf instanceof File) || pdf.size === 0) {
    throw new Error("Für die Webansicht muss eine PDF-Datei hochgeladen werden.");
  }
  if (
    path.extname(pdf.name).toLowerCase() !== ".pdf" ||
    (pdf.type && pdf.type !== "application/pdf")
  ) {
    throw new Error("Die Ansichtsdatei muss eine PDF-Datei sein.");
  }
  if (
    docx instanceof File &&
    docx.size > 0 &&
    path.extname(docx.name).toLowerCase() !== ".docx"
  ) {
    throw new Error("Als bearbeitbare Datei ist nur DOCX zulässig.");
  }
  const folder = await prisma.safetyTemplateFolder.findUnique({
    select: { area: true },
    where: { id: folderId },
  });
  if (!folder || folder.area !== area) {
    throw new Error("Der ausgewählte Ordner gehört nicht zu diesem Bereich.");
  }

  const templateId = randomUUID();
  const pdfName = safeUploadName(pdf.name);
  const pdfUploaded = await putFile(
    STORAGE_BUCKET,
    `safety-templates/${templateId}/${pdfName}`,
    Buffer.from(await pdf.arrayBuffer()),
    "application/pdf",
  );
  const sourcePdfPath = pdfUploaded.publicUrl;
  let sourceDocxPath: string | null = null;
  if (docx instanceof File && docx.size > 0) {
    const docxName = safeUploadName(docx.name);
    const docxUploaded = await putFile(
      STORAGE_BUCKET,
      `safety-templates/${templateId}/${docxName}`,
      Buffer.from(await docx.arrayBuffer()),
      docx.type || "application/octet-stream",
    );
    sourceDocxPath = docxUploaded.publicUrl;
  }

  const sections =
    area === "OPERATING_INSTRUCTION"
      ? [
          "Betriebsanweisung gemeinsam gelesen und erläutert",
          "Gefahren für Mensch und Umwelt",
          "Schutzmaßnahmen und Verhaltensregeln",
          "Verhalten bei Störungen und im Gefahrfall",
          "Erste Hilfe",
          "Instandhaltung, Wartung und sachgerechter Abschluss",
        ]
      : area === "COMMISSION"
        ? [
            "Aufgaben und Verantwortungsbereich erläutert",
            "Voraussetzungen und Fachkunde geprüft",
            "Rechte, Pflichten und Befugnisse bestätigt",
            "Originalvorlage gemeinsam gelesen",
          ]
        : [
          "Gefährdungen und betroffene Tätigkeiten erläutert",
          "Schutzmaßnahmen und Verantwortlichkeiten festgelegt",
          "Wirksamkeitskontrolle besprochen",
          "Teilnehmende Mitarbeiter unterwiesen",
        ];

  await prisma.safetyInstructionTemplate.create({
    data: {
      content: `SOURCE_PDF:${sourcePdfPath}${
        sourceDocxPath ? `\nSOURCE_DOCX:${sourceDocxPath}` : ""
      }`,
      description: optionalString(formData.get("description")),
      folderId,
      id: templateId,
      sectionsJson: JSON.stringify(sections),
      sourceDocxPath,
      sourcePdfPath,
      title,
      type: area,
    },
  });
  revalidateSafetyLibraries();
}
