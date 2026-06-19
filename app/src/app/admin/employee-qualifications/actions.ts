"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const allowedCategories = new Set([
  "DRIVER_LICENSE",
  "MACHINE_LICENSE",
  "OTHER",
]);

const documentTypeLabels: Record<string, string> = {
  DRIVER_LICENSE: "Führerschein",
  EARTHMOVING_MACHINE_LICENSE: "Erdbaumaschinenschein",
  CRANE_LICENSE: "Kranschein",
  FORKLIFT_LICENSE: "Staplerschein",
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function positiveInteger(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function revalidateQualificationViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/employee-qualifications");
  revalidatePath("/dashboard");
}

export async function createQualificationType(formData: FormData) {
  const name = text(formData.get("name"));
  const requestedCategory = text(formData.get("category"));

  if (!name) {
    throw new Error("Bezeichnung fehlt.");
  }

  await prisma.employeeQualificationType.create({
    data: {
      category: allowedCategories.has(requestedCategory)
        ? requestedCategory
        : "OTHER",
      description: text(formData.get("description")) || null,
      isActive: true,
      name,
      reviewIntervalMonths: positiveInteger(
        formData.get("reviewIntervalMonths"),
        6,
      ),
      sortOrder: positiveInteger(formData.get("sortOrder"), 999),
    },
  });

  revalidateQualificationViews();
}

export async function updateQualificationType(formData: FormData) {
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const requestedCategory = text(formData.get("category"));

  if (!id || !name) {
    throw new Error("Berechtigung und Bezeichnung sind Pflichtfelder.");
  }

  await prisma.employeeQualificationType.update({
    where: {
      id,
    },
    data: {
      category: allowedCategories.has(requestedCategory)
        ? requestedCategory
        : "OTHER",
      description: text(formData.get("description")) || null,
      isActive: formData.get("isActive") === "on",
      name,
      reviewIntervalMonths: positiveInteger(
        formData.get("reviewIntervalMonths"),
        6,
      ),
      sortOrder: positiveInteger(formData.get("sortOrder"), 999),
    },
  });

  revalidateQualificationViews();
}

export async function saveEmployeeQualifications(formData: FormData) {
  const employeeId = text(formData.get("employeeId"));
  const qualificationTypeIds = Array.from(
    new Set(
      formData
        .getAll("qualificationTypeIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  const validTypes = await prisma.employeeQualificationType.findMany({
    where: {
      id: {
        in: qualificationTypeIds,
      },
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const validTypeIds = validTypes.map((type) => type.id);

  await prisma.$transaction(async (transaction) => {
    await transaction.employeeQualification.deleteMany({
      where: {
        employeeId,
        qualificationTypeId: {
          notIn: validTypeIds,
        },
      },
    });

    for (const qualificationTypeId of validTypeIds) {
      await transaction.employeeQualification.upsert({
        where: {
          employeeId_qualificationTypeId: {
            employeeId,
            qualificationTypeId,
          },
        },
        create: {
          employeeId,
          qualificationTypeId,
        },
        update: {},
      });
    }
  });

  revalidateQualificationViews();
}

export async function confirmEmployeeQualificationReview(formData: FormData) {
  const employeeId = text(formData.get("employeeId"));

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  const result = await prisma.employeeQualification.updateMany({
    where: {
      employeeId,
    },
    data: {
      lastReviewedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return {
      reviewed: false,
    };
  }

  revalidateQualificationViews();

  return {
    reviewed: true,
  };
}

export async function uploadEmployeeQualificationDocuments(formData: FormData) {
  const employeeId = text(formData.get("employeeId"));
  const requestedDocumentType = text(formData.get("documentType"));
  const customDocumentType = text(formData.get("customDocumentType"));
  const documentType =
    requestedDocumentType in documentTypeLabels ? requestedDocumentType : "OTHER";
  const displayName =
    documentType === "OTHER"
      ? customDocumentType
      : documentTypeLabels[documentType];
  const files = formData
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  if (files.length === 0) {
    throw new Error("Bitte mindestens eine Datei auswählen.");
  }

  if (!displayName) {
    throw new Error("Bitte die eigene Dokumentbezeichnung eintragen.");
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
    select: {
      id: true,
    },
  });

  if (!employee) {
    throw new Error("Mitarbeiter wurde nicht gefunden.");
  }

  const targetDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "employee-qualifications",
    employeeId,
  );
  await mkdir(targetDirectory, { recursive: true });

  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error(`"${file.name}" ist größer als 25 MB.`);
    }

    const extension = getFileExtension(file);
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const storagePath = path.join(
      "public",
      "uploads",
      "employee-qualifications",
      employeeId,
      fileName,
    );
    const publicUrl = `/uploads/employee-qualifications/${employeeId}/${fileName}`;
    const originalFileName = cleanFileName(file.name);

    await writeFile(
      path.join(targetDirectory, fileName),
      Buffer.from(await file.arrayBuffer()),
    );

    await prisma.employeeQualificationDocument.create({
      data: {
        displayName,
        documentType,
        employeeId,
        fileName,
        fileSizeBytes: file.size,
        mimeType: file.type || "application/octet-stream",
        originalFileName,
        publicUrl,
        qualificationTypeId: null,
        storagePath,
      },
    });
  }

  revalidateQualificationViews();
}

export async function deleteEmployeeQualificationDocument(formData: FormData) {
  const id = text(formData.get("id"));

  if (!id) {
    throw new Error("Dokument-ID fehlt.");
  }

  const document = await prisma.employeeQualificationDocument.findUnique({
    where: {
      id,
    },
    select: {
      storagePath: true,
    },
  });

  if (!document) {
    return;
  }

  await prisma.employeeQualificationDocument.delete({
    where: {
      id,
    },
  });

  try {
    await unlink(path.join(process.cwd(), document.storagePath));
  } catch {
    // Die Datenbank bleibt führend, falls eine Datei bereits extern fehlt.
  }

  revalidateQualificationViews();
}

function cleanFileName(value: string) {
  return value.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (/^[a-z0-9]{1,8}$/.test(extension)) {
    return extension;
  }

  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";

  return "bin";
}
