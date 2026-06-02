"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function parseDateInput(value: string, fieldLabel: string) {
  if (!value) {
    throw new Error(`${fieldLabel} fehlt.`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldLabel} ist ungültig.`);
  }

  return date;
}

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;

  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function cleanOptionalValue(value: string) {
  return value.length ? value : null;
}

const DEFAULT_CREW_ASSIGNMENT_START_TIME = "07:00";
const DEFAULT_CREW_ASSIGNMENT_END_TIME = "16:00";

function cleanRequiredTimeValue(value: string, fallback: string) {
  return value.length ? value : fallback;
}

function normalizeTimeFieldValue(value: unknown) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue.length) return null;

    const timeMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})/);

    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, "0");
      return `${hour}:${timeMatch[2]}`;
    }

    return trimmedValue;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const hour = Math.floor(value);
    const minutes = Math.round((value - hour) * 60);

    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}`;
  }

  return null;
}

function getOptionalTimeField(source: object, keys: string[]) {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const normalizedValue = normalizeTimeFieldValue(record[key]);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return null;
}

function getProjectDefaultStartTime(project: object) {
  return getOptionalTimeField(project, [
    "defaultStartTime",
    "workStartTime",
    "workTimeStart",
    "workingTimeStart",
    "workingStartTime",
    "workingHoursStart",
    "workdayStartTime",
    "constructionStartTime",
    "siteStartTime",
    "siteWorkStartTime",
    "normalWorkStartTime",
    "regularStartTime",
    "normalStartTime",
    "dailyStartTime",
    "startTime",
    "arbeitszeitVon",
    "arbeitsbeginn",
    "workStart",
  ]);
}

function getProjectDefaultEndTime(project: object) {
  return getOptionalTimeField(project, [
    "defaultEndTime",
    "workEndTime",
    "workTimeEnd",
    "workingTimeEnd",
    "workingEndTime",
    "workingHoursEnd",
    "workdayEndTime",
    "constructionEndTime",
    "siteEndTime",
    "siteWorkEndTime",
    "normalWorkEndTime",
    "regularEndTime",
    "normalEndTime",
    "dailyEndTime",
    "endTime",
    "arbeitszeitBis",
    "arbeitsende",
    "workEnd",
  ]);
}

export async function createCrewPlanningAssignmentFromProject(
  formData: FormData,
) {
  const projectId = getFormString(formData, "projectId");
  const crewId = getFormString(formData, "crewId");
  const startDate = parseDateInput(
    getFormString(formData, "startDate"),
    "Von-Datum",
  );
  const endDate = parseDateInput(
    getFormString(formData, "endDate"),
    "Bis-Datum",
  );
  const formStartTime = getFormString(formData, "startTime");
  const formEndTime = getFormString(formData, "endTime");
  const notes = cleanOptionalValue(getFormString(formData, "notes"));

  if (!projectId) {
    throw new Error("Baustelle fehlt.");
  }

  if (!crewId) {
    throw new Error("Kolonne fehlt.");
  }

  if (endDate < startDate) {
    throw new Error("Das Bis-Datum liegt vor dem Von-Datum.");
  }

  const [project, crew] = await Promise.all([
    prisma.project.findUnique({
      where: {
        id: projectId,
      },
    }),
    prisma.crew.findUnique({
      where: {
        id: crewId,
      },
    }),
  ]);

  if (!project) {
    throw new Error("Baustelle wurde nicht gefunden.");
  }

  if (!crew) {
    throw new Error("Kolonne wurde nicht gefunden.");
  }

  const startTime = cleanRequiredTimeValue(
    formStartTime,
    getProjectDefaultStartTime(project) ?? DEFAULT_CREW_ASSIGNMENT_START_TIME,
  );
  const endTime = cleanRequiredTimeValue(
    formEndTime,
    getProjectDefaultEndTime(project) ?? DEFAULT_CREW_ASSIGNMENT_END_TIME,
  );

  const weekStart = startOfWeek(startDate);

  let row = await prisma.crewPlanningRow.findFirst({
    where: {
      projectId,
      weekStart,
      rowTitle: null,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (!row) {
    row = await prisma.crewPlanningRow.create({
      data: {
        projectId: project.id,
        projectNumber: project.projectNumber,
        projectName: project.name,
        weekStart,
        rowTitle: null,
        notes: null,
        sortOrder: 0,
      },
    });
  }

  await prisma.crewPlanningAssignment.create({
    data: {
      row: {
        connect: {
          id: row.id,
        },
      },
      crew: {
        connect: {
          id: crew.id,
        },
      },
      crewName: crew.name,
      crewTypeValue: crew.typeValue,
      crewTypeLabel: crew.typeLabel,
      startDate,
      endDate,
      startTime,
      endTime,
      notes,
    },
  });

  revalidatePath("/crew-dispatch");
}
