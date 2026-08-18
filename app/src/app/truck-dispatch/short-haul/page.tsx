import Link from "next/link";
import type { ReactNode } from "react";
import { ProjectStatus } from "@prisma/client";
import { ActionIcon, type ActionIconName } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import {
  inventoryItemToVehicleWithInventoryLink,
  inventoryVehicleBridgeInclude,
  vehicleInventoryLinkInclude,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import {
  driverIsSelectableInTruckDispatch,
  vehicleIsSelectableInTruckDispatch,
} from "@/lib/truck-dispatch-selection";
import { AsphaltShortAllocationForm } from "./AsphaltShortAllocationForm";
import { AsphaltShortSuggestionForm } from "./AsphaltShortSuggestionForm";
import { TackCoatShortAllocationForm } from "./TackCoatShortAllocationForm";
import {
  formatTons,
  getAsphaltAllocationsForDay,
  getAsphaltOpenPositions,
} from "@/lib/asphalt-loads";
import {
  formatLiters,
  getTackCoatAllocationsForDay,
  getTackCoatOpenPositions,
} from "@/lib/tack-coat-loads";
import {
  deleteAsphaltLoadAllocation,
  updateAsphaltLoadAllocation,
} from "../asphalt-load-actions";
import {
  deleteTackCoatLoadAllocation,
  updateTackCoatLoadAllocation,
} from "../tack-coat-load-actions";
import { DismissibleDetails } from "./DismissibleDetails";
import {
  ShortHaulForm,
  type TransportPurposeOption,
} from "./ShortHaulForm";
import { UtilizationTimeline } from "./UtilizationTimeline";
import {
  createShortHaulAssignment,
  deleteShortHaulAssignment,
  updateShortHaulAssignment,
} from "./actions";

const unitFallback = ["t", "m³", "m3", "Stk", "h", "km", "m", "Pauschal"];

type InventoryPurposeParentCategory = {
  id: string;
  name: string;
  useInTruckDispatchMaterial: boolean;
  useInTruckDispatchObject: boolean;
  useInTruckDispatchSelection: boolean;
};

type InventoryPurposeCategory = InventoryPurposeParentCategory & {
  parentCategory: InventoryPurposeParentCategory | null;
};

type InventoryPurposeItem = {
  id: string;
  name: string;
  objectNumber: string | null;
  inventoryNumber: string | null;
  stixId: string | null;
  manufacturer: string | null;
  model: string | null;
  licensePlate: string | null;
  stockUnit: string;
  category: InventoryPurposeCategory | null;
};

function categoryAllowsMaterialTransport(
  category: InventoryPurposeCategory | null
) {
  return Boolean(
    category?.useInTruckDispatchMaterial ||
      category?.parentCategory?.useInTruckDispatchMaterial
  );
}

function categoryAllowsMachineTransport(
  category: InventoryPurposeCategory | null
) {
  return Boolean(
    category?.useInTruckDispatchObject ||
      category?.useInTruckDispatchSelection ||
      category?.parentCategory?.useInTruckDispatchObject ||
      category?.parentCategory?.useInTruckDispatchSelection
  );
}

function getCategoryPath(category: InventoryPurposeCategory) {
  return category.parentCategory
    ? `${category.parentCategory.name} › ${category.name}`
    : category.name;
}

function getPurposeGroup(category: InventoryPurposeCategory | null) {
  if (!category) return "Ohne Kategorie";

  return category.parentCategory?.name ?? "Hauptkategorien";
}

function getInventoryItemLabel(item: InventoryPurposeItem) {
  const parts = [
    item.objectNumber,
    item.inventoryNumber,
    item.stixId,
    item.licensePlate,
    item.name,
    item.manufacturer,
    item.model,
  ].filter(Boolean);

  return parts.join(" · ");
}

function buildTransportPurposeOptions({
  categories,
  items,
  kind,
}: {
  categories: InventoryPurposeCategory[];
  items: InventoryPurposeItem[];
  kind: "MATERIAL" | "MACHINE";
}): TransportPurposeOption[] {
  const categoryMatches =
    kind === "MATERIAL"
      ? categoryAllowsMaterialTransport
      : categoryAllowsMachineTransport;

  const categoryOptions = categories
    .filter(categoryMatches)
    .map((category) => {
      const label = getCategoryPath(category);

      return {
        value: `category:${category.id}`,
        label,
        group: getPurposeGroup(category),
        categoryId: category.id,
        categoryLabel: label,
        parentCategoryId: category.parentCategory?.id ?? null,
        unit: null,
        searchText: label,
        kind: "CATEGORY" as const,
      };
    });

  const itemOptions = items
    .filter((item) => categoryMatches(item.category))
    .map((item) => {
      const label = getInventoryItemLabel(item);
      const categoryPath = item.category ? getCategoryPath(item.category) : "";

      return {
        value: `item:${item.id}`,
        label,
        group: getPurposeGroup(item.category),
        categoryId: item.category?.id ?? null,
        categoryLabel: item.category ? getCategoryPath(item.category) : "Ohne Kategorie",
        parentCategoryId: item.category?.parentCategory?.id ?? null,
        unit: item.stockUnit || null,
        searchText: `${label} ${categoryPath}`.trim(),
        kind: "OBJECT" as const,
      };
    });

  return [...categoryOptions, ...itemOptions].sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group, "de");

    if (groupCompare !== 0) return groupCompare;

    if (a.kind !== b.kind) return a.kind === "CATEGORY" ? -1 : 1;

    return a.label.localeCompare(b.label, "de");
  });
}

