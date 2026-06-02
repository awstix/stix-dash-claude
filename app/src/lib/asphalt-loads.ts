import { prisma } from "@/lib/prisma";

export type AsphaltOpenPosition = {
  asphaltDispatchEntryId: string;
  workDate: Date;
  crew: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixTypeId: string | null;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  totalTons: number;
  allocatedTons: number;
  openTons: number;
  isFullyAllocated: boolean;
};

export type AsphaltAllocationSummary = {
  id: string;
  sourceType: string;
  ownerType: string;

  asphaltDispatchEntryId: string;
  longHaulEntryId: string | null;
  longHaulTruckAssignmentId: string | null;
  shortHaulAssignmentId: string | null;

  projectNumber: string;
  projectName: string;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;

  vehicleLabel: string;
  vehicleId: string | null;
  driverId: string | null;
  driverName: string | null;
  subcontractorName: string | null;

  tourCount: number;
  tonsPerTour: number;
  totalTons: number;

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

export function roundTons(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getVehicleLabel(vehicle: {
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

export async function getAsphaltOpenPositions(workDate: Date) {
  const [dispatchEntries, allocations] = await Promise.all([
    prisma.asphaltDispatchEntry.findMany({
      where: {
        workDate: getDayRange(workDate),
      },
      orderBy: [
        { crew: "asc" },
        { projectNumber: "asc" },
        { asphaltMixName: "asc" },
        { createdAt: "asc" },
      ],
    }),

    prisma.asphaltLoadAllocation.findMany({
      where: {
        workDate: getDayRange(workDate),
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const allocatedByDispatchEntry = new Map<string, number>();

  for (const allocation of allocations) {
    const current =
      allocatedByDispatchEntry.get(allocation.asphaltDispatchEntryId) ?? 0;

    allocatedByDispatchEntry.set(
      allocation.asphaltDispatchEntryId,
      roundTons(current + allocation.totalTons),
    );
  }

  return dispatchEntries.map((entry): AsphaltOpenPosition => {
    const allocatedTons = allocatedByDispatchEntry.get(entry.id) ?? 0;
    const openTons = roundTons(Math.max(0, entry.quantityTons - allocatedTons));

    return {
      asphaltDispatchEntryId: entry.id,
      workDate: entry.workDate,
      crew: entry.crew,
      projectId: entry.projectId,
      projectNumber: entry.projectNumber,
      projectName: entry.projectName,
      constructionManager: entry.constructionManager,
      asphaltMixTypeId: entry.asphaltMixTypeId,
      asphaltMixNumber: entry.asphaltMixNumber,
      asphaltMixName: entry.asphaltMixName,
      totalTons: entry.quantityTons,
      allocatedTons,
      openTons,
      isFullyAllocated: openTons <= 0,
    };
  });
}

export async function getAsphaltAllocationsForDay(workDate: Date) {
  const allocations = await prisma.asphaltLoadAllocation.findMany({
    where: {
      workDate: getDayRange(workDate),
    },
    orderBy: [
      { projectNumber: "asc" },
      { asphaltMixName: "asc" },
      { sourceType: "asc" },
      { createdAt: "asc" },
    ],
  });

  return allocations.map((allocation): AsphaltAllocationSummary => {
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
      longHaulEntryId: allocation.longHaulEntryId,
      longHaulTruckAssignmentId: allocation.longHaulTruckAssignmentId,
      shortHaulAssignmentId: allocation.shortHaulAssignmentId,

      projectNumber: allocation.projectNumber,
      projectName: allocation.projectName,
      asphaltMixNumber: allocation.asphaltMixNumber,
      asphaltMixName: allocation.asphaltMixName,

      vehicleLabel,
      vehicleId: allocation.vehicleId,
      driverId: allocation.driverId,
      driverName: allocation.driverName,
      subcontractorName: allocation.subcontractorName,

      tourCount: allocation.tourCount,
      tonsPerTour: allocation.tonsPerTour,
      totalTons: allocation.totalTons,

      startTime: allocation.startTime,
      endTime: allocation.endTime,

      notes: allocation.notes,
    };
  });
}

export async function getOpenTonsForDispatchEntry({
  asphaltDispatchEntryId,
  ignoreAllocationId,
}: {
  asphaltDispatchEntryId: string;
  ignoreAllocationId?: string;
}) {
  const dispatchEntry = await prisma.asphaltDispatchEntry.findUnique({
    where: {
      id: asphaltDispatchEntryId,
    },
  });

  if (!dispatchEntry) {
    throw new Error("Asphaltposition wurde nicht gefunden.");
  }

  const allocations = await prisma.asphaltLoadAllocation.findMany({
    where: {
      asphaltDispatchEntryId,
      ...(ignoreAllocationId
        ? {
            id: {
              not: ignoreAllocationId,
            },
          }
        : {}),
    },
  });

  const allocatedTons = allocations.reduce(
    (sum, allocation) => sum + allocation.totalTons,
    0,
  );

  return {
    dispatchEntry,
    allocatedTons: roundTons(allocatedTons),
    openTons: roundTons(Math.max(0, dispatchEntry.quantityTons - allocatedTons)),
  };
}
