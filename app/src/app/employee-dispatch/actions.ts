"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import {
  employeeDispositionTypes,
  getEmployeeDispositionType,
} from "./disposition-types";

function parseDate(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label} fehlt oder ist ungültig.`);
  }

  return new Date(`${text}T00:00:00.000Z`);
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseTime(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value ?? "").trim();

  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

export async function createEmployeeDispositionEntry(formData: FormData) {
  await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const typeValues = Array.from(
    new Set(
      [...formData.getAll("typeValues"), ...formData.getAll("typeValue")]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!employeeId) {
    throw new Error("Bitte einen Mitarbeiter auswählen.");
  }

  if (typeValues.length === 0) {
    throw new Error("Bitte mindestens eine Art auswählen.");
  }

  if (
    typeValues.some(
      (typeValue) =>
        !employeeDispositionTypes.some((type) => type.value === typeValue),
    )
  ) {
    throw new Error("Bitte gültige Arten auswählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const employee = await prisma.employee.findUnique({
    where: {
      id: employeeId,
    },
  });

  if (!employee) {
    throw new Error("Mitarbeiter wurde nicht gefunden.");
  }

  const startTime = parseTime(formData.get("startTime"), "06:30");
  const endTime = parseTime(formData.get("endTime"), "17:00");
  const notes = optionalString(formData.get("notes"));

  await prisma.$transaction(
    typeValues.map((typeValue) => {
      const type = getEmployeeDispositionType(typeValue);

      return prisma.employeeDispositionEntry.create({
        data: {
          employeeId,
          startDate,
          endDate,
          startTime,
          endTime,
          typeValue: type.value,
          typeLabel: type.label,
          notes,
        },
      });
    }),
  );

  revalidatePath("/employee-dispatch");
}

export async function updateEmployeeDispositionEntry(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const typeValue = String(formData.get("typeValue") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Eintrags-ID fehlt.");
  }

  if (!employeeId) {
    throw new Error("Bitte einen Mitarbeiter auswählen.");
  }

  if (!employeeDispositionTypes.some((type) => type.value === typeValue)) {
    throw new Error("Bitte eine gültige Art auswählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
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

  const type = getEmployeeDispositionType(typeValue);

  await prisma.employeeDispositionEntry.update({
    where: {
      id,
    },
    data: {
      employeeId,
      startDate,
      endDate,
      startTime: parseTime(formData.get("startTime"), "06:30"),
      endTime: parseTime(formData.get("endTime"), "17:00"),
      typeValue: type.value,
      typeLabel: type.label,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/employee-dispatch");
}

export async function updateEmployeeDispositionEntryDates(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Eintrags-ID fehlt.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  await prisma.employeeDispositionEntry.update({
    where: {
      id,
    },
    data: {
      startDate,
      endDate,
    },
  });

  revalidatePath("/employee-dispatch");
}

export async function deleteEmployeeDispositionEntry(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrags-ID fehlt.");
  }

  await prisma.employeeDispositionEntry.delete({
    where: {
      id,
    },
  });

  revalidatePath("/employee-dispatch");
}
