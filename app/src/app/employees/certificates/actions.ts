"use server";

import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { deleteFile, putFile, signedUrl } from "@/lib/storage";
import { floatValue } from "@/lib/import-value-parsing";

const STORAGE_BUCKET = "uploads";

type ExcelRow = Record<string, unknown>;
type ImportErrorRow = {
  Abteilung: string;
  Anbieter: string;
  Bemerkung: string;
  "Buchung am": string;
  Buchungsbestätigung: string;
  "Datum der Schulung": string;
  Dauer: string;
  Fehler: string;
  Firma: string;
  Gültigkeit: string;
  Nachname: string;
  "Nr.": string;
  Ort: string;
  "Thema Kurs": string;
  Typ: string;
  Vorname: string;
  "Zertifikat erhalten": string;
  "gültig bis": string;
};

const allowedTrainingDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]/g, "");
}

function getEmployeeImportKey(firstName: string, lastName: string) {
  return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
}

function getRawCell(row: ExcelRow, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.includes(normalizeHeader(key))) {
      return value;
    }
  }

  return "";
}

function getCell(row: ExcelRow, aliases: string[]) {
  return String(getRawCell(row, aliases) ?? "").trim();
}

function getOptionalCell(row: ExcelRow, aliases: string[]) {
  const value = getCell(row, aliases);
  return value.length ? value : null;
}

function getOptionalNumberCell(row: ExcelRow, aliases: string[]) {
  const direct = floatValue(getRawCell(row, aliases));
  if (direct !== null) return direct;

  // Fallback: cell has extra text around the number (e.g. "5 Jahre") - pull
  // the first number-like substring out and parse that instead.
  const value = getCell(row, aliases);
  const match = value.match(/[-+]?\d+(?:\.\d+)?/);
  return match ? floatValue(match[0]) : null;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value ?? "").trim();

  if (!text) return null;

  const germanDateMatch = text.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/,
  );

  if (germanDateMatch) {
    const day = Number(germanDateMatch[1]);
    const month = Number(germanDateMatch[2]);
    const rawYear = Number(germanDateMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }

    return null;
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoDateMatch) {
    const year = Number(isoDateMatch[1]);
    const month = Number(isoDateMatch[2]);
    const day = Number(isoDateMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }

    return null;
  }

  return null;
}

function getOptionalDateCell(row: ExcelRow, aliases: string[]) {
  return parseDateValue(getRawCell(row, aliases));
}

function getImportErrorRow(row: ExcelRow, error: string): ImportErrorRow {
  return {
    Abteilung: getCell(row, ["Abteilung"]),
    Anbieter: getCell(row, ["Anbieter"]),
    Bemerkung: getCell(row, ["Bemerkung"]),
    "Buchung am": getCell(row, ["Buchung am"]),
    Buchungsbestätigung: getCell(row, [
      "Buchungsbestätigung",
      "Buchungsbestätigung ",
      "Buchungs betstätigung",
    ]),
    "Datum der Schulung": getCell(row, [
      "Datum der Schulung",
      "Datum",
      "Schulungsdatum",
    ]),
    Dauer: getCell(row, ["Dauer [Tage]", "Dauer"]),
    Fehler: error,
    Firma: getCell(row, ["Firma"]),
    Gültigkeit: getCell(row, ["Gültigkeit"]),
    Nachname: getCell(row, ["Nachname"]),
    "Nr.": getCell(row, ["Nr.", "Nr"]),
    Ort: getCell(row, ["Ort"]),
    "Thema Kurs": getCell(row, ["Thema Kurs", "Kurs", "Schulung"]),
    Typ: getCell(row, ["Typ"]),
    Vorname: getCell(row, ["Vorname"]),
    "Zertifikat erhalten": getCell(row, ["Zertifikat erhalten"]),
    "gültig bis": getCell(row, ["gültig bis", "Gueltig bis"]),
  };
}

