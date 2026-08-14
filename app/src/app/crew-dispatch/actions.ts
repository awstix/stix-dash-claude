"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

function parseDate(value: FormDataEntryValue | null, fieldName: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} fehlt.`);
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} ist kein gültiges Datum.`);
  }

  return date;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalNumber(value: FormDataEntryValue | null, fieldName: string) {
  const text = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");

  if (!text) {
    return null;
  }

  const number = Number(text);

  if (Number.isNaN(number)) {
    throw new Error(`${fieldName} muss eine Zahl sein.`);
  }

  return number;
}

function optionalTime(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").trim());

  if (Number.isNaN(number)) {
    return 0;
  }

  return number;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;

  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function getCrewDispatchWeekHref(weekStart: Date, showWeekend: string | null) {
  const params = new URLSearchParams();
  params.set("week", formatDateInput(weekStart));

  if (showWeekend === "1") {
    params.set("showWeekend", "1");
  }

  return `/crew-dispatch?${params.toString()}`;
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

async function getProjectSnapshot(projectId: string) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    throw new Error("Baustelle wurde nicht gefunden.");
  }

  return project;
}

async function getCrewSnapshot(crewId: string) {
  const crew = await prisma.crew.findUnique({
    where: {
      id: crewId,
    },
  });

  if (!crew) {
    throw new Error("Kolonne wurde nicht gefunden.");
  }

  return crew;
}

const CONFLICT_NOTE_PREFIX = "Konflikt-Hinweis:";

