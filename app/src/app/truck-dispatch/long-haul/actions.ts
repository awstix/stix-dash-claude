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

function parseNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "0").replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function parsePositiveInt(value: FormDataEntryValue | null) {
  const number = Number.parseInt(String(value ?? "1"), 10);

  if (Number.isNaN(number) || number <= 0) {
    return 1;
  }

  return number;
}

function roundTons(value: number) {
  return Math.round(value * 100) / 100;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalTime(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function getDayRange(workDate: Date) {
  return {
    gte: workDate,
    lt: addDays(workDate, 1),
  };
}

function revalidateLongHaulConsumers() {
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/orders");
}

type LongHaulEntryData = {
  assignmentType: string;
  asphaltCrew: string | null;
  asphaltDispatchEntryId: string | null;

  projectId: string | null;
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;

  materialTypeId: string | null;
  materialName: string | null;
  materialUnit: string | null;
  materialQuantity: number;

  notes: string | null;
};

type PlannedAsphaltLoad = {
  tourCount: number;
  tonsPerTour: number;
  totalTons: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

type OwnTruckAssignmentInput = {
  assignment: {
    ownerType: string;
    vehicleCategory: string;

    driverId: string;
    driverName: string;

    vehicleId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;

    subcontractorName: null;
    notes: string | null;
  };
  plannedAsphaltLoad: PlannedAsphaltLoad | null;
};

type SubcontractorTruckAssignmentInput = {
  assignment: {
    ownerType: string;
    vehicleCategory: string;
    driverId: null;
    driverName: null;
    vehicleId: null;
    vehicleNumber: null;
    licensePlate: null;
    vehicleType: null;
    subcontractorName: string;
    notes: string | null;
  };
  plannedAsphaltLoad: PlannedAsphaltLoad | null;
};

async function getProject(projectId: string) {
  if (!projectId) return null;

  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });
}

async function getMaterial(materialTypeId: string) {
  if (!materialTypeId) return null;

  return prisma.materialType.findUnique({
    where: {
      id: materialTypeId,
    },
  });
}

async function getAsphaltDispatchEntry(asphaltDispatchEntryId: string) {
  if (!asphaltDispatchEntryId) return null;

  return prisma.asphaltDispatchEntry.findUnique({
    where: {
      id: asphaltDispatchEntryId,
    },
  });
}

async function getEntry(entryId: string) {
  return prisma.truckLongHaulEntry.findUnique({
    where: {
      id: entryId,
    },
  });
}

async function getDriverWithPrimaryVehicle(driverId: string) {
  return prisma.driver.findUnique({
    where: {
      id: driverId,
    },
    include: {
      vehicleAssignments: {
        where: {
          isActive: true,
        },
        include: {
          vehicle: true,
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

async function getVehicle(vehicleId: string | null) {
  if (!vehicleId) return null;

  return prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
  });
}

async function assertDriverAvailableForLongHaul({
  driverId,
  workDate,
}: {
  driverId: string;
  workDate: Date;
}) {
  const existing = await prisma.truckLongHaulTruckAssignment.findFirst({
    where: {
      driverId,
      entry: {
        workDate: getDayRange(workDate),
      },
    },
    include: {
      entry: true,
    },
  });

  if (existing) {
    throw new Error(
      `Fahrer ${existing.driverName ?? ""} ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${existing.entry.projectNumber} · ${existing.entry.projectName} geplant.`,
    );
  }

  const shortHaulExisting = await prisma.shortHaulAssignment.findFirst({
    where: {
      driverId,
      workDate: getDayRange(workDate),
    },
  });

  if (shortHaulExisting) {
    throw new Error(
      `Fahrer ${shortHaulExisting.driverName ?? ""} ist an diesem Tag bereits in der Kurzstrecke bei Maßnahme ${shortHaulExisting.projectNumber} · ${shortHaulExisting.projectName} geplant.`,
    );
  }
}

async function assertVehicleAvailableForLongHaul({
  vehicleId,
  workDate,
}: {
  vehicleId: string;
  workDate: Date;
}) {
  const existing = await prisma.truckLongHaulTruckAssignment.findFirst({
    where: {
      vehicleId,
      entry: {
        workDate: getDayRange(workDate),
      },
    },
    include: {
      entry: true,
    },
  });

  if (existing) {
    throw new Error(
      `Fahrzeug ${existing.licensePlate ?? existing.vehicleNumber ?? ""} ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${existing.entry.projectNumber} · ${existing.entry.projectName} geplant.`,
    );
  }

  const shortHaulExisting = await prisma.shortHaulAssignment.findFirst({
    where: {
      vehicleId,
      workDate: getDayRange(workDate),
    },
  });

  if (shortHaulExisting) {
    throw new Error(
      `Fahrzeug ${shortHaulExisting.licensePlate ?? shortHaulExisting.vehicleNumber ?? ""} ist an diesem Tag bereits in der Kurzstrecke bei Maßnahme ${shortHaulExisting.projectNumber} · ${shortHaulExisting.projectName} geplant.`,
    );
  }
}

async function resolveLongHaulEntryData(
  formData: FormData,
): Promise<LongHaulEntryData> {
  const assignmentType = String(
    formData.get("assignmentType") ?? "CONSTRUCTION",
  );

  const asphaltCrew = optionalString(formData.get("asphaltCrew"));
  const notes = optionalString(formData.get("notes"));

  const asphaltDispatchEntryId = String(
    formData.get("asphaltDispatchEntryId") ?? "",
  ).trim();

  if (assignmentType === "ASPHALT") {
    if (!asphaltDispatchEntryId) {
      throw new Error(
        "Bitte eine Asphaltposition aus der Tages-Asphaltdisposition auswählen.",
      );
    }

    const asphaltDispatchEntry = await getAsphaltDispatchEntry(
      asphaltDispatchEntryId,
    );

    if (!asphaltDispatchEntry) {
      throw new Error("Asphaltposition wurde nicht gefunden.");
    }

    return {
      assignmentType,
      asphaltCrew,
      asphaltDispatchEntryId: asphaltDispatchEntry.id,

      projectId: asphaltDispatchEntry.projectId,
      projectNumber: asphaltDispatchEntry.projectNumber,
      projectName: asphaltDispatchEntry.projectName,
      constructionManager: asphaltDispatchEntry.constructionManager,

      materialTypeId: null,
      materialName:
        [
          asphaltDispatchEntry.asphaltMixNumber,
          asphaltDispatchEntry.asphaltMixName,
        ]
          .filter(Boolean)
          .join(" · ") || "Asphalt",
      materialUnit: "t",
      materialQuantity: asphaltDispatchEntry.quantityTons,

      notes,
    };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const materialTypeId = String(formData.get("materialTypeId") ?? "").trim();

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }

  if (!materialTypeId) {
    throw new Error("Bitte ein Material auswählen.");
  }

  const [project, material] = await Promise.all([
    getProject(projectId),
    getMaterial(materialTypeId),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (!material) {
    throw new Error("Material wurde nicht gefunden.");
  }

  return {
    assignmentType,
    asphaltCrew,
    asphaltDispatchEntryId: null,

    projectId: project.id,
    projectNumber: project.projectNumber,
    projectName: project.name,
    constructionManager: project.constructionManager,

    materialTypeId: material.id,
    materialName: material.name,
    materialUnit: material.unit,
    materialQuantity: parseNumber(formData.get("materialQuantity")),

    notes,
  };
}

async function resolveOwnTruckAssignment({
  driverId,
  vehicleId,
  notes,
  workDate,
}: {
  driverId: string;
  vehicleId: string | null;
  notes: string | null;
  workDate: Date;
}) {
  const driver = await getDriverWithPrimaryVehicle(driverId);

  if (!driver) {
    throw new Error("Fahrer wurde nicht gefunden.");
  }

  const primaryVehicle = driver.vehicleAssignments[0]?.vehicle ?? null;
  const vehicle = vehicleId ? await getVehicle(vehicleId) : primaryVehicle;

  if (!vehicle) {
    throw new Error(
      `Für Fahrer ${driver.lastName}, ${driver.firstName} ist kein Stammfahrzeug hinterlegt. Bitte ein freies Fahrzeug auswählen.`,
    );
  }

  await assertDriverAvailableForLongHaul({
    driverId: driver.id,
    workDate,
  });

  await assertVehicleAvailableForLongHaul({
    vehicleId: vehicle.id,
    workDate,
  });

  return {
    ownerType: "OWN",
    vehicleCategory: vehicle.category,

    driverId: driver.id,
    driverName: `${driver.lastName}, ${driver.firstName}`,

    vehicleId: vehicle.id,
    vehicleNumber: vehicle.vehicleNumber,
    licensePlate: vehicle.licensePlate,
    vehicleType: vehicle.vehicleType,

    subcontractorName: null,
    notes,
  };
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

function parsePlannedAsphaltLoad({
  formData,
  prefix,
  index,
  fallbackNotes,
}: {
  formData: FormData;
  prefix: "own" | "sub";
  index: number;
  fallbackNotes: string | null;
}): PlannedAsphaltLoad | null {
  const tourCount = parsePositiveInt(
    formData.get(`${prefix}TourCount_${index}`),
  );
  const tonsPerTour = roundTons(
    parseNumber(formData.get(`${prefix}TonsPerTour_${index}`)),
  );
  const totalTons = roundTons(tourCount * tonsPerTour);

  if (totalTons <= 0) {
    return null;
  }

  return {
    tourCount,
    tonsPerTour,
    totalTons,
    startTime: optionalTime(
      formData.get(`${prefix}StartTime_${index}`),
      "06:30",
    ),
    endTime: optionalTime(formData.get(`${prefix}EndTime_${index}`), "17:00"),
    notes:
      optionalString(formData.get(`${prefix}AsphaltNotes_${index}`)) ??
      optionalString(formData.get(`${prefix}PlannedNotes_${index}`)) ??
      fallbackNotes,
  };
}

async function parseInitialOwnTruckAssignments({
  formData,
  workDate,
  usedDriverIds,
  usedVehicleIds,
}: {
  formData: FormData;
  workDate: Date;
  usedDriverIds: Set<string>;
  usedVehicleIds: Set<string>;
}) {
  const assignments: OwnTruckAssignmentInput[] = [];

  const indexes = getIndexesFromFormData(formData, [
    "ownDriverId",
    "ownVehicleId",
    "ownNotes",
    "ownTourCount",
    "ownTonsPerTour",
    "ownStartTime",
    "ownEndTime",
    "ownAsphaltNotes",
  ]);

  for (const index of indexes) {
    const driverId = String(formData.get(`ownDriverId_${index}`) ?? "").trim();
    const vehicleId = String(
      formData.get(`ownVehicleId_${index}`) ?? "",
    ).trim();
    const notes = String(formData.get(`ownNotes_${index}`) ?? "").trim();
    const plannedAsphaltLoad = parsePlannedAsphaltLoad({
      formData,
      prefix: "own",
      index,
      fallbackNotes: notes || null,
    });

    const rowWasTouched = Boolean(driverId || vehicleId || notes);

    if (!rowWasTouched) {
      continue;
    }

    if (!driverId) {
      throw new Error("LKW-STIX: Bitte einen Fahrer auswählen.");
    }

    if (usedDriverIds.has(driverId)) {
      throw new Error(
        "LKW-STIX: Dieser Fahrer wurde bereits in dieser Einteilung ausgewählt.",
      );
    }

    const assignment = await resolveOwnTruckAssignment({
      driverId,
      vehicleId: vehicleId || null,
      workDate,
      notes: notes || null,
    });

    if (usedDriverIds.has(assignment.driverId)) {
      throw new Error(
        `LKW-STIX: Fahrer ${assignment.driverName ?? ""} wurde mehrfach ausgewählt.`,
      );
    }

    if (assignment.vehicleId && usedVehicleIds.has(assignment.vehicleId)) {
      throw new Error(
        `LKW-STIX: Fahrzeug ${
          assignment.licensePlate ?? assignment.vehicleNumber ?? ""
        } wurde mehrfach ausgewählt.`,
      );
    }

    usedDriverIds.add(assignment.driverId);

    if (assignment.vehicleId) {
      usedVehicleIds.add(assignment.vehicleId);
    }

    assignments.push({
      assignment,
      plannedAsphaltLoad,
    });
  }

  return assignments;
}

function parseInitialSubcontractorTruckAssignments(formData: FormData) {
  const assignments: SubcontractorTruckAssignmentInput[] = [];

  const indexes = getIndexesFromFormData(formData, [
    "subVehicleCategory",
    "subcontractorName",
    "subcontractorNameCustom",
    "subNotes",
    "subTourCount",
    "subTonsPerTour",
    "subStartTime",
    "subEndTime",
    "subAsphaltNotes",
  ]);

  for (const index of indexes) {
    const vehicleCategory = String(
      formData.get(`subVehicleCategory_${index}`) ?? "",
    ).trim();

    const selectedCompany = optionalString(
      formData.get(`subcontractorName_${index}`),
    );

    const customCompany = optionalString(
      formData.get(`subcontractorNameCustom_${index}`),
    );

    const notes = optionalString(formData.get(`subNotes_${index}`));
    const subcontractorName = customCompany ?? selectedCompany;

    const plannedAsphaltLoad = parsePlannedAsphaltLoad({
      formData,
      prefix: "sub",
      index,
      fallbackNotes: notes,
    });

    const rowWasTouched = Boolean(
      vehicleCategory || subcontractorName || notes,
    );

    if (!rowWasTouched) {
      continue;
    }

    if (!vehicleCategory) {
      throw new Error("Fremd-LKW: Bitte eine Fahrzeugkategorie auswählen.");
    }

    if (!subcontractorName) {
      throw new Error(
        "Fremd-LKW: Bitte ein Fuhrunternehmen auswählen oder frei eintragen.",
      );
    }

    assignments.push({
      assignment: {
        ownerType: "SUBCONTRACTOR",
        vehicleCategory,
        driverId: null,
        driverName: null,
        vehicleId: null,
        vehicleNumber: null,
        licensePlate: null,
        vehicleType: null,
        subcontractorName,
        notes,
      },
      plannedAsphaltLoad,
    });
  }

  return assignments;
}

async function createLongHaulAsphaltAllocation({
  tx,
  workDate,
  entryData,
  entryId,
  truckAssignment,
  plannedAsphaltLoad,
}: {
  tx: any;
  workDate: Date;
  entryData: LongHaulEntryData;
  entryId: string;
  truckAssignment: {
    id: string;
    ownerType: string;
    vehicleCategory: string;
    driverId: string | null;
    driverName: string | null;
    vehicleId: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleType: string | null;
    subcontractorName: string | null;
    notes: string | null;
  };
  plannedAsphaltLoad: PlannedAsphaltLoad | null;
}) {
  if (!entryData.asphaltDispatchEntryId || !plannedAsphaltLoad) {
    return;
  }

  const dispatchEntry = await tx.asphaltDispatchEntry.findUnique({
    where: {
      id: entryData.asphaltDispatchEntryId,
    },
  });

  if (!dispatchEntry) {
    throw new Error("Asphaltposition wurde nicht gefunden.");
  }

  const existingAllocations = await tx.asphaltLoadAllocation.findMany({
    where: {
      asphaltDispatchEntryId: entryData.asphaltDispatchEntryId,
    },
  });

  const alreadyAllocated = roundTons(
    existingAllocations.reduce(
      (sum: number, allocation: { totalTons: number }) =>
        sum + allocation.totalTons,
      0,
    ),
  );

  const openTons = roundTons(
    Math.max(0, dispatchEntry.quantityTons - alreadyAllocated),
  );

  if (openTons <= 0) {
    throw new Error("Für diese Asphaltposition ist keine offene Menge mehr vorhanden.");
  }

  const allocationTotalTons = roundTons(
    Math.min(plannedAsphaltLoad.totalTons, openTons),
  );

  await tx.asphaltLoadAllocation.create({
    data: {
      workDate,
      sourceType: "LONG",

      asphaltDispatchEntryId: dispatchEntry.id,

      projectId: dispatchEntry.projectId,
      projectNumber: dispatchEntry.projectNumber,
      projectName: dispatchEntry.projectName,

      asphaltMixTypeId: dispatchEntry.asphaltMixTypeId,
      asphaltMixNumber: dispatchEntry.asphaltMixNumber,
      asphaltMixName: dispatchEntry.asphaltMixName,

      longHaulEntryId: entryId,
      longHaulTruckAssignmentId: truckAssignment.id,

      ownerType: truckAssignment.ownerType,

      vehicleId: truckAssignment.vehicleId,
      vehicleNumber: truckAssignment.vehicleNumber,
      licensePlate: truckAssignment.licensePlate,
      vehicleType: truckAssignment.vehicleType,
      vehicleCategory: truckAssignment.vehicleCategory,

      driverId: truckAssignment.driverId,
      driverName: truckAssignment.driverName,

      subcontractorName: truckAssignment.subcontractorName,

      tourCount: plannedAsphaltLoad.tourCount,
      tonsPerTour: plannedAsphaltLoad.tonsPerTour,
      totalTons: allocationTotalTons,

      startTime: plannedAsphaltLoad.startTime,
      endTime: plannedAsphaltLoad.endTime,

      notes: plannedAsphaltLoad.notes,
    },
  });
}

export async function createLongHaulEntry(formData: FormData) {
  const workDate = parseWorkDate(formData.get("workDate"));
  const entryData = await resolveLongHaulEntryData(formData);

  const usedDriverIds = new Set<string>();
  const usedVehicleIds = new Set<string>();

  const ownAssignments = await parseInitialOwnTruckAssignments({
    formData,
    workDate,
    usedDriverIds,
    usedVehicleIds,
  });

  const subAssignments = parseInitialSubcontractorTruckAssignments(formData);

  await prisma.$transaction(async (tx) => {
    const entry = await tx.truckLongHaulEntry.create({
      data: {
        workDate,
        ...entryData,
      },
    });

    for (const item of [...ownAssignments, ...subAssignments]) {
      const truckAssignment = await tx.truckLongHaulTruckAssignment.create({
        data: {
          ...item.assignment,
          entryId: entry.id,
        },
      });

      await createLongHaulAsphaltAllocation({
        tx,
        workDate,
        entryData,
        entryId: entry.id,
        truckAssignment,
        plannedAsphaltLoad: item.plannedAsphaltLoad,
      });
    }
  });

  revalidateLongHaulConsumers();
}

export async function updateLongHaulEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  const entryData = await resolveLongHaulEntryData(formData);

  await prisma.truckLongHaulEntry.update({
    where: {
      id,
    },
    data: entryData,
  });

  revalidateLongHaulConsumers();
}

export async function deleteLongHaulEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  await prisma.truckLongHaulEntry.delete({
    where: {
      id,
    },
  });

  revalidateLongHaulConsumers();
}

export async function createOwnTruckAssignment(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "").trim();
  const driverId = String(formData.get("driverId") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  if (!entryId || !driverId) {
    throw new Error("Eintrag und Fahrer sind Pflichtfelder.");
  }

  const entry = await getEntry(entryId);

  if (!entry) {
    throw new Error("Einteilung wurde nicht gefunden.");
  }

  const assignment = await resolveOwnTruckAssignment({
    driverId,
    vehicleId: vehicleId || null,
    notes: optionalString(formData.get("notes")),
    workDate: entry.workDate,
  });

  const plannedAsphaltLoad = parsePlannedAsphaltLoad({
    formData,
    prefix: "own",
    index: 0,
    fallbackNotes: assignment.notes,
  });

  await prisma.$transaction(async (tx) => {
    const truckAssignment = await tx.truckLongHaulTruckAssignment.create({
      data: {
        ...assignment,
        entryId,
      },
    });

    await createLongHaulAsphaltAllocation({
      tx,
      workDate: entry.workDate,
      entryData: {
        assignmentType: entry.assignmentType,
        asphaltCrew: entry.asphaltCrew,
        asphaltDispatchEntryId: entry.asphaltDispatchEntryId,

        projectId: entry.projectId,
        projectNumber: entry.projectNumber,
        projectName: entry.projectName,
        constructionManager: entry.constructionManager,

        materialTypeId: entry.materialTypeId,
        materialName: entry.materialName,
        materialUnit: entry.materialUnit,
        materialQuantity: entry.materialQuantity,

        notes: entry.notes,
      },
      entryId,
      truckAssignment,
      plannedAsphaltLoad,
    });
  });

  revalidateLongHaulConsumers();
}

export async function createSubcontractorTruckAssignment(formData: FormData) {
  const entryId = String(formData.get("entryId") ?? "").trim();
  const vehicleCategory = String(formData.get("vehicleCategory") ?? "").trim();
  const selectedCompany = optionalString(formData.get("subcontractorName"));
  const customCompany = optionalString(formData.get("subcontractorNameCustom"));
  const subcontractorName = customCompany ?? selectedCompany;

  if (!entryId || !vehicleCategory || !subcontractorName) {
    throw new Error(
      "Eintrag, Fahrzeugkategorie und Fuhrunternehmen sind Pflichtfelder.",
    );
  }

  const entry = await getEntry(entryId);

  if (!entry) {
    throw new Error("Einteilung wurde nicht gefunden.");
  }

  const assignment = {
    ownerType: "SUBCONTRACTOR",
    vehicleCategory,
    driverId: null,
    driverName: null,
    vehicleId: null,
    vehicleNumber: null,
    licensePlate: null,
    vehicleType: null,
    subcontractorName,
    notes: optionalString(formData.get("notes")),
  };

  const plannedAsphaltLoad = parsePlannedAsphaltLoad({
    formData,
    prefix: "sub",
    index: 0,
    fallbackNotes: assignment.notes,
  });

  await prisma.$transaction(async (tx) => {
    const truckAssignment = await tx.truckLongHaulTruckAssignment.create({
      data: {
        ...assignment,
        entryId,
      },
    });

    await createLongHaulAsphaltAllocation({
      tx,
      workDate: entry.workDate,
      entryData: {
        assignmentType: entry.assignmentType,
        asphaltCrew: entry.asphaltCrew,
        asphaltDispatchEntryId: entry.asphaltDispatchEntryId,

        projectId: entry.projectId,
        projectNumber: entry.projectNumber,
        projectName: entry.projectName,
        constructionManager: entry.constructionManager,

        materialTypeId: entry.materialTypeId,
        materialName: entry.materialName,
        materialUnit: entry.materialUnit,
        materialQuantity: entry.materialQuantity,

        notes: entry.notes,
      },
      entryId,
      truckAssignment,
      plannedAsphaltLoad,
    });
  });

  revalidateLongHaulConsumers();
}

export async function deleteTruckAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("LKW-Zuordnung fehlt.");
  }

  await prisma.truckLongHaulTruckAssignment.delete({
    where: {
      id,
    },
  });

  revalidateLongHaulConsumers();
}
