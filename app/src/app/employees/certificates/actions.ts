"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) return null;

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");

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

function revalidateEmployeeTraining(employeeId: string) {
  revalidatePath("/employees/certificates");
  revalidatePath(`/employees/certificates/${employeeId}`);
  revalidatePath("/employees");
}

export async function createEmployeeTrainingRecord(formData: FormData) {
  const employeeId = optionalString(formData.get("employeeId"));

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  const trainingTypeId = optionalString(formData.get("trainingTypeId"));
  const trainingType = trainingTypeId
    ? await prisma.employeeTrainingType.findUnique({
        where: {
          id: trainingTypeId,
        },
      })
    : null;
  const trainingDate = optionalDate(formData.get("trainingDate"));
  const validityYears = optionalInteger(formData.get("validityYears"));
  const validityMonths =
    (validityYears ? validityYears * 12 : null) ??
    optionalInteger(formData.get("validityMonths")) ??
    trainingType?.defaultValidityMonths ??
    null;
  const explicitValidUntil = optionalDate(formData.get("validUntil"));
  const validUntil =
    explicitValidUntil ?? calculateValidUntil(trainingDate, validityMonths);
  const topic = optionalString(formData.get("topic")) ?? trainingType?.topic;

  if (!topic) {
    throw new Error("Bitte ein Thema / einen Kurs eintragen.");
  }

  await prisma.employeeTrainingRecord.create({
    data: {
      bookedAt: optionalDate(formData.get("bookedAt")),
      bookingConfirmedAt: optionalDate(formData.get("bookingConfirmedAt")),
      certificateReceivedAt: optionalDate(formData.get("certificateReceivedAt")),
      durationDays:
        optionalNumber(formData.get("durationDays")) ??
        trainingType?.defaultDurationDays ??
        null,
      employee: {
        connect: {
          id: employeeId,
        },
      },
      location:
        optionalString(formData.get("location")) ??
        trainingType?.defaultLocation ??
        null,
      notes: optionalString(formData.get("notes")),
      number: optionalString(formData.get("number")) ?? trainingType?.number ?? null,
      provider:
        optionalString(formData.get("provider")) ?? trainingType?.provider ?? null,
      topic,
      trainingDate,
      trainingType: trainingType
        ? {
            connect: {
              id: trainingType.id,
            },
          }
        : undefined,
      type: optionalString(formData.get("type")) ?? trainingType?.type ?? null,
      validityMonths,
      validUntil,
    },
  });

  revalidateEmployeeTraining(employeeId);
}

export async function deleteEmployeeTrainingRecord(formData: FormData) {
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