async function writeImportErrorWorkbook(errorRows: ImportErrorRow[]) {
  if (errorRows.length === 0) return null;

  const workbook = XLSX.utils.book_new();
  const headers = [
    "Fehler",
    "Firma",
    "Abteilung",
    "Nr.",
    "Anbieter",
    "Thema Kurs",
    "Datum der Schulung",
    "Typ",
    "Ort",
    "Dauer",
    "Vorname",
    "Nachname",
    "Buchung am",
    "Buchungsbestätigung",
    "Zertifikat erhalten",
    "Gültigkeit",
    "gültig bis",
    "Bemerkung",
  ];
  const sheet = XLSX.utils.json_to_sheet(errorRows, {
    header: headers,
  });

  sheet["!cols"] = headers.map((header) => ({
    wch: header === "Fehler" ? 36 : Math.min(34, Math.max(12, header.length + 4)),
  }));

  XLSX.utils.book_append_sheet(workbook, sheet, "Nicht importiert");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.xlsx`;
  const storagePath = `employee-training-import-errors/${fileName}`;
  await putFile(
    STORAGE_BUCKET,
    storagePath,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  return signedUrl(STORAGE_BUCKET, storagePath, 60 * 60);
}

function optionalDate(value: FormDataEntryValue | null) {
  return parseDateValue(value);
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");

  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function optionalInteger(value: FormDataEntryValue | null) {
  const number = optionalNumber(value);
  return number === null ? null : Math.trunc(number);
}

function calculateValidUntil(trainingDate: Date | null, validityMonths: number | null) {
  if (!trainingDate || !validityMonths) return null;

  const date = new Date(trainingDate);
  date.setMonth(date.getMonth() + validityMonths);
  date.setDate(date.getDate() - 1);
  return date;
}

function dateKey(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? "";
}

function isImplausibleValidUntil(date: Date | null) {
  return Boolean(date && date.getUTCFullYear() < 2000);
}

function hasFormValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().length > 0;
}

async function getFallbackValidityMonthsForTopic({
  excludeRecordId,
  topic,
  trainingTypeId,
}: {
  excludeRecordId?: string;
  topic: string;
  trainingTypeId?: string | null;
}) {
  const trainingType = trainingTypeId
    ? await prisma.employeeTrainingType.findUnique({
        where: {
          id: trainingTypeId,
        },
        select: {
          defaultValidityMonths: true,
        },
      })
    : await prisma.employeeTrainingType.findFirst({
        where: {
          topic,
          defaultValidityMonths: {
            not: null,
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          defaultValidityMonths: true,
        },
      });

  if (trainingType?.defaultValidityMonths) {
    return trainingType.defaultValidityMonths;
  }

  const [mostUsedValidity] = await prisma.employeeTrainingRecord.groupBy({
    by: ["validityMonths"],
    _count: {
      _all: true,
    },
    where: {
      id: excludeRecordId
        ? {
            not: excludeRecordId,
          }
        : undefined,
      topic,
      validityMonths: {
        not: null,
      },
    },
    orderBy: {
      _count: {
        validityMonths: "desc",
      },
    },
    take: 1,
  });

  return mostUsedValidity?.validityMonths ?? null;
}

function getTrainingPayload(formData: FormData) {
  const trainingDate = optionalDate(formData.get("trainingDate"));
  const validityYears = optionalInteger(formData.get("validityYears"));
  const validityMonths =
    (validityYears ? validityYears * 12 : null) ??
    optionalInteger(formData.get("validityMonths"));
  const explicitValidUntil = optionalDate(formData.get("validUntil"));

  return {
    bookedAt: optionalDate(formData.get("bookedAt")),
    bookingConfirmedAt: optionalDate(formData.get("bookingConfirmedAt")),
    certificateReceivedAt: optionalDate(formData.get("certificateReceivedAt")),
    durationDays: optionalNumber(formData.get("durationDays")),
    location: optionalString(formData.get("location")),
    notes: optionalString(formData.get("notes")),
    number: optionalString(formData.get("number")),
    provider: optionalString(formData.get("provider")),
    topic: optionalString(formData.get("topic")),
    trainingDate,
    type: optionalString(formData.get("type")),
    validityMonths,
    validUntil:
      explicitValidUntil ?? calculateValidUntil(trainingDate, validityMonths),
  };
}

function revalidateEmployeeTraining(employeeId: string) {
  revalidatePath("/employees/certificates");
  revalidatePath(`/employees/certificates/${employeeId}`);
  revalidatePath("/employees");
}

function revalidateTrainingViews(employeeIds: string[] = []) {
  revalidatePath("/employees/certificates");
  revalidatePath("/employees");

  for (const employeeId of employeeIds) {
    revalidatePath(`/employees/certificates/${employeeId}`);
  }
}

export async function createEmployeeTrainingType(formData: FormData) {
  await requireSession();
  const payload = getTrainingPayload(formData);

  if (!payload.topic) {
    throw new Error("Bitte ein Thema / einen Kurs eintragen.");
  }

  await prisma.employeeTrainingType.create({
    data: {
      defaultDurationDays: payload.durationDays,
      defaultLocation: payload.location,
      defaultValidityMonths: payload.validityMonths,
      number: payload.number,
      provider: payload.provider,
      topic: payload.topic,
      type: payload.type,
    },
  });

  revalidateTrainingViews();
}

export async function updateEmployeeTrainingType(formData: FormData) {
  await requireSession();
  const trainingTypeId = optionalString(formData.get("trainingTypeId"));
  const oldTopic = optionalString(formData.get("oldTopic"));
  const payload = getTrainingPayload(formData);

  if (!payload.topic) {
    throw new Error("Bitte ein Thema / einen Kurs eintragen.");
  }

  const newTopic = payload.topic;
  const existingTrainingType =
    trainingTypeId && !trainingTypeId.startsWith("import-topic:")
      ? await prisma.employeeTrainingType.findUnique({
          where: {
            id: trainingTypeId,
          },
          select: {
            id: true,
            topic: true,
          },
        })
      : null;
  const topicToUpdate =
    existingTrainingType?.topic ??
    (trainingTypeId?.startsWith("import-topic:")
      ? decodeURIComponent(trainingTypeId.replace("import-topic:", ""))
      : oldTopic);

  if (!topicToUpdate) {
    throw new Error("Schulungsvorlage fehlt.");
  }

  const affectedEmployeeConditions: Prisma.EmployeeTrainingRecordWhereInput[] =
    [
      {
        topic: topicToUpdate,
      },
    ];

  if (existingTrainingType?.id) {
    affectedEmployeeConditions.push({
      trainingTypeId: existingTrainingType.id,
    });
  }

  const affectedEmployees = await prisma.employeeTrainingRecord.findMany({
    where: {
      OR: affectedEmployeeConditions,
    },
    select: {
      employeeId: true,
    },
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const trainingType = existingTrainingType
      ? await tx.employeeTrainingType.update({
          where: {
            id: existingTrainingType.id,
          },
          data: {
            defaultDurationDays: payload.durationDays,
            defaultLocation: payload.location,
            defaultValidityMonths: payload.validityMonths,
            number: payload.number,
            provider: payload.provider,
            topic: newTopic,
            type: payload.type,
          },
          select: {
            id: true,
          },
        })
      : await tx.employeeTrainingType.create({
          data: {
            defaultDurationDays: payload.durationDays,
            defaultLocation: payload.location,
            defaultValidityMonths: payload.validityMonths,
            number: payload.number,
            provider: payload.provider,
            topic: newTopic,
            type: payload.type,
          },
          select: {
            id: true,
          },
        });

    await tx.employeeTrainingRecord.updateMany({
      where: {
        OR: affectedEmployeeConditions,
      },
      data: {
        durationDays: payload.durationDays,
        location: payload.location,
        number: payload.number,
        provider: payload.provider,
        topic: newTopic,
        trainingTypeId: trainingType.id,
        type: payload.type,
        validityMonths: payload.validityMonths,
      },
    });
  });

  revalidateTrainingViews(
    Array.from(new Set(affectedEmployees.map((employee) => employee.employeeId))),
  );
}

export async function deleteEmployeeTrainingType(formData: FormData) {
  await requireSession();
  const trainingTypeId = optionalString(formData.get("trainingTypeId"));
  const rawTopic = optionalString(formData.get("topic"));

  const trainingType =
    trainingTypeId && !trainingTypeId.startsWith("import-topic:")
      ? await prisma.employeeTrainingType.findUnique({
          where: {
            id: trainingTypeId,
          },
          select: {
            id: true,
            topic: true,
          },
        })
      : null;
  const topic =
    trainingType?.topic ??
    (trainingTypeId?.startsWith("import-topic:")
      ? decodeURIComponent(trainingTypeId.replace("import-topic:", ""))
      : rawTopic);

  if (!topic) {
    throw new Error("Schulungsvorlage fehlt.");
  }

  const affectedEmployeeConditions: Prisma.EmployeeTrainingRecordWhereInput[] =
    [
      {
        topic,
      },
    ];

  if (trainingType?.id) {
    affectedEmployeeConditions.push({
      trainingTypeId: trainingType.id,
    });
  }

  const affectedEmployees = await prisma.employeeTrainingRecord.findMany({
    where: {
      OR: affectedEmployeeConditions,
    },
    select: {
      employeeId: true,
    },
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.employeeTrainingRecord.deleteMany({
      where: {
        OR: affectedEmployeeConditions,
      },
    });

    if (trainingType?.id) {
      await tx.employeeTrainingType.delete({
        where: {
          id: trainingType.id,
        },
      });
    }
  });

  revalidateTrainingViews(
    Array.from(new Set(affectedEmployees.map((employee) => employee.employeeId))),
  );
}

async function resolveTrainingTypeSelection(trainingTypeId: string | null) {
  if (!trainingTypeId) return null;

  if (trainingTypeId.startsWith("import-topic:")) {
    const topic = decodeURIComponent(trainingTypeId.replace("import-topic:", ""));
    const record = await prisma.employeeTrainingRecord.findFirst({
      where: {
        topic,
      },
      orderBy: [{ trainingDate: "desc" }, { createdAt: "desc" }],
      select: {
        durationDays: true,
        location: true,
        number: true,
        provider: true,
        topic: true,
        type: true,
        validityMonths: true,
      },
    });

    return record
      ? {
          defaultDurationDays: record.durationDays,
          defaultLocation: record.location,
          defaultValidityMonths: record.validityMonths,
          id: null,
          number: record.number,
          provider: record.provider,
          topic: record.topic,
          type: record.type,
        }
      : null;
  }

  return prisma.employeeTrainingType.findUnique({
    where: {
      id: trainingTypeId,
    },
  });
}

export async function createEmployeeTrainingRecord(formData: FormData) {
  await requireSession();
  const employeeId = optionalString(formData.get("employeeId"));

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  const trainingTypeId = optionalString(formData.get("trainingTypeId"));
  const trainingType = await resolveTrainingTypeSelection(trainingTypeId);
  const payload = getTrainingPayload(formData);
  const trainingDate = payload.trainingDate;
  const validityYears = optionalInteger(formData.get("validityYears"));
  const validityMonths =
    (validityYears ? validityYears * 12 : null) ??
    optionalInteger(formData.get("validityMonths")) ??
    trainingType?.defaultValidityMonths ??
    null;
  const explicitValidUntil = payload.validUntil;
  const validUntil =
    explicitValidUntil ?? calculateValidUntil(trainingDate, validityMonths);
  const topic = payload.topic ?? trainingType?.topic;

  if (!topic) {
    throw new Error("Bitte ein Thema / einen Kurs eintragen.");
  }

  await prisma.employeeTrainingRecord.create({
    data: {
      bookedAt: optionalDate(formData.get("bookedAt")),
      bookingConfirmedAt: payload.bookingConfirmedAt,
      certificateReceivedAt: payload.certificateReceivedAt,
      durationDays:
        payload.durationDays ??
        trainingType?.defaultDurationDays ??
        null,
      employee: {
        connect: {
          id: employeeId,
        },
      },
      location:
        payload.location ??
        trainingType?.defaultLocation ??
        null,
      notes: payload.notes,
      number: payload.number ?? trainingType?.number ?? null,
      provider:
        payload.provider ?? trainingType?.provider ?? null,
      topic,
      trainingDate,
      trainingType: trainingType?.id
        ? {
            connect: {
              id: trainingType.id,
            },
          }
        : undefined,
      type: payload.type ?? trainingType?.type ?? null,
      validityMonths,
      validUntil,
    },
  });

  revalidateEmployeeTraining(employeeId);
}

export async function createEmployeeTrainingRecordsForParticipants(
  formData: FormData,
) {
  await requireSession();
  const employeeIds = formData
    .getAll("employeeIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (employeeIds.length === 0) {
    throw new Error("Bitte mindestens einen Teilnehmer auswählen.");
  }

  const trainingTypeId = optionalString(formData.get("trainingTypeId"));
  const trainingType = await resolveTrainingTypeSelection(trainingTypeId);
  const payload = getTrainingPayload(formData);
  const topic = payload.topic ?? trainingType?.topic;

  if (!topic) {
    throw new Error("Bitte eine Schulungsvorlage auswählen oder ein Thema eintragen.");
  }

  const validityMonths =
    payload.validityMonths ?? trainingType?.defaultValidityMonths ?? null;
  const validUntil =
    payload.validUntil ??
    calculateValidUntil(payload.trainingDate, validityMonths);

  await prisma.employeeTrainingRecord.createMany({
    data: employeeIds.map((employeeId) => ({
      bookedAt: payload.bookedAt,
      bookingConfirmedAt: payload.bookingConfirmedAt,
      certificateReceivedAt: payload.certificateReceivedAt,
      durationDays:
        payload.durationDays ?? trainingType?.defaultDurationDays ?? null,
      employeeId,
      location: payload.location ?? trainingType?.defaultLocation ?? null,
      notes: payload.notes,
      number: payload.number ?? trainingType?.number ?? null,
      provider: payload.provider ?? trainingType?.provider ?? null,
      topic,
      trainingDate: payload.trainingDate,
      trainingTypeId: trainingType?.id ?? null,
      type: payload.type ?? trainingType?.type ?? null,
      validityMonths,
      validUntil,
    })),
  });

  revalidateTrainingViews(employeeIds);
}

export async function updateEmployeeTrainingRecord(formData: FormData) {
  await requireSession();
  const id = optionalString(formData.get("id"));
  const employeeId = optionalString(formData.get("employeeId"));

  if (!id || !employeeId) {
    throw new Error("Schulung oder Mitarbeiter fehlt.");
  }

  const payload = getTrainingPayload(formData);
  const validUntilWasProvided = hasFormValue(formData.get("validUntil"));
  const validityWasProvided =
    hasFormValue(formData.get("validityYears")) ||
    hasFormValue(formData.get("validityMonths"));
  const existingRecord = await prisma.employeeTrainingRecord.findUnique({
    where: {
      id,
    },
    select: {
      trainingDate: true,
      trainingTypeId: true,
      validUntil: true,
      validityMonths: true,
    },
  });

  if (!existingRecord) {
    throw new Error("Schulung wurde nicht gefunden.");
  }

  if (!payload.topic) {
    throw new Error("Bitte ein Thema / einen Kurs eintragen.");
  }
  const fallbackValidityMonths =
    payload.validityMonths || existingRecord.validityMonths
      ? null
      : await getFallbackValidityMonthsForTopic({
          excludeRecordId: id,
          topic: payload.topic,
          trainingTypeId: existingRecord.trainingTypeId,
        });
  const validityMonths =
    payload.validityMonths ??
    existingRecord.validityMonths ??
    fallbackValidityMonths;
  const trainingDateChanged =
    dateKey(payload.trainingDate) !== dateKey(existingRecord.trainingDate);
  const validUntilWasManuallyChanged =
    validUntilWasProvided &&
    dateKey(payload.validUntil) !== dateKey(existingRecord.validUntil);
  const shouldRecalculateValidUntil =
    Boolean(validityMonths) &&
    (trainingDateChanged ||
      validityWasProvided ||
      !existingRecord.validUntil ||
      isImplausibleValidUntil(existingRecord.validUntil));
  const validUntil =
    validUntilWasManuallyChanged && payload.validUntil
      ? payload.validUntil
      : shouldRecalculateValidUntil
        ? calculateValidUntil(payload.trainingDate, validityMonths)
        : existingRecord.validUntil;

  await prisma.employeeTrainingRecord.update({
    where: {
      id,
    },
    data: {
      bookedAt: payload.bookedAt,
      bookingConfirmedAt: payload.bookingConfirmedAt,
      certificateReceivedAt: payload.certificateReceivedAt,
      durationDays: payload.durationDays,
      location: payload.location,
      notes: payload.notes,
      number: payload.number,
      provider: payload.provider,
      topic: payload.topic,
      trainingDate: payload.trainingDate,
      type: payload.type,
      validUntil,
      validityMonths,
    },
  });

  revalidateEmployeeTraining(employeeId);
}

export async function uploadEmployeeTrainingRecordDocument(formData: FormData) {
  await requireSession();
  const trainingRecordId = optionalString(formData.get("trainingRecordId"));
  const employeeId = optionalString(formData.get("employeeId"));
  const uploadedByName =
    optionalString(formData.get("uploadedByName")) ?? "Unbekannt";
  const notes = optionalString(formData.get("notes"));
  const files = formData
    .getAll("files")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (!trainingRecordId || !employeeId) {
    throw new Error("Schulung oder Mitarbeiter fehlt.");
  }

  if (files.length === 0) {
    throw new Error("Bitte mindestens eine Datei auswählen.");
  }

  const trainingRecord = await prisma.employeeTrainingRecord.findFirst({
    where: {
      employeeId,
      id: trainingRecordId,
    },
    select: {
      id: true,
    },
  });

  if (!trainingRecord) {
    throw new Error("Schulung wurde nicht gefunden.");
  }

  const documents = [];

  for (const file of files) {
    if (!allowedTrainingDocumentMimeTypes.has(file.type)) {
      throw new Error(
        "Nur PDF, JPG, PNG oder WebP können als Zertifikat hochgeladen werden.",
      );
    }

    const originalFileName = file.name || "zertifikat";
    const extension = path.extname(originalFileName).toLowerCase();
    const safeBaseName =
      sanitizeFileName(path.basename(originalFileName, extension)) ||
      "zertifikat";
    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${safeBaseName}${extension}`;
    const storagePath = `employee-training-certificates/${employeeId}/${trainingRecordId}/${fileName}`;

    const uploaded = await putFile(
      STORAGE_BUCKET,
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const publicUrl = uploaded.publicUrl;

    documents.push({
      displayName: originalFileName,
      employeeId,
      fileName,
      fileSizeBytes: file.size,
      mimeType: file.type,
      notes,
      originalFileName,
      publicUrl,
      storagePath,
      trainingRecordId,
      uploadedByName,
    });
  }

  await prisma.employeeTrainingRecordDocument.createMany({
    data: documents,
  });

  revalidateEmployeeTraining(employeeId);
}

