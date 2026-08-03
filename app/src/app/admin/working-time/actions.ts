"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import {
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

function getWeeklySchedulePayload(formData: FormData) {
  const schedule = Object.fromEntries(
    workTimeDayKeys.map((dayKey) => {
      const noWorkday = formData.get(`${dayKey}NoWorkday`) === "on";
      const startTime = noWorkday ? "" : normalizeOptionalTime(text(formData.get(`${dayKey}StartTime`)));
      const endTime = noWorkday ? "" : normalizeOptionalTime(text(formData.get(`${dayKey}EndTime`)));

      if (!startTime && !endTime) {
        // Beginn und Ende leer = kein Arbeitstag, zählt nicht in der Stundenberechnung.
        const emptyDay: WorkTimeDaySettings = {
          breakfastEnd: "",
          breakfastStart: "",
          endTime: "",
          lunchEnd: "",
          lunchStart: "",
          startTime: "",
        };
        return [dayKey, emptyDay];
      }

      if (!startTime || !endTime) {
        throw new Error(
          `${dayKey}: Beginn und Ende müssen beide ausgefüllt sein, oder beide leer bleiben (kein Arbeitstag).`,
        );
      }

      const day: WorkTimeDaySettings = {
        breakfastEnd: normalizeOptionalTime(
          text(formData.get(`${dayKey}BreakfastEnd`)),
        ),
        breakfastStart: normalizeOptionalTime(
          text(formData.get(`${dayKey}BreakfastStart`)),
        ),
        endTime,
        lunchEnd: normalizeOptionalTime(text(formData.get(`${dayKey}LunchEnd`))),
        lunchStart: normalizeOptionalTime(text(formData.get(`${dayKey}LunchStart`))),
        startTime,
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

function readManualMonthlyHours(formData: FormData) {
  if (formData.get("useManualMonthlyHours") !== "on") return null;
  const raw = text(formData.get("manualMonthlyHours")).replace(",", ".");
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0) {
    throw new Error("Manuelle Monatsstunden müssen eine gültige Zahl sein.");
  }
  return value;
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
  const weeklyScheduleJson = getWeeklySchedulePayload(formData);
  const manualMonthlyHours = readManualMonthlyHours(formData);

  await prisma.workTimePreset.create({
    data: {
      name,
      startTime,
      endTime,
      weeklyScheduleJson,
      manualMonthlyHours,
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
  const weeklyScheduleJson = getWeeklySchedulePayload(formData);
  const manualMonthlyHours = readManualMonthlyHours(formData);

  await prisma.workTimePreset.update({
    where: {
      id,
    },
    data: {
      name,
      startTime,
      endTime,
      weeklyScheduleJson,
      manualMonthlyHours,
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

export async function updateWorkTimeCalendarEffectiveFrom(formData: FormData) {
  await requireAdmin();
  const value = text(formData.get("workTimeCalendarEffectiveFrom"));
  const effectiveFrom = value ? new Date(`${value}T00:00:00.000Z`) : null;

  await prisma.timeTrackingSettings.upsert({
    create: { id: "default", workTimeCalendarEffectiveFrom: effectiveFrom },
    update: { workTimeCalendarEffectiveFrom: effectiveFrom },
    where: { id: "default" },
  });

  revalidateWorkingTimeConsumers();
  revalidatePath("/personal/konten");
  revalidatePath("/personal/monatskalender");
  revalidatePath("/personal/jahreskalender");
}
