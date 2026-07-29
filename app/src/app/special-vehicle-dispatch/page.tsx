import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import {
  getVehicleInventoryItem,
  getVehicleInventoryLabel,
  getVehicleInventoryResponsibleLabel,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import { activeDispositionDaysOff, dateKey } from "@/lib/disposition-days-off";
import {
  formatLiters,
  getTackCoatOpenPositionsForRange,
} from "@/lib/tack-coat-loads";
import {
  createSpecialVehicleDispatchTourAssignments,
  deleteSpecialVehicleDispatchAssignment,
  updateSpecialVehicleDispatchAssignment,
} from "./actions";
import { DismissibleDetails } from "../crew-dispatch/DismissibleDetails";
import { CrewTimelineScrollButtons } from "../crew-dispatch/CrewTimelineScrollButtons";
import { SpecialVehicleDispatchStickyOffset } from "./SpecialVehicleDispatchStickyOffset";
import { SpecialVehicleTimelineScroll } from "./SpecialVehicleTimelineScroll";
import { SpecialVehicleTourFormClient } from "./SpecialVehicleTourFormClient";

type TimelineView = "days" | "weeks" | "months";

type TimelineUnit = {
  key: string;
  label: string;
  subLabel: string;
  startDate: Date;
  endDateExclusive: Date;
  defaultStartDate: string;
  defaultEndDate: string;
};

type SpecialVehicleFilters = {
  q: string;
  projectId: string;
  vehicleNumber: string;
  licensePlate: string;
  vehicleType: string;
  category: string;
};

type AssignmentForPage = {
  id: string;
  workDate: Date;
  startTime: string;
  endTime: string;
  vehicleId: string | null;
  vehicleName: string;
  transportVehicleId: string | null;
  transportVehicleName: string | null;
  operatorDriverId: string | null;
  operatorDriverName: string | null;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  crewId: string | null;
  crewName: string | null;
  taskText: string;
  materialName: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  notes: string | null;
};

type TackCoatNeedForForm = {
  key: string;
  workDate: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  materialName: string;
  quantity: number;
  quantityUnit: string;
  plannedQuantity: number;
  specialVehicleQuantity: number;
  shortHaulQuantity: number;
  openQuantity: number;
  crewName: string;
};

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const LEFT_COLUMN_WIDTH_PX = 340;
const SPECIAL_VEHICLE_ROW_MIN_HEIGHT_PX = 108;
const SPECIAL_VEHICLE_LEFT_ROW_MIN_HEIGHT_PX = 132;

function parseDateParam(value: string | undefined) {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function startOfWeek(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthInclusive(date: Date) {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatQuantity(value: number | null, unit: string | null) {
  if (value === null || value === undefined) return null;

  const formatted = value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return unit ? `${formatted} ${unit}` : formatted;
}

function getCalendarWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getTimelineView(value: string | undefined): TimelineView {
  if (value === "weeks" || value === "months" || value === "days") return value;
  return "days";
}

function normalizeDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDateDiffInDays(startDate: Date, endDate: Date) {
  const start = normalizeDay(startDate).getTime();
  const end = normalizeDay(endDate).getTime();
  return Math.round((end - start) / 86400000);
}

function getSafeDateRange({
  from,
  to,
  view,
}: {
  from?: string;
  to?: string;
  view: TimelineView;
}) {
  const today = parseDateParam(formatDateInput(new Date()));
  const fallbackStart = view === "months" ? startOfMonth(today) : startOfWeek(today);
  const fallbackEnd =
    view === "months" ? endOfMonthInclusive(addMonths(fallbackStart, 4)) : addDays(fallbackStart, 13);

  const fromDate = from ? parseDateParam(from) : fallbackStart;
  const toDate = to ? parseDateParam(to) : fallbackEnd;

  if (toDate < fromDate) {
    return { fromDate: toDate, toDate: fromDate };
  }

  return { fromDate, toDate };
}

function buildTimelineUnitsFromDateRange({
  view,
  fromDate,
  toDate,
  showWeekend,
}: {
  view: TimelineView;
  fromDate: Date;
  toDate: Date;
  showWeekend: boolean;
}) {
  if (view === "months") {
    const start = startOfMonth(fromDate);
    const end = startOfMonth(toDate);
    const units: TimelineUnit[] = [];
    let current = start;

    while (current <= end) {
      const startDate = current;
      const endDateExclusive = addMonths(current, 1);
      const endDateInclusive = endOfMonthInclusive(startDate);

      units.push({
        key: formatDateInput(startDate),
        label: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(startDate),
        subLabel: String(startDate.getUTCFullYear()),
        startDate,
        endDateExclusive,
        defaultStartDate: formatDateInput(startDate),
        defaultEndDate: formatDateInput(endDateInclusive),
      });

      current = addMonths(current, 1);
    }

    return units;
  }

  if (view === "weeks") {
    const start = startOfWeek(fromDate);
    const end = startOfWeek(toDate);
    const units: TimelineUnit[] = [];
    let current = start;

    while (current <= end) {
      const startDate = current;
      const endDateExclusive = addDays(current, 7);
      const visibleEnd = addDays(current, showWeekend ? 6 : 4);

      units.push({
        key: formatDateInput(startDate),
        label: `KW ${getCalendarWeek(startDate)}`,
        subLabel: `${formatShortDate(startDate)} – ${formatShortDate(visibleEnd)}`,
        startDate,
        endDateExclusive,
        defaultStartDate: formatDateInput(startDate),
        defaultEndDate: formatDateInput(visibleEnd),
      });

      current = addDays(current, 7);
    }

    return units;
  }

  const units: TimelineUnit[] = [];
  let current = fromDate;

  while (current <= toDate) {
    if (showWeekend || ![0, 6].includes(current.getUTCDay())) {
      const dateInput = formatDateInput(current);
      units.push({
        key: dateInput,
        label: dayNames[current.getUTCDay()],
        subLabel: formatShortDate(current),
        startDate: current,
        endDateExclusive: addDays(current, 1),
        defaultStartDate: dateInput,
        defaultEndDate: dateInput,
      });
    }

    current = addDays(current, 1);
  }

  return units;
}

function getTimelineGridColumns(view: TimelineView, unitCount: number) {
  if (view === "months") return `repeat(${unitCount}, minmax(170px, 1fr))`;
  if (view === "weeks") return `repeat(${unitCount}, minmax(145px, 1fr))`;
  if (unitCount <= 10) return `repeat(${unitCount}, minmax(110px, 1fr))`;
  return `repeat(${unitCount}, minmax(96px, 1fr))`;
}

function getTimelineMinWidth(view: TimelineView, unitCount: number) {
  if (unitCount <= 10) return 0;
  if (view === "months") return unitCount * 170;
  if (view === "weeks") return unitCount * 145;
  return unitCount * 96;
}

function shiftDateRange({
  fromDate,
  toDate,
  view,
  direction,
}: {
  fromDate: Date;
  toDate: Date;
  view: TimelineView;
  direction: -1 | 1;
}) {
  if (view === "months") {
    const monthDiff =
      (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 +
      (toDate.getUTCMonth() - fromDate.getUTCMonth()) +
      1;

    const nextFrom = addMonths(startOfMonth(fromDate), monthDiff * direction);
    const nextTo = endOfMonthInclusive(addMonths(nextFrom, monthDiff - 1));

    return { fromDate: nextFrom, toDate: nextTo };
  }

  const dayDiff = getDateDiffInDays(fromDate, toDate) + 1;
  const nextFrom = addDays(fromDate, dayDiff * direction);
  const nextTo = addDays(toDate, dayDiff * direction);

  return { fromDate: nextFrom, toDate: nextTo };
}

function buildSpecialVehicleDispatchHref({
  fromDate,
  toDate,
  view,
  showWeekend,
  filters,
  focusDate,
  newVehicleId,
  newDate,
}: {
  fromDate: Date;
  toDate: Date;
  view: TimelineView;
  showWeekend: boolean;
  filters?: SpecialVehicleFilters;
  focusDate?: Date | string;
  newVehicleId?: string | null;
  newDate?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("from", formatDateInput(fromDate));
  params.set("to", formatDateInput(toDate));
  params.set("view", view);

  if (showWeekend) params.set("showWeekend", "1");
  if (filters?.q) params.set("q", filters.q);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.vehicleNumber) params.set("vehicleNumber", filters.vehicleNumber);
  if (filters?.licensePlate) params.set("licensePlate", filters.licensePlate);
  if (filters?.vehicleType) params.set("vehicleType", filters.vehicleType);
  if (filters?.category) params.set("category", filters.category);

  if (focusDate) {
    params.set("focus", typeof focusDate === "string" ? focusDate : formatDateInput(focusDate));
  }

  if (newVehicleId) params.set("newVehicleId", newVehicleId);
  if (newDate) params.set("newDate", newDate);

  return `/special-vehicle-dispatch?${params.toString()}`;
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.category, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function normalizePersonName(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getDefaultOperatorDriverForResponsibleEmployee(
  responsibleEmployee:
    | {
        firstName: string;
        lastName: string;
      }
    | null
    | undefined,
  drivers: {
    id: string;
    firstName: string;
    lastName: string;
  }[],
) {
  if (!responsibleEmployee) return null;

  const responsibleFirstName = normalizePersonName(responsibleEmployee.firstName);
  const responsibleLastName = normalizePersonName(responsibleEmployee.lastName);

  if (!responsibleFirstName || !responsibleLastName) return null;

  const driver = drivers.find(
    (candidate) =>
      normalizePersonName(candidate.firstName) === responsibleFirstName &&
      normalizePersonName(candidate.lastName) === responsibleLastName,
  );

  if (!driver) return null;

  return {
    id: driver.id,
    name: `${driver.lastName}, ${driver.firstName}`,
  };
}

function getSpecialVehicleListRowMinHeight(vehicle: VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);
  let minHeight = SPECIAL_VEHICLE_LEFT_ROW_MIN_HEIGHT_PX;

  if (inventoryItem) {
    minHeight += 34;

    if (inventoryItem.currentLocationLabel) {
      minHeight += 18;
    }

    if (inventoryItem.currentProject) {
      minHeight += 18;
    }

    if (getVehicleInventoryResponsibleLabel(inventoryItem)) {
      minHeight += 18;
    }

    if (inventoryItem.status !== "ACTIVE") {
      minHeight += 18;
    }
  }

  return minHeight;
}

function getSpecialVehicleTitle(vehicle: {
  vehicleNumber: string;
} & VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  return inventoryItem?.objectNumber ?? inventoryItem?.inventoryNumber ?? vehicle.vehicleNumber;
}

function getSpecialVehicleSubtitle(vehicle: {
  category: string;
  licensePlate: string | null;
  vehicleType: string;
} & VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  if (!inventoryItem) {
    return [vehicle.licensePlate, vehicle.category, vehicle.vehicleType]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    inventoryItem.manufacturer,
    inventoryItem.model,
    inventoryItem.name,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getVehicleSearchText(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  notes: string | null;
} & VehicleWithInventoryLink) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    vehicle.notes,
    getVehicleInventoryLabel(vehicle),
    getVehicleInventoryItem(vehicle)?.status,
    getVehicleInventoryItem(vehicle)?.currentLocationLabel,
    getVehicleInventoryResponsibleLabel(getVehicleInventoryItem(vehicle)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isTackCoatSpecialVehicle(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  notes: string | null;
  tackCoatTankLiters: number;
}) {
  if (vehicle.tackCoatTankLiters > 0) return true;

  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    vehicle.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes("anspritz");
}

function getTackCoatNeedsForTimelineUnit({
  needs,
  unit,
}: {
  needs: TackCoatNeedForForm[];
  unit: TimelineUnit;
}) {
  const startDate = formatDateInput(unit.startDate);
  const endDate = formatDateInput(unit.endDateExclusive);

  return needs.filter(
    (need) =>
      need.plannedQuantity > 0 &&
      need.workDate >= startDate &&
      need.workDate < endDate,
  );
}

function getTackCoatMarkerText(needs: TackCoatNeedForForm[]) {
  const openLiters = needs.reduce((sum, need) => sum + need.openQuantity, 0);

  if (openLiters > 0) {
    return `Anspritz offen ${formatLiters(openLiters)} l`;
  }

  return "Anspritz vollständig";
}

function getTackCoatMarkerTitle(needs: TackCoatNeedForForm[]) {
  return needs
    .map((need) =>
      [
        formatGermanDate(parseDateParam(need.workDate)),
        `${need.projectNumber} · ${need.projectName}`,
        `${formatLiters(need.openQuantity)} ${need.quantityUnit} offen`,
        need.materialName,
      ].join(" · "),
    )
    .join("\n");
}

function assignmentMatchesQuery(assignment: AssignmentForPage, query: string) {
  if (!query) return true;

  const haystack = [
    assignment.vehicleName,
    assignment.transportVehicleName,
    assignment.operatorDriverName,
    assignment.projectNumber,
    assignment.projectName,
    assignment.crewName,
    assignment.taskText,
    assignment.materialName,
    assignment.quantityUnit,
    assignment.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function getAssignmentsForVehicleAndDate({
  assignments,
  vehicleId,
  dateInput,
}: {
  assignments: AssignmentForPage[];
  vehicleId: string;
  dateInput: string;
}) {
  return assignments
    .filter(
      (assignment) =>
        assignment.vehicleId === vehicleId && formatDateInput(assignment.workDate) === dateInput,
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function getAssignmentSummary(assignment: AssignmentForPage) {
  const quantityLabel = formatQuantity(assignment.quantity, assignment.quantityUnit);

  return [
    `${assignment.startTime}–${assignment.endTime}`,
    assignment.projectNumber,
    assignment.taskText,
    quantityLabel && assignment.materialName
      ? `${quantityLabel} ${assignment.materialName}`
      : (quantityLabel ?? assignment.materialName),
  ]
    .filter(Boolean)
    .join(" · ");
}

function getActiveFilterCount(filters: SpecialVehicleFilters) {
  return Object.values(filters).filter(Boolean).length;
}

export default async function SpecialVehicleDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    focus?: string;
    showWeekend?: string;
    view?: string;
    q?: string;
    projectId?: string;
    vehicleNumber?: string;
    licensePlate?: string;
    vehicleType?: string;
    category?: string;
    newVehicleId?: string;
    newDate?: string;
  }>;
}) {
  const params = await searchParams;
  const view = getTimelineView(params.view);
  const showWeekend = params.showWeekend === "1";
  const filters: SpecialVehicleFilters = {
    q: String(params.q ?? "").trim(),
    projectId: String(params.projectId ?? "").trim(),
    vehicleNumber: String(params.vehicleNumber ?? "").trim(),
    licensePlate: String(params.licensePlate ?? "").trim(),
    vehicleType: String(params.vehicleType ?? "").trim(),
    category: String(params.category ?? "").trim(),
  };

  const { fromDate, toDate } = getSafeDateRange({
    from: params.from,
    to: params.to,
    view,
  });

  const focusDate = params.focus ? parseDateParam(params.focus) : fromDate;

  const timelineUnits = buildTimelineUnitsFromDateRange({
    view,
    fromDate,
    toDate,
    showWeekend,
  });

  const unitCount = timelineUnits.length;
  const periodStart = timelineUnits[0]?.startDate ?? fromDate;
  const periodEndExclusive =
    timelineUnits[timelineUnits.length - 1]?.endDateExclusive ?? addDays(toDate, 1);
  const daysOffByDate = new Map(
    (await activeDispositionDaysOff(periodStart, addDays(periodEndExclusive, -1))).map(
      (item) => [dateKey(item.date), item],
    ),
  );
  const gridColumns = getTimelineGridColumns(view, unitCount);
  const timelineMinWidth = getTimelineMinWidth(view, unitCount);
  const timelineContentMinWidth = timelineMinWidth || undefined;

  const previousRange = shiftDateRange({
    fromDate,
    toDate,
    view,
    direction: -1,
  });

  const nextRange = shiftDateRange({
    fromDate,
    toDate,
    view,
    direction: 1,
  });

  const today = parseDateParam(formatDateInput(new Date()));
  const todayStart = view === "months" ? startOfMonth(today) : startOfWeek(today);
  const todayEnd = view === "months" ? endOfMonthInclusive(addMonths(todayStart, 4)) : addDays(todayStart, 13);

  const [
    inventoryVehicleItems,
    transportInventoryVehicleItems,
    drivers,
    projects,
    crews,
    assignments,
    tackCoatOpenPositions,
    tackCoatMaterials,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        status: {
          notIn: ["DELETED", "INACTIVE"],
        },
        vehicleId: {
          not: null,
        },
        category: {
          OR: [
            {
              useInSpecialVehicleDisposition: true,
            },
            {
              parentCategory: {
                useInSpecialVehicleDisposition: true,
              },
            },
          ],
        },
      },
      include: {
        category: {
          select: {
            dailyReportMachineLabel: true,
            name: true,
            parentCategory: {
              select: {
                name: true,
                useInSpecialVehicleDisposition: true,
                useInTruckDispatchSelection: true,
              },
            },
            useInSpecialVehicleDisposition: true,
            useInTruckDispatchSelection: true,
          },
        },
        currentProject: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        responsibleCrew: {
          select: {
            id: true,
            name: true,
          },
        },
        responsibleEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vehicle: true,
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { objectNumber: "asc" },
        { name: "asc" },
      ],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          notIn: ["DELETED", "INACTIVE"],
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
      include: {
        category: {
          select: {
            dailyReportMachineLabel: true,
            name: true,
            parentCategory: {
              select: {
                name: true,
                useInSpecialVehicleDisposition: true,
                useInTruckDispatchSelection: true,
              },
            },
            useInSpecialVehicleDisposition: true,
            useInTruckDispatchSelection: true,
          },
        },
        currentProject: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
        responsibleCrew: {
          select: {
            id: true,
            name: true,
          },
        },
        responsibleEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        vehicle: true,
      },
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.project.findMany({
      where: {
        status: {
          in: [ProjectStatus.NOT_STARTED, ProjectStatus.ACTIVE, ProjectStatus.PAUSED],
        },
      },
      orderBy: [{ projectNumber: "asc" }],
    }),

    prisma.crew.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.specialVehicleDispatchAssignment.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }, { vehicleName: "asc" }],
    }),

    getTackCoatOpenPositionsForRange({
      gte: periodStart,
      lt: periodEndExclusive,
    }),

    prisma.materialType.findMany({
      where: {
        isActive: true,
        category: "Anspritzmittel",
      },
      orderBy: [{ materialNumber: "asc" }, { name: "asc" }],
    }),
  ]);

  const vehicles = inventoryVehicleItems.flatMap((item) => {
    if (!item.vehicle) {
      return [];
    }

    const categoryName = item.category?.name ?? item.vehicle.category;
    const parentCategoryName = item.category?.parentCategory?.name;
    const categoryLabel = parentCategoryName
      ? `${parentCategoryName} / ${categoryName}`
      : categoryName;
    const defaultOperatorDriver = getDefaultOperatorDriverForResponsibleEmployee(
      item.responsibleEmployee,
      drivers,
    );

    return [
      {
        ...item.vehicle,
        category: categoryLabel,
        defaultOperatorDriverId: defaultOperatorDriver?.id ?? null,
        defaultOperatorDriverName: defaultOperatorDriver?.name ?? null,
        inventoryItemId: item.id,
        licensePlate: item.licensePlate ?? item.vehicle.licensePlate,
        tackCoatTankLiters:
          item.workMaterialTankLiters ?? item.vehicle.tackCoatTankLiters,
        vehicleNumber: item.objectNumber ?? item.vehicle.vehicleNumber,
        inventoryItems: [item],
      },
    ];
  });

  const transportVehicles = transportInventoryVehicleItems.flatMap((item) => {
    if (!item.vehicle) {
      return [];
    }

    const categoryName = item.category?.name ?? item.vehicle.category;
    const parentCategoryName = item.category?.parentCategory?.name;
    const categoryLabel = parentCategoryName
      ? `${parentCategoryName} / ${categoryName}`
      : categoryName;
    const defaultOperatorDriver = getDefaultOperatorDriverForResponsibleEmployee(
      item.responsibleEmployee,
      drivers,
    );

    return [
      {
        ...item.vehicle,
        category: categoryLabel,
        defaultOperatorDriverId: defaultOperatorDriver?.id ?? null,
        defaultOperatorDriverName: defaultOperatorDriver?.name ?? null,
        inventoryItemId: item.id,
        licensePlate: item.licensePlate ?? item.vehicle.licensePlate,
        tackCoatTankLiters:
          item.workMaterialTankLiters ?? item.vehicle.tackCoatTankLiters,
        vehicleNumber: item.objectNumber ?? item.vehicle.vehicleNumber,
        inventoryItems: [item],
      },
    ];
  });

  const assignmentsForPage: AssignmentForPage[] = assignments.map((assignment) => ({
    id: assignment.id,
    workDate: assignment.workDate,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    vehicleId: assignment.vehicleId,
    vehicleName: assignment.vehicleName,
    transportVehicleId: assignment.transportVehicleId,
    transportVehicleName: assignment.transportVehicleName,
    operatorDriverId: assignment.operatorDriverId,
    operatorDriverName: assignment.operatorDriverName,
    projectId: assignment.projectId,
    projectNumber: assignment.projectNumber,
    projectName: assignment.projectName,
    crewId: assignment.crewId,
    crewName: assignment.crewName,
    taskText: assignment.taskText,
    materialName: assignment.materialName,
    quantity: assignment.quantity,
    quantityUnit: assignment.quantityUnit,
    notes: assignment.notes,
  }));

  const tackCoatNeedsForForm: TackCoatNeedForForm[] = tackCoatOpenPositions.map((position) => ({
    key: position.key,
    workDate: formatDateInput(position.workDate),
    projectId: position.projectId,
    projectNumber: position.projectNumber,
    projectName: position.projectName,
    materialName: position.materialName,
    quantity: position.plannedLiters,
    quantityUnit: position.quantityUnit,
    plannedQuantity: position.plannedLiters,
    specialVehicleQuantity: position.specialVehicleLiters,
    shortHaulQuantity: position.shortHaulLiters,
    openQuantity: position.openLiters,
    crewName: position.crewNames.join(", "),
  }));
  const tackCoatMaterialsForForm = [
    ...tackCoatMaterials,
    ...tackCoatNeedsForForm
      .filter(
        (need) =>
          need.materialName &&
          !tackCoatMaterials.some(
            (material) =>
              material.name.trim().toLowerCase() ===
              need.materialName.trim().toLowerCase(),
          ),
      )
      .map((need) => ({
        id: `need-${need.key}`,
        materialNumber: null,
        name: need.materialName,
        unit: need.quantityUnit,
      })),
  ];

  const q = filters.q.toLowerCase();

  const filteredVehicles = vehicles.filter((vehicle) => {
    if (filters.q && !getVehicleSearchText(vehicle).includes(q)) {
      const hasMatchingAssignment = assignmentsForPage.some(
        (assignment) =>
          assignment.vehicleId === vehicle.id && assignmentMatchesQuery(assignment, filters.q),
      );

      if (!hasMatchingAssignment) return false;
    }

    if (filters.vehicleNumber && vehicle.vehicleNumber !== filters.vehicleNumber) return false;
    if (filters.licensePlate && vehicle.licensePlate !== filters.licensePlate) return false;
    if (filters.vehicleType && vehicle.vehicleType !== filters.vehicleType) return false;
    if (filters.category && vehicle.category !== filters.category) return false;

    if (filters.projectId) {
      const hasProjectAssignment = assignmentsForPage.some(
        (assignment) => assignment.vehicleId === vehicle.id && assignment.projectId === filters.projectId,
      );

      if (!hasProjectAssignment) return false;
    }

    return true;
  });

  const visibleVehicleIds = new Set(filteredVehicles.map((vehicle) => vehicle.id));
  const visibleAssignments = assignmentsForPage.filter(
    (assignment) => assignment.vehicleId && visibleVehicleIds.has(assignment.vehicleId),
  );

  const openTackCoatLiters = tackCoatNeedsForForm.reduce(
    (sum, need) => sum + need.openQuantity,
    0,
  );

  const vehicleNumberOptions = Array.from(new Set(vehicles.map((vehicle) => vehicle.vehicleNumber))).sort((a, b) => a.localeCompare(b, "de-DE"));
  const licensePlateOptions = Array.from(new Set(vehicles.map((vehicle) => vehicle.licensePlate).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "de-DE"));
  const vehicleTypeOptions = Array.from(new Set(vehicles.map((vehicle) => vehicle.vehicleType))).sort((a, b) => a.localeCompare(b, "de-DE"));
  const categoryOptions = Array.from(new Set(vehicles.map((vehicle) => vehicle.category))).sort((a, b) => a.localeCompare(b, "de-DE"));

  const previousHref = buildSpecialVehicleDispatchHref({
    fromDate: previousRange.fromDate,
    toDate: previousRange.toDate,
    view,
    showWeekend,
    filters,
    focusDate: previousRange.fromDate,
  });

  const nextHref = buildSpecialVehicleDispatchHref({
    fromDate: nextRange.fromDate,
    toDate: nextRange.toDate,
    view,
    showWeekend,
    filters,
    focusDate: nextRange.fromDate,
  });

  const todayHref = buildSpecialVehicleDispatchHref({
    fromDate: todayStart,
    toDate: todayEnd,
    view,
    showWeekend,
    filters,
    focusDate: todayStart,
  });
  const closeCreateHref = buildSpecialVehicleDispatchHref({
    fromDate,
    toDate,
    view,
    showWeekend,
    filters,
    focusDate,
  });
  const timelineRangePresets = [
    {
      label: "1W",
      fromDate,
      toDate: addDays(fromDate, showWeekend ? 6 : 4),
    },
    {
      label: "2W",
      fromDate,
      toDate: addDays(fromDate, 13),
    },
    {
      label: "5W",
      fromDate,
      toDate: addDays(fromDate, 34),
    },
  ];

  const activeFilterCount = getActiveFilterCount(filters);
  const quickVehicle = params.newVehicleId
    ? vehicles.find((vehicle) => vehicle.id === params.newVehicleId)
    : null;
  const quickDate = params.newDate ?? formatDateInput(focusDate);
  const shouldOpenCreateForm = Boolean(params.newVehicleId || params.newDate);
  const rowHeightByVehicleId = new Map(
    filteredVehicles.map((vehicle) => {
      const isTackCoatVehicle = isTackCoatSpecialVehicle(vehicle);
      const maxCellItems = Math.max(
        1,
        ...timelineUnits.map((unit) => {
          const assignmentCount = getAssignmentsForVehicleAndDate({
            assignments: assignmentsForPage,
            vehicleId: vehicle.id,
            dateInput: unit.defaultStartDate,
          }).length;
          const tackCoatMarkerCount =
            isTackCoatVehicle &&
            getTackCoatNeedsForTimelineUnit({
              needs: tackCoatNeedsForForm,
              unit,
            }).length > 0
              ? 1
              : 0;

          return assignmentCount + tackCoatMarkerCount;
        }),
      );

      return [
        vehicle.id,
        Math.max(
          SPECIAL_VEHICLE_ROW_MIN_HEIGHT_PX,
          getSpecialVehicleListRowMinHeight(vehicle),
          56 + maxCellItems * 48,
        ),
      ] as const;
    }),
  );

  return (
    <AppShell
      title="Sonderfahrzeug-Disposition"
      description="Tages- und zeitgenaue Einsätze für Spritzwagen, Tieflader, Kehrmaschinen, Fräsen und weitere Sonderfahrzeuge. Mehrere Baustellen je Tag sind möglich."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/truck-dispatch/short-haul"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Kurzstrecke öffnen
        </Link>
        <Link
          href="/equipment-dispatch"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Gerätedisposition öffnen
        </Link>
        <Link
          href="/crew-dispatch?showSpecialVehicles=1"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          In Kolonneneinteilung anzeigen
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard label="Sonderfahrzeuge" value={`${filteredVehicles.length} / ${vehicles.length}`} />
        <SummaryCard label="Einsätze im Zeitraum" value={String(visibleAssignments.length)} />
        <SummaryCard label="Zeitraum" value={`${formatShortDate(fromDate)} – ${formatShortDate(toDate)}`} />
        <SummaryCard label="Anspritzmittel offen" value={`${formatLiters(openTackCoatLiters)} l`} />
        <SummaryCard label="Aktive Filter" value={String(activeFilterCount)} />
      </div>

      {shouldOpenCreateForm ? (
        <Link
          href={closeCreateHref}
          scroll={false}
          aria-label="Sonderfahrzeug-Einsatz schließen"
          className="fixed inset-0 z-[210] bg-gray-950/30 backdrop-blur-sm"
        />
      ) : null}

      <details
        id="special-vehicle-create"
        open={shouldOpenCreateForm}
        className={
          shouldOpenCreateForm
            ? "fixed left-4 right-4 top-[calc(var(--app-header-height,0px)+1rem)] z-[230] mx-auto max-h-[calc(100vh-var(--app-header-height,0px)-2rem)] max-w-6xl scroll-mt-28 overflow-y-auto rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-2xl ring-2 ring-blue-100"
            : "mb-6 scroll-mt-28 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"
        }
      >
        {shouldOpenCreateForm ? (
          <Link
            href={closeCreateHref}
            scroll={false}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-white text-lg font-bold text-blue-950 shadow-sm hover:bg-blue-50"
            aria-label="Sonderfahrzeug-Einsatz schließen"
          >
            ×
          </Link>
        ) : null}
        <summary className="cursor-pointer text-lg font-semibold text-blue-950">
          Sonderfahrzeug-Einsatz eintragen
          {quickVehicle ? ` · ${getVehicleLabel(quickVehicle)}` : null}
        </summary>
        {shouldOpenCreateForm ? (
          <div className="mt-3 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-950">
            {quickVehicle ? `Vorausgewählt: ${getVehicleLabel(quickVehicle)}` : "Bitte Sonderfahrzeug wählen."}
            {quickDate ? ` · Datum: ${formatGermanDate(parseDateParam(quickDate))}` : null}
          </div>
        ) : null}
        <SpecialVehicleTourFormClient
          key={`create-${quickVehicle?.id ?? "none"}-${quickDate}`}
          action={createSpecialVehicleDispatchTourAssignments}
          vehicles={vehicles}
          transportVehicles={transportVehicles}
          drivers={drivers}
          projects={projects}
          crews={crews}
          defaultVehicleId={quickVehicle?.id ?? ""}
          defaultWorkDate={quickDate}
          tackCoatNeeds={tackCoatNeedsForForm}
          tackCoatMaterials={tackCoatMaterialsForForm}
        />
      </details>

      <div
        data-special-vehicle-dispatch-root
        className="max-w-full overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <SpecialVehicleDispatchStickyOffset />
        <div
          data-special-vehicle-dispatch-sticky-controls
          className="sticky top-0 z-[90] -mx-px -mt-px overflow-visible rounded-t-2xl border border-gray-200 bg-white/95 p-4 pt-[calc(var(--app-header-height,0px)+1rem)] shadow-sm backdrop-blur"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Zeitstrahl Sonderfahrzeuge
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {formatGermanDate(fromDate)} – {formatGermanDate(toDate)} · {filteredVehicles.length} von {vehicles.length} Sonderfahrzeugen sichtbar
              </p>
            </div>
            <div className="text-sm font-semibold text-gray-500">
              Ein gemeinsamer horizontaler Zeitstrahl für alle Sonderfahrzeuge
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={todayHref}
              scroll={false}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            >
              Heute
            </Link>

            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
              {timelineRangePresets.map((preset) => (
                <Link
                  key={preset.label}
                  href={buildSpecialVehicleDispatchHref({
                    fromDate: preset.fromDate,
                    toDate: preset.toDate,
                    view: view === "months" ? "days" : view,
                    showWeekend,
                    filters,
                    focusDate: preset.fromDate,
                  })}
                  scroll={false}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                >
                  {preset.label}
                </Link>
              ))}
            </div>

            <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
              {filteredVehicles.length}/{vehicles.length} Sonderfahrzeuge
            </div>

            <DismissibleDetails className="relative inline-block">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                🔎 Filter
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </summary>

              <div className="fixed left-4 right-4 top-24 z-[140] mx-auto max-h-[calc(100vh-7rem)] max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="text-sm font-bold text-gray-900">
                  Sonderfahrzeuge filtern
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Zeitraum, Ansicht, Fahrzeuge und Baustellen einschränken.
                </p>

                <form
                  action="/special-vehicle-dispatch"
                  className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12"
                >
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Von
                    <input
                      type="date"
                      name="from"
                      defaultValue={formatDateInput(fromDate)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Bis
                    <input
                      type="date"
                      name="to"
                      defaultValue={formatDateInput(toDate)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Ansicht
                    <select
                      name="view"
                      defaultValue={view}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="days">Tage</option>
                      <option value="weeks">Wochen</option>
                      <option value="months">Monate</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 lg:col-span-2">
                    <input
                      type="checkbox"
                      name="showWeekend"
                      value="1"
                      defaultChecked={showWeekend}
                      className="h-4 w-4"
                    />
                    Sa/So anzeigen
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-4">
                    Schnellsuche
                    <input
                      name="q"
                      defaultValue={filters.q}
                      placeholder="Spritzwagen, Tieflader, Baustelle, Material, Aufgabe..."
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-xs font-semibold text-gray-700 lg:col-span-3">
                    Baustelle / Projekt
                    <select
                      name="projectId"
                      defaultValue={filters.projectId}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Alle Baustellen</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.projectNumber} · {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Fahrzeugnummer
                    <select
                      name="vehicleNumber"
                      defaultValue={filters.vehicleNumber}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Alle</option>
                      {vehicleNumberOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Kennzeichen
                    <select
                      name="licensePlate"
                      defaultValue={filters.licensePlate}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Alle</option>
                      {licensePlateOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Typ
                    <select
                      name="vehicleType"
                      defaultValue={filters.vehicleType}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Alle</option>
                      {vehicleTypeOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
                    Kategorie
                    <select
                      name="category"
                      defaultValue={filters.category}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">Alle</option>
                      {categoryOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex flex-wrap items-end gap-2 lg:col-span-12">
                    <button
                      type="submit"
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                    >
                      Filter anwenden
                    </button>
                    <Link
                      href={buildSpecialVehicleDispatchHref({
                        fromDate,
                        toDate,
                        view,
                        showWeekend,
                      })}
                      scroll={false}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Filter zurücksetzen
                    </Link>
                  </div>
                </form>
              </div>
            </DismissibleDetails>
          </div>

          <div
            className="relative mt-4 -mx-4 grid border-t border-gray-200 bg-white shadow-sm"
            style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH_PX}px minmax(0, 1fr)` }}
          >
            <CrewTimelineScrollButtons
              leftColumnWidth={LEFT_COLUMN_WIDTH_PX}
              scrollContainerSelector='[data-special-vehicle-timeline-scroll-container="true"]'
              previousHref={previousHref}
              nextHref={nextHref}
            />
            <div className="flex min-h-[64px] items-center border-r border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
              Sonderfahrzeug
            </div>
            <div
              data-special-vehicle-timeline-header-scroll
              className="min-w-0 overflow-hidden border-b border-gray-200 bg-gray-50"
            >
              <div
                className="grid"
                style={{ gridTemplateColumns: gridColumns, minWidth: timelineMinWidth || undefined }}
              >
                {timelineUnits.map((unit) => (
                  <div
                    key={unit.key}
                    data-timeline-date={unit.defaultStartDate}
                    title={daysOffByDate.get(unit.defaultStartDate)?.name}
                    className={`flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-200 px-3 py-3 text-center last:border-r-0 ${
                      daysOffByDate.has(unit.defaultStartDate) ? "bg-slate-300" : "bg-gray-50"
                    }`}
                  >
                    <div className="truncate text-sm font-bold text-gray-900" title={unit.label}>{unit.label}</div>
                    <div className="mt-1 truncate text-xs font-medium text-gray-500" title={unit.subLabel}>{unit.subLabel}</div>
                    {daysOffByDate.has(unit.defaultStartDate) ? <div className="mt-1 truncate text-[9px] font-black uppercase text-gray-800">arbeitsfrei</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="overflow-y-auto overflow-x-hidden overscroll-contain rounded-b-2xl"
          style={{
            maxHeight:
              "max(360px, calc(100vh - var(--special-vehicle-dispatch-sticky-offset, 220px) - var(--app-header-height, 0px) - 1rem))",
          }}
        >
          {filteredVehicles.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-gray-500">
              Keine Sonderfahrzeuge passend zum Filter gefunden.
            </div>
          ) : (
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: `${LEFT_COLUMN_WIDTH_PX}px minmax(0, 1fr)`,
              }}
            >
              <div className="border-r border-gray-200 bg-white">
                {filteredVehicles.map((vehicle) => {
                  const isTackCoatVehicle = isTackCoatSpecialVehicle(vehicle);
                  const rowHeight = rowHeightByVehicleId.get(vehicle.id) ?? 108;
                  const inventoryItem = getVehicleInventoryItem(vehicle);
                  const inventoryLabel = getVehicleInventoryLabel(vehicle);
                  const inventoryResponsibleLabel =
                    getVehicleInventoryResponsibleLabel(inventoryItem);

                  return (
                    <div
                      key={vehicle.id}
                      className="border-b border-gray-200 bg-white p-4"
                      style={{
                        height: `${rowHeight}px`,
                        minHeight: `${rowHeight}px`,
                      }}
                    >
                      <div className="truncate font-semibold text-gray-900">
                        {getSpecialVehicleTitle(vehicle)}
                      </div>
                      <div className="mt-1 truncate text-sm text-gray-600">
                        {getSpecialVehicleSubtitle(vehicle) || "Sondergerät"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                        {inventoryItem && inventoryLabel ? (
                          <Link
                            href={`/inventory/${inventoryItem.id}`}
                            className="max-w-full truncate rounded-full bg-amber-100 px-2 py-1 text-amber-950 transition hover:bg-amber-200"
                            title="Inventarobjekt öffnen"
                          >
                            Inventar: {inventoryLabel}
                          </Link>
                        ) : (
                          <span className="rounded-full bg-gray-50 px-2 py-1 text-gray-500">
                            Kein Inventarobjekt
                          </span>
                        )}
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-800">Sonderfahrzeug</span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{vehicle.category}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{vehicle.vehicleType}</span>
                        {isTackCoatVehicle ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                            Anspritzgerät
                          </span>
                        ) : null}
                      </div>
                      {inventoryItem ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-500">
                          {inventoryItem.status !== "ACTIVE" ? (
                            <div>
                              Status:{" "}
                              <span className="font-semibold text-red-700">
                                {inventoryItem.status === "DEFECT"
                                  ? "Defekt"
                                  : inventoryItem.status}
                              </span>
                            </div>
                          ) : null}
                          {inventoryItem.currentLocationLabel ? (
                            <div className="truncate">
                              Standort: {inventoryItem.currentLocationLabel}
                            </div>
                          ) : null}
                          {inventoryItem.currentProject ? (
                            <div className="truncate">
                              Baustelle:{" "}
                              {inventoryItem.currentProject.projectNumber} ·{" "}
                              {inventoryItem.currentProject.name}
                            </div>
                          ) : null}
                          {inventoryResponsibleLabel ? (
                            <div className="truncate">
                              Zuweisung: {inventoryResponsibleLabel}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <SpecialVehicleTimelineScroll focusDate={formatDateInput(focusDate)}>
                <div
                  className="grid min-w-0"
                  style={{
                    gridTemplateColumns: gridColumns,
                    minWidth: timelineContentMinWidth || undefined,
                  }}
                >
                  {filteredVehicles.map((vehicle) => {
                    const isTackCoatVehicle = isTackCoatSpecialVehicle(vehicle);
                    const rowHeight = rowHeightByVehicleId.get(vehicle.id) ?? 108;

                    return (
                      <div
                        key={vehicle.id}
                        className="grid border-b border-gray-100"
                        style={{
                          gridColumn: `1 / span ${timelineUnits.length}`,
                          gridTemplateColumns: gridColumns,
                          height: `${rowHeight}px`,
                          minHeight: `${rowHeight}px`,
                        }}
                      >
                        {timelineUnits.map((unit) => {
                          const dateInput = unit.defaultStartDate;
                          const dayAssignments = getAssignmentsForVehicleAndDate({
                            assignments: assignmentsForPage,
                            vehicleId: vehicle.id,
                            dateInput,
                          });
                          const tackCoatNeeds = isTackCoatVehicle
                            ? getTackCoatNeedsForTimelineUnit({
                                needs: tackCoatNeedsForForm,
                                unit,
                              })
                            : [];
                          const openTackCoatLitersForUnit = tackCoatNeeds.reduce(
                            (sum, need) => sum + need.openQuantity,
                            0,
                          );
                          const plusHref = buildSpecialVehicleDispatchHref({
                            fromDate,
                            toDate,
                            view,
                            showWeekend,
                            filters,
                            focusDate: dateInput,
                            newVehicleId: vehicle.id,
                            newDate: dateInput,
                          });

                          return (
                            <div
                              key={`${vehicle.id}-${unit.key}`}
                              className={`border-r border-gray-100 p-2 last:border-r-0 ${
                                daysOffByDate.has(unit.defaultStartDate)
                                  ? "bg-slate-200/80"
                                  : ""
                              }`}
                              style={{
                                height: `${rowHeight}px`,
                                minHeight: `${rowHeight}px`,
                              }}
                            >
                              <Link
                                href={`${plusHref}#special-vehicle-create`}
                                className="mb-2 flex h-7 w-full items-center justify-center rounded-md border border-dashed border-purple-300 bg-purple-50 text-xs font-semibold text-purple-800 hover:bg-purple-100"
                              >
                                +
                              </Link>

                              {tackCoatNeeds.length > 0 ? (
                                <Link
                                  href={`${plusHref}#special-vehicle-create`}
                                  title={getTackCoatMarkerTitle(tackCoatNeeds)}
                                  className={
                                    openTackCoatLitersForUnit > 0
                                      ? "mb-2 block rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold leading-5 text-amber-900 hover:bg-amber-100"
                                      : "mb-2 block rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold leading-5 text-green-800 hover:bg-green-100"
                                  }
                                >
                                  {getTackCoatMarkerText(tackCoatNeeds)}
                                </Link>
                              ) : null}

                              <div className="space-y-2">
                                {dayAssignments.map((assignment) => (
                                  <SpecialVehicleAssignmentCard
                                    key={assignment.id}
                                    assignment={assignment}
                                    vehicles={vehicles}
                                    transportVehicles={transportVehicles}
                                    drivers={drivers}
                                    projects={projects}
                                    crews={crews}
                                    tackCoatMaterials={tackCoatMaterialsForForm}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </SpecialVehicleTimelineScroll>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function SpecialVehicleAssignmentCard({
  assignment,
  vehicles,
  transportVehicles,
  drivers,
  projects,
  crews,
  tackCoatMaterials,
}: {
  assignment: AssignmentForPage;
  vehicles: {
    defaultOperatorDriverId?: string | null;
    defaultOperatorDriverName?: string | null;
    id: string;
    inventoryItemId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  transportVehicles: {
    defaultOperatorDriverId?: string | null;
    defaultOperatorDriverName?: string | null;
    id: string;
    inventoryItemId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  drivers: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
  crews: { id: string; name: string }[];
  tackCoatMaterials: {
    id: string;
    materialNumber: string | null;
    name: string;
    unit: string;
  }[];
}) {
  const quantityLabel = formatQuantity(assignment.quantity, assignment.quantityUnit);
  const overlayId = `special-vehicle-assignment-${assignment.id}`;

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-2 text-xs text-purple-950 shadow-sm">
      <input id={overlayId} type="checkbox" className="peer sr-only" />
      <label
        htmlFor={overlayId}
        className="block cursor-pointer font-semibold leading-5"
      >
        <span className="block truncate" title={getAssignmentSummary(assignment)}>
          {getAssignmentSummary(assignment)}
        </span>
      </label>

      <label
        htmlFor={overlayId}
        aria-label="Sonderfahrzeug-Einsatz schließen"
        className="fixed inset-0 z-[210] hidden cursor-default bg-gray-950/30 backdrop-blur-sm peer-checked:block"
      />

      <div className="fixed left-4 right-4 top-[calc(var(--app-header-height,0px)+1rem)] z-[230] mx-auto hidden max-h-[calc(100vh-var(--app-header-height,0px)-2rem)] max-w-6xl overflow-y-auto rounded-2xl border border-purple-200 bg-white p-5 text-gray-900 shadow-2xl peer-checked:block">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-700">
              Sonderfahrzeug-Einsatz bearbeiten
            </div>
            <h3 className="mt-1 text-xl font-bold text-gray-950">
              {getAssignmentSummary(assignment)}
            </h3>
          </div>
          <label
            htmlFor={overlayId}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-900 shadow-sm hover:bg-gray-50"
            aria-label="Sonderfahrzeug-Einsatz schließen"
          >
            ×
          </label>
        </div>

        <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs text-gray-700">
          <div>
            <strong>Baustelle:</strong> {assignment.projectNumber} · {assignment.projectName}
          </div>
          <div>
            <strong>Aufgabe:</strong> {assignment.taskText}
          </div>
          {quantityLabel || assignment.materialName ? (
            <div>
              <strong>Material:</strong> {[quantityLabel, assignment.materialName].filter(Boolean).join(" ")}
            </div>
          ) : null}
          {assignment.crewName ? (
            <div>
              <strong>Kolonne:</strong> {assignment.crewName}
            </div>
          ) : null}
          {assignment.transportVehicleName ? (
            <div>
              <strong>Transport-LKW:</strong> {assignment.transportVehicleName}
            </div>
          ) : null}
          {assignment.operatorDriverName ? (
            <div>
              <strong>Fahrer/Bediener:</strong> {assignment.operatorDriverName}
            </div>
          ) : null}
          {assignment.notes ? <div>{assignment.notes}</div> : null}
        </div>

        <SpecialVehicleAssignmentForm
          action={updateSpecialVehicleDispatchAssignment}
          id={assignment.id}
          vehicles={vehicles}
          transportVehicles={transportVehicles}
          drivers={drivers}
          projects={projects}
          crews={crews}
          defaultVehicleId={assignment.vehicleId ?? ""}
          defaultTransportVehicleId={assignment.transportVehicleId ?? ""}
          defaultOperatorDriverId={assignment.operatorDriverId ?? ""}
          defaultProjectId={assignment.projectId ?? ""}
          defaultCrewId={assignment.crewId ?? ""}
          defaultWorkDate={formatDateInput(assignment.workDate)}
          defaultStartTime={assignment.startTime}
          defaultEndTime={assignment.endTime}
          defaultTaskText={assignment.taskText}
          defaultMaterialName={assignment.materialName ?? ""}
          defaultQuantity={assignment.quantity === null ? "" : String(assignment.quantity)}
          defaultQuantityUnit={assignment.quantityUnit ?? ""}
          defaultNotes={assignment.notes ?? ""}
          tackCoatMaterials={tackCoatMaterials}
        />

        <form action={deleteSpecialVehicleDispatchAssignment} className="mt-4">
          <input type="hidden" name="id" value={assignment.id} />
          <button type="submit" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
            Einsatz löschen
          </button>
        </form>
      </div>
    </div>
  );
}

function SpecialVehicleAssignmentForm({
  action,
  id,
  vehicles,
  transportVehicles,
  drivers,
  projects,
  crews,
  defaultVehicleId = "",
  defaultTransportVehicleId = "",
  defaultOperatorDriverId = "",
  defaultProjectId = "",
  defaultCrewId = "",
  defaultWorkDate,
  defaultStartTime = "07:00",
  defaultEndTime = "17:00",
  defaultTaskText = "",
  defaultMaterialName = "",
  defaultQuantity = "",
  defaultQuantityUnit = "",
  defaultNotes = "",
  tackCoatMaterials = [],
  compact = false,
}: {
  action: (formData: FormData) => Promise<void>;
  id?: string;
  vehicles: {
    defaultOperatorDriverId?: string | null;
    defaultOperatorDriverName?: string | null;
    id: string;
    inventoryItemId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  transportVehicles: {
    defaultOperatorDriverId?: string | null;
    defaultOperatorDriverName?: string | null;
    id: string;
    inventoryItemId: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  drivers: { id: string; firstName: string; lastName: string }[];
  projects: { id: string; projectNumber: string; name: string }[];
  crews: { id: string; name: string }[];
  defaultVehicleId?: string;
  defaultTransportVehicleId?: string;
  defaultOperatorDriverId?: string;
  defaultProjectId?: string;
  defaultCrewId?: string;
  defaultWorkDate: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultTaskText?: string;
  defaultMaterialName?: string;
  defaultQuantity?: string;
  defaultQuantityUnit?: string;
  defaultNotes?: string;
  tackCoatMaterials?: {
    id: string;
    materialNumber: string | null;
    name: string;
    unit: string;
  }[];
  compact?: boolean;
}) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === defaultVehicleId);
  const selectedInventoryItemId = selectedVehicle?.inventoryItemId ?? "";
  const selectedTransportVehicle = transportVehicles.find(
    (vehicle) => vehicle.id === defaultTransportVehicleId,
  );
  const selectedTransportInventoryItemId =
    selectedTransportVehicle?.inventoryItemId ?? "";
  const resolvedOperatorDriverId =
    defaultOperatorDriverId || selectedVehicle?.defaultOperatorDriverId || "";

  return (
    <form action={action} className={compact ? "space-y-3" : "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"}>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {!selectedInventoryItemId && defaultVehicleId ? (
        <input type="hidden" name="vehicleId" value={defaultVehicleId} />
      ) : null}
      {!selectedTransportInventoryItemId && defaultTransportVehicleId ? (
        <input
          type="hidden"
          name="transportVehicleId"
          value={defaultTransportVehicleId}
        />
      ) : null}

      <label className="text-xs font-semibold text-gray-700">
        Sonderfahrzeug
        <select name="inventoryItemId" required defaultValue={selectedInventoryItemId} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="" disabled>Inventarobjekt wählen</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.inventoryItemId}>
              {getVehicleLabel(vehicle)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Transport-LKW optional
        <select name="transportInventoryItemId" defaultValue={selectedTransportInventoryItemId} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="">Kein Transport-LKW</option>
          {transportVehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.inventoryItemId}>
              {getVehicleLabel(vehicle)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Fahrer/Bediener optional
        <select name="operatorDriverId" defaultValue={resolvedOperatorDriverId} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="">Kein Fahrer/Bediener</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.lastName}, {driver.firstName}
            </option>
          ))}
        </select>
        {selectedVehicle?.defaultOperatorDriverName && !defaultOperatorDriverId ? (
          <span className="mt-1 block text-[11px] font-medium text-gray-500">
            Verantwortlicher: {selectedVehicle.defaultOperatorDriverName}
          </span>
        ) : null}
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Baustelle
        <select name="projectId" required defaultValue={defaultProjectId} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="" disabled>Baustelle wählen</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Kolonne optional
        <select name="crewId" defaultValue={defaultCrewId} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="">Keine Kolonne</option>
          {crews.map((crew) => (
            <option key={crew.id} value={crew.id}>{crew.name}</option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Datum
        <input type="date" name="workDate" required defaultValue={defaultWorkDate} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Beginn
        <input
          name="startTime"
          required
          defaultValue={defaultStartTime}
          placeholder="07:00"
          inputMode="numeric"
          pattern="^([01]?[0-9]|2[0-4]):[0-5][0-9]$"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <span className="mt-1 block text-[11px] font-medium text-gray-500">Format: 07:00</span>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Ende
        <input
          name="endTime"
          required
          defaultValue={defaultEndTime}
          placeholder="17:00"
          inputMode="numeric"
          pattern="^([01]?[0-9]|2[0-4]):[0-5][0-9]$"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <span className="mt-1 block text-[11px] font-medium text-gray-500">Format: 17:00</span>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Aufgabe
        <input name="taskText" defaultValue={defaultTaskText} placeholder="z.B. Anspritzen, Tieflader, Kehren" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Anspritzmittel / Mittel
        <select name="materialName" defaultValue={defaultMaterialName} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="">Kein Anspritzmittel / anderer Einsatz</option>
          {tackCoatMaterials.map((material) => (
            <option key={material.id} value={material.name}>
              {[material.materialNumber, material.name].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Anspritzmenge / Menge
        <input name="quantity" type="number" min="0" step="0.01" defaultValue={defaultQuantity} placeholder="z.B. 850" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Einheit
        <input name="quantityUnit" defaultValue={defaultQuantityUnit} placeholder="kg, l, t, m²" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <label className={compact ? "block text-xs font-semibold text-gray-700" : "text-xs font-semibold text-gray-700 xl:col-span-2"}>
        Bemerkung
        <input name="notes" defaultValue={defaultNotes} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
      </label>

      <div className={compact ? "" : "flex items-end"}>
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
          Speichern
        </button>
      </div>
    </form>
  );
}
