"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import { workTimeDayKeys, type WorkTimeDaySettings } from "@/lib/work-time";

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
  const raw = text(formData.get("manualMonthlyHours")).replace(/\./g, "").replace(",", ".");
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0) {
    throw new Error("Manuelle Monatsstunden müssen eine gültige Zahl sein.");
  }
  return value;
}

/** Liest ein Datum aus einem `type="date"`-Feld und gibt nur Tag/Monat zurück
 * (Format "MM-DD") – das Jahr im Eingabefeld ist nur ein Platzhalter, da der
 * Saison-Zeitraum jedes Jahr wiederkehrt. */
function readMonthDay(formData: FormData, key: string) {
  const raw = text(formData.get(key));
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Ungültiges Datum für den Saison-Zeitraum.");
  }
  const [, monthText, dayText] = raw.split("-");
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("Ungültiges Datum für den Saison-Zeitraum.");
  }
  return `${monthText}-${dayText}`;
}

function readSeasonRange(formData: FormData) {
  const validFrom = readMonthDay(formData, "validFrom");
  const validTo = readMonthDay(formData, "validTo");

  if ((validFrom && !validTo) || (!validFrom && validTo)) {
    throw new Error("Saison-Zeitraum: Von und Bis müssen beide ausgefüllt sein, oder beide leer bleiben.");
  }

  return { validFrom, validTo };
}

function revalidateWorkingTimeConsumers() {
  revalidatePath("/admin/working-time");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/projects/bautagesberichte");
  revalidatePath("/api/work-time");
}

export type WorkTimePresetActionState = {
  error: string | null;
  errorKey: number;
};

function workTimePresetActionError(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Die Arbeitszeit-Vorlage konnte nicht gespeichert werden.";
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
  const { validFrom, validTo } = readSeasonRange(formData);

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
      validFrom,
      validTo,
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function createWorkTimePresetAction(
  state: WorkTimePresetActionState,
  formData: FormData,
): Promise<WorkTimePresetActionState> {
  try {
    await createWorkTimePreset(formData);
    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return { error: workTimePresetActionError(error), errorKey: state.errorKey + 1 };
  }
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
  const { validFrom, validTo } = readSeasonRange(formData);

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
      validFrom,
      validTo,
    },
  });

  revalidateWorkingTimeConsumers();
}

export async function updateWorkTimePresetAction(
  state: WorkTimePresetActionState,
  formData: FormData,
): Promise<WorkTimePresetActionState> {
  try {
    await updateWorkTimePreset(formData);
    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return { error: workTimePresetActionError(error), errorKey: state.errorKey + 1 };
  }
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
