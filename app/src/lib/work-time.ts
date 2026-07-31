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
        const day = parsed[dayKey] ?? {};

        return [
          dayKey,
          {
            breakfastEnd: day.breakfastEnd || "",
            breakfastStart: day.breakfastStart || "",
            endTime: day.endTime || endTime,
            lunchEnd: day.lunchEnd || "",
            lunchStart: day.lunchStart || "",
            startTime: day.startTime || startTime,
          },
        ];
      }),
    ) as Record<WorkTimeDayKey, WorkTimeDaySettings>;
  } catch {
    return fallback;
  }
}

function withSchedule(preset: {
  endTime: string;
  name: string;
  startTime: string;
  weeklyScheduleJson?: string | null;
}) {
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

export async function getDefaultWorkTime() {
  await ensureDefaultWorkTimePresets();

  const defaultPreset = await prisma.workTimePreset.findFirst({
    where: {
      isDefault: true,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (defaultPreset) {
    return withSchedule(defaultPreset);
  }

  const firstActivePreset = await prisma.workTimePreset.findFirst({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (firstActivePreset) {
    return withSchedule(firstActivePreset);
  }

  return fallbackWorkTime;
}
