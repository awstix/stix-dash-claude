import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createSpecialVehicleDispatchTourAssignments,
  deleteSpecialVehicleDispatchAssignment,
  updateSpecialVehicleDispatchAssignment,
} from "./actions";
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
  openQuantity: number;
  crewName: string;
};

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const LEFT_COLUMN_WIDTH_PX = 340;

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
  filters: SpecialVehicleFilters;
  focusDate?: Date | string;
  newVehicleId?: string | null;
  newDate?: string | null;
}) {
  const params = new URLSearchParams();

  params.set("from", formatDateInput(fromDate));
  params.set("to", formatDateInput(toDate));
  params.set("view", view);

  if (showWeekend) params.set("showWeekend", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.vehicleNumber) params.set("vehicleNumber", filters.vehicleNumber);
  if (filters.licensePlate) params.set("licensePlate", filters.licensePlate);
  if (filters.vehicleType) params.set("vehicleType", filters.vehicleType);
  if (filters.category) params.set("category", filters.category);

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

function getVehicleSearchText(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  notes: string | null;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    vehicle.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function assignmentMatchesQuery(assignment: AssignmentForPage, query: string) {
  if (!query) return true;

  const haystack = [
    assignment.vehicleName,
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
  const gridColumns = getTimelineGridColumns(view, unitCount);
  const timelineMinWidth = getTimelineMinWidth(view, unitCount);

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

  const [vehicles, projects, crews, assignments, asphaltTackCoatEntries, tackCoatMaterials] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        isActive: true,
        isSpecialVehicle: true,
      },
      orderBy: [{ category: "asc" }, { vehicleNumber: "asc" }],
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

    prisma.asphaltDispatchEntry.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
        tackCoatQuantity: {
          gt: 0,
        },
      },
      orderBy: [{ workDate: "asc" }, { projectNumber: "asc" }, { createdAt: "asc" }],
    }),

    prisma.materialType.findMany({
      where: {
        isActive: true,
        category: "Anspritzmittel",
      },
      orderBy: [{ materialNumber: "asc" }, { name: "asc" }],
    }),
  ]);

  const assignmentsForPage: AssignmentForPage[] = assignments.map((assignment) => ({
    id: assignment.id,
    workDate: assignment.workDate,
    startTime: assignment.startTime,
    endTime: assignment.endTime,
    vehicleId: assignment.vehicleId,
    vehicleName: assignment.vehicleName,
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

  const usedTackCoatByKey = new Map<string, number>();

  for (const assignment of assignmentsForPage) {
    const materialName = assignment.materialName?.trim().toLowerCase();

    if (!assignment.projectId || !materialName || assignment.quantity === null) {
      continue;
    }

    const key = [
      formatDateInput(assignment.workDate),
      assignment.projectId,
      materialName,
      assignment.quantityUnit ?? "",
    ].join("|||");

    usedTackCoatByKey.set(key, (usedTackCoatByKey.get(key) ?? 0) + assignment.quantity);
  }

  const tackCoatNeedsMap = new Map<string, TackCoatNeedForForm>();

  for (const entry of asphaltTackCoatEntries) {
    if (!entry.tackCoatMaterialName || !entry.tackCoatQuantity || entry.tackCoatQuantity <= 0) {
      continue;
    }

    const dateKey = formatDateInput(entry.workDate);
    const materialKey = entry.tackCoatMaterialName.trim().toLowerCase();
    const unit = entry.tackCoatUnit ?? "";
    const key = [dateKey, entry.projectId ?? entry.projectNumber, materialKey, unit].join("|||");
    const existing = tackCoatNeedsMap.get(key) ?? {
      key,
      workDate: dateKey,
      projectId: entry.projectId,
      projectNumber: entry.projectNumber,
      projectName: entry.projectName,
      materialName: entry.tackCoatMaterialName,
      quantity: 0,
      quantityUnit: unit,
      plannedQuantity: 0,
      openQuantity: 0,
      crewName: entry.crew,
    };

    existing.quantity += entry.tackCoatQuantity;
    existing.plannedQuantity += entry.tackCoatQuantity;
    tackCoatNeedsMap.set(key, existing);
  }

  const tackCoatNeedsForForm = Array.from(tackCoatNeedsMap.values()).map((need) => {
    const usedKey = [
      need.workDate,
      need.projectId ?? need.projectNumber,
      need.materialName.trim().toLowerCase(),
      need.quantityUnit,
    ].join("|||");
    const usedQuantity = usedTackCoatByKey.get(usedKey) ?? 0;

    return {
      ...need,
      openQuantity: Math.max(0, Math.round((need.quantity - usedQuantity) * 100) / 100),
    };
  });

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

  const activeFilterCount = getActiveFilterCount(filters);
  const quickVehicle = params.newVehicleId
    ? vehicles.find((vehicle) => vehicle.id === params.newVehicleId)
    : null;
  const quickDate = params.newDate ?? formatDateInput(focusDate);
  const shouldOpenCreateForm = Boolean(params.newVehicleId || params.newDate);

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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Sonderfahrzeuge" value={`${filteredVehicles.length} / ${vehicles.length}`} />
        <SummaryCard label="Einsätze im Zeitraum" value={String(visibleAssignments.length)} />
        <SummaryCard label="Zeitraum" value={`${formatShortDate(fromDate)} – ${formatShortDate(toDate)}`} />
        <SummaryCard label="Aktive Filter" value={String(activeFilterCount)} />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <form action="/special-vehicle-dispatch" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
            <input type="checkbox" name="showWeekend" value="1" defaultChecked={showWeekend} className="h-4 w-4" />
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
                <option key={value} value={value}>{value}</option>
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
                <option key={value} value={value}>{value}</option>
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
                <option key={value} value={value}>{value}</option>
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
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 lg:col-span-1">
            <button type="submit" className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
              Öffnen
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={previousHref} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            ← zurück
          </Link>
          <Link href={todayHref} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Heute
          </Link>
          <Link href={nextHref} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            weiter →
          </Link>
          <Link href={`/special-vehicle-dispatch?from=${formatDateInput(fromDate)}&to=${formatDateInput(toDate)}&view=${view}${showWeekend ? "&showWeekend=1" : ""}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
            Filter zurücksetzen
          </Link>
        </div>
      </div>

      <details
        id="special-vehicle-create"
        open={shouldOpenCreateForm}
        className={
          shouldOpenCreateForm
            ? "mb-6 scroll-mt-28 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-md ring-2 ring-blue-100"
            : "mb-6 scroll-mt-28 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm"
        }
      >
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
          projects={projects}
          crews={crews}
          defaultVehicleId={quickVehicle?.id ?? ""}
          defaultWorkDate={quickDate}
          tackCoatNeeds={tackCoatNeedsForForm}
          tackCoatMaterials={tackCoatMaterials}
        />
      </details>

      <div className="max-w-full overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur">
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
              Klick auf + = Einsatz für dieses Fahrzeug und Datum vorbereiten
            </div>
          </div>

          <div className="mt-4 flex min-w-0">
            <div style={{ width: LEFT_COLUMN_WIDTH_PX }} className="shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              Sonderfahrzeug
            </div>
            <div data-special-vehicle-timeline-header-scroll className="min-w-0 flex-1 overflow-x-hidden">
              <div
                className="grid border-t border-gray-200 bg-white"
                style={{ gridTemplateColumns: gridColumns, minWidth: timelineMinWidth || undefined }}
              >
                {timelineUnits.map((unit) => (
                  <div key={unit.key} data-timeline-date={unit.defaultStartDate} className="border-r border-gray-200 px-3 py-3 text-center last:border-r-0">
                    <div className="text-sm font-bold text-gray-900">{unit.label}</div>
                    <div className="mt-1 text-xs font-medium text-gray-500">{unit.subLabel}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-gray-500">
            Keine Sonderfahrzeuge passend zum Filter gefunden.
          </div>
        ) : (
          <div>
            {filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex min-w-0 border-t border-gray-100">
                <div style={{ width: LEFT_COLUMN_WIDTH_PX }} className="shrink-0 border-r border-gray-200 bg-white p-4">
                  <div className="font-semibold text-gray-900">{vehicle.vehicleNumber}</div>
                  <div className="mt-1 text-sm text-gray-600">{vehicle.licensePlate ?? "-"}</div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                    <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-800">Sonderfahrzeug</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{vehicle.category}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700">{vehicle.vehicleType}</span>
                  </div>
                </div>

                <SpecialVehicleTimelineScroll focusDate={formatDateInput(focusDate)}>
                  <div className="grid min-h-[108px]" style={{ gridTemplateColumns: gridColumns, minWidth: timelineMinWidth || undefined }}>
                    {timelineUnits.map((unit) => {
                      const dateInput = unit.defaultStartDate;
                      const dayAssignments = getAssignmentsForVehicleAndDate({
                        assignments: assignmentsForPage,
                        vehicleId: vehicle.id,
                        dateInput,
                      });
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
                        <div key={`${vehicle.id}-${unit.key}`} className="min-h-[108px] border-r border-gray-100 p-2 last:border-r-0">
                          <Link
                            href={`${plusHref}#special-vehicle-create`}
                            className="mb-2 flex h-7 w-full items-center justify-center rounded-md border border-dashed border-purple-300 bg-purple-50 text-xs font-semibold text-purple-800 hover:bg-purple-100"
                          >
                            +
                          </Link>

                          <div className="space-y-2">
                            {dayAssignments.map((assignment) => (
                              <SpecialVehicleAssignmentCard
                                key={assignment.id}
                                assignment={assignment}
                                vehicles={vehicles}
                                projects={projects}
                                crews={crews}
                                tackCoatMaterials={tackCoatMaterials}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SpecialVehicleTimelineScroll>
              </div>
            ))}
          </div>
        )}
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
  projects,
  crews,
  tackCoatMaterials,
}: {
  assignment: AssignmentForPage;
  vehicles: {
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
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

  return (
    <details className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-2 text-xs text-purple-950 shadow-sm">
      <summary className="cursor-pointer font-semibold leading-5">
        <span className="block truncate" title={getAssignmentSummary(assignment)}>
          {getAssignmentSummary(assignment)}
        </span>
      </summary>

      <div className="mt-3 rounded-lg border border-purple-100 bg-white p-3 text-gray-900">
        <div className="mb-3 space-y-1 text-xs text-gray-600">
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
          {assignment.notes ? <div>{assignment.notes}</div> : null}
        </div>

        <SpecialVehicleAssignmentForm
          action={updateSpecialVehicleDispatchAssignment}
          id={assignment.id}
          vehicles={vehicles}
          projects={projects}
          crews={crews}
          defaultVehicleId={assignment.vehicleId ?? ""}
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
          compact
        />

        <form action={deleteSpecialVehicleDispatchAssignment} className="mt-3">
          <input type="hidden" name="id" value={assignment.id} />
          <button type="submit" className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
            Einsatz löschen
          </button>
        </form>
      </div>
    </details>
  );
}

function SpecialVehicleAssignmentForm({
  action,
  id,
  vehicles,
  projects,
  crews,
  defaultVehicleId = "",
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
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  projects: { id: string; projectNumber: string; name: string }[];
  crews: { id: string; name: string }[];
  defaultVehicleId?: string;
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
  return (
    <form action={action} className={compact ? "space-y-3" : "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"}>
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <label className="text-xs font-semibold text-gray-700">
        Sonderfahrzeug
        <select name="vehicleId" required defaultValue={defaultVehicleId ?? ""} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
          <option value="" disabled>Fahrzeug wählen</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {getVehicleLabel(vehicle)}
            </option>
          ))}
        </select>
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
        Menge
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