function parseDateParam(value: string | undefined) {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function timeToMinutes(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function formatQuantity(value: number | null, unit: string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const formatted = value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return unit ? `${formatted} ${unit}` : formatted;
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string | null;
  licensePlate: string | null;
  vehicleType: string | null;
  category: string | null;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getPrimaryVehicleText(driver: {
  vehicleAssignments: {
    vehicle: {
      vehicleNumber: string | null;
      licensePlate: string | null;
      vehicleType: string | null;
      category: string | null;
    };
  }[];
}) {
  const primaryVehicle = driver.vehicleAssignments[0]?.vehicle;

  if (!primaryVehicle) {
    return "Hauptfahrzeug: kein Hauptfahrzeug";
  }

  return `Hauptfahrzeug: ${getVehicleLabel(primaryVehicle)}`;
}

function addUniqueLabel(labels: string[], label: string | null) {
  if (!label || label === "-") {
    return labels;
  }

  if (!labels.includes(label)) {
    labels.push(label);
  }

  return labels;
}

function getAssignmentLabel(assignment: {
  projectNumber: string;
  projectName: string;
  tours?: {
    projectNumber: string;
    projectName: string;
  }[];
}) {
  const firstTour = assignment.tours?.[0];

  if (firstTour) {
    return `${firstTour.projectNumber} · ${firstTour.projectName}`;
  }

  return `${assignment.projectNumber} · ${assignment.projectName}`;
}

function getTourPurposeLabel(tour: {
  purposeType: string;
  itemName: string | null;
  customPurpose: string | null;
  material: string | null;
}) {
  if (tour.customPurpose) {
    return tour.customPurpose;
  }

  if (tour.itemName) {
    return tour.itemName;
  }

  if (tour.material) {
    return tour.material;
  }

  if (
    tour.purposeType === "MATERIAL" ||
    tour.purposeType === "ASPHALT" ||
    tour.purposeType === "TRANSPORT_MATERIAL"
  ) {
    return "Transport Material";
  }

  if (
    tour.purposeType === "TRANSPORT" ||
    tour.purposeType === "TRANSPORT_MACHINE"
  ) {
    return "Transport Maschine";
  }

  return "Freier Zweck";
}

function getTourPurposeTypeLabel(value: string) {
  if (
    value === "MATERIAL" ||
    value === "ASPHALT" ||
    value === "TRANSPORT_MATERIAL"
  ) {
    return "Transport Material";
  }

  if (value === "TRANSPORT" || value === "TRANSPORT_MACHINE") {
    return "Transport Maschine";
  }

  return "Freier Zweck";
}

export default async function ShortHaulPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    editAssignmentId?: string;
    fromTimeline?: string;
  }>;
}) {
  const params = await searchParams;

  const selectedDate = parseDateParam(params.date);
  const selectedDateInput = formatDateInput(selectedDate);
  const timelineEditAssignmentId =
    params.fromTimeline === "1" ? params.editAssignmentId ?? "" : "";
  const previousDay = formatDateInput(addDays(selectedDate, -1));
  const today = formatDateInput(new Date());
  const nextDay = formatDateInput(addDays(selectedDate, 1));

  const [
    assignments,
    projects,
    allVehicleItems,
    allDrivers,
    longHaulAssignments,
    inventoryCategories,
    inventoryItems,
    unitAdminOptions,
    asphaltOpenPositions,
    asphaltAllocations,
    tackCoatOpenPositions,
    tackCoatAllocations,
  ] = await Promise.all([
    prisma.shortHaulAssignment.findMany({
      where: {
        workDate: {
          gte: selectedDate,
          lt: addDays(selectedDate, 1),
        },
      },
      include: {
        tours: {
          orderBy: [{ tourNumber: "asc" }, { startTime: "asc" }],
        },
      },
      orderBy: [{ startTime: "asc" }, { vehicleNumber: "asc" }],
    }),

    prisma.project.findMany({
      where: {
        status: {
          in: [
            ProjectStatus.NOT_STARTED,
            ProjectStatus.ACTIVE,
            ProjectStatus.PAUSED,
          ],
        },
      },
      orderBy: [{ projectNumber: "asc" }],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "INACTIVE",
        },
        vehicleId: {
          not: null,
        },
        category: {
          OR: [
            {
              useInTruckDispatchSelection: true,
            },
            {
              parentCategory: {
                useInTruckDispatchSelection: true,
              },
            },
          ],
        },
      },
      include: inventoryVehicleBridgeInclude,
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { objectNumber: "asc" },
        { name: "asc" },
      ],
    }),

    prisma.driver.findMany({
      where: {
        isActive: true,
      },
      include: {
        employee: {
          select: {
            positions: {
              select: {
                positionLabel: true,
                positionValue: true,
              },
            },
          },
        },
        vehicleAssignments: {
          where: {
            isActive: true,
          },
          include: {
            vehicle: {
              include: vehicleInventoryLinkInclude,
            },
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.truckLongHaulTruckAssignment.findMany({
      where: {
        ownerType: "OWN",
        entry: {
          workDate: {
            gte: selectedDate,
            lt: addDays(selectedDate, 1),
          },
        },
      },
      include: {
        entry: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),

    prisma.inventoryCategory.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        useInTruckDispatchMaterial: true,
        useInTruckDispatchObject: true,
        useInTruckDispatchSelection: true,
        parentCategory: {
          select: {
            id: true,
            name: true,
            useInTruckDispatchMaterial: true,
            useInTruckDispatchObject: true,
            useInTruckDispatchSelection: true,
          },
        },
      },
      orderBy: [{ parentCategoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "DELETED",
        },
      },
      select: {
        id: true,
        name: true,
        objectNumber: true,
        inventoryNumber: true,
        stixId: true,
        manufacturer: true,
        model: true,
        licensePlate: true,
        stockUnit: true,
        category: {
          select: {
            id: true,
            name: true,
            useInTruckDispatchMaterial: true,
            useInTruckDispatchObject: true,
            useInTruckDispatchSelection: true,
            parentCategory: {
              select: {
                id: true,
                name: true,
                useInTruckDispatchMaterial: true,
                useInTruckDispatchObject: true,
                useInTruckDispatchSelection: true,
              },
            },
          },
        },
      },
      orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: ["material_unit", "asphalt_unit", "quantity_unit"],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    getAsphaltOpenPositions(selectedDate),
    getAsphaltAllocationsForDay(selectedDate),
    getTackCoatOpenPositions(selectedDate),
    getTackCoatAllocationsForDay(selectedDate),
  ]);

  const allVehicles = allVehicleItems.flatMap((item) => {
    const vehicle = inventoryItemToVehicleWithInventoryLink(item);
    return vehicle ? [vehicle] : [];
  });
  const vehicles = allVehicles.filter(vehicleIsSelectableInTruckDispatch);
  const drivers = allDrivers.filter(driverIsSelectableInTruckDispatch);

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const materialTransportOptions = buildTransportPurposeOptions({
    categories: inventoryCategories,
    items: inventoryItems,
    kind: "MATERIAL",
  });
  const machineTransportOptions = buildTransportPurposeOptions({
    categories: inventoryCategories,
    items: inventoryItems,
    kind: "MACHINE",
  });

  const unitOptionsFromAdmin = unitAdminOptions.map((option) => option.label);
  const unitOptions = Array.from(
    new Set([...unitOptionsFromAdmin, ...unitFallback])
  );

  const driverConflicts: Record<string, string> = {};
  const vehicleConflicts: Record<string, string> = {};

  for (const assignment of longHaulAssignments) {
    const label = `${assignment.entry.projectNumber} · ${assignment.entry.projectName}`;

    if (assignment.driverId) {
      driverConflicts[assignment.driverId] = label;
    }

    if (assignment.vehicleId) {
      vehicleConflicts[assignment.vehicleId] = label;
    }
  }

  function buildShortDriverConflicts(excludeId?: string) {
    const conflicts: Record<string, string> = {};

    for (const assignment of assignments) {
      if (excludeId && assignment.id === excludeId) {
        continue;
      }

      if (assignment.driverId) {
        conflicts[assignment.driverId] = getAssignmentLabel(assignment);
      }
    }

    Object.assign(
      conflicts,
      shortAsphaltDriverConflicts,
      shortTackCoatDriverConflicts,
    );

    return conflicts;
  }

  function buildShortVehicleConflicts(excludeId?: string) {
    const conflicts: Record<string, string> = {};

    for (const assignment of assignments) {
      if (excludeId && assignment.id === excludeId) {
        continue;
      }

      if (assignment.vehicleId) {
        conflicts[assignment.vehicleId] = getAssignmentLabel(assignment);
      }
    }

    Object.assign(
      conflicts,
      shortAsphaltVehicleConflicts,
      shortTackCoatVehicleConflicts,
    );

    return conflicts;
  }

  const totalTours = assignments.reduce(
    (sum, assignment) => sum + assignment.tours.length,
    0
  );

  const totalAsphaltTons = asphaltOpenPositions.reduce(
    (sum, position) => sum + position.totalTons,
    0
  );

  const allocatedAsphaltTons = asphaltOpenPositions.reduce(
    (sum, position) => sum + position.allocatedTons,
    0
  );

  const openAsphaltTons = asphaltOpenPositions.reduce(
    (sum, position) => sum + position.openTons,
    0
  );

  const totalTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.plannedLiters,
    0
  );

  const specialVehicleTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.specialVehicleLiters,
    0
  );

  const shortHaulTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.shortHaulLiters,
    0
  );

  const allocatedTackCoatLiters =
    specialVehicleTackCoatLiters + shortHaulTackCoatLiters;

  const openTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.openLiters,
    0
  );

  const shortAsphaltAllocations = asphaltAllocations.filter(
    (allocation) => allocation.sourceType === "SHORT"
  );

  const shortTackCoatAllocations = tackCoatAllocations.filter(
    (allocation) => allocation.sourceType === "SHORT"
  );

  const shortAsphaltDriverConflicts: Record<string, string> = Object.fromEntries(
    shortAsphaltAllocations
      .filter((allocation) => allocation.driverId)
      .map((allocation) => [
        allocation.driverId as string,
        `Asphalt ${allocation.projectNumber} · ${
          allocation.asphaltMixName ?? "Asphalt"
        }`,
      ])
  );

  const shortAsphaltVehicleConflicts: Record<string, string> = Object.fromEntries(
    shortAsphaltAllocations
      .filter((allocation) => allocation.vehicleId)
      .map((allocation) => [
        allocation.vehicleId as string,
        `Asphalt ${allocation.projectNumber} · ${
          allocation.asphaltMixName ?? "Asphalt"
        }`,
      ])
  );

  const shortTackCoatDriverConflicts: Record<string, string> = Object.fromEntries(
    shortTackCoatAllocations
      .filter((allocation) => allocation.driverId)
      .map((allocation) => [
        allocation.driverId as string,
        `Anspritzmittel ${allocation.projectNumber} · ${allocation.materialName}`,
      ])
  );

  const shortTackCoatVehicleConflicts: Record<string, string> = Object.fromEntries(
    shortTackCoatAllocations
      .filter((allocation) => allocation.vehicleId)
      .map((allocation) => [
        allocation.vehicleId as string,
        `Anspritzmittel ${allocation.projectNumber} · ${allocation.materialName}`,
      ])
  );

  const shortDriverConflicts = buildShortDriverConflicts();
  const shortVehicleConflicts = buildShortVehicleConflicts();

  // Späteste Endzeit eines bestehenden Kurzstrecken-Eintrags pro Fahrer/
  // Fahrzeug an dem Tag - damit kann ein Zuteilungs-Formular beim Auswählen
  // direkt ab der freien Uhrzeit statt wieder ab Arbeitsbeginn planen.
  // "HH:MM" lässt sich als String direkt vergleichen (Zeitreihenfolge).
  const shortDriverFreeFrom: Record<string, string> = {};
  const shortVehicleFreeFrom: Record<string, string> = {};

  function noteFreeFrom(
    map: Record<string, string>,
    key: string | null,
    endTime: string
  ) {
    if (!key) return;
    if (!map[key] || endTime > map[key]) {
      map[key] = endTime;
    }
  }

  for (const assignment of assignments) {
    for (const tour of assignment.tours) {
      noteFreeFrom(shortDriverFreeFrom, assignment.driverId, tour.endTime);
      noteFreeFrom(shortVehicleFreeFrom, assignment.vehicleId, tour.endTime);
    }
  }

  for (const allocation of shortAsphaltAllocations) {
    noteFreeFrom(shortDriverFreeFrom, allocation.driverId, allocation.endTime);
    noteFreeFrom(shortVehicleFreeFrom, allocation.vehicleId, allocation.endTime);
  }

  for (const allocation of shortTackCoatAllocations) {
    noteFreeFrom(shortDriverFreeFrom, allocation.driverId, allocation.endTime);
    noteFreeFrom(shortVehicleFreeFrom, allocation.vehicleId, allocation.endTime);
  }

  const usedDriverIds = new Set([
    ...assignments
      .map((assignment) => assignment.driverId)
      .filter((id): id is string => Boolean(id)),
    ...Object.keys(shortAsphaltDriverConflicts),
    ...Object.keys(shortTackCoatDriverConflicts),
  ]);

  const usedVehicleIds = new Set([
    ...assignments
      .map((assignment) => assignment.vehicleId)
      .filter((id): id is string => Boolean(id)),
    ...Object.keys(shortAsphaltVehicleConflicts),
    ...Object.keys(shortTackCoatVehicleConflicts),
  ]);

  const freeDrivers = drivers.filter(
    (driver) => !usedDriverIds.has(driver.id) && !driverConflicts[driver.id]
  );

  const freeVehicles = vehicles.filter(
    (vehicle) => !usedVehicleIds.has(vehicle.id) && !vehicleConflicts[vehicle.id]
  );

  const asphaltAllocationDriverConflicts = {
    ...driverConflicts,
    ...shortDriverConflicts,
  };

  const asphaltAllocationVehicleConflicts = {
    ...vehicleConflicts,
    ...shortVehicleConflicts,
  };

  function matchesDailyResource(
    target: { driverId: string | null; vehicleId: string | null },
    candidate: { driverId: string | null; vehicleId: string | null }
  ) {
    return Boolean(
      (target.driverId && candidate.driverId === target.driverId) ||
        (target.vehicleId && candidate.vehicleId === target.vehicleId)
    );
  }

  function getDailyTourOffsetBefore({
    driverId,
    vehicleId,
    beforeMinutes,
    excludeTourId,
  }: {
    driverId: string | null;
    vehicleId: string | null;
    beforeMinutes: number;
    excludeTourId?: string;
  }) {
    const target = { driverId, vehicleId };

    const matchingShortTourCount = assignments.reduce((sum, assignment) => {
      if (!matchesDailyResource(target, assignment)) {
        return sum;
      }

      return (
        sum +
        assignment.tours.filter(
          (tour) =>
            tour.id !== excludeTourId &&
            timeToMinutes(tour.endTime) <= beforeMinutes
        ).length
      );
    }, 0);

    const matchingAsphaltTourCount = shortAsphaltAllocations
      .filter(
        (allocation) =>
          matchesDailyResource(target, allocation) &&
          timeToMinutes(allocation.endTime) <= beforeMinutes
      )
      .reduce((sum, allocation) => sum + allocation.tourCount, 0);

    const matchingTackCoatTourCount = shortTackCoatAllocations
      .filter(
        (allocation) =>
          matchesDailyResource(target, allocation) &&
          timeToMinutes(allocation.endTime) <= beforeMinutes
      )
      .reduce((sum, allocation) => sum + allocation.tourCount, 0);

    return (
      matchingShortTourCount +
      matchingAsphaltTourCount +
      matchingTackCoatTourCount
    );
  }

  function getShortHaulAssignmentTourOffset(
    assignment: (typeof assignments)[number]
  ) {
    const firstTourStart = assignment.tours.reduce(
      (earliest, tour) =>
        timeToMinutes(tour.startTime) < timeToMinutes(earliest)
          ? tour.startTime
          : earliest,
      assignment.tours[0]?.startTime ?? assignment.startTime
    );

    return getDailyTourOffsetBefore({
      driverId: assignment.driverId,
      vehicleId: assignment.vehicleId,
      beforeMinutes: timeToMinutes(firstTourStart),
    });
  }

  function getShortHaulTourNumber(
    assignment: (typeof assignments)[number],
    tour: (typeof assignments)[number]["tours"][number]
  ) {
    return (
      getDailyTourOffsetBefore({
        driverId: assignment.driverId,
        vehicleId: assignment.vehicleId,
        beforeMinutes: timeToMinutes(tour.startTime),
        excludeTourId: tour.id,
      }) + 1
    );
  }

  function getAllocationTourLabel(allocation: {
    driverId: string | null;
    vehicleId: string | null;
    startTime: string;
    tourCount: number;
  }) {
    const offset = getDailyTourOffsetBefore({
      driverId: allocation.driverId,
      vehicleId: allocation.vehicleId,
      beforeMinutes: timeToMinutes(allocation.startTime),
    });
    const firstTourNumber = offset + 1;
    const lastTourNumber = offset + Math.max(allocation.tourCount, 1);

    if (firstTourNumber === lastTourNumber) {
      return `Tour ${firstTourNumber}`;
    }

    return `Touren ${firstTourNumber}-${lastTourNumber}`;
  }

  function getAssignmentSortStart(assignment: (typeof assignments)[number]) {
    return assignment.tours.reduce(
      (earliest, tour) =>
        Math.min(earliest, timeToMinutes(tour.startTime)),
      timeToMinutes(assignment.startTime)
    );
  }

  function getAssignmentSortEnd(assignment: (typeof assignments)[number]) {
    return assignment.tours.reduce(
      (latest, tour) => Math.max(latest, timeToMinutes(tour.endTime)),
      timeToMinutes(assignment.startTime)
    );
  }

  const dailyScheduleRows = [
    ...assignments.map((assignment) => ({
      kind: "assignment" as const,
      id: assignment.id,
      sortStart: getAssignmentSortStart(assignment),
      sortEnd: getAssignmentSortEnd(assignment),
      assignment,
    })),
    ...shortAsphaltAllocations.map((allocation) => ({
      kind: "asphalt" as const,
      id: allocation.id,
      sortStart: timeToMinutes(allocation.startTime),
      sortEnd: timeToMinutes(allocation.endTime),
      allocation,
    })),
    ...shortTackCoatAllocations.map((allocation) => ({
      kind: "tackCoat" as const,
      id: allocation.id,
      sortStart: timeToMinutes(allocation.startTime),
      sortEnd: timeToMinutes(allocation.endTime),
      allocation,
    })),
  ].sort((first, second) => {
    const startDiff = first.sortStart - second.sortStart;

    if (startDiff !== 0) {
      return startDiff;
    }

    const endDiff = first.sortEnd - second.sortEnd;

    if (endDiff !== 0) {
      return endDiff;
    }

    return `${first.kind}-${first.id}`.localeCompare(
      `${second.kind}-${second.id}`
    );
  });

  type DailyScheduleRow = (typeof dailyScheduleRows)[number];
  type DailyScheduleItem =
    | {
        kind: "shortTour";
        id: string;
        sortStart: number;
        sortEnd: number;
        assignment: (typeof assignments)[number];
        tour: (typeof assignments)[number]["tours"][number];
      }
    | {
        kind: "asphalt";
        id: string;
        sortStart: number;
        sortEnd: number;
        allocation: (typeof shortAsphaltAllocations)[number];
      }
    | {
        kind: "tackCoat";
        id: string;
        sortStart: number;
        sortEnd: number;
        allocation: (typeof shortTackCoatAllocations)[number];
      };

  function getSortedAssignmentTours(assignment: (typeof assignments)[number]) {
    return [...assignment.tours].sort((first, second) => {
      const startDiff =
        timeToMinutes(first.startTime) - timeToMinutes(second.startTime);

      if (startDiff !== 0) {
        return startDiff;
      }

      return timeToMinutes(first.endTime) - timeToMinutes(second.endTime);
    });
  }

  function getDailyRowDriverId(row: DailyScheduleRow) {
    return row.kind === "assignment"
      ? row.assignment.driverId
      : row.allocation.driverId;
  }

  function getDailyRowVehicleId(row: DailyScheduleRow) {
    return row.kind === "assignment"
      ? row.assignment.vehicleId
      : row.allocation.vehicleId;
  }

  function getDailyRowDriverName(row: DailyScheduleRow) {
    return row.kind === "assignment"
      ? row.assignment.driverName
      : row.allocation.driverName;
  }

  function getDailyRowVehicleLabel(row: DailyScheduleRow) {
    if (row.kind !== "assignment") {
      return row.allocation.vehicleLabel || "-";
    }

    return (
      [
        row.assignment.vehicleNumber,
        row.assignment.licensePlate,
        row.assignment.vehicleCategory,
        row.assignment.vehicleType,
      ]
        .filter(Boolean)
        .join(" · ") || "-"
    );
  }

  function getDailyRowGroupKey(row: DailyScheduleRow) {
    const driverId = getDailyRowDriverId(row);
    const vehicleId = getDailyRowVehicleId(row);

    if (driverId) {
      return `driver-${driverId}`;
    }

    if (vehicleId) {
      return `vehicle-${vehicleId}`;
    }

    return `${row.kind}-${row.id}`;
  }

  function getDailyScheduleItems(row: DailyScheduleRow): DailyScheduleItem[] {
    if (row.kind === "assignment") {
      return getSortedAssignmentTours(row.assignment).map((tour) => ({
        kind: "shortTour" as const,
        id: tour.id,
        sortStart: timeToMinutes(tour.startTime),
        sortEnd: timeToMinutes(tour.endTime),
        assignment: row.assignment,
        tour,
      }));
    }

    if (row.kind === "asphalt") {
      return [
        {
          kind: "asphalt" as const,
          id: row.allocation.id,
          sortStart: timeToMinutes(row.allocation.startTime),
          sortEnd: timeToMinutes(row.allocation.endTime),
          allocation: row.allocation,
        },
      ];
    }

    return [
      {
        kind: "tackCoat" as const,
        id: row.allocation.id,
        sortStart: timeToMinutes(row.allocation.startTime),
        sortEnd: timeToMinutes(row.allocation.endTime),
        allocation: row.allocation,
      },
    ];
  }

  const dailyScheduleGroupMap = new Map<
    string,
    {
      id: string;
      sortStart: number;
      sortEnd: number;
      driverName: string;
      vehicleLabels: string[];
      sourceRows: DailyScheduleRow[];
      items: DailyScheduleItem[];
    }
  >();

  for (const row of dailyScheduleRows) {
    const groupKey = getDailyRowGroupKey(row);
    const existingGroup = dailyScheduleGroupMap.get(groupKey);
    const group =
      existingGroup ??
      {
        id: groupKey,
        sortStart: row.sortStart,
        sortEnd: row.sortEnd,
        driverName: getDailyRowDriverName(row) ?? "-",
        vehicleLabels: [],
        sourceRows: [],
        items: [],
      };

    group.sortStart = Math.min(group.sortStart, row.sortStart);
    group.sortEnd = Math.max(group.sortEnd, row.sortEnd);
    group.sourceRows.push(row);
    group.items.push(...getDailyScheduleItems(row));
    addUniqueLabel(group.vehicleLabels, getDailyRowVehicleLabel(row));

    if (group.driverName === "-" && getDailyRowDriverName(row)) {
      group.driverName = getDailyRowDriverName(row) ?? "-";
    }

    dailyScheduleGroupMap.set(groupKey, group);
  }

  const dailyScheduleGroups = Array.from(dailyScheduleGroupMap.values()).map(
    (group) => ({
      ...group,
      items: group.items.sort((first, second) => {
        const startDiff = first.sortStart - second.sortStart;

        if (startDiff !== 0) {
          return startDiff;
        }

        const endDiff = first.sortEnd - second.sortEnd;

        if (endDiff !== 0) {
          return endDiff;
        }

        return `${first.kind}-${first.id}`.localeCompare(
          `${second.kind}-${second.id}`
        );
      }),
    })
  ).sort((first, second) => {
    const startDiff = first.sortStart - second.sortStart;

    if (startDiff !== 0) {
      return startDiff;
    }

    return first.driverName.localeCompare(second.driverName);
  });

  const utilizationRows = [
    ...drivers.map((driver) => {
      const blocks = [];
      const dayVehicleLabels: string[] = [];
      const dayAssignment =
        assignments.find((assignment) => assignment.driverId === driver.id) ??
        null;
      const dayAsphaltAllocation = shortAsphaltAllocations.find(
        (allocation) => allocation.driverId === driver.id
      );
      const dayTackCoatAllocation = shortTackCoatAllocations.find(
        (allocation) => allocation.driverId === driver.id
      );

      for (const longHaulAssignment of longHaulAssignments) {
        if (longHaulAssignment.driverId === driver.id) {
          blocks.push({
            id: `driver-long-${longHaulAssignment.id}`,
            label: `Langstrecke ${longHaulAssignment.entry.projectNumber}`,
            detail: longHaulAssignment.entry.projectName,
            startTime: "00:00",
            endTime: "24:00",
            type: "LONG" as const,
          });

          addUniqueLabel(
            dayVehicleLabels,
            getVehicleLabel({
              vehicleNumber: longHaulAssignment.vehicleNumber,
              licensePlate: longHaulAssignment.licensePlate,
              category: longHaulAssignment.vehicleCategory,
              vehicleType: longHaulAssignment.vehicleType,
            })
          );
        }
      }

      for (const assignment of assignments) {
        if (assignment.driverId !== driver.id) {
          continue;
        }

        const assignedVehicle = assignment.vehicleId
          ? vehicleById.get(assignment.vehicleId)
          : null;

        addUniqueLabel(
          dayVehicleLabels,
          assignedVehicle
            ? getVehicleLabel(assignedVehicle)
            : getVehicleLabel({
                vehicleNumber: assignment.vehicleNumber,
                licensePlate: assignment.licensePlate,
                category: assignment.vehicleCategory,
                vehicleType: assignment.vehicleType,
              })
        );

        for (const tour of assignment.tours) {
          blocks.push({
            id: `driver-short-${tour.id}`,
            label: `${tour.projectNumber} · ${tour.projectName}`,
            detail: getTourPurposeLabel(tour),
            startTime: tour.startTime,
            endTime: tour.endTime,
            type: "SHORT" as const,
          });
        }
      }

      for (const allocation of shortAsphaltAllocations) {
        if (allocation.driverId !== driver.id) {
          continue;
        }

        addUniqueLabel(dayVehicleLabels, allocation.vehicleLabel);

        blocks.push({
          id: `driver-asphalt-${allocation.id}`,
          label: `${allocation.projectNumber} · ${
            allocation.asphaltMixName ?? "Asphalt"
          }`,
          detail: `${allocation.tourCount} Touren × ${formatTons(
            allocation.tonsPerTour
          )} t = ${formatTons(allocation.totalTons)} t`,
          startTime: allocation.startTime,
          endTime: allocation.endTime,
          tourCount: allocation.tourCount,
          type: "SHORT" as const,
        });
      }

      for (const allocation of shortTackCoatAllocations) {
        if (allocation.driverId !== driver.id) {
          continue;
        }

        addUniqueLabel(dayVehicleLabels, allocation.vehicleLabel);

        blocks.push({
          id: `driver-tack-coat-${allocation.id}`,
          label: `${allocation.projectNumber} · ${allocation.materialName}`,
          detail: `${allocation.tourCount} Touren × ${formatLiters(
            allocation.litersPerTour
          )} ${allocation.quantityUnit} = ${formatLiters(
            allocation.totalLiters
          )} ${allocation.quantityUnit}`,
          startTime: allocation.startTime,
          endTime: allocation.endTime,
          tourCount: allocation.tourCount,
          type: "SHORT" as const,
        });
      }

      const dayVehicleText =
        dayVehicleLabels.length > 0
          ? `Tageseinteilung: ${dayVehicleLabels.join(" / ")}`
          : "Tageseinteilung: kein Fahrzeug zugewiesen";

      const primaryVehicleText = getPrimaryVehicleText(driver);

      return {
        id: `driver-${driver.id}`,
        kind: "DRIVER" as const,
        title: `${driver.lastName}, ${driver.firstName}`,
        subtitle: `${dayVehicleText} · ${primaryVehicleText}`,
        shortHaulAssignmentId: dayAssignment?.id,
        dayDriverId: driver.id,
        dayVehicleId:
          dayAssignment?.vehicleId ??
          dayAsphaltAllocation?.vehicleId ??
          dayTackCoatAllocation?.vehicleId ??
          undefined,
        blocks,
      };
    }),

    ...vehicles.map((vehicle) => {
      const blocks = [];
      const dayAssignment =
        assignments.find((assignment) => assignment.vehicleId === vehicle.id) ??
        null;
      const dayAsphaltAllocation = shortAsphaltAllocations.find(
        (allocation) => allocation.vehicleId === vehicle.id
      );
      const dayTackCoatAllocation = shortTackCoatAllocations.find(
        (allocation) => allocation.vehicleId === vehicle.id
      );

      for (const longHaulAssignment of longHaulAssignments) {
        if (longHaulAssignment.vehicleId === vehicle.id) {
          blocks.push({
            id: `vehicle-long-${longHaulAssignment.id}`,
            label: `Langstrecke ${longHaulAssignment.entry.projectNumber}`,
            detail: longHaulAssignment.entry.projectName,
            startTime: "00:00",
            endTime: "24:00",
            type: "LONG" as const,
          });
        }
      }

      for (const assignment of assignments) {
        if (assignment.vehicleId !== vehicle.id) {
          continue;
        }

        for (const tour of assignment.tours) {
          blocks.push({
            id: `vehicle-short-${tour.id}`,
            label: `${tour.projectNumber} · ${tour.projectName}`,
            detail: getTourPurposeLabel(tour),
            startTime: tour.startTime,
            endTime: tour.endTime,
            type: "SHORT" as const,
          });
        }
      }

      for (const allocation of shortAsphaltAllocations) {
        if (allocation.vehicleId !== vehicle.id) {
          continue;
        }

        blocks.push({
          id: `vehicle-asphalt-${allocation.id}`,
          label: `${allocation.projectNumber} · ${
            allocation.asphaltMixName ?? "Asphalt"
          }`,
          detail: `${allocation.tourCount} Touren × ${formatTons(
            allocation.tonsPerTour
          )} t = ${formatTons(allocation.totalTons)} t`,
          startTime: allocation.startTime,
          endTime: allocation.endTime,
          tourCount: allocation.tourCount,
          type: "SHORT" as const,
        });
      }

      for (const allocation of shortTackCoatAllocations) {
        if (allocation.vehicleId !== vehicle.id) {
          continue;
        }

        blocks.push({
          id: `vehicle-tack-coat-${allocation.id}`,
          label: `${allocation.projectNumber} · ${allocation.materialName}`,
          detail: `${allocation.tourCount} Touren × ${formatLiters(
            allocation.litersPerTour
          )} ${allocation.quantityUnit} = ${formatLiters(
            allocation.totalLiters
          )} ${allocation.quantityUnit}`,
          startTime: allocation.startTime,
          endTime: allocation.endTime,
          tourCount: allocation.tourCount,
          type: "SHORT" as const,
        });
      }

      const assignedDriver = vehicle.driverAssignments[0]?.driver;

      return {
        id: `vehicle-${vehicle.id}`,
        kind: "VEHICLE" as const,
        title: `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"}`,
        subtitle: assignedDriver
          ? `Zugeordneter Fahrer: ${assignedDriver.lastName}, ${assignedDriver.firstName} · ${vehicle.category}`
          : `frei zugeordnet · ${vehicle.category} · ${vehicle.vehicleType}`,
        shortHaulAssignmentId: dayAssignment?.id,
        dayDriverId:
          dayAssignment?.driverId ??
          dayAsphaltAllocation?.driverId ??
          dayTackCoatAllocation?.driverId ??
          undefined,
        dayVehicleId: vehicle.id,
        blocks,
      };
    }),
  ];

  function renderAssignmentEditSection(
    assignment: (typeof assignments)[number]
  ) {
    const assignmentTourOffset = getShortHaulAssignmentTourOffset(assignment);
    const sortedTours = getSortedAssignmentTours(assignment);

    return (
      <section key={`edit-assignment-${assignment.id}`} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Kurzstrecken-Touren bearbeiten
        </h3>

        <ShortHaulForm
          action={updateShortHaulAssignment}
          id={assignment.id}
          projects={projects}
          vehicles={vehicles}
          drivers={drivers}
          materialTransportOptions={materialTransportOptions}
          machineTransportOptions={machineTransportOptions}
          unitOptions={unitOptions}
          driverConflicts={driverConflicts}
          vehicleConflicts={vehicleConflicts}
          shortDriverConflicts={buildShortDriverConflicts(assignment.id)}
          shortVehicleConflicts={buildShortVehicleConflicts(assignment.id)}
          defaultVehicleId={assignment.vehicleId ?? ""}
          defaultDriverId={assignment.driverId ?? ""}
          defaultNotes={assignment.notes ?? ""}
          defaultTourNumberOffset={assignmentTourOffset}
          defaultTours={
            sortedTours.length > 0
              ? sortedTours.map((tour) => ({
                  startTime: tour.startTime,
                  endTime: tour.endTime,
                  projectId: tour.projectId ?? "",
                  purposeType: tour.purposeType ?? "CUSTOM",
                  itemId: tour.itemId ?? "",
                  customPurpose: tour.customPurpose ?? "",
                  quantity:
                    tour.quantity !== null && tour.quantity !== undefined
                      ? String(tour.quantity)
                      : "",
                  quantityUnit: tour.quantityUnit ?? "",
                  notes: tour.notes ?? "",
                }))
              : [
                  {
                    startTime: assignment.startTime,
                    endTime: "",
                    projectId: assignment.projectId ?? "",
                    purposeType: "CUSTOM",
                    itemId: "",
                    customPurpose: assignment.material ?? "",
                    quantity: "",
                    quantityUnit: "",
                    notes: "",
                  },
                ]
          }
        />

        <form action={deleteShortHaulAssignment} className="mt-3 flex justify-start">
          <input type="hidden" name="id" value={assignment.id} />
          <IconActionButton
            icon="delete"
            title="Kurzstrecken-Einteilung löschen"
            danger
          />
        </form>
      </section>
    );
  }

  function renderAsphaltEditSection(
    allocation: (typeof shortAsphaltAllocations)[number]
  ) {
    return (
      <section key={`edit-asphalt-${allocation.id}`} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Asphalt-Zuteilung bearbeiten
        </h3>

        <div className="rounded-xl border border-orange-200 bg-white p-3">
          <div className="mb-3 text-xs font-semibold text-orange-900">
            {getAllocationTourLabel(allocation)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-gray-700 md:col-span-2">
              Baustelle
              <div className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm font-medium text-gray-900">
                {allocation.projectNumber} · {allocation.projectName}
              </div>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Beginn
              <input
                form={`daily-allocation-form-${allocation.id}`}
                name="startTime"
                type="time"
                defaultValue={allocation.startTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              Ende
              <input
                form={`daily-allocation-form-${allocation.id}`}
                name="endTime"
                type="time"
                defaultValue={allocation.endTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              Touren
              <input
                form={`daily-allocation-form-${allocation.id}`}
                name="tourCount"
                type="number"
                min="1"
                defaultValue={allocation.tourCount}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              t / Tour
              <input
                form={`daily-allocation-form-${allocation.id}`}
                name="tonsPerTour"
                type="number"
                min="0"
                step="0.01"
                defaultValue={String(allocation.tonsPerTour)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>
          </div>

          <input
            form={`daily-allocation-form-${allocation.id}`}
            name="notes"
            defaultValue={allocation.notes ?? ""}
            placeholder="Bemerkung"
            className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
          />

          <div className="mt-3 flex gap-2">
            <form
              id={`daily-allocation-form-${allocation.id}`}
              action={updateAsphaltLoadAllocation}
            >
              <input type="hidden" name="id" value={allocation.id} />
              <IconActionButton icon="save" title="Asphalt-Zuteilung speichern" />
            </form>

            <form action={deleteAsphaltLoadAllocation}>
              <input type="hidden" name="id" value={allocation.id} />
              <IconActionButton
                icon="delete"
                title="Asphalt-Zuteilung löschen"
                danger
              />
            </form>
          </div>
        </div>
      </section>
    );
  }

  function renderTackCoatEditSection(
    allocation: (typeof shortTackCoatAllocations)[number]
  ) {
    return (
      <section key={`edit-tack-coat-${allocation.id}`} className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Anspritzmittel-Zuteilung bearbeiten
        </h3>

        <div className="rounded-xl border border-blue-200 bg-white p-3">
          <div className="mb-3 text-xs font-semibold text-blue-900">
            {getAllocationTourLabel(allocation)}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-gray-700 md:col-span-2">
              Baustelle
              <div className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-2 py-2 text-sm font-medium text-gray-900">
                {allocation.projectNumber} · {allocation.projectName}
              </div>
            </label>

            <label className="text-xs font-medium text-gray-700">
              Beginn
              <input
                form={`daily-tack-coat-form-${allocation.id}`}
                name="startTime"
                type="time"
                defaultValue={allocation.startTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              Ende
              <input
                form={`daily-tack-coat-form-${allocation.id}`}
                name="endTime"
                type="time"
                defaultValue={allocation.endTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              Touren
              <input
                form={`daily-tack-coat-form-${allocation.id}`}
                name="tourCount"
                type="number"
                min="1"
                defaultValue={allocation.tourCount}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="text-xs font-medium text-gray-700">
              l / Tour
              <input
                form={`daily-tack-coat-form-${allocation.id}`}
                name="litersPerTour"
                type="number"
                min="0"
                step="0.01"
                defaultValue={String(allocation.litersPerTour)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
              />
            </label>
          </div>

          <input
            form={`daily-tack-coat-form-${allocation.id}`}
            name="notes"
            defaultValue={allocation.notes ?? ""}
            placeholder="Bemerkung"
            className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
          />

          <div className="mt-3 flex gap-2">
            <form
              id={`daily-tack-coat-form-${allocation.id}`}
              action={updateTackCoatLoadAllocation}
            >
              <input type="hidden" name="id" value={allocation.id} />
              <IconActionButton
                icon="save"
                title="Anspritzmittel-Zuteilung speichern"
              />
            </form>

            <form action={deleteTackCoatLoadAllocation}>
              <input type="hidden" name="id" value={allocation.id} />
              <IconActionButton
                icon="delete"
                title="Anspritzmittel-Zuteilung löschen"
                danger
              />
            </form>
          </div>
        </div>
      </section>
    );
  }

  function renderDailyEditSection(row: DailyScheduleRow) {
    if (row.kind === "assignment") {
      return renderAssignmentEditSection(row.assignment);
    }

    if (row.kind === "asphalt") {
      return renderAsphaltEditSection(row.allocation);
    }

    return renderTackCoatEditSection(row.allocation);
  }

  function renderDailyScheduleItem(item: DailyScheduleItem) {
    if (item.kind === "shortTour") {
      const quantityText = formatQuantity(
        item.tour.quantity,
        item.tour.quantityUnit
      );

      return (
        <div
          key={`short-tour-${item.id}`}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900">
            <span>
              Tour {getShortHaulTourNumber(item.assignment, item.tour)}
            </span>
            <span>
              {item.tour.startTime} – {item.tour.endTime}
            </span>
            <span className="rounded-full bg-white px-2 py-1 text-gray-700">
              {getTourPurposeTypeLabel(item.tour.purposeType)}
            </span>
          </div>

          <div className="mt-1 text-sm font-medium text-gray-900">
            {item.tour.projectNumber} · {item.tour.projectName}
          </div>

          <div className="mt-1 text-xs text-gray-600">
            Zweck: {getTourPurposeLabel(item.tour)}
            {quantityText ? ` · ${quantityText}` : ""}
          </div>

          {item.tour.notes ? (
            <div className="mt-1 text-xs text-gray-500">{item.tour.notes}</div>
          ) : null}
        </div>
      );
    }

    if (item.kind === "asphalt") {
      const allocation = item.allocation;

      return (
        <div
          key={`asphalt-${allocation.id}`}
          className="rounded-lg border border-orange-200 bg-orange-50/40 p-3"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900">
            <span>{getAllocationTourLabel(allocation)}</span>
            <span>
              {allocation.startTime} – {allocation.endTime}
            </span>
            <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-900">
              Asphalt
            </span>
          </div>

          <div className="mt-1 text-sm font-medium text-gray-900">
            {allocation.projectNumber} · {allocation.projectName}
          </div>

          <div className="mt-1 text-xs text-gray-600">
            {allocation.asphaltMixNumber ?? "-"} ·{" "}
            {allocation.asphaltMixName ?? "Asphalt"} ·{" "}
            {formatTons(allocation.totalTons)} t gesamt ·{" "}
            {formatTons(allocation.tonsPerTour)} t/Tour
          </div>

          {allocation.notes ? (
            <div className="mt-1 text-xs text-gray-500">{allocation.notes}</div>
          ) : null}
        </div>
      );
    }

    const allocation = item.allocation;

    return (
      <div
        key={`tack-coat-${allocation.id}`}
        className="rounded-lg border border-blue-200 bg-blue-50/40 p-3"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900">
          <span>{getAllocationTourLabel(allocation)}</span>
          <span>
            {allocation.startTime} – {allocation.endTime}
          </span>
          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-900">
            Anspritzmittel
          </span>
        </div>

        <div className="mt-1 text-sm font-medium text-gray-900">
          {allocation.projectNumber} · {allocation.projectName}
        </div>

        <div className="mt-1 text-xs text-gray-600">
          {allocation.materialName} · {formatLiters(allocation.totalLiters)}{" "}
          {allocation.quantityUnit} gesamt ·{" "}
          {formatLiters(allocation.litersPerTour)} {allocation.quantityUnit}/Tour
        </div>

        {allocation.notes ? (
          <div className="mt-1 text-xs text-gray-500">{allocation.notes}</div>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell
      title="LKW-Einteilung Kurzstrecke"
      description="Tagesplanung für Fahrer, Fahrzeuge und mehrere Touren je Fahrer/Fahrzeug."
    >
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {formatGermanDate(selectedDate)}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Fahrer mit Hauptfahrzeug können direkt gewählt werden. Neue Touren
            starten automatisch mit dem Ende der vorherigen Tour.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <form
            action="/truck-dispatch/short-haul"
            className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <label className="text-xs font-semibold text-gray-700">
              Datum wählen
              <input
                type="date"
                name="date"
                defaultValue={selectedDateInput}
                className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Öffnen
            </button>
          </form>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/truck-dispatch/short-haul?date=${previousDay}`}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Vortag
            </Link>

            <Link
              href={`/truck-dispatch/short-haul?date=${today}`}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Heute
            </Link>

            <Link
              href={`/truck-dispatch/short-haul?date=${nextDay}`}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Folgetag
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Einteilungen"
          value={String(assignments.length)}
          hint="Fahrer/Fahrzeug"
        />

        <SummaryCard
          label="Touren"
          value={String(totalTours)}
          hint="geplante Fahrten"
        />

        <OpenQuantitiesSummaryCard
          asphaltOpen={`${formatTons(openAsphaltTons)} t`}
          asphaltHint={`${formatTons(allocatedAsphaltTons)} von ${formatTons(
            totalAsphaltTons
          )} t verteilt`}
          tackCoatOpen={`${formatLiters(openTackCoatLiters)} l`}
          tackCoatHint={`${formatLiters(
            allocatedTackCoatLiters
          )} von ${formatLiters(totalTackCoatLiters)} l eingeteilt`}
        />

        <SummaryCard
          label="Freie Fahrer"
          value={String(freeDrivers.length)}
          hint="ohne Tagesbelegung"
        />

        <SummaryCard
          label="Freie Fahrzeuge"
          value={String(freeVehicles.length)}
          hint="ohne Tagesbelegung"
        />
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Nicht verteilte Asphaltmengen
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Gesamt aus Asphaltdisposition:{" "}
            <strong>{formatTons(totalAsphaltTons)} t</strong> · verteilt:{" "}
            <strong>{formatTons(allocatedAsphaltTons)} t</strong> · offen:{" "}
            <strong>{formatTons(openAsphaltTons)} t</strong>
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {asphaltOpenPositions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Für diesen Tag sind keine Asphaltmengen in der Asphaltdisposition
              vorhanden.
            </div>
          ) : (
            asphaltOpenPositions.map((position) =>
              position.isFullyAllocated ? (
                <CompactAllocatedRow
                  key={position.asphaltDispatchEntryId}
                  title={`${position.projectNumber} · ${position.projectName}`}
                  detail={`${position.asphaltMixNumber ?? "-"} · ${
                    position.asphaltMixName ?? "-"
                  }`}
                  metrics={[
                    {
                      label: "Gesamt",
                      value: `${formatTons(position.totalTons)} t`,
                    },
                    {
                      label: "verteilt",
                      value: `${formatTons(position.allocatedTons)} t`,
                    },
                  ]}
                />
              ) : (
                <div
                  key={position.asphaltDispatchEntryId}
                  className="p-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {position.projectNumber} · {position.projectName}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {position.asphaltMixNumber ?? "-"} ·{" "}
                        {position.asphaltMixName ?? "-"}
                      </div>
                      <span className="mt-2 inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                        {formatTons(position.openTons)} t offen
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <QuantityMetric
                        label="Gesamt"
                        value={`${formatTons(position.totalTons)} t`}
                      />
                      <QuantityMetric
                        label="Verteilt"
                        value={`${formatTons(position.allocatedTons)} t`}
                      />
                      <QuantityMetric
                        label="Offen"
                        value={`${formatTons(position.openTons)} t`}
                      />
                    </div>

                    <DismissibleDetails className="group relative lg:self-start">
                      <AllocationDetailsSummary label="Zuteilen" />
                      <EditDetailsPanel align="right">
                        <AsphaltShortAllocationForm
                          workDate={selectedDateInput}
                          position={{
                            asphaltDispatchEntryId:
                              position.asphaltDispatchEntryId,
                            openTons: position.openTons,
                            isFullyAllocated: position.isFullyAllocated,
                          }}
                          drivers={drivers}
                          vehicles={vehicles}
                          driverConflicts={driverConflicts}
                          vehicleConflicts={vehicleConflicts}
                          shortDriverConflicts={shortDriverConflicts}
                          shortVehicleConflicts={shortVehicleConflicts}
                          shortDriverFreeFrom={shortDriverFreeFrom}
                          shortVehicleFreeFrom={shortVehicleFreeFrom}
                        />

                        <AsphaltShortSuggestionForm
                          workDate={selectedDateInput}
                          position={{
                            asphaltDispatchEntryId:
                              position.asphaltDispatchEntryId,
                            openTons: position.openTons,
                            isFullyAllocated: position.isFullyAllocated,
                          }}
                          drivers={drivers}
                          vehicles={vehicles}
                          driverConflicts={asphaltAllocationDriverConflicts}
                          vehicleConflicts={asphaltAllocationVehicleConflicts}
                        />
                      </EditDetailsPanel>
                    </DismissibleDetails>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Offene Anspritzmittelmengen
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Bedarf: <strong>{formatLiters(totalTackCoatLiters)} l</strong> ·
            Spritzwagen: <strong>{formatLiters(specialVehicleTackCoatLiters)} l</strong> ·
            Kurzstrecke: <strong>{formatLiters(shortHaulTackCoatLiters)} l</strong> ·
            offen: <strong>{formatLiters(openTackCoatLiters)} l</strong>
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {tackCoatOpenPositions.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Für diesen Tag sind keine Anspritzmittelmengen in der
              Asphaltdisposition vorhanden.
            </div>
          ) : (
            tackCoatOpenPositions.map((position) =>
              position.isFullyAllocated ? (
                <CompactAllocatedRow
                  key={position.key}
                  title={`${position.projectNumber} · ${position.projectName}`}
                  detail={`${position.materialName} · Einheit ${position.quantityUnit}`}
                  metrics={[
                    {
                      label: "Bedarf",
                      value: `${formatLiters(position.plannedLiters)} ${
                        position.quantityUnit
                      }`,
                    },
                    {
                      label: "Spritzwagen",
                      value: `${formatLiters(position.specialVehicleLiters)} ${
                        position.quantityUnit
                      }`,
                    },
                    {
                      label: "Kurzstrecke",
                      value: `${formatLiters(position.shortHaulLiters)} ${
                        position.quantityUnit
                      }`,
                    },
                  ]}
                />
              ) : (
                <div key={position.key} className="p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,430px)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {position.projectNumber} · {position.projectName}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {position.materialName} · Einheit {position.quantityUnit}
                      </div>
                      {position.crewNames.length > 0 ? (
                        <div className="mt-1 text-xs text-gray-500">
                          {position.crewNames.join(", ")}
                        </div>
                      ) : null}
                      <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                        {formatLiters(position.openLiters)}{" "}
                        {position.quantityUnit} offen
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <QuantityMetric
                        label="Bedarf"
                        value={`${formatLiters(position.plannedLiters)} ${
                          position.quantityUnit
                        }`}
                      />
                      <QuantityMetric
                        label="Spritzwagen"
                        value={`${formatLiters(position.specialVehicleLiters)} ${
                          position.quantityUnit
                        }`}
                      />
                      <QuantityMetric
                        label="Kurzstrecke"
                        value={`${formatLiters(position.shortHaulLiters)} ${
                          position.quantityUnit
                        }`}
                      />
                      <QuantityMetric
                        label="Offen"
                        value={`${formatLiters(position.openLiters)} ${
                          position.quantityUnit
                        }`}
                      />
                    </div>

                    <DismissibleDetails className="group relative lg:self-start">
                      <AllocationDetailsSummary label="Zuteilen" />
                      <EditDetailsPanel align="right">
                        <TackCoatShortAllocationForm
                          workDate={selectedDateInput}
                          position={{
                            projectId: position.projectId,
                            projectNumber: position.projectNumber,
                            materialName: position.materialName,
                            quantityUnit: position.quantityUnit,
                            openLiters: position.openLiters,
                            isFullyAllocated: position.isFullyAllocated,
                          }}
                          drivers={drivers}
                          vehicles={vehicles}
                          driverConflicts={driverConflicts}
                          vehicleConflicts={vehicleConflicts}
                          shortDriverConflicts={shortDriverConflicts}
                          shortVehicleConflicts={shortVehicleConflicts}
                          shortDriverFreeFrom={shortDriverFreeFrom}
                          shortVehicleFreeFrom={shortVehicleFreeFrom}
                        />
                      </EditDetailsPanel>
                    </DismissibleDetails>
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Verteilte Asphaltmengen Kurzstrecke
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Hier siehst du, welcher LKW wie viele Touren und Tonnen für Asphalt
            eingeteilt bekommen hat.
          </p>
        </div>

        <div className="overflow-visible">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: "54px" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "23%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th className="px-2 text-center">
                  <span className="sr-only">Aktion</span>
                </Th>
                <Th>LKW / Fahrer</Th>
                <Th>Baustelle</Th>
                <Th>Asphalt</Th>
                <Th>Zeit & Menge</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody>
              {shortAsphaltAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Noch keine Asphaltmengen auf Kurzstrecken-LKW verteilt.
                  </td>
                </tr>
              ) : (
                shortAsphaltAllocations.map((allocation) => {
                  const formId = `allocation-form-${allocation.id}`;

                  return (
                    <tr key={allocation.id} className="border-t border-gray-100">
                      <Td className="px-2 text-center">
                        <DismissibleDetails className="group relative">
                          <EditDetailsSummary />

                          <EditDetailsPanel>
                            <div className="rounded-xl border border-orange-200 bg-white p-3">
                              <div className="grid grid-cols-2 gap-2">
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Beginn
                                  <input
                                    form={formId}
                                    name="startTime"
                                    type="time"
                                    defaultValue={allocation.startTime}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Ende
                                  <input
                                    form={formId}
                                    name="endTime"
                                    type="time"
                                    defaultValue={allocation.endTime}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Touren
                                  <input
                                    form={formId}
                                    name="tourCount"
                                    type="number"
                                    min="1"
                                    defaultValue={allocation.tourCount}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  t / Tour
                                  <input
                                    form={formId}
                                    name="tonsPerTour"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={String(allocation.tonsPerTour)}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                              </div>

                              <label className="mt-2 block text-xs font-medium text-gray-700">
                                Bemerkung
                                <input
                                  form={formId}
                                  name="notes"
                                  defaultValue={allocation.notes ?? ""}
                                  className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                                />
                              </label>

                              <div className="mt-3 flex gap-2">
                                <form id={formId} action={updateAsphaltLoadAllocation}>
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={allocation.id}
                                  />
                                  <IconActionButton
                                    icon="save"
                                    title="Asphalt-Zuteilung speichern"
                                  />
                                </form>

                                <form action={deleteAsphaltLoadAllocation}>
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={allocation.id}
                                  />
                                  <IconActionButton
                                    icon="delete"
                                    title="Asphalt-Zuteilung löschen"
                                    danger
                                  />
                                </form>
                              </div>
                            </div>
                          </EditDetailsPanel>
                        </DismissibleDetails>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.vehicleLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.driverName ?? "-"}
                        </div>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.projectNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.projectName}
                        </div>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.asphaltMixNumber ?? "-"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.asphaltMixName ?? "Asphalt"}
                        </div>
                      </Td>

                      <Td>
                        <div className="text-sm font-semibold text-gray-900">
                          {allocation.startTime} – {allocation.endTime}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {allocation.tourCount} Tour
                          {allocation.tourCount === 1 ? "" : "en"} ·{" "}
                          {formatTons(allocation.tonsPerTour)} t/Tour ·{" "}
                          <strong>{formatTons(allocation.totalTons)} t gesamt</strong>
                        </div>
                      </Td>

                      <Td>
                        {allocation.notes ? (
                          <span>{allocation.notes}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Verteilte Anspritzmittel Kurzstrecke
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Hier siehst du, welcher LKW Restmengen oder Nachschub für
            Anspritzmittel liefert.
          </p>
        </div>

        <div className="overflow-visible">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: "54px" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "23%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th className="px-2 text-center">
                  <span className="sr-only">Aktion</span>
                </Th>
                <Th>LKW / Fahrer</Th>
                <Th>Baustelle</Th>
                <Th>Anspritzmittel</Th>
                <Th>Zeit & Menge</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody>
              {shortTackCoatAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Noch keine Anspritzmittelmengen auf Kurzstrecken-LKW verteilt.
                  </td>
                </tr>
              ) : (
                shortTackCoatAllocations.map((allocation) => {
                  const formId = `tack-coat-allocation-form-${allocation.id}`;

                  return (
                    <tr key={allocation.id} className="border-t border-gray-100">
                      <Td className="px-2 text-center">
                        <DismissibleDetails className="group relative">
                          <EditDetailsSummary />

                          <EditDetailsPanel>
                            <div className="rounded-xl border border-blue-200 bg-white p-3">
                              <div className="grid grid-cols-2 gap-2">
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Beginn
                                  <input
                                    form={formId}
                                    name="startTime"
                                    type="time"
                                    defaultValue={allocation.startTime}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Ende
                                  <input
                                    form={formId}
                                    name="endTime"
                                    type="time"
                                    defaultValue={allocation.endTime}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  Touren
                                  <input
                                    form={formId}
                                    name="tourCount"
                                    type="number"
                                    min="1"
                                    defaultValue={allocation.tourCount}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                                <label className="min-w-0 text-xs font-medium text-gray-700">
                                  l / Tour
                                  <input
                                    form={formId}
                                    name="litersPerTour"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={String(allocation.litersPerTour)}
                                    className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                                  />
                                </label>
                              </div>

                              <label className="mt-2 block text-xs font-medium text-gray-700">
                                Bemerkung
                                <input
                                  form={formId}
                                  name="notes"
                                  defaultValue={allocation.notes ?? ""}
                                  className="mt-1 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                                />
                              </label>

                              <div className="mt-3 flex gap-2">
                                <form id={formId} action={updateTackCoatLoadAllocation}>
                                  <input type="hidden" name="id" value={allocation.id} />
                                  <IconActionButton
                                    icon="save"
                                    title="Anspritzmittel-Zuteilung speichern"
                                  />
                                </form>

                                <form action={deleteTackCoatLoadAllocation}>
                                  <input type="hidden" name="id" value={allocation.id} />
                                  <IconActionButton
                                    icon="delete"
                                    title="Anspritzmittel-Zuteilung löschen"
                                    danger
                                  />
                                </form>
                              </div>
                            </div>
                          </EditDetailsPanel>
                        </DismissibleDetails>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.vehicleLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.driverName ?? "-"}
                        </div>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.projectNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.projectName}
                        </div>
                      </Td>

                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.materialName}
                        </div>
                        <div className="text-xs text-gray-500">
                          Einheit: {allocation.quantityUnit}
                        </div>
                      </Td>

                      <Td>
                        <div className="text-sm font-semibold text-gray-900">
                          {allocation.startTime} – {allocation.endTime}
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          {allocation.tourCount} Tour
                          {allocation.tourCount === 1 ? "" : "en"} ·{" "}
                          {formatLiters(allocation.litersPerTour)}{" "}
                          {allocation.quantityUnit}/Tour ·{" "}
                          <strong>
                            {formatLiters(allocation.totalLiters)}{" "}
                            {allocation.quantityUnit} gesamt
                          </strong>
                        </div>
                      </Td>

                      <Td>
                        {allocation.notes ? (
                          <span>{allocation.notes}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div
        id="fahrer-fahrzeug-einteilen"
        className="mb-6 scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Fahrer/Fahrzeug einteilen
        </h2>

        <ShortHaulForm
          action={createShortHaulAssignment}
          workDate={selectedDateInput}
          projects={projects}
          vehicles={vehicles}
          drivers={drivers}
          materialTransportOptions={materialTransportOptions}
          machineTransportOptions={machineTransportOptions}
          unitOptions={unitOptions}
          driverConflicts={driverConflicts}
          vehicleConflicts={vehicleConflicts}
          shortDriverConflicts={shortDriverConflicts}
          shortVehicleConflicts={shortVehicleConflicts}
        />
      </div>

      <UtilizationTimeline
        rows={utilizationRows}
        selectedDate={selectedDateInput}
      />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AvailabilityList
          title="Freie Fahrer"
          emptyText="Keine freien Fahrer verfügbar."
          items={freeDrivers.map((driver) => ({
            id: driver.id,
            title: `${driver.lastName}, ${driver.firstName}`,
            description:
              driver.vehicleAssignments[0]?.vehicle != null
                ? `Hauptfahrzeug: ${getVehicleLabel(
                    driver.vehicleAssignments[0].vehicle
                  )}`
                : "kein Hauptfahrzeug",
          }))}
        />

        <AvailabilityList
          title="Freie Fahrzeuge"
          emptyText="Keine freien Fahrzeuge verfügbar."
          items={freeVehicles.map((vehicle) => ({
            id: vehicle.id,
            title: `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"}`,
            description: `${vehicle.category} · ${vehicle.vehicleType}`,
          }))}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Tagesaushang Kurzstrecke
          </h2>
        </div>

        <div className="overflow-visible">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: "54px" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "20%" }} />
              <col />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th className="px-2 text-center">
                  <span className="sr-only">Aktion</span>
                </Th>
                <Th>Fahrer</Th>
                <Th>Fahrzeug</Th>
                <Th>Touren</Th>
                <Th>Hinweis</Th>
              </tr>
            </thead>

            <tbody>
              {dailyScheduleGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Noch keine Kurzstrecken-Einteilung, Asphalt-Zuteilung oder Anspritzmittel-Nachlieferung für diesen Tag vorhanden.
                  </td>
                </tr>
              ) : (
                <>
                  {dailyScheduleGroups.map((group) => {
                    const assignmentSourceRow = group.sourceRows.find(
                      (
                        row
                      ): row is Extract<
                        DailyScheduleRow,
                        { kind: "assignment" }
                      > => row.kind === "assignment"
                    );
                    const conflictNotes = group.sourceRows.flatMap((row) =>
                      row.kind === "assignment" && row.assignment.conflictNote
                        ? [row.assignment.conflictNote]
                        : []
                    );
                    const hasShortTours = group.items.some(
                      (item) => item.kind === "shortTour"
                    );
                    const hasAsphalt = group.items.some(
                      (item) => item.kind === "asphalt"
                    );
                    const hasTackCoat = group.items.some(
                      (item) => item.kind === "tackCoat"
                    );
                    const defaultOpen = group.sourceRows.some(
                      (row) =>
                        row.kind === "assignment" &&
                        row.assignment.id === timelineEditAssignmentId
                    );
                    const editRows = [...group.sourceRows].sort(
                      (first, second) => {
                        const startDiff = first.sortStart - second.sortStart;

                        if (startDiff !== 0) {
                          return startDiff;
                        }

                        const endDiff = first.sortEnd - second.sortEnd;

                        if (endDiff !== 0) {
                          return endDiff;
                        }

                        return `${first.kind}-${first.id}`.localeCompare(
                          `${second.kind}-${second.id}`
                        );
                      }
                    );

                    return (
                      <tr
                        key={group.id}
                        id={
                          assignmentSourceRow
                            ? `assignment-${assignmentSourceRow.id}`
                            : group.id
                        }
                        className="scroll-mt-6 border-t border-gray-100"
                      >
                        <Td className="px-2 text-center">
                          <DismissibleDetails
                            className="group relative"
                            defaultOpen={defaultOpen}
                          >
                            <EditDetailsSummary />

                            <EditDetailsPanel>
                              <div className="space-y-4">
                                {editRows.map(renderDailyEditSection)}
                              </div>
                            </EditDetailsPanel>
                          </DismissibleDetails>
                        </Td>

                        <Td>
                          <div className="font-semibold text-gray-900">
                            {group.driverName}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {hasShortTours ? (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                                Kurzstrecke
                              </span>
                            ) : null}
                            {hasAsphalt ? (
                              <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-900">
                                Asphalt
                              </span>
                            ) : null}
                            {hasTackCoat ? (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-900">
                                Anspritzmittel
                              </span>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          <div className="space-y-1">
                            {group.vehicleLabels.length > 0 ? (
                              group.vehicleLabels.map((label) => (
                                <div
                                  key={`${group.id}-${label}`}
                                  className="font-semibold text-gray-900"
                                >
                                  {label}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </Td>

                        <Td>
                          <div className="space-y-2">
                            {group.items.length > 0 ? (
                              group.items.map(renderDailyScheduleItem)
                            ) : (
                              <span className="text-gray-400">Keine Touren</span>
                            )}
                          </div>
                        </Td>

                        <Td>
                          {conflictNotes.length > 0 ? (
                            <div className="space-y-2">
                              {conflictNotes.map((note) => (
                                <div
                                  key={note}
                                  className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900"
                                >
                                  {note}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function OpenQuantitiesSummaryCard({
  asphaltOpen,
  asphaltHint,
  tackCoatOpen,
  tackCoatHint,
}: {
  asphaltOpen: string;
  asphaltHint: string;
  tackCoatOpen: string;
  tackCoatHint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">Offene Mengen</p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-gray-700">Asphalt</span>
            <span className="text-2xl font-bold text-gray-900">
              {asphaltOpen}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{asphaltHint}</p>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-gray-700">
              Anspritzmittel
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {tackCoatOpen}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{tackCoatHint}</p>
        </div>
      </div>
    </div>
  );
}

function QuantityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}

function CompactAllocatedRow({
  title,
  detail,
  metrics,
}: {
  title: string;
  detail: string;
  metrics: { label: string; value: string }[];
}) {
  return (
    <div className="bg-green-50/50 p-3 text-sm text-gray-700">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-gray-900">{title}</span>
        <span>{detail}</span>
        {metrics.map((metric) => (
          <span key={metric.label}>
            {metric.label}: <strong>{metric.value}</strong>
          </span>
        ))}
        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
          vollständig verteilt
        </span>
      </div>
    </div>
  );
}

function EditDetailsSummary() {
  return (
    <summary
      aria-label="Bearbeiten"
      title="Bearbeiten"
      className="mx-auto inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-white">
        <ActionIcon name="edit" className="h-4 w-4" />
      </span>
    </summary>
  );
}

function AllocationDetailsSummary({ label }: { label: string }) {
  return (
    <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700">
      {label}
    </summary>
  );
}

function EditDetailsPanel({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  const alignmentClass = align === "right" ? "right-0" : "left-0";

  return (
    <div
      className={`absolute top-full z-30 mt-2 hidden w-[min(calc(100vw-2rem),760px)] ${alignmentClass} rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-xl group-open:block`}
    >
      {children}
    </div>
  );
}

function IconActionButton({
  icon,
  title,
  danger = false,
}: {
  icon: ActionIconName;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      className={
        danger
          ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
          : "inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
      }
    >
      <ActionIcon name={icon} className="h-4 w-4" />
    </button>
  );
}

function AvailabilityList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: {
    id: string;
    title: string;
    description: string;
  }[];
}) {
  return (
    <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs font-medium text-gray-500">
            {items.length} verfügbar · bei Bedarf aufklappen
          </p>
        </div>

        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 group-open:hidden">
          Anzeigen
        </span>
        <span className="hidden rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 group-open:inline-flex">
          Einklappen
        </span>
      </summary>

      <div className="border-t border-gray-100 px-6 py-5">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyText}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-3"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {item.title}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function Th({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={`whitespace-normal break-words p-3 font-semibold ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`break-words p-3 align-top text-gray-700 ${className}`}>
      {children}
    </td>
  );
}
