"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkTimePresets } from "@/lib/work-time";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Uhrzeit muss im Format HH:MM angegeben werden.");
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Ungültige Uhrzeit.");
  }

  return value;
}

function timeToMinutes(value: string) {
  const [hoursText, minutesText] = value.split(":");
  return Number(hoursText) * 60 + Number(minutesText);
}

function validateTimeRange(startTime: string, endTime: string) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("Ende muss nach Beginn liegen.");
  }
}

function revalidateWorkingTimeConsumers() {
  revalidatePath("/admin/working-time");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/api/work-time");
}

export async function seedWorkTimePresets() {
  await ensureDefaultWorkTimePresets();
  revalidateWorkingTimeConsumers();
}

export async function createWorkTimePreset(formData: FormData) {
  const name = text(formData.get("name"));
  const startTime = normalizeTime(text(formData.get("startTime")));
  const endTime = normalizeTime(text(formData.get("endTime")));
  const sortOrder = Number(text(formData.get("sortOrder")) || "9999");

  if (!name) {
    throw new Error("Name ist ein Pflichtfeld.");
  }

  validateTimeRange(startTime, endTime);

  await prisma.workTimePreset.create({
    data: {
      name,
      startTime,
      endTime,
      sortOrder: Number.isNaN(sortOrder) ? 9999 : sortOrder,
      isActive: true,
      isDefault: false,
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function updateWorkTimePreset(formData: FormData) {
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const startTime = normalizeTime(text(formData.get("startTime")));
  const endTime = normalizeTime(text(formData.get("endTime")));
  const sortOrder = Number(text(formData.get("sortOrder")) || "0");

  if (!id || !name) {
    throw new Error("ID und Name sind Pflichtfelder.");
  }

  validateTimeRange(startTime, endTime);

  await prisma.workTimePreset.update({
    where: {
      id,
    },
    data: {
      name,
      startTime,
      endTime,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function setDefaultWorkTimePreset(formData: FormData) {
  const id = text(formData.get("id"));

  if (!id) {
    throw new Error("ID fehlt.");
  }

  await prisma.$transaction([
    prisma.workTimePreset.updateMany({
      data: {
        isDefault: false,
      },
    }),
    prisma.workTimePreset.update({
      where: {
        id,
      },
      data: {
        isDefault: true,
        isActive: true,
      },
    }),
  ]);

  revalidateWorkingTimeConsumers();
}

export async function deleteWorkTimePreset(formData: FormData) {
  const id = text(formData.get("id"));

  if (!id) {
    throw new Error("ID fehlt.");
  }

  const preset = await prisma.workTimePreset.findUnique({
    where: {
      id,
    },
  });

  if (!preset) {
    return;
  }

  await prisma.workTimePreset.delete({
    where: {
      id,
    },
  });

  if (preset.isDefault) {
    const nextPreset = await prisma.workTimePreset.findFirst({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    if (nextPreset) {
      await prisma.workTimePreset.update({
        where: {
          id: nextPreset.id,
        },
        data: {
          isDefault: true,
        },
      });
    }
  }

  revalidateWorkingTimeConsumers();
}