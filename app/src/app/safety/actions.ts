"use server";

import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  nextHazardSequentialNumber,
  readHazardRegisterTemplate,
} from "@/lib/hazard-register";
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
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
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

  const templateDir = path.join(process.cwd(), "public", "templates");
  await mkdir(templateDir, {
    recursive: true,
  });

  await writeFile(
    path.join(templateDir, fileName),
    Buffer.from(await file.arrayBuffer()),
  );
}

export async function replaceSafetyPdfTemplate(formData: FormData) {
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

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "safety-accidents",
    reportId,
  );

  await mkdir(uploadDir, {
    recursive: true,
  });

  const photoRows = [];

  for (const file of usableFiles) {
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${fileExtension(file)}`;
    const storagePath = path.join(uploadDir, fileName);
    const publicUrl = `/uploads/safety-accidents/${reportId}/${fileName}`;

    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

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

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    documentType === "BA" ? "safety-operating-instructions" : "safety-data-sheets",
    substanceId,
  );

  await mkdir(uploadDir, {
    recursive: true,
  });

  const rows = [];

  for (const file of usableFiles) {
    const originalExtension = path.extname(file.name || "").toLowerCase();
    const extension = originalExtension || (file.type === "application/pdf" ? ".pdf" : fileExtension(file));
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;
    const storagePath = path.join(uploadDir, fileName);
    const publicUrl = `/uploads/${
      documentType === "BA"
        ? "safety-operating-instructions"
        : "safety-data-sheets"
    }/${substanceId}/${fileName}`;

    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

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
  const data = await accidentReportData(formData);
  const { employeeRelation, projectRelation, ...reportData } = data;

  const report = await prisma.safetyAccidentReport.create({
    data: {
      ...reportData,
      employee: employeeRelation,
      project: projectRelation,
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
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  await prisma.safetyHazardousSubstance.update({
    data: { isActive: false },
    where: { id },
  });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function archiveTemplateHazardousSubstance(formData: FormData) {
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
  const id = requiredString(formData.get("id"), "Gefahrstoff");
  await prisma.safetyHazardousSubstance.update({
    data: { isActive: true },
    where: { id },
  });
  revalidatePath("/safety/hazardous-substances");
  revalidatePath("/safety/hazardous-substances/archive");
}

export async function deleteHazardousSubstancePermanently(formData: FormData) {
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

  const allowedRoots = ["safety-data-sheets", "safety-operating-instructions"].map(
    (folder) =>
      path.resolve(process.cwd(), "public", "uploads", folder),
  );
  const storedPath = path.resolve(document.storagePath);
  if (
    !allowedRoots.some((root) => storedPath.startsWith(`${root}${path.sep}`))
  ) {
    throw new Error("Ungültiger Speicherort des Sicherheitsdatenblatts.");
  }

  await prisma.safetyDataSheet.delete({ where: { id } });
  await rm(storedPath, { force: true });

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
  const templateId = requiredString(formData.get("templateId"), "Vorlage");
  const employeeIds = formData
    .getAll("employeeIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (employeeIds.length === 0) {
    throw new Error("Bitte mindestens einen Mitarbeiter auswählen.");
  }

  const [template, project, employees] = await Promise.all([
    prisma.safetyInstructionTemplate.findUniqueOrThrow({
      where: {
        id: templateId,
      },
      select: {
        title: true,
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

  const projectId = optionalString(formData.get("projectId"));
  const checkedSections = formData
    .getAll("checkedSections")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const record = await prisma.safetyInstructionRecord.create({
    data: {
      checkedSectionsJson: JSON.stringify(checkedSections),
      instructedByName: optionalString(formData.get("instructedByName")),
      instructionDate: dateValue(formData.get("instructionDate"), "Datum"),
      notes: optionalString(formData.get("notes")),
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
        create: employees.map((employee) => ({
          employee: {
            connect: {
              id: employee.id,
            },
          },
          employeeName: `${employee.lastName}, ${employee.firstName}`,
        })),
      },
      status: "OPEN",
      template: {
        connect: {
          id: templateId,
        },
      },
    },
  });

  revalidatePath("/safety/risk-assessments");
  revalidatePath("/safety/operating-instructions");
  redirect(`/safety/instruction-records/${record.id}`);
}

export async function saveSafetyInstructionSignature(
  recordId: string,
  signatureId: string,
  formData: FormData,
) {
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
