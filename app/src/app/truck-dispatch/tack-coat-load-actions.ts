"use server";

import { revalidatePath } from "next/cache";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import {
  getDayRange,
  getOpenLitersForTackCoatPosition,
  roundLiters,
} from "@/lib/tack-coat-loads";

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
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/crew-dispatch");
}

async function getVehicleSnapshot(vehicleId: string | null) {
  if (!vehicleId) return null;

  return prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    include: vehicleInventoryLinkInclude,
  });
}

async function getDriverSnapshot(driverId: string | null) {
  if (!driverId) return null;

  return prisma.driver.findUnique({
    where: {
      id: driverId,
    },
  });
}

function getAllocationLitersFromCapacity({
  openLiters,
  capacityLiters,
}: {
  openLiters: number;
  capacityLiters: number;
}) {
  if (capacityLiters <= 0) {
    throw new Error("Bitte eine Transportmenge größer 0 l eintragen.");
  }

  if (openLiters <= 0) {
    throw new Error("Für diese Anspritzmittel-Position ist keine offene Menge mehr vorhanden.");
  }

  return roundLiters(Math.min(capacityLiters, openLiters));
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
        } ist an diesem Tag bereits in der Kurzstrecke eingeplant.`,
      );
    }

    if (vehicleId && existingShortHaul.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingShortHaul.licensePlate ??
          existingShortHaul.vehicleNumber ??
          ""
        } ist an diesem Tag bereits in der Kurzstrecke eingeplant.`,
      );
    }
  }

  const existingAsphaltAllocation = await prisma.asphaltLoadAllocation.findFirst({
    where: {
      sourceType: "SHORT",
      workDate: getDayRange(workDate),
      OR: orConditions,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingAsphaltAllocation) {
    if (driverId && existingAsphaltAllocation.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingAsphaltAllocation.driverName ?? ""
        } ist an diesem Tag bereits über eine Asphaltmenge eingeplant.`,
      );
    }

    if (vehicleId && existingAsphaltAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingAsphaltAllocation.licensePlate ??
          existingAsphaltAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Asphaltmenge eingeplant.`,
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
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant.`,
      );
    }

    if (vehicleId && existingTackCoatAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingTackCoatAllocation.licensePlate ??
          existingTackCoatAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant.`,
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
        } · ${existingLongHaul.entry.projectName} geplant.`,
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
        } · ${existingLongHaul.entry.projectName} geplant.`,
      );
    }
  }
}

export async function createTackCoatLoadAllocation(formData: FormData) {
  const workDate = parseDate(formData.get("workDate"));
  const sourceType = text(formData.get("sourceType")) || "SHORT";
  const projectId = optionalText(formData.get("projectId"));
  const projectNumber = text(formData.get("projectNumber"));
  const materialName = text(formData.get("materialName"));
  const quantityUnit = text(formData.get("quantityUnit")) || "l";
  const manualVehicleId = optionalText(formData.get("vehicleId"));
  const manualDriverId = optionalText(formData.get("driverId"));
  const tourCount = parsePositiveInt(formData.get("tourCount"));
  const litersPerTour = roundLiters(parseNumber(formData.get("litersPerTour")));
  const capacityLiters = roundLiters(tourCount * litersPerTour);
  const startTime = parseTime(formData.get("startTime"), "06:30");
  const endTime = parseTime(formData.get("endTime"), "17:00");
  const notes = optionalText(formData.get("notes"));

  if (!projectNumber && !projectId) {
    throw new Error("Bitte eine Baustelle auswählen.");
  }

  if (!materialName) {
    throw new Error("Bitte ein Anspritzmittel auswählen.");
  }

  const { position, openLiters } = await getOpenLitersForTackCoatPosition({
    workDate,
    projectId,
    projectNumber,
    materialName,
    quantityUnit,
  });

  const totalLiters = getAllocationLitersFromCapacity({
    openLiters,
    capacityLiters,
  });

  await assertShortSourceAvailability({
    driverId: manualDriverId,
    vehicleId: manualVehicleId,
    workDate,
  });

  const [vehicle, driver] = await Promise.all([
    getVehicleSnapshot(manualVehicleId),
    getDriverSnapshot(manualDriverId),
  ]);
  const inventoryItem = vehicle ? getVehicleInventoryItem(vehicle) : null;

  const driverName =
    driver != null ? `${driver.lastName}, ${driver.firstName}` : null;

  await prisma.tackCoatLoadAllocation.create({
    data: {
      workDate,
      sourceType,
      asphaltDispatchEntryId: position.asphaltDispatchEntryId,
      projectId: position.projectId,
      projectNumber: position.projectNumber,
      projectName: position.projectName,
      tackCoatMaterialTypeId: position.tackCoatMaterialTypeId,
      tackCoatInventoryItemId: position.tackCoatInventoryItemId,
      materialName: position.materialName,
      quantityUnit: position.quantityUnit,
      ownerType: "OWN",
      vehicleId: vehicle?.id ?? null,
      vehicleInventoryItemId: inventoryItem?.id ?? null,
      vehicleNumber: inventoryItem?.objectNumber ?? vehicle?.vehicleNumber ?? null,
      licensePlate: inventoryItem?.licensePlate ?? vehicle?.licensePlate ?? null,
      vehicleType: vehicle?.vehicleType ?? null,
      vehicleCategory:
        inventoryItem?.category?.parentCategory?.name && inventoryItem?.category?.name
          ? `${inventoryItem.category.parentCategory.name} / ${inventoryItem.category.name}`
          : inventoryItem?.category?.name ?? vehicle?.category ?? null,
      driverId: driver?.id ?? null,
      driverName,
      tourCount,
      litersPerTour,
      totalLiters,
      startTime,
      endTime,
      notes,
    },
  });

  revalidateConsumers();
}

export async function updateTackCoatLoadAllocation(formData: FormData) {
  const id = text(formData.get("id"));
  const tourCount = parsePositiveInt(formData.get("tourCount"));
  const litersPerTour = roundLiters(parseNumber(formData.get("litersPerTour")));
  const capacityLiters = roundLiters(tourCount * litersPerTour);
  const startTime = parseTime(formData.get("startTime"), "06:30");
  const endTime = parseTime(formData.get("endTime"), "17:00");
  const notes = optionalText(formData.get("notes"));

  if (!id) {
    throw new Error("Anspritzmittel-Zuteilung fehlt.");
  }

  const existing = await prisma.tackCoatLoadAllocation.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw new Error("Anspritzmittel-Zuteilung wurde nicht gefunden.");
  }

  const { openLiters } = await getOpenLitersForTackCoatPosition({
    workDate: existing.workDate,
    projectId: existing.projectId,
    projectNumber: existing.projectNumber,
    materialName: existing.materialName,
    quantityUnit: existing.quantityUnit,
    ignoreAllocationId: id,
  });

  const totalLiters = getAllocationLitersFromCapacity({
    openLiters,
    capacityLiters,
  });

  await prisma.tackCoatLoadAllocation.update({
    where: {
      id,
    },
    data: {
      tourCount,
      litersPerTour,
      totalLiters,
      startTime,
      endTime,
      notes,
    },
  });

  revalidateConsumers();
}

export async function deleteTackCoatLoadAllocation(formData: FormData) {
  const id = text(formData.get("id"));

  if (!id) {
    throw new Error("Anspritzmittel-Zuteilung fehlt.");
  }

  await prisma.tackCoatLoadAllocation.delete({
    where: {
      id,
    },
  });

  revalidateConsumers();
}