function removeExistingConflictNotice(notes: string | null) {
  if (!notes) {
    return null;
  }

  const cleaned = notes
    .split("\n")
    .filter((line) => !line.trim().startsWith(CONFLICT_NOTE_PREFIX))
    .join("\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

async function getCrewConflictNotice({
  crewId,
  startDate,
  endDate,
  ignoreAssignmentId,
}: {
  crewId: string;
  startDate: Date;
  endDate: Date;
  ignoreAssignmentId?: string;
}) {
  const conflict = await prisma.crewPlanningAssignment.findFirst({
    where: {
      crewId,
      ...(ignoreAssignmentId
        ? {
            id: {
              not: ignoreAssignmentId,
            },
          }
        : {}),
      startDate: {
        lte: endDate,
      },
      endDate: {
        gte: startDate,
      },
    },
    include: {
      row: true,
    },
    orderBy: [{ startDate: "asc" }],
  });

  if (!conflict) {
    return null;
  }

  const projectText = conflict.row
    ? `${conflict.row.projectNumber} · ${conflict.row.projectName}${
        conflict.row.rowTitle ? ` · ${conflict.row.rowTitle}` : ""
      }`
    : "einer anderen Baustelle";

  return `Diese Kolonne ist bereits vom ${formatGermanDate(
    conflict.startDate
  )} bis ${formatGermanDate(conflict.endDate)} auf ${projectText} eingeplant.`;
}

async function getOrCreateCrewPlanningRow({
  projectId,
  startDate,
  rowTitle,
}: {
  projectId: string;
  startDate: Date;
  rowTitle: string | null;
}) {
  const project = await getProjectSnapshot(projectId);
  const weekStart = startOfWeek(startDate);

  const existingRow = await prisma.crewPlanningRow.findFirst({
    where: {
      weekStart,
      projectId: project.id,
      rowTitle,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  if (existingRow) {
    return existingRow;
  }

  return prisma.crewPlanningRow.create({
    data: {
      weekStart,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      rowTitle,
      notes: null,
      sortOrder: 0,
    },
  });
}

export async function createCrewPlanningRow(formData: FormData) {
  await requireSession();
  const weekStart = parseDate(formData.get("weekStart"), "KW-Start");
  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  const project = await getProjectSnapshot(projectId);

  await prisma.crewPlanningRow.create({
    data: {
      weekStart,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      rowTitle: optionalString(formData.get("rowTitle")),
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function updateCrewPlanningRow(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!id) {
    throw new Error("Planzeilen-ID fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  const project = await getProjectSnapshot(projectId);

  await prisma.crewPlanningRow.update({
    where: {
      id,
    },
    data: {
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      rowTitle: optionalString(formData.get("rowTitle")),
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function deleteCrewPlanningRow(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Planzeilen-ID fehlt.");
  }

  await prisma.crewPlanningRow.delete({
    where: {
      id,
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function createCrewPlanningAssignment(formData: FormData) {
  await requireSession();
  const rowId = String(formData.get("rowId") ?? "").trim();
  const crewId = String(formData.get("crewId") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!rowId) {
    throw new Error("Planzeile fehlt.");
  }

  if (!crewId) {
    throw new Error("Bitte eine Kolonne wählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const crew = await getCrewSnapshot(crewId);

  await getCrewConflictNotice({
    crewId: crew.id,
    startDate,
    endDate,
  });

  await prisma.crewPlanningAssignment.create({
    data: {
      rowId,
      crewId: crew.id,
      crewName: crew.name,
      crewTypeValue: crew.typeValue,
      crewTypeLabel: crew.typeLabel,
      startDate,
      endDate,
      startTime: String(formData.get("startTime") ?? "06:30").trim() || "06:30",
      endTime: String(formData.get("endTime") ?? "17:00").trim() || "17:00",
      notes: removeExistingConflictNotice(optionalString(formData.get("notes"))),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function createCrewPlanningAssignmentFromProject(
  formData: FormData
) {
  await requireSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const crewId = String(formData.get("crewId") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");
  const rowTitle = optionalString(formData.get("rowTitle"));

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  if (!crewId) {
    throw new Error("Bitte eine Kolonne wählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const crew = await getCrewSnapshot(crewId);

  await getCrewConflictNotice({
    crewId: crew.id,
    startDate,
    endDate,
  });

  const row = await getOrCreateCrewPlanningRow({
    projectId,
    startDate,
    rowTitle,
  });

  await prisma.crewPlanningAssignment.create({
    data: {
      rowId: row.id,
      crewId: crew.id,
      crewName: crew.name,
      crewTypeValue: crew.typeValue,
      crewTypeLabel: crew.typeLabel,
      startDate,
      endDate,
      startTime: String(formData.get("startTime") ?? "06:30").trim() || "06:30",
      endTime: String(formData.get("endTime") ?? "17:00").trim() || "17:00",
      notes: removeExistingConflictNotice(optionalString(formData.get("notes"))),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function updateCrewPlanningAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const crewId = String(formData.get("crewId") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Einteilungs-ID fehlt.");
  }

  if (!crewId) {
    throw new Error("Bitte eine Kolonne wählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const crew = await getCrewSnapshot(crewId);

  await getCrewConflictNotice({
    crewId: crew.id,
    startDate,
    endDate,
    ignoreAssignmentId: id,
  });

  await prisma.crewPlanningAssignment.update({
    where: {
      id,
    },
    data: {
      crewId: crew.id,
      crewName: crew.name,
      crewTypeValue: crew.typeValue,
      crewTypeLabel: crew.typeLabel,
      startDate,
      endDate,
      startTime: String(formData.get("startTime") ?? "06:30").trim() || "06:30",
      endTime: String(formData.get("endTime") ?? "17:00").trim() || "17:00",
      notes: removeExistingConflictNotice(optionalString(formData.get("notes"))),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function updateCrewPlanningAssignmentDates(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Einteilungs-ID fehlt.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const assignment = await prisma.crewPlanningAssignment.findUnique({
    where: {
      id,
    },
  });

  if (!assignment) {
    throw new Error("Einteilung wurde nicht gefunden.");
  }

  if (!assignment.crewId) {
    throw new Error("Diese Einteilung hat keine verknüpfte Kolonne.");
  }

  await getCrewConflictNotice({
    crewId: assignment.crewId,
    startDate,
    endDate,
    ignoreAssignmentId: id,
  });

  await prisma.crewPlanningAssignment.update({
    where: {
      id,
    },
    data: {
      startDate,
      endDate,
      notes: removeExistingConflictNotice(assignment.notes),
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function deleteCrewPlanningAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Einteilungs-ID fehlt.");
  }

  await prisma.crewPlanningAssignment.delete({
    where: {
      id,
    },
  });

  revalidatePath("/crew-dispatch");
}

export async function createCrewPlanningAssignmentForDay(formData: FormData) {
  await requireSession();
  const weekStart = parseDate(formData.get("weekStart"), "KW-Start");
  await createCrewPlanningAssignment(formData);

  const showWeekend = optionalString(formData.get("showWeekend"));
  revalidatePath(getCrewDispatchWeekHref(weekStart, showWeekend));
}

export async function updatePlanningTimelineSource(formData: FormData) {
  await requireSession();
  const sourceType = String(formData.get("sourceType") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const projectNumber = String(formData.get("projectNumber") ?? "").trim();
  const projectName = String(formData.get("projectName") ?? "").trim();
  const itemLabel = optionalString(formData.get("itemLabel"));
  const taskText = optionalString(formData.get("taskText"));
  const quantity = optionalNumber(formData.get("quantityValue"), "Menge");
  const quantityUnit = optionalString(formData.get("quantityUnit"));
  const notes = optionalString(formData.get("notes"));
  const startTime = optionalTime(formData.get("startTime"), "06:30");
  const endTime = optionalTime(formData.get("endTime"), "17:00");

  if (!sourceId) {
    throw new Error("Quell-ID fehlt.");
  }

  switch (sourceType) {
    case "TRUCK_LONG_HAUL_ENTRY":
      await prisma.truckLongHaulEntry.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          materialName: itemLabel,
          materialQuantity: quantity ?? 0,
          materialUnit: quantityUnit,
          notes,
        },
      });
      break;

    case "SHORT_HAUL_ASSIGNMENT":
      await prisma.shortHaulAssignment.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          material: itemLabel,
          notes,
        },
      });
      break;

    case "SHORT_HAUL_TOUR":
      await prisma.shortHaulTour.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          itemName: itemLabel,
          quantity,
          quantityUnit,
          notes,
        },
      });
      break;

    case "ASPHALT_LOAD_ALLOCATION":
      await prisma.asphaltLoadAllocation.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          asphaltMixName: itemLabel,
          totalTons: quantity ?? 0,
          notes,
          startTime,
          endTime,
        },
      });
      break;

    case "TACK_COAT_LOAD_ALLOCATION":
      await prisma.tackCoatLoadAllocation.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          materialName: itemLabel ?? "",
          quantityUnit: quantityUnit ?? "l",
          totalLiters: quantity ?? 0,
          notes,
          startTime,
          endTime,
        },
      });
      break;

    case "SPECIAL_VEHICLE_DISPATCH_ASSIGNMENT":
      await prisma.specialVehicleDispatchAssignment.update({
        where: {
          id: sourceId,
        },
        data: {
          projectNumber,
          projectName,
          taskText: taskText ?? itemLabel ?? "",
          materialName: itemLabel,
          quantity,
          quantityUnit,
          notes,
          startTime,
          endTime,
        },
      });
      break;

    case "EQUIPMENT_DISPATCH_ASSIGNMENT":
      await prisma.equipmentDispatchAssignment.update({
        where: {
          id: sourceId,
        },
        data: {
          notes,
        },
      });
      break;

    default:
      throw new Error("Diese Zeitstrahl-Quelle kann noch nicht bearbeitet werden.");
  }

  revalidatePath("/crew-dispatch");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function deletePlanningTimelineSource(formData: FormData) {
  await requireSession();
  const sourceType = String(formData.get("sourceType") ?? "").trim();
  const sourceId = String(formData.get("sourceId") ?? "").trim();

  if (!sourceId) {
    throw new Error("Quell-ID fehlt.");
  }

  switch (sourceType) {
    case "TRUCK_LONG_HAUL_ENTRY":
      await prisma.truckLongHaulEntry.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "SHORT_HAUL_ASSIGNMENT":
      await prisma.shortHaulAssignment.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "SHORT_HAUL_TOUR":
      await prisma.shortHaulTour.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "ASPHALT_LOAD_ALLOCATION":
      await prisma.asphaltLoadAllocation.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "TACK_COAT_LOAD_ALLOCATION":
      await prisma.tackCoatLoadAllocation.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "SPECIAL_VEHICLE_DISPATCH_ASSIGNMENT":
      await prisma.specialVehicleDispatchAssignment.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    case "EQUIPMENT_DISPATCH_ASSIGNMENT":
      await prisma.equipmentDispatchAssignment.delete({
        where: {
          id: sourceId,
        },
      });
      break;

    default:
      throw new Error("Diese Zeitstrahl-Quelle kann noch nicht gelöscht werden.");
  }

  revalidatePath("/crew-dispatch");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/asphalt-dispatch");
}
