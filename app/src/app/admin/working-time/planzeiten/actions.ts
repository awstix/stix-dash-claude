"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import { workTimeDayTypeColorOptions } from "@/lib/work-time-day-type-colors";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function optionalTime(value: FormDataEntryValue | null) {
  const raw = text(value);
  if (!raw) return null;
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw new Error("Uhrzeit muss im Format HH:MM angegeben werden.");
  }
  return raw;
}

async function nextDayTypeNumber() {
  const highest = await prisma.workTimeDayType.aggregate({
    _max: { number: true },
  });
  return (highest._max.number ?? 0) + 1;
}

function dayTypeFieldsFromFormData(formData: FormData) {
  const colorKey = text(formData.get("colorKey")) || "gray";
  if (!workTimeDayTypeColorOptions.some((option) => option.key === colorKey)) {
    throw new Error("Bitte eine gültige Farbe auswählen.");
  }
  const startTime = optionalTime(formData.get("startTime"));
  const endTime = optionalTime(formData.get("endTime"));
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new Error("Beginn und Ende müssen beide gesetzt oder beide leer sein.");
  }

  return {
    breakfastEnd: optionalTime(formData.get("breakfastEnd")),
    breakfastStart: optionalTime(formData.get("breakfastStart")),
    colorKey,
    endTime,
    lunchEnd: optionalTime(formData.get("lunchEnd")),
    lunchStart: optionalTime(formData.get("lunchStart")),
    startTime,
  };
}

export async function createWorkTimeDayType(formData: FormData) {
  await requireAdmin();
  const fields = dayTypeFieldsFromFormData(formData);
  const number = await nextDayTypeNumber();

  await prisma.workTimeDayType.create({
    data: {
      ...fields,
      number,
    },
  });

  revalidatePath("/admin/working-time/planzeiten");
}

export async function updateWorkTimeDayType(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (!id) {
    throw new Error("Planzeit fehlt.");
  }
  const fields = dayTypeFieldsFromFormData(formData);

  await prisma.workTimeDayType.update({
    data: fields,
    where: { id },
  });

  revalidatePath("/admin/working-time/planzeiten");
}

export async function deleteWorkTimeDayType(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (!id) {
    throw new Error("Planzeit fehlt.");
  }

  await prisma.workTimeDayType.delete({
    where: { id },
  });

  revalidatePath("/admin/working-time/planzeiten");
}
