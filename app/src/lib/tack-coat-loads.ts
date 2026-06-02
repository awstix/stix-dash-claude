import { prisma } from "@/lib/prisma";

export type TackCoatOpenPosition = {
  key: string;
  asphaltDispatchEntryId: string | null;
  workDate: Date;
  crewNames: string[];
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  tackCoatMaterialTypeId: string | null;
  materialName: string;
  quantityUnit: string;
  plannedLiters: number;
  specialVehicleLiters: number;
  shortHaulLiters: number;
  allocatedLiters: number;
  openLiters: number;
  isFullyAllocated: boolean;
};

export type TackCoatAllocationSummary = {
  id: string;
  sourceType: string;
  ownerType: string;
  asphaltDispatchEntryId: string | null;
  shortHaulAssignmentId: string | null;
  projectNumber: string;
  projectName: string;
  materialName: string;
  quantityUnit: string;
  vehicleLabel: string;
  vehicleId: string | null;
  driverId: string | null;
  driverName: string | null;
  tourCount: number;
  litersPerTour: number;
  totalLiters: number;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getDayRange(workDate: Date) {
  return {
    gte: workDate,
    lt: addDays(workDate, 1),
  };
}

export function roundLiters(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatLiters(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeMaterialName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizeTackCoatUnit(value: string | null | undefined) {
  const unit = String(value ?? "").trim();
  return unit || "l";
}

function getProjectKey(projectId: string | null | undefined, projectNumber: string) {
  return projectId ?? projectNumber;
}

export function getTackCoatPositionKey({
  workDate,
  projectId,
  projectNumber,
  materialName,
  quantityUnit,
}: {
  workDate: Date;
  projectId: string | null;
  projectNumber: string;
  materialName: string;
  quantityUnit: string | null;
}) {
  return [
    formatDateInput(workDate),
    getProjectKey(projectId, projectNumber),
    normalizeMaterialName(materialName),
    normalizeTackCoatUnit(quantityUnit),
  ].join("|||");
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string | null;
  licensePlate: string | null;
  vehicleCategory?: string | null;
  category?: string | null;
  vehicleType: string | null;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleCategory ?? vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function addCrewName(crewNames: string[], crewName: string) {
  if (!crewNames.includes(crewName)) {
    crewNames.push(crewName);
  }
}

export async function getTackCoatOpenPositionsForRange({
  gte,
  lt,
}: {
  gte: Date;
  lt: Date;
}) {
  const [dispatchEntries, specialAssignments, loadAllocations] = await Promise.all([
    prisma.asphaltDispatchEntry.findMany({
      where: {
        workDate: {
          gte,
          lt,
        },
        tackCoatQuantity: {
          gt: 0,
        },
      },
      orderBy: [{ workDate: "asc" }, { projectNumber: "asc" }, { createdAt: "asc" }],
    }),

    prisma.specialVehicleDispatchAssignment.findMany({
      where: {
        workDate: {
          gte,
          lt,
        },
      },
      orderBy: [{ workDate: "asc" }, { projectNumber: "asc" }, { startTime: "asc" }],
    }),

    prisma.tackCoatLoadAllocation.findMany({
      where: {
        workDate: {
          gte,
          lt,
        },
      },
      orderBy: [{ workDate: "asc" }, { projectNumber: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const specialVehicleByKey = new Map<string, number>();

  for (const assignment of specialAssignments) {
    if (!assignment.materialName || assignment.quantity === null) {
      continue;
    }

    const key = getTackCoatPositionKey({
      workDate: assignment.workDate,
      projectId: assignment.projectId,
      projectNumber: assignment.projectNumber,
      materialName: assignment.materialName,
      quantityUnit: assignment.quantityUnit,
    });

    specialVehicleByKey.set(
      key,
      roundLiters((specialVehicleByKey.get(key) ?? 0) + assignment.quantity),
    );
  }

  const shortHaulByKey = new Map<string, number>();

  for (const allocation of loadAllocations) {
    const key = getTackCoatPositionKey({
      workDate: allocation.workDate,
      projectId: allocation.projectId,
      projectNumber: allocation.projectNumber,
      materialName: allocation.materialName,
      quantityUnit: allocation.quantityUnit,
    });

    shortHaulByKey.set(
      key,
      roundLiters((shortHaulByKey.get(key) ?? 0) + allocation.totalLiters),
    );
  }

  const needsByKey = new Map<string, TackCoatOpenPosition>();

  for (const entry of dispatchEntries) {
    if (!entry.tackCoatMaterialName || entry.tackCoatQuantity <= 0) {
      continue;
    }

    const quantityUnit = normalizeTackCoatUnit(entry.tackCoatUnit);
    const key = getTackCoatPositionKey({
      workDate: entry.workDate,
      projectId: entry.projectId,
      projectNumber: entry.projectNumber,
      materialName: entry.tackCoatMaterialName,
      quantityUnit,
    });

    const existing =
      needsByKey.get(key) ??
      ({
        key,
        asphaltDispatchEntryId: entry.id,
        workDate: entry.workDate,
        crewNames: [],
        projectId: entry.projectId,
        projectNumber: entry.projectNumber,
        projectName: entry.projectName,
        tackCoatMaterialTypeId: entry.tackCoatMaterialTypeId,
        materialName: entry.tackCoatMaterialName,
        quantityUnit,
        plannedLiters: 0,
        specialVehicleLiters: 0,
        shortHaulLiters: 0,
        allocatedLiters: 0,
        openLiters: 0,
        isFullyAllocated: false,
      } satisfies TackCoatOpenPosition);

    existing.plannedLiters = roundLiters(existing.plannedLiters + entry.tackCoatQuantity);
    addCrewName(existing.crewNames, entry.crew);
    needsByKey.set(key, existing);
  }

  return Array.from(needsByKey.values()).map((need) => {
    const specialVehicleLiters = specialVehicleByKey.get(need.key) ?? 0;
    const shortHaulLiters = shortHaulByKey.get(need.key) ?? 0;
    const allocatedLiters = roundLiters(specialVehicleLiters + shortHaulLiters);
    const openLiters = roundLiters(Math.max(0, need.plannedLiters - allocatedLiters));

    return {
      ...need,
      specialVehicleLiters,
      shortHaulLiters,
      allocatedLiters,
      openLiters,
      isFullyAllocated: openLiters <= 0,
    };
  });
}

export async function getTackCoatOpenPositions(workDate: Date) {
  return getTackCoatOpenPositionsForRange(getDayRange(workDate));
}

export async function getTackCoatAllocationsForDay(workDate: Date) {
  const allocations = await prisma.tackCoatLoadAllocation.findMany({
    where: {
      workDate: getDayRange(workDate),
    },
    orderBy: [{ projectNumber: "asc" }, { materialName: "asc" }, { createdAt: "asc" }],
  });

  return allocations.map((allocation): TackCoatAllocationSummary => {
    const vehicleLabel =
      getVehicleLabel({
        vehicleNumber: allocation.vehicleNumber,
        licensePlate: allocation.licensePlate,
        vehicleCategory: allocation.vehicleCategory,
        vehicleType: allocation.vehicleType,
      }) || "-";

    return {
      id: allocation.id,
      sourceType: allocation.sourceType,
      ownerType: allocation.ownerType,
      asphaltDispatchEntryId: allocation.asphaltDispatchEntryId,
      shortHaulAssignmentId: allocation.shortHaulAssignmentId,
      projectNumber: allocation.projectNumber,
      projectName: allocation.projectName,
      materialName: allocation.materialName,
      quantityUnit: allocation.quantityUnit,
      vehicleLabel,
      vehicleId: allocation.vehicleId,
      driverId: allocation.driverId,
      driverName: allocation.driverName,
      tourCount: allocation.tourCount,
      litersPerTour: allocation.litersPerTour,
      totalLiters: allocation.totalLiters,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      notes: allocation.notes,
    };
  });
}

export async function getOpenLitersForTackCoatPosition({
  workDate,
  projectId,
  projectNumber,
  materialName,
  quantityUnit,
  ignoreAllocationId,
}: {
  workDate: Date;
  projectId: string | null;
  projectNumber: string;
  materialName: string;
  quantityUnit: string;
  ignoreAllocationId?: string;
}) {
  const positions = await getTackCoatOpenPositions(workDate);
  const key = getTackCoatPositionKey({
    workDate,
    projectId,
    projectNumber,
    materialName,
    quantityUnit,
  });
  const position = positions.find((item) => item.key === key);

  if (!position) {
    throw new Error("Anspritzmittel-Position wurde nicht gefunden.");
  }

  if (!ignoreAllocationId) {
    return {
      position,
      openLiters: position.openLiters,
    };
  }

  const ignoredAllocation = await prisma.tackCoatLoadAllocation.findUnique({
    where: {
      id: ignoreAllocationId,
    },
  });

  return {
    position,
    openLiters: roundLiters(position.openLiters + (ignoredAllocation?.totalLiters ?? 0)),
  };
}
