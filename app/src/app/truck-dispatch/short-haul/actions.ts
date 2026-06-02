"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
  const text = String(value ?? "").trim().replace(",", ".");

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

async function getVehicle(vehicleId: string) {
  if (!vehicleId) return null;

  return prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
  });
}

async function getDriver(driverId: string) {
  if (!driverId) return null;

  return prisma.driver.findUnique({
    where: {
      id: driverId,
    },
  });
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
  if (customPurpose) {
    return {
      itemId,
      itemName: customPurpose,
      customPurpose,
      defaultUnit: null,
    };
  }

  if (purposeType === "MATERIAL" && itemId) {
    const material = await prisma.materialType.findUnique({
      where: {
        id: itemId,
      },
    });

    if (!material) {
      throw new Error("Material wurde nicht gefunden.");
    }

    return {
      itemId: material.id,
      itemName: material.name,
      customPurpose: null,
      defaultUnit: material.unit,
    };
  }

  if (purposeType === "ASPHALT" && itemId) {
    const asphalt = await prisma.asphaltMixType.findUnique({
      where: {
        id: itemId,
      },
    });

    if (!asphalt) {
      throw new Error("Asphaltsorte wurde nicht gefunden.");
    }

    return {
      itemId: asphalt.id,
      itemName: asphalt.name,
      customPurpose: null,
      defaultUnit: asphalt.unit,
    };
  }

  if (purposeType === "TRANSPORT" && itemId) {
    const option = await prisma.adminOption.findFirst({
      where: {
        groupKey: "transport_item",
        value: itemId,
        isActive: true,
      },
    });

    if (!option) {
      throw new Error(
        "Transport-/Maschinenlisten-Eintrag wurde nicht gefunden."
      );
    }

    return {
      itemId: option.value,
      itemName: option.label,
      customPurpose: null,
      defaultUnit: null,
    };
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
  workDate,
}: {
  driverId: string;
  vehicleId: string;
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
  workDate,
  excludeId,
}: {
  driverId: string;
  vehicleId: string;
  workDate: Date;
  excludeId?: string;
}) {
  const existing = await prisma.shortHaulAssignment.findFirst({
    where: {
      workDate: getDayRange(workDate),
      OR: [{ driverId }, { vehicleId }],
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

      purposeType,
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

  return tours;
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

  const longHaulConflicts = await findLongHaulConflicts({
    driverId,
    vehicleId,
    workDate,
  });

  const allowLongHaulConflict =
    formData.get("allowLongHaulConflict") === "on";

  if (longHaulConflicts.length > 0 && !allowLongHaulConflict) {
    throw new Error(
      `${longHaulConflicts.join(" ")} Bitte bestätige bewusst die zusätzliche Kurzstrecken-Einteilung.`
    );
  }

  return {
    vehicle,
    driver,
    tours,
    firstTour: tours[0],
    allowLongHaulConflict,
    conflictNote:
      longHaulConflicts.length > 0 ? longHaulConflicts.join(" ") : null,
  };
}

export async function createShortHaulAssignment(formData: FormData) {
  const workDate = parseWorkDate(formData.get("workDate"));

  const {
    vehicle,
    driver,
    tours,
    firstTour,
    allowLongHaulConflict,
    conflictNote,
  } = await resolveShortHaulData(formData, workDate);

  await assertShortHaulAvailability({
    driverId: driver.id,
    vehicleId: vehicle.id,
    workDate,
  });

  await prisma.shortHaulAssignment.create({
    data: {
      workDate,
      startTime: firstTour.startTime,

      projectId: firstTour.projectId,
      projectNumber: firstTour.projectNumber,
      projectName: firstTour.projectName,

      vehicleId: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber,
      licensePlate: vehicle.licensePlate,
      vehicleType: vehicle.vehicleType,
      vehicleCategory: vehicle.category,

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
  revalidatePath("/truck-dispatch");
}

export async function updateShortHaulAssignment(formData: FormData) {
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

  await assertShortHaulAvailability({
    driverId: driver.id,
    vehicleId: vehicle.id,
    workDate,
    excludeId: id,
  });

  await prisma.$transaction(async (tx) => {
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
        vehicleNumber: vehicle.vehicleNumber,
        licensePlate: vehicle.licensePlate,
        vehicleType: vehicle.vehicleType,
        vehicleCategory: vehicle.category,

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

  await prisma.$transaction(async (tx) => {
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
  revalidatePath("/truck-dispatch");
}

export async function deleteShortHaulAssignment(formData: FormData) {
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
  revalidatePath("/truck-dispatch");
}

export async function createSpecialVehicleTask(formData: FormData) {
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
}

export async function updateSpecialVehicleTask(formData: FormData) {
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
}

export async function deleteSpecialVehicleTask(formData: FormData) {
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
}