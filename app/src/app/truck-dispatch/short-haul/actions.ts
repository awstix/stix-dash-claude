"use server";
import type { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

function parseWorkDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error("Datum fehlt.");
  }

  return new Date(`${text}T00:00:00.000Z`);
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

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");

  if (!text) {
    return null;
  }

  const number = Number(text);
  return Number.isNaN(number) ? null : number;
}

function formatVehicleName(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
}) {
  return `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"} · ${
    vehicle.category
  } · ${vehicle.vehicleType}`;
}

function getIndexesFromFormData(formData: FormData, prefixes: string[]) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    for (const prefix of prefixes) {
      const match = key.match(new RegExp(`^${prefix}_(\\d+)$`));

      if (match) {
        indexes.add(Number(match[1]));
      }
    }
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) || value === "24:00";
}

function timeToMinutes(value: string) {
  if (value === "24:00") {
    return 1440;
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function assertValidTimeRange(startTime: string, endTime: string) {
  if (!isValidTime(startTime)) {
    throw new Error("Beginn ist keine gültige Uhrzeit.");
  }

  if (!isValidTime(endTime)) {
    throw new Error("Ende ist keine gültige Uhrzeit.");
  }

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("Ende muss nach Beginn liegen.");
  }
}

function toursOverlap(
  first: { startTime: string; endTime: string },
  second: { startTime: string; endTime: string }
) {
  const firstStart = timeToMinutes(first.startTime);
  const firstEnd = timeToMinutes(first.endTime);
  const secondStart = timeToMinutes(second.startTime);
  const secondEnd = timeToMinutes(second.endTime);

  return firstStart < secondEnd && secondStart < firstEnd;
}

function findOverlappingTimeBlock<T extends { startTime: string; endTime: string }>(
  existingBlocks: T[],
  plannedTours: { startTime: string; endTime: string }[]
) {
  return existingBlocks.find((block) =>
    plannedTours.some((tour) => toursOverlap(block, tour))
  );
}

async function getVehicle(vehicleId: string) {
  if (!vehicleId) return null;

  return prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    include: vehicleInventoryLinkInclude,
  });
}

function getInventoryCategoryLabel(
  vehicle: ({
    category: string;
  } & VehicleWithInventoryLink) | null,
) {
  const item = vehicle ? getVehicleInventoryItem(vehicle) : null;
  const categoryName = item?.category?.name ?? vehicle?.category ?? "";
  const parentCategoryName = item?.category?.parentCategory?.name;

  return parentCategoryName
    ? `${parentCategoryName} / ${categoryName}`
    : categoryName;
}

async function getDriver(driverId: string) {
  if (!driverId) return null;

  return prisma.driver.findUnique({
    where: {
      id: driverId,
    },
  });
}

function normalizePurposeType(value: string) {
  if (value === "MATERIAL" || value === "ASPHALT") {
    return "TRANSPORT_MATERIAL";
  }

  if (value === "TRANSPORT") {
    return "TRANSPORT_MACHINE";
  }

  if (value === "TRANSPORT_MATERIAL" || value === "TRANSPORT_MACHINE") {
    return value;
  }

  return "CUSTOM";
}

function categoryAllowsMaterialTransport(category: {
  useInTruckDispatchMaterial: boolean;
  parentCategory: { useInTruckDispatchMaterial: boolean } | null;
}) {
  return Boolean(
    category.useInTruckDispatchMaterial ||
      category.parentCategory?.useInTruckDispatchMaterial
  );
}

function categoryAllowsMachineTransport(category: {
  useInTruckDispatchObject: boolean;
  useInTruckDispatchSelection: boolean;
  parentCategory: {
    useInTruckDispatchObject: boolean;
    useInTruckDispatchSelection: boolean;
  } | null;
}) {
  return Boolean(
    category.useInTruckDispatchObject ||
      category.useInTruckDispatchSelection ||
      category.parentCategory?.useInTruckDispatchObject ||
      category.parentCategory?.useInTruckDispatchSelection
  );
}

function getCategoryPath(category: {
  name: string;
  parentCategory: { name: string } | null;
}) {
  return category.parentCategory
    ? `${category.parentCategory.name} › ${category.name}`
    : category.name;
}

