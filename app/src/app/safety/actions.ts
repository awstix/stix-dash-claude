"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

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

async function saveSafetyDataSheets(substanceId: string, files: File[], versionDate: Date | null) {
  const usableFiles = files.filter((file) => file.size > 0);

  if (usableFiles.length === 0) {
    return;
  }

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "safety-data-sheets",
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
    const publicUrl = `/uploads/safety-data-sheets/${substanceId}/${fileName}`;

    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

    rows.push({
      displayName: file.name || "Sicherheitsdatenblatt",
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

export async function createHazardousSubstance(formData: FormData) {
  const substance = await prisma.safetyHazardousSubstance.create({
    data: {
      category: optionalString(formData.get("category")),
      disposalNotes: optionalString(formData.get("disposalNotes")),
      firstAidMeasures: optionalString(formData.get("firstAidMeasures")),
      hStatements: optionalString(formData.get("hStatements")),
      hazardSymbols: optionalString(formData.get("hazardSymbols")),
      isActive: true,
      manufacturer: optionalString(formData.get("manufacturer")),
      name: requiredString(formData.get("name"), "Gefahrstoff"),
      notes: optionalString(formData.get("notes")),
      pStatements: optionalString(formData.get("pStatements")),
      protectiveMeasures: optionalString(formData.get("protectiveMeasures")),
      responsibleName: optionalString(formData.get("responsibleName")),
      signalWord: optionalString(formData.get("signalWord")),
      storagePlace: optionalString(formData.get("storagePlace")),
      usageArea: optionalString(formData.get("usageArea")),
    },
  });

  const files = formData
    .getAll("safetyDataSheets")
    .filter((entry): entry is File => entry instanceof File);

  await saveSafetyDataSheets(
    substance.id,
    files,
    optionalDateValue(formData.get("versionDate")),
  );

  revalidatePath("/safety");
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