export async function deleteEmployeeTrainingRecordDocument(formData: FormData) {
  await requireSession();
  const documentId = optionalString(formData.get("documentId"));
  const employeeId = optionalString(formData.get("employeeId"));

  if (!documentId || !employeeId) {
    throw new Error("Dokument oder Mitarbeiter fehlt.");
  }

  const document = await prisma.employeeTrainingRecordDocument.findFirst({
    where: {
      employeeId,
      id: documentId,
    },
    select: {
      storagePath: true,
    },
  });

  if (!document) {
    throw new Error("Dokument wurde nicht gefunden.");
  }

  await prisma.employeeTrainingRecordDocument.delete({
    where: {
      id: documentId,
    },
  });
  await deleteFile(STORAGE_BUCKET, document.storagePath).catch(() => undefined);

  revalidateEmployeeTraining(employeeId);
}

async function readExcelRows(file: File) {
  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    cellDates: true,
    type: "buffer",
  });
  const rows: ExcelRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      blankrows: false,
      defval: "",
      header: 1,
    });

    const headerIndex = matrix.findIndex((row) => {
      const headers = row.map((cell) => normalizeHeader(String(cell ?? "")));
      return (
        headers.includes("vorname") &&
        headers.includes("nachname") &&
        headers.some((header) => header.includes("themakurs"))
      );
    });

    if (headerIndex < 0) continue;

    const headers = matrix[headerIndex].map((cell) => String(cell ?? "").trim());
    let previousProvider = "";
    let previousTopic = "";
    let previousTrainingNumber = "";
    let previousType = "";
    let previousLocation = "";
    let previousDuration = "";
    let previousValidity = "";

    for (const row of matrix.slice(headerIndex + 1)) {
      const mappedRow: ExcelRow = {};

      headers.forEach((header, index) => {
        if (header) {
          mappedRow[header] = row[index] ?? "";
        }
      });

      const provider = getCell(mappedRow, ["Anbieter"]);
      const topic = getCell(mappedRow, ["Thema Kurs", "Kurs", "Schulung"]);
      const trainingNumber = getCell(mappedRow, ["Nr.", "Nr"]);
      const type = getCell(mappedRow, ["Typ"]);
      const location = getCell(mappedRow, ["Ort"]);
      const duration = getCell(mappedRow, ["Dauer [Tage]", "Dauer"]);
      const validity = getCell(mappedRow, ["Gültigkeit"]);

      if (provider) previousProvider = provider;
      if (topic) previousTopic = topic;
      if (trainingNumber) previousTrainingNumber = trainingNumber;
      if (type) previousType = type;
      if (location) previousLocation = location;
      if (duration) previousDuration = duration;
      if (validity) previousValidity = validity;

      if (!provider && previousProvider) mappedRow.Anbieter = previousProvider;
      if (!topic && previousTopic) mappedRow["Thema Kurs"] = previousTopic;
      if (!trainingNumber && previousTrainingNumber) mappedRow["Nr."] = previousTrainingNumber;
      if (!type && previousType) mappedRow.Typ = previousType;
      if (!location && previousLocation) mappedRow.Ort = previousLocation;
      if (!duration && previousDuration) mappedRow["Dauer [Tage]"] = previousDuration;
      if (!validity && previousValidity) mappedRow.Gültigkeit = previousValidity;

      rows.push(mappedRow);
    }
  }

  return rows;
}