async function resolveInventoryPurpose({
  purposeType,
  itemId,
}: {
  purposeType: string;
  itemId: string;
}) {
  const [source, id] = itemId.includes(":")
    ? itemId.split(":")
    : ["item", itemId];

  if (!source || !id) {
    throw new Error("Die Auswahl ist ungültig. Bitte erneut auswählen.");
  }

  if (source === "category") {
    const category = await prisma.inventoryCategory.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        useInTruckDispatchMaterial: true,
        useInTruckDispatchObject: true,
        useInTruckDispatchSelection: true,
        parentCategory: {
          select: {
            name: true,
            useInTruckDispatchMaterial: true,
            useInTruckDispatchObject: true,
            useInTruckDispatchSelection: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error("Inventarkategorie wurde nicht gefunden.");
    }

    const isAllowed =
      purposeType === "TRANSPORT_MATERIAL"
        ? categoryAllowsMaterialTransport(category)
        : categoryAllowsMachineTransport(category);

    if (!isAllowed) {
      throw new Error(
        "Diese Inventarkategorie ist für diese Zweck-Art nicht freigegeben."
      );
    }

    return {
      itemId,
      itemName: getCategoryPath(category),
      customPurpose: null,
      defaultUnit: null,
    };
  }

  if (source === "item") {
    const item = await prisma.inventoryItem.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        objectNumber: true,
        inventoryNumber: true,
        stixId: true,
        licensePlate: true,
        manufacturer: true,
        model: true,
        stockUnit: true,
        category: {
          select: {
            name: true,
            useInTruckDispatchMaterial: true,
            useInTruckDispatchObject: true,
            useInTruckDispatchSelection: true,
            parentCategory: {
              select: {
                name: true,
                useInTruckDispatchMaterial: true,
                useInTruckDispatchObject: true,
                useInTruckDispatchSelection: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new Error("Inventarobjekt wurde nicht gefunden.");
    }

    if (!item.category) {
      throw new Error("Inventarobjekt hat keine Kategorie.");
    }

    const isAllowed =
      purposeType === "TRANSPORT_MATERIAL"
        ? categoryAllowsMaterialTransport(item.category)
        : categoryAllowsMachineTransport(item.category);

    if (!isAllowed) {
      throw new Error(
        "Dieses Inventarobjekt ist für diese Zweck-Art nicht freigegeben."
      );
    }

    const itemName = [
      item.objectNumber,
      item.inventoryNumber,
      item.stixId,
      item.licensePlate,
      item.name,
      item.manufacturer,
      item.model,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      itemId,
      itemName,
      customPurpose: null,
      defaultUnit: item.stockUnit,
    };
  }

  throw new Error("Die Auswahl ist ungültig. Bitte erneut auswählen.");
}

async function resolvePurpose({
  purposeType,
  itemId,
  customPurpose,
}: {
  purposeType: string;
  itemId: string | null;
  customPurpose: string | null;
}) {
  const normalizedPurposeType = normalizePurposeType(purposeType);

  if (normalizedPurposeType === "CUSTOM" && customPurpose) {
    return {
      itemId: null,
      itemName: customPurpose,
      customPurpose,
      defaultUnit: null,
    };
  }

  if (
    (normalizedPurposeType === "TRANSPORT_MATERIAL" ||
      normalizedPurposeType === "TRANSPORT_MACHINE") &&
    itemId
  ) {
    return resolveInventoryPurpose({
      purposeType: normalizedPurposeType,
      itemId,
    });
  }

  if ((purposeType === "MATERIAL" || purposeType === "ASPHALT") && itemId) {
    return resolveInventoryPurpose({
      purposeType: "TRANSPORT_MATERIAL",
      itemId,
    });
  }

  if (purposeType === "TRANSPORT" && itemId) {
    return resolveInventoryPurpose({
      purposeType: "TRANSPORT_MACHINE",
      itemId,
    });
  }

  return {
    itemId: null,
    itemName: null,
    customPurpose: null,
    defaultUnit: null,
  };
}

async function findLongHaulConflicts({
  driverId,
  vehicleId,
  vehicleInventoryItemId,
  workDate,
}: {
  driverId: string;
  vehicleId: string;
  vehicleInventoryItemId?: string | null;
  workDate: Date;
}) {
  const orConditions = [];

  if (driverId) {
    orConditions.push({ driverId });
  }

  if (vehicleId) {
    orConditions.push({ vehicleId });
  }

  if (vehicleInventoryItemId) {
    orConditions.push({ vehicleInventoryItemId });
  }

  if (orConditions.length === 0) {
    return [];
  }

  const conflicts = await prisma.truckLongHaulTruckAssignment.findMany({
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

  return conflicts.map((conflict) => {
    const target =
      conflict.driverId === driverId
        ? `Fahrer ${conflict.driverName ?? ""}`
        : `Fahrzeug ${conflict.licensePlate ?? conflict.vehicleNumber ?? ""}`;

    return `${target} ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${conflict.entry.projectNumber} · ${conflict.entry.projectName} geplant.`;
  });
}

async function assertShortHaulAvailability({
  driverId,
  vehicleId,
  vehicleInventoryItemId,
  workDate,
  tours,
  excludeId,
}: {
  driverId: string;
  vehicleId: string;
  vehicleInventoryItemId?: string | null;
  workDate: Date;
  tours: { startTime: string; endTime: string }[];
  excludeId?: string;
}) {
  const vehicleConditions = [
    { vehicleId },
    ...(vehicleInventoryItemId ? [{ vehicleInventoryItemId }] : []),
  ];

  const existing = await prisma.shortHaulAssignment.findFirst({
    where: {
      workDate: getDayRange(workDate),
      OR: [{ driverId }, ...vehicleConditions],
      ...(excludeId
        ? {
            NOT: {
              id: excludeId,
            },
          }
        : {}),
    },
  });

  if (!existing) {
    return;
  }

  if (existing.driverId === driverId) {
    throw new Error(
      `Fahrer ${existing.driverName ?? ""} ist an diesem Tag bereits in der Kurzstrecke eingeplant. Bitte diesen bestehenden Eintrag öffnen und dort weitere Touren ergänzen.`
    );
  }

  if (existing.vehicleId === vehicleId) {
    throw new Error(
      `Fahrzeug ${existing.licensePlate ?? existing.vehicleNumber ?? ""} ist an diesem Tag bereits in der Kurzstrecke eingeplant. Bitte diesen bestehenden Eintrag öffnen und dort weitere Touren ergänzen.`
    );
  }

  if (
    vehicleInventoryItemId &&
    existing.vehicleInventoryItemId === vehicleInventoryItemId
  ) {
    throw new Error(
      `Fahrzeug ${existing.licensePlate ?? existing.vehicleNumber ?? ""} ist an diesem Tag bereits in der Kurzstrecke eingeplant. Bitte diesen bestehenden Eintrag öffnen und dort weitere Touren ergänzen.`
    );
  }

  const existingAsphaltAllocations = await prisma.asphaltLoadAllocation.findMany({
    where: {
      sourceType: "SHORT",
      workDate: getDayRange(workDate),
      OR: [{ driverId }, ...vehicleConditions],
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const existingAsphaltAllocation = findOverlappingTimeBlock(
    existingAsphaltAllocations,
    tours
  );

  if (existingAsphaltAllocation) {
    if (existingAsphaltAllocation.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingAsphaltAllocation.driverName ?? ""
        } ist an diesem Tag bereits über eine Asphaltmenge in der Kurzstrecke eingeplant. Bitte die bestehende Asphalt-Zuteilung bearbeiten oder löschen.`
      );
    }

    if (existingAsphaltAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingAsphaltAllocation.licensePlate ??
          existingAsphaltAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Asphaltmenge in der Kurzstrecke eingeplant. Bitte die bestehende Asphalt-Zuteilung bearbeiten oder löschen.`
      );
    }

    if (
      vehicleInventoryItemId &&
      existingAsphaltAllocation.vehicleInventoryItemId === vehicleInventoryItemId
    ) {
      throw new Error(
        `Fahrzeug ${
          existingAsphaltAllocation.licensePlate ??
          existingAsphaltAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Asphaltmenge in der Kurzstrecke eingeplant. Bitte die bestehende Asphalt-Zuteilung bearbeiten oder löschen.`
      );
    }
  }

  const existingTackCoatAllocations =
    await prisma.tackCoatLoadAllocation.findMany({
    where: {
      sourceType: "SHORT",
      workDate: getDayRange(workDate),
      OR: [{ driverId }, ...vehicleConditions],
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const existingTackCoatAllocation = findOverlappingTimeBlock(
    existingTackCoatAllocations,
    tours
  );

  if (existingTackCoatAllocation) {
    if (existingTackCoatAllocation.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingTackCoatAllocation.driverName ?? ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Anspritzmittel-Zuteilung bearbeiten oder löschen.`
      );
    }

    if (existingTackCoatAllocation.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingTackCoatAllocation.licensePlate ??
          existingTackCoatAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Anspritzmittel-Zuteilung bearbeiten oder löschen.`
      );
    }

    if (
      vehicleInventoryItemId &&
      existingTackCoatAllocation.vehicleInventoryItemId ===
        vehicleInventoryItemId
    ) {
      throw new Error(
        `Fahrzeug ${
          existingTackCoatAllocation.licensePlate ??
          existingTackCoatAllocation.vehicleNumber ??
          ""
        } ist an diesem Tag bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Anspritzmittel-Zuteilung bearbeiten oder löschen.`
      );
    }
  }
}

async function parseTours(formData: FormData) {
  const indexes = getIndexesFromFormData(formData, [
    "tourStartTime",
    "tourEndTime",
    "tourProjectId",
    "tourPurposeType",
    "tourItemId",
    "tourCustomPurpose",
    "tourQuantity",
    "tourQuantityUnit",
    "tourNotes",
  ]);

  const tours = [];

  for (const index of indexes) {
    const startTime = String(
      formData.get(`tourStartTime_${index}`) ?? ""
    ).trim();
    const endTime = String(formData.get(`tourEndTime_${index}`) ?? "").trim();
    const projectId = String(
      formData.get(`tourProjectId_${index}`) ?? ""
    ).trim();

    const purposeType = String(
      formData.get(`tourPurposeType_${index}`) ?? "CUSTOM"
    ).trim();
    const normalizedPurposeType = normalizePurposeType(purposeType);

    const itemId = optionalString(formData.get(`tourItemId_${index}`));
    const customPurpose = optionalString(
      formData.get(`tourCustomPurpose_${index}`)
    );

    const quantity = parseOptionalNumber(formData.get(`tourQuantity_${index}`));
    const quantityUnitInput = optionalString(
      formData.get(`tourQuantityUnit_${index}`)
    );

    const notes = optionalString(formData.get(`tourNotes_${index}`));

    if (
      !startTime &&
      !endTime &&
      !projectId &&
      !itemId &&
      !customPurpose &&
      quantity === null &&
      !quantityUnitInput &&
      !notes
    ) {
      continue;
    }

    if (!startTime) {
      throw new Error(`Tour ${tours.length + 1}: Beginn fehlt.`);
    }

    if (!endTime) {
      throw new Error(`Tour ${tours.length + 1}: Ende fehlt.`);
    }

    assertValidTimeRange(startTime, endTime);

    if (!projectId) {
      throw new Error(`Tour ${tours.length + 1}: Baustelle fehlt.`);
    }

    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new Error(`Tour ${tours.length + 1}: Projekt wurde nicht gefunden.`);
    }

    if (normalizedPurposeType === "CUSTOM" && !customPurpose) {
      throw new Error(`Tour ${tours.length + 1}: Freier Zweck fehlt.`);
    }

    if (normalizedPurposeType !== "CUSTOM" && !itemId) {
      throw new Error(`Tour ${tours.length + 1}: Auswahl fehlt.`);
    }

    const purpose = await resolvePurpose({
      purposeType,
      itemId,
      customPurpose,
    });

    const quantityUnit = quantityUnitInput ?? purpose.defaultUnit;

    const material =
      purpose.itemName ??
      customPurpose ??
      (quantity !== null
        ? `Menge ${quantity}${quantityUnit ? ` ${quantityUnit}` : ""}`
        : null);

    tours.push({
      tourNumber: tours.length + 1,
      startTime,
      endTime,
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,

      purposeType: normalizedPurposeType,
      itemId: purpose.itemId,
      itemName: purpose.itemName,
      customPurpose: purpose.customPurpose,
      quantity,
      quantityUnit,

      material,
      notes,
    });
  }

  if (tours.length === 0) {
    throw new Error(
      "Bitte mindestens eine Tour mit Beginn, Ende und Baustelle eintragen."
    );
  }

  return tours
    .sort((first, second) => {
      const startDiff =
        timeToMinutes(first.startTime) - timeToMinutes(second.startTime);

      if (startDiff !== 0) {
        return startDiff;
      }

      return timeToMinutes(first.endTime) - timeToMinutes(second.endTime);
    })
    .map((tour, index) => ({
      ...tour,
      tourNumber: index + 1,
    }));
}

async function resolveShortHaulData(formData: FormData, workDate: Date) {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const driverId = String(formData.get("driverId") ?? "").trim();

  if (!vehicleId) {
    throw new Error("Bitte ein Fahrzeug auswählen.");
  }

  if (!driverId) {
    throw new Error("Bitte einen Fahrer auswählen.");
  }

  const [vehicle, driver, tours] = await Promise.all([
    getVehicle(vehicleId),
    getDriver(driverId),
    parseTours(formData),
  ]);

  if (!vehicle) {
    throw new Error("Fahrzeug wurde nicht gefunden.");
  }

  if (!driver) {
    throw new Error("Fahrer wurde nicht gefunden.");
  }

  const inventoryItem = getVehicleInventoryItem(vehicle);

  const longHaulConflicts = await findLongHaulConflicts({
    driverId,
    vehicleId,
    vehicleInventoryItemId: inventoryItem?.id ?? null,
    workDate,
  });

  if (longHaulConflicts.length > 0) {
    throw new Error(
      `${longHaulConflicts.join(" ")} Fahrer oder LKW dürfen in der LKW-Dispo am selben Tag nicht doppelt eingeteilt werden. Bitte bestehende Einteilung bearbeiten oder anderes Fahrzeug/Fahrer wählen.`
    );
  }

  return {
    vehicle,
    driver,
    tours,
    firstTour: tours[0],
    allowLongHaulConflict: false,
    conflictNote: null,
  };
}

export async function createShortHaulAssignment(formData: FormData) {
  await requireSession();
  const workDate = parseWorkDate(formData.get("workDate"));

  const {
    vehicle,
    driver,
    tours,
    firstTour,
    allowLongHaulConflict,
    conflictNote,
  } = await resolveShortHaulData(formData, workDate);
  const inventoryItem = getVehicleInventoryItem(vehicle);

  await assertShortHaulAvailability({
    driverId: driver.id,
    vehicleId: vehicle.id,
    vehicleInventoryItemId: inventoryItem?.id ?? null,
    workDate,
    tours,
  });

  await prisma.shortHaulAssignment.create({
    data: {
      workDate,
      startTime: firstTour.startTime,

      projectId: firstTour.projectId,
      projectNumber: firstTour.projectNumber,
      projectName: firstTour.projectName,

      vehicleId: vehicle.id,
      vehicleInventoryItemId: inventoryItem?.id ?? null,
      vehicleNumber: inventoryItem?.objectNumber ?? vehicle.vehicleNumber,
      licensePlate: inventoryItem?.licensePlate ?? vehicle.licensePlate,
      vehicleType: vehicle.vehicleType,
      vehicleCategory: getInventoryCategoryLabel(vehicle),

      driverId: driver.id,
      driverName: `${driver.lastName}, ${driver.firstName}`,

      material: firstTour.material,
      notes: optionalString(formData.get("notes")),

      allowLongHaulConflict,
      conflictNote,

      tours: {
        create: tours,
      },
    },
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/truck-dispatch");
}

export async function updateShortHaulAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  const existingAssignment = await prisma.shortHaulAssignment.findUnique({
    where: {
      id,
    },
  });

  if (!existingAssignment) {
    throw new Error("Kurzstrecken-Einteilung wurde nicht gefunden.");
  }

  const workDate = existingAssignment.workDate;

  const {
    vehicle,
    driver,
    tours,
    firstTour,
    allowLongHaulConflict,
    conflictNote,
  } = await resolveShortHaulData(formData, workDate);
  const inventoryItem = getVehicleInventoryItem(vehicle);

  await assertShortHaulAvailability({
    driverId: driver.id,
    vehicleId: vehicle.id,
    vehicleInventoryItemId: inventoryItem?.id ?? null,
    workDate,
    tours,
    excludeId: id,
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.shortHaulAssignment.update({
      where: {
        id,
      },
      data: {
        startTime: firstTour.startTime,

        projectId: firstTour.projectId,
        projectNumber: firstTour.projectNumber,
        projectName: firstTour.projectName,

        vehicleId: vehicle.id,
        vehicleInventoryItemId: inventoryItem?.id ?? null,
        vehicleNumber: inventoryItem?.objectNumber ?? vehicle.vehicleNumber,
        licensePlate: inventoryItem?.licensePlate ?? vehicle.licensePlate,
        vehicleType: vehicle.vehicleType,
        vehicleCategory: getInventoryCategoryLabel(vehicle),

        driverId: driver.id,
        driverName: `${driver.lastName}, ${driver.firstName}`,

        material: firstTour.material,
        notes: optionalString(formData.get("notes")),

        allowLongHaulConflict,
        conflictNote,
      },
    });

    await tx.shortHaulTour.deleteMany({
      where: {
        assignmentId: id,
      },
    });

    await tx.shortHaulTour.createMany({
      data: tours.map((tour) => ({
        ...tour,
        assignmentId: id,
      })),
    });
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/truck-dispatch");
}

export async function updateShortHaulTourTimeFromTimeline({
  tourId,
  startTime,
  endTime,
}: {
  tourId: string;
  startTime: string;
  endTime: string;
}) {
  await requireSession();
  const safeTourId = String(tourId ?? "").trim();
  const safeStartTime = String(startTime ?? "").trim();
  const safeEndTime = String(endTime ?? "").trim();

  if (!safeTourId) {
    throw new Error("Tour-ID fehlt.");
  }

  assertValidTimeRange(safeStartTime, safeEndTime);

  const existingTour = await prisma.shortHaulTour.findUnique({
    where: {
      id: safeTourId,
    },
    include: {
      assignment: true,
    },
  });

  if (!existingTour) {
    throw new Error("Tour wurde nicht gefunden.");
  }

  const allTours = await prisma.shortHaulTour.findMany({
    where: {
      assignmentId: existingTour.assignmentId,
    },
    orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
  });

  for (const tour of allTours) {
    if (tour.id === safeTourId) {
      continue;
    }

    if (
      toursOverlap(
        {
          startTime: safeStartTime,
          endTime: safeEndTime,
        },
        {
          startTime: tour.startTime,
          endTime: tour.endTime,
        }
      )
    ) {
      throw new Error(
        `Zeitkonflikt mit Tour ${tour.tourNumber}: ${tour.startTime} – ${tour.endTime}.`
      );
    }
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.shortHaulTour.update({
      where: {
        id: safeTourId,
      },
      data: {
        startTime: safeStartTime,
        endTime: safeEndTime,
      },
    });

    const updatedTours = await tx.shortHaulTour.findMany({
      where: {
        assignmentId: existingTour.assignmentId,
      },
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
    });

    await Promise.all(
      updatedTours.map((tour, index) =>
        tx.shortHaulTour.update({
          where: {
            id: tour.id,
          },
          data: {
            tourNumber: index + 1,
          },
        })
      )
    );

    const firstTour = updatedTours[0];

    if (firstTour) {
      await tx.shortHaulAssignment.update({
        where: {
          id: existingTour.assignmentId,
        },
        data: {
          startTime: firstTour.startTime,
          projectId: firstTour.projectId,
          projectNumber: firstTour.projectNumber,
          projectName: firstTour.projectName,
          material: firstTour.material,
        },
      });
    }
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/truck-dispatch");
}

export async function deleteShortHaulAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  await prisma.shortHaulAssignment.delete({
    where: {
      id,
    },
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/truck-dispatch");
}

export async function createSpecialVehicleTask(formData: FormData) {
  await requireSession();
  const workDate = parseWorkDate(formData.get("workDate"));
  const vehicleId = optionalString(formData.get("vehicleId"));
  const vehicleNameInput = optionalString(formData.get("vehicleName"));
  const taskText = String(formData.get("taskText") ?? "").trim();

  if (!taskText) {
    throw new Error("Aufgabe ist ein Pflichtfeld.");
  }

  let vehicleName = vehicleNameInput;
  let resolvedVehicleId = vehicleId;

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      throw new Error("Sonderfahrzeug wurde nicht gefunden.");
    }

    vehicleName = formatVehicleName(vehicle);
    resolvedVehicleId = vehicle.id;
  }

  if (!vehicleName) {
    throw new Error("Sonderfahrzeug ist ein Pflichtfeld.");
  }

  await prisma.specialVehicleTask.create({
    data: {
      workDate,
      vehicleId: resolvedVehicleId,
      vehicleName,
      taskText,
    },
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
}

export async function updateSpecialVehicleTask(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const taskText = String(formData.get("taskText") ?? "").trim();

  if (!id || !taskText) {
    throw new Error("Aufgaben-ID oder Text fehlt.");
  }

  await prisma.specialVehicleTask.update({
    where: {
      id,
    },
    data: {
      taskText,
    },
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
}

export async function deleteSpecialVehicleTask(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Aufgaben-ID fehlt.");
  }

  await prisma.specialVehicleTask.delete({
    where: {
      id,
    },
  });

  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
}
