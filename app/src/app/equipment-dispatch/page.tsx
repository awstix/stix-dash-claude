import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createEquipmentDispatchAssignment,
  deleteEquipmentDispatchAssignment,
  updateEquipmentDispatchAssignment,
} from "./actions";
import { EquipmentAssignmentBar } from "./EquipmentAssignmentBar";
import { EquipmentTimelineScroll } from "./EquipmentTimelineScroll";

type TimelineUnit = {
  key: string;
  label: string;
  subLabel: string;
  startDate: Date;
  endDateExclusive: Date;
  defaultStartDate: string;
  defaultEndDate: string;
};

type TimelineView = "days" | "weeks" | "months";
type EquipmentBarSource = "default" | "manual" | "special" | "truck";
type EquipmentSourceFilter =
  | "all"
  | "default"
  | "empty"
  | "manual"
  | "special"
  | "truck";
type SpecialVehicleFilter = "all" | "yes" | "no";

type EquipmentDispatchFilters = {
  assignmentSource: EquipmentSourceFilter;
  category: string;
  licensePlate: string;
  projectId: string;
  q: string;
  showCars: boolean;
  showSpecialVehicles: boolean;
  showTrucks: boolean;
  specialVehicle: SpecialVehicleFilter;
  vehicleNumber: string;
  vehicleType: string;
};

type EquipmentRowBar = {
  id: string;
  source: EquipmentBarSource;
  sourceLabel: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  crewId: string | null;
  crewName: string | null;
  notes: string | null;
  detailLines?: string[];
  href?: string;
  assignment?: {
    id: string;
    vehicleId: string;
    projectId: string;
    crewId: string | null;
    startDate: Date;
    endDate: Date;
    notes: string | null;
    project: {
      id: string;
      projectNumber: string;
      name: string;
    };
    crew: {
      id: string;
      name: string;
    } | null;
  };
};

type LaneLayout = {
  rowHeight: number;
  lanes: Map<string, number>;
};

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const LEFT_COLUMN_WIDTH_PX = 340;
const TIMELINE_ROW_MIN_HEIGHT_PX = 112;
const TIMELINE_TOP_OFFSET_PX = 44;
const TIMELINE_LANE_HEIGHT_PX = 68;
const TIMELINE_BOTTOM_PADDING_PX = 28;

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
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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