export async function importEmployeeTrainingsFromExcel(formData: FormData) {
  await requireSession();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Excel-Datei auswählen.");
  }

  const rows = await readExcelRows(file);
  const employees = await prisma.employee.findMany({
    select: {
      firstName: true,
      id: true,
      lastName: true,
    },
  });
  const employeeByName = new Map(
    employees.map((employee) => [
      getEmployeeImportKey(employee.firstName, employee.lastName),
      employee,
    ]),
  );
  const records = [];
  const importErrorRows: ImportErrorRow[] = [];

  for (const row of rows) {
    const firstName = getOptionalCell(row, ["Vorname"]);
    const lastName = getOptionalCell(row, ["Nachname"]);
    const topic = getOptionalCell(row, ["Thema Kurs", "Kurs", "Schulung"]);

    if (!firstName || !lastName || !topic) {
      if (firstName || lastName || topic) {
        importErrorRows.push(
          getImportErrorRow(
            row,
            "Pflichtfelder fehlen: Vorname, Nachname oder Thema Kurs.",
          ),
        );
      }
      continue;
    }
    if (
      normalizeHeader(firstName) === "vorname" ||
      normalizeHeader(lastName) === "nachname"
    ) {
      continue;
    }

    const employee = employeeByName.get(getEmployeeImportKey(firstName, lastName));

    if (!employee) {
      importErrorRows.push(
        getImportErrorRow(
          row,
          `Mitarbeiter nicht gefunden: ${firstName} ${lastName}`,
        ),
      );
      continue;
    }

    const trainingDate = getOptionalDateCell(row, [
      "Datum der Schulung",
      "Datum",
      "Schulungsdatum",
    ]);
    const validityYears = getOptionalNumberCell(row, ["Gültigkeit"]);
    const validityMonths = validityYears ? Math.trunc(validityYears * 12) : null;
    const explicitValidUntil = getOptionalDateCell(row, [
      "gültig bis",
      "Gueltig bis",
    ]);

    records.push({
      bookedAt: getOptionalDateCell(row, ["Buchung am"]),
      bookingConfirmedAt: getOptionalDateCell(row, [
        "Buchungsbestätigung",
        "Buchungsbestätigung ",
        "Buchungs betstätigung",
      ]),
      certificateReceivedAt: getOptionalDateCell(row, ["Zertifikat erhalten"]),
      durationDays: getOptionalNumberCell(row, ["Dauer [Tage]", "Dauer"]),
      employeeId: employee.id,
      location: getOptionalCell(row, ["Ort"]),
      notes: null,
      number: getOptionalCell(row, ["Nr.", "Nr"]),
      provider: getOptionalCell(row, ["Anbieter"]),
      topic,
      trainingDate,
      trainingTypeId: null,
      type: getOptionalCell(row, ["Typ"]),
      validityMonths,
      validUntil:
        explicitValidUntil ?? calculateValidUntil(trainingDate, validityMonths),
      __importRow: row,
    });
  }

  if (records.length === 0) {
    const errorFile = await writeImportErrorWorkbook(importErrorRows);
    const params = new URLSearchParams({
      imported: "0",
      skipped: String(importErrorRows.length),
    });

    if (errorFile) {
      params.set("errorFile", errorFile);
    }

    redirect(`/employees/certificates?${params.toString()}`);
  }

  const existingRecords = await prisma.employeeTrainingRecord.findMany({
    where: {
      employeeId: {
        in: Array.from(new Set(records.map((record) => record.employeeId))),
      },
    },
    select: {
      employeeId: true,
      id: true,
      topic: true,
      trainingDate: true,
      validUntil: true,
      validityMonths: true,
    },
  });
  const existingByKey = new Map<string, (typeof existingRecords)[number]>(
    existingRecords.map(
      (record) =>
        [
          `${record.employeeId}|${record.topic.trim().toLowerCase()}|${
          record.trainingDate?.toISOString().slice(0, 10) ?? ""
          }`,
          record,
        ] as const,
    ),
  );
  const duplicateUpdates: {
    id: string;
    validUntil: Date | null;
    validityMonths: number | null;
  }[] = [];
  const newRecords = records.filter((record) => {
    const key = `${record.employeeId}|${record.topic.trim().toLowerCase()}|${
      record.trainingDate?.toISOString().slice(0, 10) ?? ""
    }`;
    const existingRecord = existingByKey.get(key);
    const isNew = !existingRecord;

    if (!isNew) {
      if (
        existingRecord &&
        (!existingRecord.validUntil || !existingRecord.validityMonths) &&
        (record.validUntil || record.validityMonths)
      ) {
        duplicateUpdates.push({
          id: existingRecord.id,
          validUntil: record.validUntil,
          validityMonths: record.validityMonths,
        });
      }

      importErrorRows.push(
        getImportErrorRow(
          record.__importRow,
          "Bereits vorhanden / Dublette. Fehlende Gültigkeit wurde nachgetragen, falls vorhanden.",
        ),
      );
    }

    return isNew;
  });

  if (newRecords.length > 0) {
    const trainingTypeIdsByTopic = new Map<string, string>();
    const trainingTypePayloads = new Map<
      string,
      {
        defaultDurationDays: number | null;
        defaultLocation: string | null;
        defaultValidityMonths: number | null;
        number: string | null;
        provider: string | null;
        topic: string;
        type: string | null;
      }
    >();

    for (const record of newRecords) {
      const key = record.topic.trim().toLowerCase();

      if (!trainingTypePayloads.has(key)) {
        trainingTypePayloads.set(key, {
          defaultDurationDays: record.durationDays,
          defaultLocation: record.location,
          defaultValidityMonths: record.validityMonths,
          number: record.number,
          provider: record.provider,
          topic: record.topic,
          type: record.type,
        });
      }
    }

    for (const payload of trainingTypePayloads.values()) {
      const trainingType = await prisma.employeeTrainingType.upsert({
        where: {
          topic: payload.topic,
        },
        create: {
          ...payload,
          isActive: true,
        },
        update: {
          defaultDurationDays: payload.defaultDurationDays ?? undefined,
          defaultLocation: payload.defaultLocation ?? undefined,
          defaultValidityMonths: payload.defaultValidityMonths ?? undefined,
          isActive: true,
          number: payload.number ?? undefined,
          provider: payload.provider ?? undefined,
          type: payload.type ?? undefined,
        },
        select: {
          id: true,
          topic: true,
        },
      });

      trainingTypeIdsByTopic.set(trainingType.topic.trim().toLowerCase(), trainingType.id);
    }

    await prisma.employeeTrainingRecord.createMany({
      data: newRecords.map((record) => ({
        bookedAt: record.bookedAt,
        bookingConfirmedAt: record.bookingConfirmedAt,
        certificateReceivedAt: record.certificateReceivedAt,
        durationDays: record.durationDays,
        employeeId: record.employeeId,
        location: record.location,
        notes: record.notes,
        number: record.number,
        provider: record.provider,
        topic: record.topic,
        trainingDate: record.trainingDate,
        trainingTypeId:
          trainingTypeIdsByTopic.get(record.topic.trim().toLowerCase()) ?? null,
        type: record.type,
        validUntil: record.validUntil,
        validityMonths: record.validityMonths,
      })),
    });
  }

  for (const update of duplicateUpdates) {
    await prisma.employeeTrainingRecord.update({
      where: {
        id: update.id,
      },
      data: {
        validUntil: update.validUntil,
        validityMonths: update.validityMonths,
      },
    });
  }

  revalidateTrainingViews(
    Array.from(new Set(records.map((record) => record.employeeId))),
  );
  const errorFile = await writeImportErrorWorkbook(importErrorRows);
  const params = new URLSearchParams({
    imported: String(newRecords.length),
    skipped: String(importErrorRows.length),
  });

  if (errorFile) {
    params.set("errorFile", errorFile);
  }

  redirect(`/employees/certificates?${params.toString()}`);
}

export async function deleteEmployeeTrainingRecord(formData: FormData) {
  await requireSession();
  const id = optionalString(formData.get("id"));
  const employeeId = optionalString(formData.get("employeeId"));

  if (!id || !employeeId) {
    throw new Error("Schulung fehlt.");
  }

  await prisma.employeeTrainingRecord.delete({
    where: {
      id,
    },
  });

  revalidateEmployeeTraining(employeeId);
}
