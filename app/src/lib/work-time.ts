import { prisma } from "@/lib/prisma";
import {
  workTimeDayKeys,
  workTimeDayLabels,
  type WorkTimeDayKey,
} from "@/lib/work-time-constants";

export { workTimeDayKeys, workTimeDayLabels, type WorkTimeDayKey };

export type WorkTimeDaySettings = {
  breakfastEnd: string;
  breakfastStart: string;
  endTime: string;
  lunchEnd: string;
  lunchStart: string;
  startTime: string;
};

export type WorkTimeSettings = {
  endTime: string;
  name: string;
  startTime: string;
  weeklySchedule: Record<WorkTimeDayKey, WorkTimeDaySettings>;
};

export function createWeeklySchedule(
  startTime: string,
  endTime: string,
): Record<WorkTimeDayKey, WorkTimeDaySettings> {
  return Object.fromEntries(
    workTimeDayKeys.map((dayKey) => [
      dayKey,
      {
        breakfastEnd: "",
        breakfastStart: "",
        endTime,
        lunchEnd: "",
        lunchStart: "",
        startTime,
      },
    ]),
  ) as Record<WorkTimeDayKey, WorkTimeDaySettings>;
}

export const fallbackWorkTime: WorkTimeSettings = {
  endTime: "17:00",
  name: "Standard",
  startTime: "06:30",
  weeklySchedule: createWeeklySchedule("06:30", "17:00"),
};

export function parseWeeklySchedule(
  value: string | null | undefined,
  startTime: string,
  endTime: string,
) {
  const fallback = createWeeklySchedule(startTime, endTime);

  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<
      Record<WorkTimeDayKey, Partial<WorkTimeDaySettings>>
    >;

    return Object.fromEntries(
      workTimeDayKeys.map((dayKey) => {
        const day = parsed[dayKey];
        // Fehlt der Tag komplett im gespeicherten JSON (alte Datenformate), auf die
        // Vorlagen-Standardzeit zurückfallen. Ist der Tag vorhanden, aber mit leeren
        // Zeiten gespeichert, ist das bewusst "kein Arbeitstag" und bleibt leer.
        const hasStoredDay = day !== undefined;

        return [
          dayKey,
          {
            breakfastEnd: day?.breakfastEnd ?? "",
            breakfastStart: day?.breakfastStart ?? "",
            endTime: hasStoredDay ? (day?.endTime ?? "") : endTime,
            lunchEnd: day?.lunchEnd ?? "",
            lunchStart: day?.lunchStart ?? "",
            startTime: hasStoredDay ? (day?.startTime ?? "") : startTime,
          },
        ];
      }),
    ) as Record<WorkTimeDayKey, WorkTimeDaySettings>;
  } catch {
    return fallback;
  }
}

export type WorkTimePresetRecord = {
  endTime: string;
  isActive: boolean;
  isDefault: boolean;
  name: string;
  sortOrder: number;
  startTime: string;
  validFrom?: string | null;
  validTo?: string | null;
  weeklyScheduleJson?: string | null;
};

export function workTimeSettingsFromPreset(preset: {
  endTime: string;
  name: string;
  startTime: string;
  weeklyScheduleJson?: string | null;
}): WorkTimeSettings {
  return {
    endTime: preset.endTime,
    name: preset.name,
    startTime: preset.startTime,
    weeklySchedule: parseWeeklySchedule(
      preset.weeklyScheduleJson,
      preset.startTime,
      preset.endTime,
    ),
  };
}

function monthDayValue(date: Date) {
  return (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
}

function parseMonthDayValue(value: string) {
  const [month, day] = value.split("-").map(Number);
  return month * 100 + day;
}

/** Prüft, ob ein Datum (nur Tag/Monat, jahresunabhängig) in einem wiederkehrenden
 * Saison-Zeitraum liegt. Der Zeitraum darf über den Jahreswechsel hinausgehen
 * (z. B. "10-01"–"03-31" für Winterzeit). */
function isDateInSeason(date: Date, validFrom: string, validTo: string) {
  const dayValue = monthDayValue(date);
  const fromValue = parseMonthDayValue(validFrom);
  const toValue = parseMonthDayValue(validTo);

  if (fromValue <= toValue) {
    return dayValue >= fromValue && dayValue <= toValue;
  }

  return dayValue >= fromValue || dayValue <= toValue;
}

/** Wählt die für ein Datum gültige Arbeitszeit-Vorlage: zuerst eine aktive Vorlage,
 * deren wiederkehrender Saison-Zeitraum das Datum abdeckt (bei mehreren Treffern die
 * mit der niedrigsten Position); ohne Treffer die als Standard markierte Vorlage,
 * sonst die erste aktive Vorlage. */
export function selectWorkTimePresetForDate<T extends WorkTimePresetRecord>(
  presets: T[],
  date: Date,
): T | undefined {
  const activePresets = presets.filter((preset) => preset.isActive);
  const seasonalMatches = activePresets
    .filter(
      (preset) => preset.validFrom && preset.validTo && isDateInSeason(date, preset.validFrom, preset.validTo),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (seasonalMatches.length > 0) return seasonalMatches[0];
  return activePresets.find((preset) => preset.isDefault) ?? activePresets[0];
}

function getWorkTimeDayKey(date: Date): WorkTimeDayKey {
  const day = date.getUTCDay();

  if (day === 0) return "sunday";
  if (day === 1) return "monday";
  if (day === 2) return "tuesday";
  if (day === 3) return "wednesday";
  if (day === 4) return "thursday";
  if (day === 5) return "friday";
  return "saturday";
}

export function getWorkTimeForDate(
  settings: WorkTimeSettings,
  date: Date,
): WorkTimeDaySettings {
  return settings.weeklySchedule[getWorkTimeDayKey(date)] ?? {
    breakfastEnd: "",
    breakfastStart: "",
    endTime: settings.endTime,
    lunchEnd: "",
    lunchStart: "",
    startTime: settings.startTime,
  };
}

function timeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hoursText, minutesText] = value.split(":");
  return Number(hoursText) * 60 + Number(minutesText);
}