function getCalendarWeek(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

function getTimelineView(value: string | undefined): TimelineView {
  if (value === "weeks" || value === "months" || value === "days") {
    return value;
  }

  return "days";
}

function normalizeDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function getDateDiffInDays(startDate: Date, endDate: Date) {
  const start = normalizeDay(startDate).getTime();
  const end = normalizeDay(endDate).getTime();
  return Math.round((end - start) / 86400000);
}

function rangesOverlapInclusive(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
) {
  return (
    normalizeDay(startA).getTime() <= normalizeDay(endB).getTime() &&
    normalizeDay(endA).getTime() >= normalizeDay(startB).getTime()
  );
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
  const fallbackStart =
    view === "months" ? startOfMonth(today) : startOfWeek(today);
  const fallbackEnd =
    view === "months"
      ? endOfMonthInclusive(addMonths(fallbackStart, 4))
      : addDays(fallbackStart, 13);

  const fromDate = from ? parseDateParam(from) : fallbackStart;
  const toDate = to ? parseDateParam(to) : fallbackEnd;

  if (toDate < fromDate) {
    return {
      fromDate: toDate,
      toDate: fromDate,
    };
  }

  return {
    fromDate,
    toDate,
  };
}

function getVisibleDateRange({
  fromDate,
  toDate,
}: {
  fromDate: Date;
  toDate: Date;
}) {
  /*
    Gerätedisposition: Von/Bis ist immer der exakt sichtbare Bereich.
    Es werden keine zusätzlichen Wochen davor/danach gerendert.
  */
  return {
    timelineFromDate: fromDate,
    timelineToDate: toDate,
  };
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
  return {
    fromDate: addDays(fromDate, dayDiff * direction),
    toDate: addDays(toDate, dayDiff * direction),
  };
}

function buildTimelineUnits({
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
    const units: TimelineUnit[] = [];
    let current = startOfMonth(fromDate);
    const end = startOfMonth(toDate);

    while (current <= end) {
      units.push({
        key: formatDateInput(current),
        label: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(
          current,
        ),
        subLabel: String(current.getUTCFullYear()),
        startDate: current,
        endDateExclusive: addMonths(current, 1),
        defaultStartDate: formatDateInput(current),
        defaultEndDate: formatDateInput(endOfMonthInclusive(current)),
      });
      current = addMonths(current, 1);
    }

    return units;
  }

  if (view === "weeks") {
    const units: TimelineUnit[] = [];
    let current = startOfWeek(fromDate);
    const end = startOfWeek(toDate);

    while (current <= end) {
      const visibleEnd = addDays(current, showWeekend ? 6 : 4);
      units.push({
        key: formatDateInput(current),
        label: `KW ${getCalendarWeek(current)}`,
        subLabel: `${formatShortDate(current)} – ${formatShortDate(visibleEnd)}`,
        startDate: current,
        endDateExclusive: addDays(current, 7),
        defaultStartDate: formatDateInput(current),
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

function getTimelineColumnWidth(view: TimelineView, unitCount: number) {
  if (view === "months") return 170;
  if (view === "weeks") return 145;
  if (unitCount >= 30) return 74;
  if (unitCount >= 20) return 84;
  if (unitCount >= 12) return 96;
  return 112;
}

function getTimelineGridColumns(view: TimelineView, unitCount: number) {
  return `repeat(${unitCount}, minmax(${getTimelineColumnWidth(view, unitCount)}px, 1fr))`;
}

function getTimelineMinWidth(view: TimelineView, unitCount: number) {
  return unitCount * getTimelineColumnWidth(view, unitCount);
}

function getPlusButtonClass(unitCount: number) {
  if (unitCount >= 30) {
    return "flex h-6 w-full cursor-pointer items-center justify-center rounded border border-dashed border-green-300 bg-green-50 text-[10px] font-semibold text-green-800 hover:bg-green-100";
  }

  if (unitCount >= 20) {
    return "flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-green-300 bg-green-50 text-[10px] font-semibold text-green-800 hover:bg-green-100";
  }

  return "flex h-8 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-green-300 bg-green-50 text-xs font-semibold text-green-800 hover:bg-green-100";
}

function getTimelineGridColumnForDateRange({
  startDate,
  endDate,
  timelineUnits,
}: {
  startDate: Date;
  endDate: Date;
  timelineUnits: TimelineUnit[];
}) {
  const firstIndex = timelineUnits.findIndex((unit) =>
    rangesOverlapInclusive(
      startDate,
      endDate,
      unit.startDate,
      addDays(unit.endDateExclusive, -1),
    ),
  );

  if (firstIndex === -1) return null;

  let lastIndex = firstIndex;

  for (let index = firstIndex; index < timelineUnits.length; index += 1) {
    const unit = timelineUnits[index];
    if (
      rangesOverlapInclusive(
        startDate,
        endDate,
        unit.startDate,
        addDays(unit.endDateExclusive, -1),
      )
    ) {
      lastIndex = index;
    }
  }

  return `${firstIndex + 1} / ${lastIndex + 2}`;
}

function buildEquipmentDispatchHref({
  fromDate,
  toDate,
  view,
  showWeekend,
  focusDate,
  filters,
}: {
  fromDate: Date;
  toDate: Date;
  view: TimelineView;
  showWeekend: boolean;
  focusDate?: Date | string;
  filters?: EquipmentDispatchFilters;
}) {
  const params = new URLSearchParams();
  params.set("from", formatDateInput(fromDate));
  params.set("to", formatDateInput(toDate));
  params.set("view", view);


  if (focusDate) {
    params.set(
      "focus",
      typeof focusDate === "string" ? focusDate : formatDateInput(focusDate),
    );
  }

  if (showWeekend) {
    params.set("showWeekend", "1");
  }

  if (filters) {
    if (filters.q) params.set("q", filters.q);
    if (filters.projectId) params.set("projectId", filters.projectId);
    if (filters.vehicleNumber)
      params.set("vehicleNumber", filters.vehicleNumber);
    if (filters.licensePlate) params.set("licensePlate", filters.licensePlate);
    if (filters.vehicleType) params.set("vehicleType", filters.vehicleType);
    if (filters.category) params.set("category", filters.category);
    if (filters.specialVehicle !== "all") {
      params.set("specialVehicle", filters.specialVehicle);
    }
    if (filters.assignmentSource !== "all") {
      params.set("assignmentSource", filters.assignmentSource);
    }
    if (filters.showTrucks) {
      params.set("showTrucks", "1");
    }
    if (filters.showSpecialVehicles) {
      params.set("showSpecialVehicles", "1");
    }
    if (filters.showCars) {
      params.set("showCars", "1");
    }
  }

  return `/equipment-dispatch?${params.toString()}`;
}

function buildEquipmentQuickAddHref({
  fromDate,
  toDate,
  view,
  showWeekend,
  filters,
  vehicleId,
  startDate,
  endDate,
}: {
  fromDate: Date;
  toDate: Date;
  view: TimelineView;
  showWeekend: boolean;
  filters: EquipmentDispatchFilters;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
}) {
  const baseHref = buildEquipmentDispatchHref({
    fromDate,
    toDate,
    view,
    showWeekend,
    focusDate: startDate,
    filters,
  });

  const separator = baseHref.includes("?") ? "&" : "?";

  return `${baseHref}${separator}quickVehicleId=${encodeURIComponent(
    vehicleId,
  )}&quickStart=${formatDateInput(startDate)}&quickEnd=${formatDateInput(
    endDate,
  )}#equipment-quick-add`;
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
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

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function getFilterText(value: string | undefined) {
  return String(value ?? "").trim();
}

function getSpecialVehicleFilter(
  value: string | undefined,
): SpecialVehicleFilter {
  if (value === "yes" || value === "no") return value;
  return "all";
}

function getEquipmentSourceFilter(
  value: string | undefined,
): EquipmentSourceFilter {
  if (
    value === "manual" ||
    value === "default" ||
    value === "truck" ||
    value === "special" ||
    value === "empty"
  ) {
    return value;
  }

  return "all";
}

function getUniqueOptions(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter((value) => value.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-DE", { numeric: true }));
}

function vehicleMatchesSimpleFilters({
  vehicle,
  filters,
}: {
  vehicle: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
    isSpecialVehicle: boolean;
  };
  filters: EquipmentDispatchFilters;
}) {
  if (!shouldShowSpecialVehicles(filters) && vehicle.isSpecialVehicle) {
    return false;
  }

  if (!shouldShowTrucks(filters) && isTruckVehicle(vehicle)) {
    return false;
  }

  if (!shouldShowCars(filters) && isCarVehicle(vehicle)) {
    return false;
  }

  if (
    filters.vehicleNumber &&
    vehicle.vehicleNumber !== filters.vehicleNumber
  ) {
    return false;
  }

  if (
    filters.licensePlate &&
    !normalizeSearchText(vehicle.licensePlate).includes(
      normalizeSearchText(filters.licensePlate),
    )
  ) {
    return false;
  }

  if (filters.vehicleType && vehicle.vehicleType !== filters.vehicleType) {
    return false;
  }

  if (filters.category && vehicle.category !== filters.category) {
    return false;
  }

  if (filters.specialVehicle === "yes" && !vehicle.isSpecialVehicle) {
    return false;
  }

  if (filters.specialVehicle === "no" && vehicle.isSpecialVehicle) {
    return false;
  }

  return true;
}

function shouldShowTrucks(filters: EquipmentDispatchFilters) {
  return filters.showTrucks || filters.assignmentSource === "truck";
}

function shouldShowSpecialVehicles(filters: EquipmentDispatchFilters) {
  return (
    filters.showSpecialVehicles ||
    filters.assignmentSource === "special" ||
    filters.specialVehicle === "yes"
  );
}

function shouldShowCars(filters: EquipmentDispatchFilters) {
  return filters.showCars;
}

function isTruckVehicle(vehicle: {
  category: string;
  vehicleNumber?: string | null;
  vehicleType: string;
}) {
  const text = normalizeSearchText(
    [vehicle.category, vehicle.vehicleType, vehicle.vehicleNumber].join(" "),
  );

  return (
    text.includes("lkw") ||
    text.includes("kipper") ||
    text.includes("sattel") ||
    text.includes("auflieger") ||
    text.includes("anhaenger") ||
    text.includes("3-achser") ||
    text.includes("4-achser")
  );
}

function isCarVehicle(vehicle: {
  category: string;
  vehicleNumber?: string | null;
  vehicleType: string;
}) {
  if (isTruckVehicle(vehicle)) {
    return false;
  }

  const text = normalizeSearchText(
    [vehicle.category, vehicle.vehicleType, vehicle.vehicleNumber].join(" "),
  );

  return (
    text.includes("pkw") ||
    text.includes("personenkraftwagen") ||
    text.includes("kombi")
  );
}


function vehicleMatchesFilters({
  vehicle,
  bars,
  filters,
}: {
  vehicle: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
    isSpecialVehicle: boolean;
    notes: string | null;
  };
  bars: EquipmentRowBar[];
  filters: EquipmentDispatchFilters;
}) {
  if (
    filters.vehicleNumber &&
    vehicle.vehicleNumber !== filters.vehicleNumber
  ) {
    return false;
  }

  if (
    filters.licensePlate &&
    !normalizeSearchText(vehicle.licensePlate).includes(
      normalizeSearchText(filters.licensePlate),
    )
  ) {
    return false;
  }

  if (filters.vehicleType && vehicle.vehicleType !== filters.vehicleType) {
    return false;
  }

  if (filters.category && vehicle.category !== filters.category) {
    return false;
  }

  if (filters.specialVehicle === "yes" && !vehicle.isSpecialVehicle) {
    return false;
  }

  if (filters.specialVehicle === "no" && vehicle.isSpecialVehicle) {
    return false;
  }

  if (filters.projectId && !bars.some((bar) => bar.projectId === filters.projectId)) {
    return false;
  }

  if (
    filters.assignmentSource === "manual" &&
    !bars.some((bar) => bar.source === "manual")
  ) {
    return false;
  }

  if (
    filters.assignmentSource === "default" &&
    !bars.some((bar) => bar.source === "default")
  ) {
    return false;
  }

  if (
    filters.assignmentSource === "truck" &&
    !bars.some((bar) => bar.source === "truck")
  ) {
    return false;
  }

  if (
    filters.assignmentSource === "special" &&
    !bars.some((bar) => bar.source === "special")
  ) {
    return false;
  }

  if (filters.assignmentSource === "empty" && bars.length > 0) {
    return false;
  }

  const query = normalizeSearchText(filters.q);

  if (!query) {
    return true;
  }

  const searchableText = normalizeSearchText(
    [
      vehicle.vehicleNumber,
      vehicle.licensePlate,
      vehicle.vehicleType,
      vehicle.category,
      vehicle.isSpecialVehicle ? "Sonderfahrzeug" : "normales Gerät",
      vehicle.notes,
      ...bars.flatMap((bar) => [
        bar.source === "manual"
          ? "Gerätedisposition manuell"
          : bar.source === "default"
            ? "Grundinfo Kolonne"
            : bar.sourceLabel,
        bar.projectNumber,
        bar.projectName,
        bar.crewName,
        bar.notes,
        ...(bar.detailLines ?? []),
        formatGermanDate(bar.startDate),
        formatGermanDate(bar.endDate),
      ]),
    ].join(" "),
  );

  return searchableText.includes(query);
}

function getBarClass(source: EquipmentBarSource) {
  if (source === "manual") {
    return "rounded-lg border border-blue-300 bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-950 shadow-sm ring-1 ring-blue-200";
  }

  if (source === "truck") {
    return "rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-950 shadow-sm ring-1 ring-emerald-200";
  }

  if (source === "special") {
    return "rounded-lg border border-violet-300 bg-violet-100 px-3 py-2 text-xs font-semibold text-violet-950 shadow-sm ring-1 ring-violet-200";
  }

  return "rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm";
}

function buildLaneLayout(bars: EquipmentRowBar[]) {
  const lanes = new Map<string, number>();
  const laneEndDates: Date[] = [];

  const sortedBars = [...bars].sort((a, b) => {
    const startCompare =
      normalizeDay(a.startDate).getTime() - normalizeDay(b.startDate).getTime();
    if (startCompare !== 0) return startCompare;
    const sourceCompare = getBarSourceSort(a.source) - getBarSourceSort(b.source);
    if (sourceCompare !== 0) return sourceCompare;
    return (
      normalizeDay(a.endDate).getTime() - normalizeDay(b.endDate).getTime()
    );
  });

  for (const bar of sortedBars) {
    const startTime = normalizeDay(bar.startDate).getTime();
    let laneIndex = laneEndDates.findIndex(
      (laneEndDate) => normalizeDay(laneEndDate).getTime() < startTime,
    );

    if (laneIndex === -1) {
      laneIndex = laneEndDates.length;
      laneEndDates.push(bar.endDate);
    } else {
      laneEndDates[laneIndex] = bar.endDate;
    }

    lanes.set(bar.id, laneIndex);
  }

  const laneCount = Math.max(1, laneEndDates.length);

  return {
    lanes,
    rowHeight: Math.max(
      TIMELINE_ROW_MIN_HEIGHT_PX,
      TIMELINE_TOP_OFFSET_PX +
        laneCount * TIMELINE_LANE_HEIGHT_PX +
        TIMELINE_BOTTOM_PADDING_PX,
    ),
  } satisfies LaneLayout;
}

function getBarSourceSort(source: EquipmentBarSource) {
  const order: Record<EquipmentBarSource, number> = {
    manual: 10,
    truck: 20,
    special: 30,
    default: 40,
  };

  return order[source];
}

function manualAssignmentOverlapsVehicle({
  vehicleId,
  startDate,
  endDate,
  manualBars,
}: {
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  manualBars: EquipmentRowBar[];
}) {
  return manualBars.some(
    (bar) =>
      bar.source === "manual" &&
      bar.vehicleId === vehicleId &&
      rangesOverlapInclusive(startDate, endDate, bar.startDate, bar.endDate),
  );
}

function buildDefaultBarsForCrewAssignment({
  vehicleId,
  timelineUnits,
  manualBars,
  assignment,
}: {
  vehicleId: string;
  timelineUnits: TimelineUnit[];
  manualBars: EquipmentRowBar[];
  assignment: {
    id: string;
    startDate: Date;
    endDate: Date;
    crewId: string | null;
    crewName: string;
    row: {
      projectId: string | null;
      projectNumber: string;
      projectName: string;
    };
  };
}) {
  const bars: EquipmentRowBar[] = [];
  let currentSegmentStart: Date | null = null;
  let currentSegmentEnd: Date | null = null;
  let segmentIndex = 0;

  const closeSegment = () => {
    if (!currentSegmentStart || !currentSegmentEnd) return;

    bars.push({
      id: `default-${assignment.id}-${vehicleId}-${segmentIndex}`,
      source: "default",
      sourceLabel: "Kolonnen-Grundinfo",
      vehicleId,
      startDate: currentSegmentStart,
      endDate: currentSegmentEnd,
      projectId: assignment.row.projectId,
      projectNumber: assignment.row.projectNumber,
      projectName: assignment.row.projectName,
      crewId: assignment.crewId,
      crewName: assignment.crewName,
      notes:
        "Grundinfo aus Kolonneneinteilung. Wird von der Gerätedisposition übersteuert.",
    });
    segmentIndex += 1;
    currentSegmentStart = null;
    currentSegmentEnd = null;
  };

  for (const unit of timelineUnits) {
    const unitEnd = addDays(unit.endDateExclusive, -1);
    const assignmentOverlapsUnit = rangesOverlapInclusive(
      assignment.startDate,
      assignment.endDate,
      unit.startDate,
      unitEnd,
    );

    const isManuallyOverridden = manualAssignmentOverlapsVehicle({
      vehicleId,
      startDate: unit.startDate,
      endDate: unitEnd,
      manualBars,
    });

    if (assignmentOverlapsUnit && !isManuallyOverridden) {
      if (!currentSegmentStart) {
        currentSegmentStart = unit.startDate;
      }
      currentSegmentEnd = unitEnd;
    } else {
      closeSegment();
    }
  }

  closeSegment();

  return bars;
}

function addEquipmentBarToVehicle(
  barsByVehicle: Map<string, EquipmentRowBar[]>,
  visibleVehicleIds: Set<string>,
  bar: EquipmentRowBar,
) {
  if (!visibleVehicleIds.has(bar.vehicleId)) {
    return false;
  }

  const vehicleBars = barsByVehicle.get(bar.vehicleId) ?? [];
  vehicleBars.push(bar);
  barsByVehicle.set(bar.vehicleId, vehicleBars);
  return true;
}

function getProjectNumber(value: string | null | undefined) {
  return value?.trim() || "ohne Projektnummer";
}

function getProjectName(value: string | null | undefined) {
  return value?.trim() || "ohne Baustelle";
}

function getEquipmentDetailLines(lines: Array<string | null | undefined>) {
  return lines
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
}

function formatTimeRange(startTime: string | null | undefined, endTime?: string | null) {
  const start = startTime?.trim();
  const end = endTime?.trim();

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start || end || null;
}

function formatOptionalQuantity(
  value: number | null | undefined,
  unit: string | null | undefined,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value)} ${unit?.trim() || ""}`.trim();
}

function getShortHaulHref(date: Date, assignmentId?: string) {
  const hash = assignmentId ? `#assignment-${assignmentId}` : "";
  return `/truck-dispatch/short-haul?date=${formatDateInput(date)}${hash}`;
}

function getLongHaulHref(date: Date) {
  return `/truck-dispatch/long-haul?week=${formatDateInput(startOfWeek(date))}`;
}

function getSpecialVehicleHref(date: Date) {
  return `/special-vehicle-dispatch?from=${formatDateInput(date)}&to=${formatDateInput(
    date,
  )}&view=days`;
}

export default async function EquipmentDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    view?: string;
    showWeekend?: string;
    focus?: string;
    q?: string;
    projectId?: string;
    vehicleNumber?: string;
    licensePlate?: string;
    vehicleType?: string;
    category?: string;
    specialVehicle?: string;
    assignmentSource?: string;
    showCars?: string;
    showSpecialVehicles?: string;
    showTrucks?: string;
    quickVehicleId?: string;
    quickStart?: string;
    quickEnd?: string;
  }>;
}) {
  const params = await searchParams;
  const view = getTimelineView(params.view);
  const showWeekend = params.showWeekend === "1";
  const filters: EquipmentDispatchFilters = {
    q: getFilterText(params.q),
    projectId: getFilterText(params.projectId),
    vehicleNumber: getFilterText(params.vehicleNumber),
    licensePlate: getFilterText(params.licensePlate),
    vehicleType: getFilterText(params.vehicleType),
    category: getFilterText(params.category),
    showCars: params.showCars === "1",
    showSpecialVehicles: params.showSpecialVehicles === "1",
    showTrucks: params.showTrucks === "1",
    specialVehicle: getSpecialVehicleFilter(params.specialVehicle),
    assignmentSource: getEquipmentSourceFilter(params.assignmentSource),
  };
  const { fromDate, toDate } = getSafeDateRange({
    from: params.from,
    to: params.to,
    view,
  });

  const focusDateFromParams = params.focus
    ? parseDateParam(params.focus)
    : fromDate;

  const quickVehicleId = String(params.quickVehicleId ?? "").trim();
  const quickStartDate = params.quickStart
    ? parseDateParam(params.quickStart)
    : fromDate;
  const quickEndDate = params.quickEnd
    ? parseDateParam(params.quickEnd)
    : quickStartDate;

  const { timelineFromDate, timelineToDate } = getVisibleDateRange({
    fromDate,
    toDate,
  });

  const timelineUnits = buildTimelineUnits({
    view,
    fromDate: timelineFromDate,
    toDate: timelineToDate,
    showWeekend,
  });

  const timelineUnitsForClient = timelineUnits.map((unit) => ({
    key: unit.key,
    label: unit.label,
    subLabel: unit.subLabel,
    defaultStartDate: unit.defaultStartDate,
    defaultEndDate: unit.defaultEndDate,
  }));

  const unitCount = timelineUnits.length;
  const periodStart = timelineUnits[0]?.startDate ?? timelineFromDate;
  const periodEndExclusive =
    timelineUnits[timelineUnits.length - 1]?.endDateExclusive ??
    addDays(timelineToDate, 1);

  const previousRange = shiftDateRange({
    fromDate,
    toDate,
    view,
    direction: -1,
  });
  const nextRange = shiftDateRange({ fromDate, toDate, view, direction: 1 });
  const todayRange = {
    fromDate:
      view === "months" ? startOfMonth(new Date()) : startOfWeek(new Date()),
    toDate:
      view === "months"
        ? endOfMonthInclusive(addMonths(startOfMonth(new Date()), 4))
        : addDays(startOfWeek(new Date()), 13),
  };

  const [
    vehicles,
    projects,
    crews,
    equipmentAssignments,
    crewPlanningAssignments,
    specialVehicleAssignments,
    shortHaulAssignments,
    truckLongHaulTruckAssignments,
    asphaltLoadAllocations,
    tackCoatLoadAllocations,
  ] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { isSpecialVehicle: "desc" },
        { category: "asc" },
        { vehicleNumber: "asc" },
      ],
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

    prisma.crew.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.equipmentDispatchAssignment.findMany({
      where: {
        startDate: {
          lt: periodEndExclusive,
        },
        endDate: {
          gte: periodStart,
        },
      },
      include: {
        vehicle: true,
        project: true,
        crew: true,
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),

    prisma.crewPlanningAssignment.findMany({
      where: {
        startDate: {
          lt: periodEndExclusive,
        },
        endDate: {
          gte: periodStart,
        },
      },
      include: {
        row: true,
        crew: {
          include: {
            defaultVehicles: {
              where: {
                isActive: true,
              },
              select: {
                vehicleId: true,
              },
            },
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { crewName: "asc" }],
    }),

    prisma.specialVehicleDispatchAssignment.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
        OR: [
          {
            vehicleId: {
              not: null,
            },
          },
          {
            transportVehicleId: {
              not: null,
            },
          },
        ],
      },
      include: {
        vehicle: true,
        transportVehicle: true,
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.shortHaulAssignment.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
        vehicleId: {
          not: null,
        },
      },
      include: {
        tours: {
          orderBy: [{ tourNumber: "asc" }],
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.truckLongHaulTruckAssignment.findMany({
      where: {
        vehicleId: {
          not: null,
        },
        entry: {
          workDate: {
            gte: periodStart,
            lt: periodEndExclusive,
          },
        },
      },
      include: {
        entry: true,
      },
      orderBy: [{ entry: { workDate: "asc" } }, { plannedStartTime: "asc" }],
    }),

    prisma.asphaltLoadAllocation.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
        vehicleId: {
          not: null,
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.tackCoatLoadAllocation.findMany({
      where: {
        workDate: {
          gte: periodStart,
          lt: periodEndExclusive,
        },
        vehicleId: {
          not: null,
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const quickVehicle = quickVehicleId
    ? vehicles.find((vehicle) => vehicle.id === quickVehicleId) ?? null
    : null;

  const manualBars: EquipmentRowBar[] = equipmentAssignments.map(
    (assignment) => ({
      id: `manual-${assignment.id}`,
      source: "manual",
      sourceLabel: "Gerätedisposition",
      vehicleId: assignment.vehicleId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      projectId: assignment.projectId,
      projectNumber: assignment.project.projectNumber,
      projectName: assignment.project.name,
      crewId: assignment.crewId,
      crewName: assignment.crew?.name ?? null,
      notes: assignment.notes,
      assignment: {
        id: assignment.id,
        vehicleId: assignment.vehicleId,
        projectId: assignment.projectId,
        crewId: assignment.crewId,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        notes: assignment.notes,
        project: assignment.project,
        crew: assignment.crew,
      },
    }),
  );

  const simpleFilteredVehicles = vehicles.filter((vehicle) =>
    vehicleMatchesSimpleFilters({
      vehicle,
      filters,
    }),
  );

  const visibleVehicleIds = new Set(
    simpleFilteredVehicles.map((vehicle) => vehicle.id),
  );

  const barsByVehicle = new Map<string, EquipmentRowBar[]>();
  const manualBarsByVehicle = new Map<string, EquipmentRowBar[]>();

  for (const bar of manualBars) {
    if (!visibleVehicleIds.has(bar.vehicleId)) {
      continue;
    }

    const vehicleBars = manualBarsByVehicle.get(bar.vehicleId) ?? [];
    vehicleBars.push(bar);
    manualBarsByVehicle.set(bar.vehicleId, vehicleBars);
  }

  for (const vehicle of simpleFilteredVehicles) {
    barsByVehicle.set(vehicle.id, [...(manualBarsByVehicle.get(vehicle.id) ?? [])]);
  }

  const externalBarCounts = {
    special: 0,
    truck: 0,
  };

  for (const assignment of specialVehicleAssignments) {
    const date = normalizeDay(assignment.workDate);
    const baseDetails = getEquipmentDetailLines([
      formatTimeRange(assignment.startTime, assignment.endTime)
        ? `Zeit: ${formatTimeRange(assignment.startTime, assignment.endTime)}`
        : null,
      assignment.taskText ? `Aufgabe: ${assignment.taskText}` : null,
      formatOptionalQuantity(assignment.quantity, assignment.quantityUnit)
        ? `Menge: ${formatOptionalQuantity(assignment.quantity, assignment.quantityUnit)}`
        : null,
      assignment.operatorDriverName
        ? `Bediener/Fahrer: ${assignment.operatorDriverName}`
        : null,
      assignment.transportVehicleName
        ? `Transport-LKW: ${assignment.transportVehicleName}`
        : null,
    ]);

    if (assignment.vehicleId) {
      const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
        id: `special-dispatch-${assignment.id}`,
        source: "special",
        sourceLabel: "Sonderfahrzeugdisposition",
        vehicleId: assignment.vehicleId,
        startDate: date,
        endDate: date,
        projectId: assignment.projectId,
        projectNumber: getProjectNumber(assignment.projectNumber),
        projectName: getProjectName(assignment.projectName),
        crewId: assignment.crewId,
        crewName: assignment.crewName,
        notes: assignment.notes || assignment.taskText || null,
        detailLines: baseDetails,
        href: getSpecialVehicleHref(date),
      });

      if (added) {
        externalBarCounts.special += 1;
      }
    }

    if (assignment.transportVehicleId) {
      const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
        id: `special-transport-${assignment.id}`,
        source: "truck",
        sourceLabel: "LKW für Sonderfahrzeug",
        vehicleId: assignment.transportVehicleId,
        startDate: date,
        endDate: date,
        projectId: assignment.projectId,
        projectNumber: getProjectNumber(assignment.projectNumber),
        projectName: getProjectName(assignment.projectName),
        crewId: assignment.crewId,
        crewName: assignment.crewName,
        notes: assignment.notes || assignment.taskText || null,
        detailLines: getEquipmentDetailLines([
          ...baseDetails,
          assignment.vehicleName ? `Sonderfahrzeug: ${assignment.vehicleName}` : null,
        ]),
        href: getSpecialVehicleHref(date),
      });

      if (added) {
        externalBarCounts.truck += 1;
      }
    }
  }

  for (const assignment of shortHaulAssignments) {
    if (!assignment.vehicleId) continue;

    const date = normalizeDay(assignment.workDate);
    const tours = assignment.tours.length > 0 ? assignment.tours : null;

    if (!tours) {
      const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
        id: `truck-short-${assignment.id}`,
        source: "truck",
        sourceLabel: "LKW Kurzstrecke",
        vehicleId: assignment.vehicleId,
        startDate: date,
        endDate: date,
        projectId: assignment.projectId,
        projectNumber: getProjectNumber(assignment.projectNumber),
        projectName: getProjectName(assignment.projectName),
        crewId: null,
        crewName: assignment.driverName,
        notes: assignment.notes || assignment.material || null,
        detailLines: getEquipmentDetailLines([
          assignment.startTime ? `Start: ${assignment.startTime}` : null,
          assignment.driverName ? `Fahrer: ${assignment.driverName}` : null,
          assignment.material ? `Material: ${assignment.material}` : null,
        ]),
        href: getShortHaulHref(date, assignment.id),
      });

      if (added) {
        externalBarCounts.truck += 1;
      }
      continue;
    }

    for (const tour of tours) {
      const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
        id: `truck-short-tour-${tour.id}`,
        source: "truck",
        sourceLabel: "LKW Kurzstrecke",
        vehicleId: assignment.vehicleId,
        startDate: date,
        endDate: date,
        projectId: tour.projectId ?? assignment.projectId,
        projectNumber: getProjectNumber(tour.projectNumber || assignment.projectNumber),
        projectName: getProjectName(tour.projectName || assignment.projectName),
        crewId: null,
        crewName: assignment.driverName,
        notes: tour.notes || assignment.notes || tour.material || null,
        detailLines: getEquipmentDetailLines([
          `Tour ${tour.tourNumber}`,
          formatTimeRange(tour.startTime, tour.endTime)
            ? `Zeit: ${formatTimeRange(tour.startTime, tour.endTime)}`
            : null,
          assignment.driverName ? `Fahrer: ${assignment.driverName}` : null,
          tour.itemName || tour.customPurpose
            ? `Zweck: ${tour.itemName || tour.customPurpose}`
            : null,
          formatOptionalQuantity(tour.quantity, tour.quantityUnit)
            ? `Menge: ${formatOptionalQuantity(tour.quantity, tour.quantityUnit)}`
            : null,
          tour.material ? `Material: ${tour.material}` : null,
        ]),
        href: getShortHaulHref(date, assignment.id),
      });

      if (added) {
        externalBarCounts.truck += 1;
      }
    }
  }

  for (const truckAssignment of truckLongHaulTruckAssignments) {
    if (!truckAssignment.vehicleId) continue;

    const date = normalizeDay(truckAssignment.entry.workDate);
    const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
      id: `truck-long-${truckAssignment.id}`,
      source: "truck",
      sourceLabel: "LKW Langstrecke",
      vehicleId: truckAssignment.vehicleId,
      startDate: date,
      endDate: date,
      projectId: truckAssignment.entry.projectId,
      projectNumber: getProjectNumber(truckAssignment.entry.projectNumber),
      projectName: getProjectName(truckAssignment.entry.projectName),
      crewId: null,
      crewName: truckAssignment.driverName,
      notes:
        truckAssignment.plannedNotes ||
        truckAssignment.notes ||
        truckAssignment.entry.notes ||
        null,
      detailLines: getEquipmentDetailLines([
        formatTimeRange(
          truckAssignment.plannedStartTime,
          truckAssignment.plannedEndTime,
        )
          ? `Zeit: ${formatTimeRange(
              truckAssignment.plannedStartTime,
              truckAssignment.plannedEndTime,
            )}`
          : null,
        truckAssignment.driverName ? `Fahrer: ${truckAssignment.driverName}` : null,
        truckAssignment.entry.materialName
          ? `Material: ${truckAssignment.entry.materialName}`
          : null,
        truckAssignment.plannedTourCount > 0
          ? `Geplant: ${truckAssignment.plannedTourCount} Touren`
          : null,
        truckAssignment.plannedTotalTons > 0
          ? `Menge: ${formatOptionalQuantity(
              truckAssignment.plannedTotalTons,
              "t",
            )}`
          : null,
      ]),
      href: getLongHaulHref(date),
    });

    if (added) {
      externalBarCounts.truck += 1;
    }
  }

  for (const allocation of asphaltLoadAllocations) {
    if (!allocation.vehicleId) continue;

    const date = normalizeDay(allocation.workDate);
    const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
      id: `truck-asphalt-${allocation.id}`,
      source: "truck",
      sourceLabel: "Asphaltlieferung",
      vehicleId: allocation.vehicleId,
      startDate: date,
      endDate: date,
      projectId: allocation.projectId,
      projectNumber: getProjectNumber(allocation.projectNumber),
      projectName: getProjectName(allocation.projectName),
      crewId: null,
      crewName: allocation.driverName,
      notes: allocation.notes,
      detailLines: getEquipmentDetailLines([
        formatTimeRange(allocation.startTime, allocation.endTime)
          ? `Zeit: ${formatTimeRange(allocation.startTime, allocation.endTime)}`
          : null,
        allocation.driverName ? `Fahrer: ${allocation.driverName}` : null,
        allocation.asphaltMixNumber || allocation.asphaltMixName
          ? `Asphalt: ${[allocation.asphaltMixNumber, allocation.asphaltMixName]
              .filter(Boolean)
              .join(" · ")}`
          : null,
        allocation.tourCount > 0 ? `Touren: ${allocation.tourCount}` : null,
        allocation.totalTons > 0
          ? `Menge: ${formatOptionalQuantity(allocation.totalTons, "t")}`
          : null,
      ]),
      href:
        allocation.sourceType === "LONG"
          ? getLongHaulHref(date)
          : getShortHaulHref(date, allocation.shortHaulAssignmentId ?? undefined),
    });

    if (added) {
      externalBarCounts.truck += 1;
    }
  }

  for (const allocation of tackCoatLoadAllocations) {
    if (!allocation.vehicleId) continue;

    const date = normalizeDay(allocation.workDate);
    const added = addEquipmentBarToVehicle(barsByVehicle, visibleVehicleIds, {
      id: `truck-tack-${allocation.id}`,
      source: "truck",
      sourceLabel: "Anspritzmitteltransport",
      vehicleId: allocation.vehicleId,
      startDate: date,
      endDate: date,
      projectId: allocation.projectId,
      projectNumber: getProjectNumber(allocation.projectNumber),
      projectName: getProjectName(allocation.projectName),
      crewId: null,
      crewName: allocation.driverName,
      notes: allocation.notes,
      detailLines: getEquipmentDetailLines([
        formatTimeRange(allocation.startTime, allocation.endTime)
          ? `Zeit: ${formatTimeRange(allocation.startTime, allocation.endTime)}`
          : null,
        allocation.driverName ? `Fahrer: ${allocation.driverName}` : null,
        allocation.materialName ? `Anspritzmittel: ${allocation.materialName}` : null,
        allocation.tourCount > 0 ? `Touren: ${allocation.tourCount}` : null,
        allocation.totalLiters > 0
          ? `Menge: ${formatOptionalQuantity(
              allocation.totalLiters,
              allocation.quantityUnit,
            )}`
          : null,
      ]),
      href: getShortHaulHref(date, allocation.shortHaulAssignmentId ?? undefined),
    });

    if (added) {
      externalBarCounts.truck += 1;
    }
  }

  for (const assignment of crewPlanningAssignments) {
    const defaultVehicles = assignment.crew?.defaultVehicles ?? [];

    for (const defaultVehicle of defaultVehicles) {
      if (!visibleVehicleIds.has(defaultVehicle.vehicleId)) {
        continue;
      }

      const defaultBars = buildDefaultBarsForCrewAssignment({
        vehicleId: defaultVehicle.vehicleId,
        timelineUnits,
        manualBars: manualBarsByVehicle.get(defaultVehicle.vehicleId) ?? [],
        assignment,
      });

      if (defaultBars.length === 0) {
        continue;
      }

      const vehicleBars = barsByVehicle.get(defaultVehicle.vehicleId) ?? [];
      vehicleBars.push(...defaultBars);
      barsByVehicle.set(defaultVehicle.vehicleId, vehicleBars);
    }
  }

  const vehicleNumberOptions = getUniqueOptions(
    vehicles.map((vehicle) => vehicle.vehicleNumber),
  );
  const vehicleTypeOptions = getUniqueOptions(
    vehicles.map((vehicle) => vehicle.vehicleType),
  );
  const vehicleCategoryOptions = getUniqueOptions(
    vehicles.map((vehicle) => vehicle.category),
  );
  const projectFilterOptions = projects.map((project) => ({
    id: project.id,
    label: `${project.projectNumber} · ${project.name}`,
  }));

  const filteredVehicles = simpleFilteredVehicles.filter((vehicle) =>
    vehicleMatchesFilters({
      vehicle,
      bars: barsByVehicle.get(vehicle.id) ?? [],
      filters,
    }),
  );

  const activeFilterCount = [
    filters.q,
    filters.projectId,
    filters.vehicleNumber,
    filters.licensePlate,
    filters.vehicleType,
    filters.category,
    filters.assignmentSource !== "all" ? filters.assignmentSource : "",
    filters.showCars ? "showCars" : "",
    filters.showSpecialVehicles ? "showSpecialVehicles" : "",
    filters.showTrucks ? "showTrucks" : "",
  ].filter(Boolean).length;

  const rowLayouts = new Map<string, LaneLayout>();

  for (const vehicle of filteredVehicles) {
    rowLayouts.set(
      vehicle.id,
      buildLaneLayout(barsByVehicle.get(vehicle.id) ?? []),
    );
  }

  const timelineGridColumns = getTimelineGridColumns(view, unitCount);
  const timelineMinWidth = getTimelineMinWidth(view, unitCount);
  const timelineContentMinWidth = unitCount <= 14 ? "100%" : `${timelineMinWidth}px`;
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
    {
      label: "5M",
      fromDate: startOfMonth(fromDate),
      toDate: endOfMonthInclusive(addMonths(startOfMonth(fromDate), 4)),
    },
  ];

  return (
    <AppShell
      title="Gerätedisposition"
      description="Geräte und Maschinen auf Baustellen disponieren. Manuelle Gerätedisposition hat Vorrang vor Standardgeräten der Kolonne."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Geräte sichtbar"
          value={`${filteredVehicles.length}/${vehicles.length}`}
        />
        <SummaryCard
          label="Manuelle Dispo"
          value={String(equipmentAssignments.length)}
        />
        <SummaryCard
          label="LKW-Dispo sichtbar"
          value={String(externalBarCounts.truck)}
        />
        <SummaryCard
          label="Sonderfahrzeug-Dispo sichtbar"
          value={String(externalBarCounts.special)}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/crew-dispatch"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Kolonneneinteilung öffnen →
        </Link>

        <Link
          href="/admin/vehicles"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Geräte/Fahrzeuge öffnen
        </Link>

        <Link
          href="/admin/crews"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Kolonnen öffnen
        </Link>
      </div>

      <details
        id="equipment-quick-add"
        open={Boolean(quickVehicle)}
        className={
          quickVehicle
            ? "mb-6 scroll-mt-24 rounded-2xl border border-blue-300 bg-blue-50 p-6 shadow-sm ring-2 ring-blue-100"
            : "mb-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        }
      >
        <summary className="cursor-pointer text-xl font-semibold text-gray-900">
          {quickVehicle
            ? `+ ${getVehicleLabel(quickVehicle)} disponieren`
            : "+ Gerät auf Baustelle disponieren"}
        </summary>

        {quickVehicle ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-950">
            Gerät und Datum sind aus dem angeklickten Plus-Feld vorbelegt. Bitte nur noch Baustelle wählen und speichern.
          </div>
        ) : null}

        <EquipmentAssignmentForm
          action={createEquipmentDispatchAssignment}
          vehicles={vehicles}
          projects={projects}
          crews={crews}
          fixedVehicleId={quickVehicle?.id}
          fixedVehicleLabel={quickVehicle ? getVehicleLabel(quickVehicle) : undefined}
          defaultVehicleId={quickVehicle?.id ?? ""}
          defaultStartDate={formatDateInput(quickStartDate)}
          defaultEndDate={formatDateInput(quickEndDate)}
        />
      </details>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-950">
        Blaue Balken sind manuelle Gerätedispositionen und haben Vorrang. Graue
        gestrichelte Balken sind nur Grundinfo aus der Kolonneneinteilung und
        werden durch manuelle Dispo automatisch ausgeblendet. Grüne Balken kommen
        aus der LKW-Disposition, violette Balken aus der Sonderfahrzeugdisposition.
      </div>

      <form
        action="/equipment-dispatch"
        className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="from" value={formatDateInput(fromDate)} />
        <input type="hidden" name="to" value={formatDateInput(toDate)} />
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="focus" value={formatDateInput(focusDateFromParams)} />
        {showWeekend ? (
          <input type="hidden" name="showWeekend" value="1" />
        ) : null}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Geräte filtern
            </div>
            <label className="mt-2 block text-sm font-semibold text-gray-800">
              Schnellsuche
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="z.B. Bagger, Walze, 105, AB-ST, Sonderfahrzeug, Baustelle, Kolonne"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>

          <div className="text-sm font-semibold text-gray-600">
            {filteredVehicles.length} von {vehicles.length} Geräten sichtbar
            {activeFilterCount > 0
              ? ` · ${activeFilterCount} Filter aktiv`
              : ""}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-xs font-semibold text-gray-700">
            Baustelle / Projekt
            <select
              name="projectId"
              defaultValue={filters.projectId}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value="">Alle Baustellen</option>
              {projectFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-700">
            Fahrzeugnummer
            <select
              name="vehicleNumber"
              defaultValue={filters.vehicleNumber}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value="">Alle Fahrzeugnummern</option>
              {vehicleNumberOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-700">
            Kennzeichen
            <input
              name="licensePlate"
              defaultValue={filters.licensePlate}
              placeholder="Kennzeichen suchen"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="text-xs font-semibold text-gray-700">
            Gerätetyp
            <select
              name="vehicleType"
              defaultValue={filters.vehicleType}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value="">Alle Gerätetypen</option>
              {vehicleTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-700">
            Kategorie
            <select
              name="category"
              defaultValue={filters.category}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value="">Alle Kategorien</option>
              {vehicleCategoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold text-gray-700">
            Belegung
            <select
              name="assignmentSource"
              defaultValue={filters.assignmentSource}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
            >
              <option value="all">Alle Belegungen</option>
              <option value="manual">Nur manuelle Dispo</option>
              <option value="default">Nur Kolonnen-Grundinfo</option>
              <option value="truck">Nur LKW-Dispo</option>
              <option value="special">Nur Sonderfahrzeug-Dispo</option>
              <option value="empty">Ohne sichtbare Belegung</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              name="showTrucks"
              type="checkbox"
              value="1"
              defaultChecked={shouldShowTrucks(filters)}
              className="h-4 w-4 rounded border-gray-300"
            />
            LKW aus LKW-/Asphaltdispo anzeigen
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              name="showSpecialVehicles"
              type="checkbox"
              value="1"
              defaultChecked={shouldShowSpecialVehicles(filters)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Sonderfahrzeuge anzeigen
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <input
              name="showCars"
              type="checkbox"
              value="1"
              defaultChecked={shouldShowCars(filters)}
              className="h-4 w-4 rounded border-gray-300"
            />
            PKW anzeigen
          </label>
          <span className="text-xs font-medium text-gray-500">
            Standardmäßig bleiben diese Gruppen ausgeblendet, damit die Geräteliste kompakt bleibt.
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Suchen / Filtern
          </button>
          <Link
            href={buildEquipmentDispatchHref({
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

      <div className="max-w-full overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Gerätedisposition ·{" "}
                {view === "months"
                  ? "Monate"
                  : view === "weeks"
                    ? "Wochen"
                    : "Tage"}
              </div>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {formatGermanDate(fromDate)} – {formatGermanDate(toDate)}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Arbeitsbereich: {formatGermanDate(fromDate)} – {formatGermanDate(toDate)} ·
                Fokus: {formatShortDate(focusDateFromParams)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildEquipmentDispatchHref({
                  fromDate: previousRange.fromDate,
                  toDate: previousRange.toDate,
                  view,
                  showWeekend,
                  filters,
                })}
                scroll={false}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                ← zurück
              </Link>

              <Link
                href={buildEquipmentDispatchHref({
                  fromDate: todayRange.fromDate,
                  toDate: todayRange.toDate,
                  view,
                  showWeekend,
                  filters,
                })}
                scroll={false}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Heute
              </Link>

              <Link
                href={buildEquipmentDispatchHref({
                  fromDate: nextRange.fromDate,
                  toDate: nextRange.toDate,
                  view,
                  showWeekend,
                  filters,
                })}
                scroll={false}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                weiter →
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["days", "weeks", "months"] as TimelineView[]).map((item) => (
              <Link
                key={item}
                href={buildEquipmentDispatchHref({
                  fromDate,
                  toDate,
                  view: item,
                  showWeekend,
                  filters,
                })}
                scroll={false}
                className={
                  view === item
                    ? "rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                }
              >
                {item === "days"
                  ? "Tage"
                  : item === "weeks"
                    ? "Wochen"
                    : "Monate"}
              </Link>
            ))}

            {view !== "months" ? (
              <Link
                href={buildEquipmentDispatchHref({
                  fromDate,
                  toDate,
                  view,
                  showWeekend: !showWeekend,
                  filters,
                })}
                scroll={false}
                className={
                  showWeekend
                    ? "rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                }
              >
                {showWeekend ? "Sa/So ausblenden" : "Sa/So anzeigen"}
              </Link>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2">
            <span className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Zeitstrahl
            </span>
            {timelineRangePresets.map((preset) => (
              <Link
                key={preset.label}
                href={buildEquipmentDispatchHref({
                  fromDate: preset.fromDate,
                  toDate: preset.toDate,
                  view: preset.label === "5M" ? "months" : view === "months" ? "days" : view,
                  showWeekend,
                  filters,
                })}
                scroll={false}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
              >
                {preset.label}
              </Link>
            ))}
            <span className="text-xs font-medium text-gray-500">
              oder unten Von/Bis frei wählen
            </span>
          </div>

          <form
            action="/equipment-dispatch"
            className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"
          >
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="focus" value={formatDateInput(fromDate)} />
            {showWeekend ? (
              <input type="hidden" name="showWeekend" value="1" />
            ) : null}
            {filters.q ? (
              <input type="hidden" name="q" value={filters.q} />
            ) : null}
            {filters.projectId ? (
              <input type="hidden" name="projectId" value={filters.projectId} />
            ) : null}
            {filters.vehicleNumber ? (
              <input
                type="hidden"
                name="vehicleNumber"
                value={filters.vehicleNumber}
              />
            ) : null}
            {filters.licensePlate ? (
              <input
                type="hidden"
                name="licensePlate"
                value={filters.licensePlate}
              />
            ) : null}
            {filters.vehicleType ? (
              <input
                type="hidden"
                name="vehicleType"
                value={filters.vehicleType}
              />
            ) : null}
            {filters.category ? (
              <input type="hidden" name="category" value={filters.category} />
            ) : null}
            {filters.specialVehicle !== "all" ? (
              <input
                type="hidden"
                name="specialVehicle"
                value={filters.specialVehicle}
              />
            ) : null}
            {filters.assignmentSource !== "all" ? (
              <input
                type="hidden"
                name="assignmentSource"
                value={filters.assignmentSource}
              />
            ) : null}
            {filters.showTrucks ? (
              <input type="hidden" name="showTrucks" value="1" />
            ) : null}
            {filters.showSpecialVehicles ? (
              <input type="hidden" name="showSpecialVehicles" value="1" />
            ) : null}
            {filters.showCars ? (
              <input type="hidden" name="showCars" value="1" />
            ) : null}
            <label className="text-xs font-semibold text-blue-950">
              Von
              <input
                name="from"
                type="date"
                defaultValue={formatDateInput(fromDate)}
                className="mt-1 block rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-900"
              />
            </label>
            <label className="text-xs font-semibold text-blue-950">
              Bis
              <input
                name="to"
                type="date"
                defaultValue={formatDateInput(toDate)}
                className="mt-1 block rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-900"
              />
            </label>
            <div className="max-w-[360px] text-[11px] font-medium leading-4 text-blue-800">
              Von/Bis ist der exakt sichtbare Bereich. Bei kurzen Zeiträumen wird die Breite an den Bildschirm angepasst; verschoben wird über Zurück/Weiter, Heute oder neue Von/Bis-Werte.
            </div>
            <button
              type="submit"
              className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              Öffnen
            </button>
          </form>

          <div
            className="mt-4 -mx-4 grid border-t border-gray-200 bg-white shadow-sm"
            style={{
              gridTemplateColumns: `${LEFT_COLUMN_WIDTH_PX}px minmax(0, 1fr)`,
            }}
          >
            <div className="flex min-h-[64px] items-center border-r border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Gerät / Maschine
            </div>
            <div data-equipment-timeline-header-scroll className="min-w-0 overflow-hidden border-b border-gray-200 bg-gray-50">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: timelineGridColumns,
                  minWidth: timelineContentMinWidth,
                }}
              >
                {timelineUnits.map((unit) => (
                  <div
                    key={unit.key}
                    data-timeline-date={unit.defaultStartDate}
                    className="flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-center last:border-r-0"
                  >
                    <div
                      className="truncate text-xs font-bold text-gray-900"
                      title={unit.label}
                    >
                      {unit.label}
                    </div>
                    <div
                      className="mt-1 truncate text-[11px] text-gray-500"
                      title={unit.subLabel}
                    >
                      {unit.subLabel}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `${LEFT_COLUMN_WIDTH_PX}px minmax(0, 1fr)`,
          }}
        >
          <div className="border-r border-gray-200 bg-white">
            {filteredVehicles.length === 0 ? (
              <div className="p-10 text-center text-sm font-medium text-gray-500">
                Keine Geräte passen zu den aktuellen Filtern.
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const rowHeight =
                  rowLayouts.get(vehicle.id)?.rowHeight ??
                  TIMELINE_ROW_MIN_HEIGHT_PX;

                return (
                  <div
                    key={vehicle.id}
                    className="border-b border-gray-200 bg-white p-3"
                    style={{
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  >
                    <div className="truncate text-sm font-bold text-gray-900">
                      {vehicle.vehicleNumber} · {vehicle.licensePlate ?? "-"}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-gray-600">
                      {vehicle.category} · {vehicle.vehicleType}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {vehicle.isSpecialVehicle ? (
                        <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900">
                          Sonderfahrzeug
                        </span>
                      ) : null}
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {(barsByVehicle.get(vehicle.id) ?? []).length} Balken
                      </span>
                    </div>
                    {vehicle.notes ? (
                      <div className="mt-2 line-clamp-3 text-xs text-gray-500">
                        {vehicle.notes}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <EquipmentTimelineScroll focusDate={formatDateInput(focusDateFromParams)}>
            <div
              className="grid"
              style={{
                gridTemplateColumns: timelineGridColumns,
                minWidth: timelineContentMinWidth,
              }}
            >
              {filteredVehicles.map((vehicle) => {
                const bars = barsByVehicle.get(vehicle.id) ?? [];
                const rowLayout = rowLayouts.get(vehicle.id);
                const rowHeight =
                  rowLayout?.rowHeight ?? TIMELINE_ROW_MIN_HEIGHT_PX;

                return (
                  <div
                    key={vehicle.id}
                    data-time-grid="true"
                    className="relative grid min-w-0 border-b border-gray-100 bg-white"
                    style={{
                      gridColumn: `1 / span ${timelineUnits.length}`,
                      gridTemplateColumns: timelineGridColumns,
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  >
                    {timelineUnits.map((unit) => (
                      <div
                        key={`${vehicle.id}-${unit.key}`}
                        className="min-w-0 border-r border-gray-100 p-1 last:border-r-0"
                        style={{
                          height: `${rowHeight}px`,
                          minHeight: `${rowHeight}px`,
                        }}
                      >
                        <Link
                          href={buildEquipmentQuickAddHref({
                            fromDate,
                            toDate,
                            view,
                            showWeekend,
                            filters,
                            vehicleId: vehicle.id,
                            startDate: unit.startDate,
                            endDate: addDays(unit.endDateExclusive, -1),
                          })}
                          className={getPlusButtonClass(unitCount)}
                          title={`+ Gerät disponieren: ${getVehicleLabel(
                            vehicle,
                          )} · ${unit.label} ${unit.subLabel}`}
                        >
                          +
                        </Link>
                      </div>
                    ))}

                    <div
                      className="pointer-events-none absolute inset-0 grid p-1"
                      style={{ gridTemplateColumns: timelineGridColumns }}
                    >
                      {bars.map((bar) => {
                        const laneIndex = rowLayout?.lanes.get(bar.id) ?? 0;
                        const topOffsetPx =
                          TIMELINE_TOP_OFFSET_PX +
                          laneIndex * TIMELINE_LANE_HEIGHT_PX;
                        const title = `${bar.projectNumber} · ${bar.projectName}`;

                        if (bar.source === "manual" && bar.assignment) {
                          const assignment = bar.assignment;

                          return (
                            <EquipmentAssignmentBar
                              key={bar.id}
                              id={assignment.id}
                              crewName={title}
                              crewTypeValue="equipment"
                              startDate={formatDateInput(assignment.startDate)}
                              endDate={formatDateInput(assignment.endDate)}
                              timelineUnits={timelineUnitsForClient}
                              unitCount={unitCount}
                              topOffsetPx={topOffsetPx}
                              barClassName={getBarClass("manual")}
                            >
                              <div className="absolute z-40 mt-2 w-[460px] max-w-[calc(100vw-3rem)] rounded-xl border border-blue-200 bg-white p-4 text-gray-900 shadow-xl">
                                <div className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900">
                                  Gerätedisposition
                                </div>
                                <div className="mt-3 text-sm font-bold text-gray-900">
                                  {title}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {getVehicleLabel(vehicle)}
                                </div>
                                <div className="mt-2 text-xs font-medium text-gray-600">
                                  {formatGermanDate(assignment.startDate)} –{" "}
                                  {formatGermanDate(assignment.endDate)}
                                </div>
                                {assignment.crew ? (
                                  <div className="mt-2 text-xs text-gray-600">
                                    Kolonne/Polier: {assignment.crew.name}
                                  </div>
                                ) : null}
                                {assignment.notes ? (
                                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                    {assignment.notes}
                                  </div>
                                ) : null}

                                <EquipmentAssignmentForm
                                  action={updateEquipmentDispatchAssignment}
                                  id={assignment.id}
                                  vehicles={vehicles}
                                  projects={projects}
                                  crews={crews}
                                  defaultVehicleId={assignment.vehicleId}
                                  defaultProjectId={assignment.projectId}
                                  defaultCrewId={assignment.crewId ?? ""}
                                  defaultStartDate={formatDateInput(
                                    assignment.startDate,
                                  )}
                                  defaultEndDate={formatDateInput(
                                    assignment.endDate,
                                  )}
                                  defaultNotes={assignment.notes ?? ""}
                                />

                                <form
                                  action={deleteEquipmentDispatchAssignment}
                                  className="mt-3"
                                >
                                  <input
                                    type="hidden"
                                    name="id"
                                    value={assignment.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                                  >
                                    Zuweisung löschen
                                  </button>
                                </form>
                              </div>
                            </EquipmentAssignmentBar>
                          );
                        }

                        if (bar.source === "truck" || bar.source === "special") {
                          return (
                            <EquipmentAssignmentBar
                              key={bar.id}
                              id={bar.id}
                              crewName={title}
                              crewTypeValue={`equipment-${bar.source}`}
                              startDate={formatDateInput(bar.startDate)}
                              endDate={formatDateInput(bar.endDate)}
                              timelineUnits={timelineUnitsForClient}
                              unitCount={unitCount}
                              topOffsetPx={topOffsetPx}
                              barClassName={getBarClass(bar.source)}
                              readOnly
                            >
                              <div
                                className={`absolute z-40 mt-2 w-[440px] max-w-[calc(100vw-3rem)] rounded-xl border bg-white p-4 text-gray-900 shadow-xl ${
                                  bar.source === "truck"
                                    ? "border-emerald-200"
                                    : "border-violet-200"
                                }`}
                              >
                                <div
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                    bar.source === "truck"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-violet-100 text-violet-900"
                                  }`}
                                >
                                  {bar.sourceLabel}
                                </div>
                                <div className="mt-3 text-sm font-bold text-gray-900">
                                  {title}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {getVehicleLabel(vehicle)}
                                </div>
                                <div className="mt-2 text-xs font-medium text-gray-600">
                                  {formatGermanDate(bar.startDate)}
                                  {bar.startDate.getTime() !== bar.endDate.getTime()
                                    ? ` – ${formatGermanDate(bar.endDate)}`
                                    : ""}
                                </div>
                                {bar.crewName ? (
                                  <div className="mt-2 text-xs text-gray-600">
                                    Fahrer/Kolonne: {bar.crewName}
                                  </div>
                                ) : null}
                                {bar.detailLines && bar.detailLines.length > 0 ? (
                                  <div className="mt-3 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                    {bar.detailLines.map((line) => (
                                      <div key={line}>{line}</div>
                                    ))}
                                  </div>
                                ) : null}
                                {bar.notes ? (
                                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                    {bar.notes}
                                  </div>
                                ) : null}
                                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                                  Dieser Balken kommt aus einer anderen Disposition
                                  und wird hier nur angezeigt.
                                </div>
                                {bar.href ? (
                                  <Link
                                    href={bar.href}
                                    className="mt-3 inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                                  >
                                    Führende Dispo öffnen
                                  </Link>
                                ) : null}
                              </div>
                            </EquipmentAssignmentBar>
                          );
                        }

                        if (!bar.projectId) {
                          const gridColumn = getTimelineGridColumnForDateRange({
                            startDate: bar.startDate,
                            endDate: bar.endDate,
                            timelineUnits,
                          });

                          if (!gridColumn) return null;

                          return (
                            <div
                              key={bar.id}
                              className="pointer-events-auto relative z-10 min-w-0 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm"
                              style={{
                                gridColumn,
                                gridRow: 1,
                                alignSelf: "start",
                                marginTop: `${topOffsetPx}px`,
                              }}
                              title={`${title}\n${formatGermanDate(bar.startDate)} – ${formatGermanDate(bar.endDate)}\n${bar.notes ?? "Grundinfo aus Kolonneneinteilung"}`}
                            >
                              <div className="truncate">{title}</div>
                              <div className="mt-0.5 truncate font-medium opacity-80">
                                aus Kolonne {bar.crewName ?? "-"}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <EquipmentAssignmentBar
                            key={bar.id}
                            id={bar.id}
                            crewName={title}
                            crewTypeValue="equipment-default"
                            startDate={formatDateInput(bar.startDate)}
                            endDate={formatDateInput(bar.endDate)}
                            timelineUnits={timelineUnitsForClient}
                            unitCount={unitCount}
                            topOffsetPx={topOffsetPx}
                            barClassName={getBarClass("default")}
                            dragCreatePayload={{
                              vehicleId: bar.vehicleId,
                              projectId: bar.projectId,
                              crewId: bar.crewId,
                              notes:
                                "Aus Kolonnen-Grundinfo in die Gerätedisposition übernommen.",
                            }}
                          >
                            <div className="absolute z-40 mt-2 w-[440px] max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl">
                              <div className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                Kolonnen-Grundinfo
                              </div>
                              <div className="mt-3 text-sm font-bold text-gray-900">
                                {title}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {getVehicleLabel(vehicle)}
                              </div>
                              <div className="mt-2 text-xs font-medium text-gray-600">
                                {formatGermanDate(bar.startDate)} – {" "}
                                {formatGermanDate(bar.endDate)}
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                Kolonne: {bar.crewName ?? "-"}
                              </div>
                              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900">
                                Ziehen oder Rand ziehen übernimmt diese Grundinfo
                                als manuelle Gerätedisposition. Danach hat sie
                                Vorrang vor der Kolonnen-Standardzuordnung.
                              </div>
                            </div>
                          </EquipmentAssignmentBar>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </EquipmentTimelineScroll>
        </div>
      </div>
    </AppShell>
  );
}

function EquipmentAssignmentForm({
  action,
  id,
  vehicles,
  projects,
  crews,
  defaultVehicleId = "",
  fixedVehicleId,
  fixedVehicleLabel,
  defaultProjectId = "",
  defaultCrewId = "",
  defaultStartDate,
  defaultEndDate,
  defaultNotes = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  vehicles: {
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
  projects: {
    id: string;
    projectNumber: string;
    name: string;
  }[];
  crews: {
    id: string;
    name: string;
  }[];
  defaultVehicleId?: string;
  fixedVehicleId?: string;
  fixedVehicleLabel?: string;
  defaultProjectId?: string;
  defaultCrewId?: string;
  defaultStartDate: string;
  defaultEndDate: string;
  defaultNotes?: string;
}) {
  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {fixedVehicleId ? (
        <label className="block text-sm font-medium text-gray-800">
          Gerät / Maschine
          <input type="hidden" name="vehicleId" value={fixedVehicleId} />
          <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
            {fixedVehicleLabel ?? "festes Gerät"}
          </div>
        </label>
      ) : (
        <label className="block text-sm font-medium text-gray-800">
          Gerät / Maschine
          <select
            name="vehicleId"
            required
            defaultValue={defaultVehicleId}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="" disabled>
              Gerät wählen
            </option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {getVehicleLabel(vehicle)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-sm font-medium text-gray-800">
        Baustelle
        <select
          name="projectId"
          required
          defaultValue={defaultProjectId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="" disabled>
            Baustelle wählen
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Kolonne / Polier optional
        <select
          name="crewId"
          defaultValue={defaultCrewId}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Keine Kolonne gewählt</option>
          {crews.map((crew) => (
            <option key={crew.id} value={crew.id}>
              {crew.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-800">
          Von
          <input
            name="startDate"
            type="date"
            required
            defaultValue={defaultStartDate}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Bis
          <input
            name="endDate"
            type="date"
            required
            defaultValue={defaultEndDate}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-800 md:col-span-2">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
