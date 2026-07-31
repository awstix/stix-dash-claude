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

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function revalidateEquipmentConsumers() {
  revalidatePath("/equipment-dispatch");
  revalidatePath("/crew-dispatch");
}

async function assertEquipmentIsFree({
  vehicleId,
  inventoryItemId,
  startDate,
  endDate,
  ignoreId,
}: {
  vehicleId: string;
  inventoryItemId?: string | null;
  startDate: Date;
  endDate: Date;
  ignoreId?: string;
}) {
  const vehicleConditions = [
    { vehicleId },
    ...(inventoryItemId ? [{ inventoryItemId }] : []),
  ];

  const conflict = await prisma.equipmentDispatchAssignment.findFirst({
    where: {
      OR: vehicleConditions,
      ...(ignoreId
        ? {
            id: {
              not: ignoreId,
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
      inventoryItem: true,
      project: true,
      vehicle: true,
    },
    orderBy: [{ startDate: "asc" }],
  });

  if (!conflict) {
    return;
  }

  throw new Error(
    `Gerät ${
      conflict.inventoryItem?.objectNumber ??
      conflict.inventoryItem?.inventoryNumber ??
      conflict.inventoryItem?.name ??
      conflict.vehicle.vehicleNumber
    } ist bereits vom ${formatGermanDate(conflict.startDate)} bis ${formatGermanDate(
      conflict.endDate,
    )} auf ${conflict.project.projectNumber} · ${
      conflict.project.name
    } disponiert.`,
  );
}

async function getVehicle(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    include: {
      inventoryItems: {
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!vehicle) {
    throw new Error("Gerät/Fahrzeug wurde nicht gefunden.");
  }

  return vehicle;
}

async function getVehicleByInventoryItemId(inventoryItemId: string) {
  const inventoryItem = await prisma.inventoryItem.findUnique({
    where: {
      id: inventoryItemId,
    },
    select: {
      vehicleId: true,
    },
  });

  if (!inventoryItem?.vehicleId) {
    throw new Error(
      "Inventarobjekt wurde nicht gefunden oder ist nicht mit der Geräte-Disposition verknüpft.",
    );
  }

  return getVehicle(inventoryItem.vehicleId);
}

async function getVehicleFromFormData(formData: FormData) {
  const inventoryItemId = optionalString(formData.get("inventoryItemId"));
  const vehicleId = optionalString(formData.get("vehicleId"));

  if (inventoryItemId) {
    return getVehicleByInventoryItemId(inventoryItemId);
  }

  if (vehicleId) {
    return getVehicle(vehicleId);
  }

  throw new Error("Bitte ein Inventarobjekt wählen.");
}

function getVehicleInventoryItemId(vehicle: {
  inventoryItems?: { id: string }[];
}) {
  return vehicle.inventoryItems?.[0]?.id ?? null;
}

async function getProject(projectId: string) {
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

async function getCrewOrNull(crewId: string | null) {
  if (!crewId) return null;

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

export async function createEquipmentDispatchAssignment(formData: FormData) {
  await requireSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const crewId = optionalString(formData.get("crewId"));
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const [vehicle] = await Promise.all([
    getVehicleFromFormData(formData),
    getProject(projectId),
    getCrewOrNull(crewId),
  ]);
  const inventoryItemId = getVehicleInventoryItemId(vehicle);
  const vehicleId = vehicle.id;

  await assertEquipmentIsFree({
    vehicleId,
    inventoryItemId,
    startDate,
    endDate,
  });

  await prisma.equipmentDispatchAssignment.create({
    data: {
      vehicle: {
        connect: {
          id: vehicleId,
        },
      },
      ...(inventoryItemId
        ? {
            inventoryItem: {
              connect: {
                id: inventoryItemId,
              },
            },
          }
        : {}),
      project: {
        connect: {
          id: projectId,
        },
      },
      ...(crewId
        ? {
            crew: {
              connect: {
                id: crewId,
              },
            },
          }
        : {}),
      startDate,
      endDate,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateEquipmentConsumers();
}

export async function updateEquipmentDispatchAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const crewId = optionalString(formData.get("crewId"));
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Gerätezuweisung-ID fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const [vehicle] = await Promise.all([
    getVehicleFromFormData(formData),
    getProject(projectId),
    getCrewOrNull(crewId),
  ]);
  const inventoryItemId = getVehicleInventoryItemId(vehicle);
  const vehicleId = vehicle.id;

  await assertEquipmentIsFree({
    vehicleId,
    inventoryItemId,
    startDate,
    endDate,
    ignoreId: id,
  });

  await prisma.equipmentDispatchAssignment.update({
    where: {
      id,
    },
    data: {
      vehicle: {
        connect: {
          id: vehicleId,
        },
      },
      inventoryItem: inventoryItemId
        ? {
            connect: {
              id: inventoryItemId,
            },
          }
        : {
            disconnect: true,
          },
      project: {
        connect: {
          id: projectId,
        },
      },
      crew: crewId
        ? {
            connect: {
              id: crewId,
            },
          }
        : {
            disconnect: true,
          },
      startDate,
      endDate,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateEquipmentConsumers();
}


export async function createEquipmentDispatchAssignmentFromDefaultDates(
  formData: FormData,
) {
  await requireSession();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const crewId = optionalString(formData.get("crewId"));
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!projectId) {
    throw new Error("Baustelle fehlt. Diese Kolonnen-Grundinfo kann nicht automatisch übernommen werden.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const [vehicle] = await Promise.all([
    getVehicleFromFormData(formData),
    getProject(projectId),
    getCrewOrNull(crewId),
  ]);
  const inventoryItemId = getVehicleInventoryItemId(vehicle);
  const vehicleId = vehicle.id;

  await assertEquipmentIsFree({
    vehicleId,
    inventoryItemId,
    startDate,
    endDate,
  });

  await prisma.equipmentDispatchAssignment.create({
    data: {
      vehicle: {
        connect: {
          id: vehicleId,
        },
      },
      ...(inventoryItemId
        ? {
            inventoryItem: {
              connect: {
                id: inventoryItemId,
              },
            },
          }
        : {}),
      project: {
        connect: {
          id: projectId,
        },
      },
      ...(crewId
        ? {
            crew: {
              connect: {
                id: crewId,
              },
            },
          }
        : {}),
      startDate,
      endDate,
      notes:
        optionalString(formData.get("notes")) ??
        "Aus Kolonnen-Grundinfo in die Gerätedisposition übernommen.",
    },
  });

  revalidateEquipmentConsumers();
}

export async function updateEquipmentDispatchAssignmentDates(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const startDate = parseDate(formData.get("startDate"), "Startdatum");
  const endDate = parseDate(formData.get("endDate"), "Enddatum");

  if (!id) {
    throw new Error("Gerätezuweisung-ID fehlt.");
  }

  if (endDate < startDate) {
    throw new Error("Enddatum darf nicht vor Startdatum liegen.");
  }

  const assignment = await prisma.equipmentDispatchAssignment.findUnique({
    where: {
      id,
    },
  });

  if (!assignment) {
    throw new Error("Gerätezuweisung wurde nicht gefunden.");
  }

  await assertEquipmentIsFree({
    vehicleId: assignment.vehicleId,
    inventoryItemId: assignment.inventoryItemId,
    startDate,
    endDate,
    ignoreId: id,
  });

  await prisma.equipmentDispatchAssignment.update({
    where: {
      id,
    },
    data: {
      startDate,
      endDate,
    },
  });

  revalidateEquipmentConsumers();
}

export async function deleteEquipmentDispatchAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Gerätezuweisung-ID fehlt.");
  }

  await prisma.equipmentDispatchAssignment.delete({
    where: {
      id,
    },
  });

  revalidateEquipmentConsumers();
}
