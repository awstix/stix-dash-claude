"use server";

import { revalidatePath } from "next/cache";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import { getOpenTonsForDispatchEntry, roundTons } from "@/lib/asphalt-loads";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function optionalText(value: FormDataEntryValue | null) {
  const result = text(value);
  return result.length > 0 ? result : null;
}

function parseDate(value: FormDataEntryValue | null) {
  const result = text(value);

  if (!result) {
    throw new Error("Datum fehlt.");
  }

  return new Date(`${result}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getDayRange(workDate: Date) {
  return {
    gte: workDate,
    lt: addDays(workDate, 1),
  };
}

function parseNumber(value: FormDataEntryValue | null) {
  const result = Number(text(value).replace(",", "."));

  if (Number.isNaN(result)) {
    return 0;
  }

  return result;
}

function parsePositiveInt(value: FormDataEntryValue | null) {
  const result = Number.parseInt(text(value), 10);

  if (Number.isNaN(result) || result <= 0) {
    return 1;
  }

  return result;
}

function parseTime(value: FormDataEntryValue | null, fallback: string) {
  const result = text(value);
  return result.length > 0 ? result : fallback;
}

function revalidateConsumers() {
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/orders");
}

async function getVehicleSnapshot(vehicleId: string | null) {
  if (!vehicleId) {
    return null;
  }

  return prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    include: vehicleInventoryLinkInclude,
  });
}

async function getDriverSnapshot(driverId: string | null) {
  if (!driverId) {
    return null;
  }

  return prisma.driver.findUnique({
    where: {
      id: driverId,
    },
  });
}

async function getShortHaulSnapshot(shortHaulAssignmentId: string | null) {
  if (!shortHaulAssignmentId) {
    return null;
  }

  return prisma.shortHaulAssignment.findUnique({
    where: {
      id: shortHaulAssignmentId,
    },
  });
}

async function getLongHaulEntrySnapshot(longHaulEntryId: string | null) {
  if (!longHaulEntryId) {
    return null;
  }

  return prisma.truckLongHaulEntry.findUnique({
    where: {
      id: longHaulEntryId,
    },
  });
}

async function getLongHaulTruckSnapshot(longHaulTruckAssignmentId: string | null) {
  if (!longHaulTruckAssignmentId) {
    return null;
  }

  return prisma.truckLongHaulTruckAssignment.findUnique({
    where: {
      id: longHaulTruckAssignmentId,
    },
    include: {
      entry: true,
    },
  });
}

function getAllocationTonsFromCapacity({
  openTons,
  capacityTons,
}: {
  openTons: number;
  capacityTons: number;
}) {
  if (capacityTons <= 0) {
    throw new Error("Bitte eine Transportkapazität größer 0 t eintragen.");
  }

  if (openTons <= 0) {
    throw new Error("Für diese Asphaltposition ist keine offene Menge mehr vorhanden.");
  }

  return roundTons(Math.min(capacityTons, openTons));
}

function validatePayload({
  tonsPerTour,
  asphaltPayloadTons,
  vehicleLabel,
}: {
  tonsPerTour: number;
  asphaltPayloadTons: number;
  vehicleLabel: string;
}) {
  // Die Fahrzeug-Nutzlast dient nur als Vorschlag.
  // Die Handeingabe bei t/Tour hat Vorrang.
  // Deshalb wird hier bewusst nicht blockiert.
  void tonsPerTour;
  void asphaltPayloadTons;
  void vehicleLabel;
}

async function assertShortSourceAvailability({
  driverId,
  vehicleId,
  workDate,
}: {
  driverId: string | null;
  vehicleId: string | null;
  workDate: Date;
}) {
  const orConditions = [];

  if (driverId) {
    orConditions.push({ driverId });
  }

  if (vehicleId) {
    orConditions.push({ vehicleId });
  }

  if (orConditions.length === 0) {
    return;
  }

  const existingShortHaul = await prisma.shortHaulAssignment.findFirst({
    where: {
      workDate: getDayRange(workDate),
      OR: orConditions,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingShortHaul) {
    if (driverId && existingShortHaul.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingShortHaul.driverName ?? ""
        } ist an diesem Tag bereits in der Kurzstrecke eingeplant. Bitte den bestehenden Kurzstrecken-Eintrag öffnen und dort weitere Touren ergänzen.`,
      );
    }

    if (vehicleId && existingShortHaul.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingShortHaul.licensePlate ??
          existingShortHaul.vehicleNumber ??
          ""
        } ist an diesem Tag bereits in der Kurzstrecke eingeplant. Bitte den bestehenden Kurzstrecken-Eintrag öffnen und dort weitere Touren ergänzen.`,
      );
    }
  }

  const existingShortAllocation = await prisma.asphaltLoadAllocation.findFirst({
    where: {
      sourceType: "SHORT",
      workDate: getDayRange(workDate),
      OR: orConditions,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingShortAllocation) {
    if (driverId && existingShortAllocation.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingShortAllocation.driverName ?? ""
        } ist an diesem Tag bereits über eine nicht verteilte Asphaltmenge eingeplant. Bitte die bestehende Asphalt-Zuteilung bearbeiten oder löschen.`,
      );
    }

    if (vehicleId && existingShortAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingShortAllocation.licensePlate ??
          existingShortAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine nicht verteilte Asphaltmenge eingeplant. Bitte die bestehende Asphalt-Zuteilung bearbeiten oder löschen.`,
      );
    }
  }

  const existingTackCoatAllocation = await prisma.tackCoatLoadAllocation.findFirst({
    where: {
      sourceType: "SHORT",
      workDate: getDayRange(workDate),
      OR: orConditions,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingTackCoatAllocation) {
    if (driverId && existingTackCoatAllocation.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingTackCoatAllocation.driverName ?? ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Anspritzmittel-Zuteilung bearbeiten oder löschen.`,
      );
    }

    if (vehicleId && existingTackCoatAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingTackCoatAllocation.licensePlate ??
          existingTackCoatAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Anspritzmittel-Zuteilung bearbeiten oder löschen.`,
      );
    }
  }

  const existingLongHaul = await prisma.truckLongHaulTruckAssignment.findFirst({
    where: {
      ownerType: "OWN",
      OR: orConditions,
      entry: {
        workDate: getDayRange(workDate),
      },
    },
    include: {
      entry: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingLongHaul) {
    if (driverId && existingLongHaul.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingLongHaul.driverName ?? ""
        } ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${
          existingLongHaul.entry.projectNumber
        } · ${
          existingLongHaul.entry.projectName
        } geplant. Bitte bewusst prüfen und dort ändern.`,
      );
    }

    if (vehicleId && existingLongHaul.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingLongHaul.licensePlate ??
          existingLongHaul.vehicleNumber ??
          ""
        } ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${
          existingLongHaul.entry.projectNumber
        } · ${
          existingLongHaul.entry.projectName
        } geplant. Bitte bewusst prüfen und dort ändern.`,
      );
    }
  }
}

async function createAsphaltLoadAllocationInternal(formData: FormData) {
  const workDate = parseDate(formData.get("workDate"));
  const asphaltDispatchEntryId = text(formData.get("asphaltDispatchEntryId"));
  const sourceType = text(formData.get("sourceType")) || "SHORT";

  const shortHaulAssignmentId = optionalText(
    formData.get("shortHaulAssignmentId"),
  );
  const longHaulEntryId = optionalText(formData.get("longHaulEntryId"));
  const longHaulTruckAssignmentId = optionalText(
    formData.get("longHaulTruckAssignmentId"),
  );

  const manualVehicleId = optionalText(formData.get("vehicleId"));
  const manualDriverId = optionalText(formData.get("driverId"));

  const tourCount = parsePositiveInt(formData.get("tourCount"));
  const tonsPerTour = roundTons(parseNumber(formData.get("tonsPerTour")));
  const capacityTons = roundTons(tourCount * tonsPerTour);
  const startTime = parseTime(formData.get("startTime"), "06:30");
  const endTime = parseTime(formData.get("endTime"), "17:00");
  const notes = optionalText(formData.get("notes"));

  if (!asphaltDispatchEntryId) {
    throw new Error("Bitte eine Asphaltposition auswählen.");
  }

  const { dispatchEntry, openTons } = await getOpenTonsForDispatchEntry({
    asphaltDispatchEntryId,
  });

  const totalTons = getAllocationTonsFromCapacity({
    openTons,
    capacityTons,
  });

  const [shortHaul, longHaulEntry, longHaulTruck] = await Promise.all([
    getShortHaulSnapshot(shortHaulAssignmentId),
    getLongHaulEntrySnapshot(longHaulEntryId),
    getLongHaulTruckSnapshot(longHaulTruckAssignmentId),
  ]);

  const resolvedVehicleId =
    manualVehicleId ??
    shortHaul?.vehicleId ??
    longHaulTruck?.vehicleId ??
    null;

  const resolvedDriverId =
    manualDriverId ??
    shortHaul?.driverId ??
    longHaulTruck?.driverId ??
    null;

  if (sourceType === "SHORT" && !shortHaulAssignmentId) {
    await assertShortSourceAvailability({
      driverId: resolvedDriverId,
      vehicleId: resolvedVehicleId,
      workDate,
    });
  }

  const [vehicle, driver] = await Promise.all([
    getVehicleSnapshot(resolvedVehicleId),
    getDriverSnapshot(resolvedDriverId),
  ]);
  const inventoryItem = vehicle ? getVehicleInventoryItem(vehicle) : null;

  const vehicleNumber =
    inventoryItem?.objectNumber ??
    vehicle?.vehicleNumber ??
    shortHaul?.vehicleNumber ??
    longHaulTruck?.vehicleNumber ??
    null;

  const licensePlate =
    inventoryItem?.licensePlate ??
    vehicle?.licensePlate ??
    shortHaul?.licensePlate ??
    longHaulTruck?.licensePlate ??
    null;

  const vehicleType =
    vehicle?.vehicleType ??
    shortHaul?.vehicleType ??
    longHaulTruck?.vehicleType ??
    null;

  const vehicleCategory =
    inventoryItem?.category?.parentCategory?.name && inventoryItem?.category?.name
      ? `${inventoryItem.category.parentCategory.name} / ${inventoryItem.category.name}`
      : inventoryItem?.category?.name ??
    vehicle?.category ??
    shortHaul?.vehicleCategory ??
    longHaulTruck?.vehicleCategory ??
    null;

  const vehicleLabel = [vehicleNumber, licensePlate, vehicleCategory, vehicleType]
    .filter(Boolean)
    .join(" · ");

  validatePayload({
    tonsPerTour,
    asphaltPayloadTons: vehicle?.asphaltPayloadTons ?? 0,
    vehicleLabel: vehicleLabel || "gewählter LKW",
  });

  const driverName =
    driver != null
      ? `${driver.lastName}, ${driver.firstName}`
      : shortHaul?.driverName ?? longHaulTruck?.driverName ?? null;

  const ownerType =
    longHaulTruck?.ownerType ?? (sourceType === "LONG" ? "OWN" : "OWN");

  const subcontractorName = longHaulTruck?.subcontractorName ?? null;

  await prisma.asphaltLoadAllocation.create({
    data: {
      workDate,
      sourceType,

      asphaltDispatchEntryId: dispatchEntry.id,

      projectId: dispatchEntry.projectId,
      projectNumber: dispatchEntry.projectNumber,
      projectName: dispatchEntry.projectName,

      asphaltMixTypeId: dispatchEntry.asphaltMixTypeId,
      asphaltInventoryItemId: dispatchEntry.asphaltInventoryItemId,
      asphaltMixNumber: dispatchEntry.asphaltMixNumber,
      asphaltMixName: dispatchEntry.asphaltMixName,

      shortHaulAssignmentId: shortHaul?.id ?? null,
      longHaulEntryId: longHaulEntry?.id ?? longHaulTruck?.entryId ?? null,
      longHaulTruckAssignmentId: longHaulTruck?.id ?? null,

      ownerType,

      vehicleId: vehicle?.id ?? null,
      vehicleInventoryItemId:
        inventoryItem?.id ??
        shortHaul?.vehicleInventoryItemId ??
        longHaulTruck?.vehicleInventoryItemId ??
        null,
      vehicleNumber,
      licensePlate,
      vehicleType,
      vehicleCategory,

      driverId: driver?.id ?? null,
      driverName,

      subcontractorName,

      tourCount,
      tonsPerTour,
      totalTons,

      startTime,
      endTime,

      notes,
    },
  });
}

export async function createAsphaltLoadAllocation(formData: FormData) {
  await createAsphaltLoadAllocationInternal(formData);
  revalidateConsumers();
}

function getBatchIndexes(formData: FormData) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    const match = key.match(/^batchRowId_(\d+)$/);

    if (match) {
      indexes.add(Number(match[1]));
    }
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

export async function createAsphaltLoadAllocationBatch(formData: FormData) {
  const indexes = getBatchIndexes(formData);

  if (indexes.length === 0) {
    throw new Error("Es wurde kein Vorschlag zum Speichern gefunden.");
  }

  for (const index of indexes) {
    const driverId = optionalText(formData.get(`batchDriverId_${index}`));
    const vehicleId = optionalText(formData.get(`batchVehicleId_${index}`));
    const tourCount = text(formData.get(`batchTourCount_${index}`));
    const tonsPerTour = text(formData.get(`batchTonsPerTour_${index}`));

    if (!driverId || !vehicleId || !tourCount || !tonsPerTour) {
      continue;
    }

    const rowFormData = new FormData();
    rowFormData.set("workDate", text(formData.get("workDate")));
    rowFormData.set("sourceType", text(formData.get("sourceType")) || "SHORT");
    rowFormData.set(
      "asphaltDispatchEntryId",
      text(formData.get("asphaltDispatchEntryId")),
    );
    rowFormData.set("driverId", driverId);
    rowFormData.set("vehicleId", vehicleId);
    rowFormData.set("tourCount", tourCount);
    rowFormData.set("tonsPerTour", tonsPerTour);
    rowFormData.set(
      "startTime",
      text(formData.get(`batchStartTime_${index}`)) || "06:30",
    );
    rowFormData.set(
      "endTime",
      text(formData.get(`batchEndTime_${index}`)) || "17:00",
    );
    rowFormData.set("notes", text(formData.get(`batchNotes_${index}`)));

    await createAsphaltLoadAllocationInternal(rowFormData);
  }

  revalidateConsumers();
}

export async function updateAsphaltLoadAllocation(formData: FormData) {
  const id = text(formData.get("id"));
  const tourCount = parsePositiveInt(formData.get("tourCount"));
  const tonsPerTour = roundTons(parseNumber(formData.get("tonsPerTour")));
  const capacityTons = roundTons(tourCount * tonsPerTour);
  const startTime = parseTime(formData.get("startTime"), "06:30");
  const endTime = parseTime(formData.get("endTime"), "17:00");
  const notes = optionalText(formData.get("notes"));

  if (!id) {
    throw new Error("Zuteilung fehlt.");
  }

  const existing = await prisma.asphaltLoadAllocation.findUnique({
    where: {
      id,
    },
    include: {
      vehicle: true,
    },
  });

  if (!existing) {
    throw new Error("Zuteilung wurde nicht gefunden.");
  }

  const { openTons } = await getOpenTonsForDispatchEntry({
    asphaltDispatchEntryId: existing.asphaltDispatchEntryId,
    ignoreAllocationId: id,
  });

  const totalTons = getAllocationTonsFromCapacity({
    openTons,
    capacityTons,
  });

  const vehicleLabel = [
    existing.vehicleNumber,
    existing.licensePlate,
    existing.vehicleCategory,
    existing.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");

  validatePayload({
    tonsPerTour,
    asphaltPayloadTons: existing.vehicle?.asphaltPayloadTons ?? 0,
    vehicleLabel: vehicleLabel || "gewählter LKW",
  });

  await prisma.asphaltLoadAllocation.update({
    where: {
      id,
    },
    data: {
      tourCount,
      tonsPerTour,
      totalTons,
      startTime,
      endTime,
      notes,
    },
  });

  revalidateConsumers();
}

export async function deleteAsphaltLoadAllocation(formData: FormData) {
  const id = text(formData.get("id"));

  if (!id) {
    throw new Error("Zuteilung fehlt.");
  }

  await prisma.asphaltLoadAllocation.delete({
    where: {
      id,
    },
  });

  revalidateConsumers();
}