function breakMinutes(start: string, end: string) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes === null || endMinutes === null) return 0;
  if (endMinutes <= startMinutes) return 0;

  return endMinutes - startMinutes;
}

export function getNetWorkHoursForDay(day: WorkTimeDaySettings) {
  const startMinutes = timeToMinutes(day.startTime);
  const endMinutes = timeToMinutes(day.endTime);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 0;
  }

  const grossMinutes = endMinutes - startMinutes;
  const pauseMinutes =
    breakMinutes(day.breakfastStart, day.breakfastEnd) +
    breakMinutes(day.lunchStart, day.lunchEnd);

  return Math.max(0, (grossMinutes - pauseMinutes) / 60);
}

export async function ensureDefaultWorkTimePresets() {
  const count = await prisma.workTimePreset.count();

  if (count > 0) {
    return;
  }

  await prisma.workTimePreset.createMany({
    data: [
      {
        name: "Sommer",
        startTime: "06:30",
        endTime: "17:00",
        weeklyScheduleJson: JSON.stringify(createWeeklySchedule("06:30", "17:00")),
        isDefault: true,
        isActive: true,
        sortOrder: 10,
      },
      {
        name: "Winter",
        startTime: "07:30",
        endTime: "16:30",
        weeklyScheduleJson: JSON.stringify(createWeeklySchedule("07:30", "16:30")),
        isDefault: false,
        isActive: true,
        sortOrder: 20,
      },
      {
        name: "Standard",
        startTime: "07:00",
        endTime: "16:30",
        weeklyScheduleJson: JSON.stringify(createWeeklySchedule("07:00", "16:30")),
        isDefault: false,
        isActive: true,
        sortOrder: 30,
      },
    ],
  });
}

/** Ermittelt die für ein Datum (Standard: heute) gültige Arbeitszeit-Vorlage –
 * bevorzugt eine mit passendem Saison-Zeitraum, sonst die Standard-Vorlage. */
export async function getDefaultWorkTime(date: Date = new Date()) {
  await ensureDefaultWorkTimePresets();

  const presets = await prisma.workTimePreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const selected = selectWorkTimePresetForDate(presets, date);

  return selected ? workTimeSettingsFromPreset(selected) : fallbackWorkTime;
}

/** Ermittelt die für ein Datum gültige Regel-Arbeitszeit: ab dem globalen
 * Umstellungs-Stichtag zählt – falls für den Tag eine Planzeit im Jahreskalender
 * eingetragen ist – der Jahreskalender, sonst (auch vor dem Stichtag oder ohne
 * Eintrag für diesen Tag) das aktive Sommer-/Winterzeit-Preset. Nicht
 * mitarbeiterbezogen, gedacht für Vorschläge ohne konkrete Personalzuordnung
 * (z. B. Bautagesbericht). */
export async function getWorkTimeDayForDate(date: Date): Promise<WorkTimeDaySettings> {
  const timeTrackingSettings = await prisma.timeTrackingSettings.findUnique({
    select: { workTimeCalendarEffectiveFrom: true },
    where: { id: "default" },
  });
  const effectiveFrom = timeTrackingSettings?.workTimeCalendarEffectiveFrom ?? null;

  if (effectiveFrom && date >= effectiveFrom) {
    const calendarDay = await prisma.workTimeCalendarDay.findFirst({
      orderBy: { calendar: { createdAt: "asc" } },
      select: { dayType: true },
      where: { calendar: { year: date.getUTCFullYear() }, date },
    });

    if (calendarDay?.dayType) {
      return {
        breakfastEnd: calendarDay.dayType.breakfastEnd ?? "",
        breakfastStart: calendarDay.dayType.breakfastStart ?? "",
        endTime: calendarDay.dayType.endTime ?? "",
        lunchEnd: calendarDay.dayType.lunchEnd ?? "",
        lunchStart: calendarDay.dayType.lunchStart ?? "",
        startTime: calendarDay.dayType.startTime ?? "",
      };
    }
  }

  const defaultWorkTime = await getDefaultWorkTime(date);
  return getWorkTimeForDate(defaultWorkTime, date);
}
