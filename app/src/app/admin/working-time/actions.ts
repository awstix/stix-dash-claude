"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import {
  createWeeklySchedule,
  ensureDefaultWorkTimePresets,
  workTimeDayKeys,
  type WorkTimeDaySettings,
} from "@/lib/work-time";

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

function normalizeOptionalTime(value: string) {
  if (!value.trim()) return "";
  return normalizeTime(value);
}

function validateOptionalBreakRange(
  startTime: string,
  endTime: string,
  label: string,
) {
  if (!startTime && !endTime) return;

  if (!startTime || !endTime) {
    throw new Error(`${label}: Beginn und Ende der Pause müssen beide ausgefüllt sein.`);
  }

  validateTimeRange(startTime, endTime);
}

function getWeeklySchedulePayload(
  formData: FormData,
  startTime: string,
  endTime: string,
) {
  const fallbackSchedule = createWeeklySchedule(startTime, endTime);
  const schedule = Object.fromEntries(
    workTimeDayKeys.map((dayKey) => {
      const day: WorkTimeDaySettings = {
        breakfastEnd: normalizeOptionalTime(
          text(formData.get(`${dayKey}BreakfastEnd`)),
        ),
        breakfastStart: normalizeOptionalTime(
          text(formData.get(`${dayKey}BreakfastStart`)),
        ),
        endTime: normalizeOptionalTime(text(formData.get(`${dayKey}EndTime`))) ||
          fallbackSchedule[dayKey].endTime,
        lunchEnd: normalizeOptionalTime(text(formData.get(`${dayKey}LunchEnd`))),
        lunchStart: normalizeOptionalTime(text(formData.get(`${dayKey}LunchStart`))),
        startTime:
          normalizeOptionalTime(text(formData.get(`${dayKey}StartTime`))) ||
          fallbackSchedule[dayKey].startTime,
      };

      validateTimeRange(day.startTime, day.endTime);
      validateOptionalBreakRange(
        day.breakfastStart,
        day.breakfastEnd,
        `${dayKey} Frühstück`,
      );
      validateOptionalBreakRange(
        day.lunchStart,
        day.lunchEnd,
        `${dayKey} Mittag`,
      );

      return [dayKey, day];
    }),
  );

  return JSON.stringify(schedule);
}

function revalidateWorkingTimeConsumers() {
  revalidatePath("/admin/working-time");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/projects/bautagesberichte");
  revalidatePath("/api/work-time");
}

export async function seedWorkTimePresets() {
  await requireAdmin();
  await ensureDefaultWorkTimePresets();
  revalidateWorkingTimeConsumers();
}

export async function createWorkTimePreset(formData: FormData) {
  await requireAdmin();
  const name = text(formData.get("name"));
  const startTime = normalizeTime(text(formData.get("startTime")));
  const endTime = normalizeTime(text(formData.get("endTime")));
  const sortOrder = Number(text(formData.get("sortOrder")) || "9999");

  if (!name) {
    throw new Error("Name ist ein Pflichtfeld.");
  }

  validateTimeRange(startTime, endTime);
  const weeklyScheduleJson = getWeeklySchedulePayload(formData, startTime, endTime);

  await prisma.workTimePreset.create({
    data: {
      name,
      startTime,
      endTime,
      weeklyScheduleJson,
      sortOrder: Number.isNaN(sortOrder) ? 9999 : sortOrder,
      isActive: true,
      isDefault: false,
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function updateWorkTimePreset(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const startTime = normalizeTime(text(formData.get("startTime")));
  const endTime = normalizeTime(text(formData.get("endTime")));
  const sortOrder = Number(text(formData.get("sortOrder")) || "0");

  if (!id || !name) {
    throw new Error("ID und Name sind Pflichtfelder.");
  }

  validateTimeRange(startTime, endTime);
  const weeklyScheduleJson = getWeeklySchedulePayload(formData, startTime, endTime);

  await prisma.workTimePreset.update({
    where: {
      id,
    },
    data: {
      name,
      startTime,
      endTime,
      weeklyScheduleJson,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function setDefaultWorkTimePreset(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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
