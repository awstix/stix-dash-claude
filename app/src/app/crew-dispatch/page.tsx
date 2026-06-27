import { Fragment } from "react";
import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createCrewPlanningRow, deleteCrewPlanningAssignment } from "./actions";
import { CrewAssignmentBar } from "./CrewAssignmentBar";
import { CrewPlanningAssignmentFormClient } from "./CrewPlanningAssignmentFormClient";
import { CrewPopover } from "./CrewPopover";
import { CrewTimelineFocusButton } from "./CrewTimelineFocusButton";
import { CrewTimelineScroll } from "./CrewTimelineScroll";
import { CrewTimelineMouseTooltip } from "./CrewTimelineMouseTooltip";
import { DismissibleDetails } from "./DismissibleDetails";
import { CrewDispatchStickyOffset } from "./CrewDispatchStickyOffset";

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

type TimelineView = "days" | "weeks" | "months";
type PlanningAxis =
  | "projects"
  | "employees"
  | "teams"
  | "equipment"
  | "specialEquipment";
type TimelineRange =
  | "7d"
  | "14d"
  | "21d"
  | "3w"
  | "6w"
  | "9w"
  | "4m"
  | "8m"
  | "12m"
  | "custom";
type CustomUnit = "days" | "weeks" | "months";

const planningAxisTabs: { value: PlanningAxis; label: string }[] = [
  { value: "projects", label: "Projekte" },
  { value: "employees", label: "Mitarbeiter" },
  { value: "teams", label: "Teams" },
  { value: "equipment", label: "Geräte" },
  { value: "specialEquipment", label: "Sondergeräte" },
];

type TimelineUnit = {
  key: string;
  label: string;
  subLabel: string;
  startDate: Date;
  endDateExclusive: Date;
  defaultStartDate: string;
  defaultEndDate: string;
};

type AsphaltDispatchEntryForTimeline = {
  id: string;
  workDate: Date;
  crew: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  quantityTons: number;
  isForeignMix: boolean;
  notes: string | null;
};

type AsphaltTimelineBar = {
  id: string;
  crewName: string;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  constructionManager: string | null;
  startDate: Date;
  endDate: Date;
  quantityTons: number;
  entryCount: number;
  mixLabels: string[];
  hasForeignMix: boolean;
  notes: string[];
};

type CrewTimelineLaneLayout = {
  laneCount: number;
  rowHeight: number;
  laneHeight: number;
  assignmentLanes: Map<string, number>;
  asphaltLanes: Map<string, number>;
};

type CrewTimelineLaneItem = {
  id: string;
  kind: "assignment" | "asphalt";
  startDate: Date;
  endDate: Date;
};

type PlanningAxisRow = {
  id: string;
  label: string;
  subLabel?: string;
  href?: string;
};

type PlanningAxisBar = {
  id: string;
  rowId: string;
  title: string;
  subtitle?: string;
  startDate: Date;
  endDate: Date;
  tone: "project" | "employee" | "equipment" | "special";
};

type CrewDispatchMaterialItem = {
  id: string;
  workDate: Date;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  sourceLabel: string;
  itemLabel: string;
  quantityValue: number | null;
  quantityUnit: string | null;
  quantityLabel: string | null;
  detail: string | null;
};

type CrewDispatchMaterialDayGroup = {
  key: string;
  workDate: Date;
  items: CrewDispatchMaterialItem[];
};

type CrewDispatchMaterialTimelineStrip = {
  id: string;
  gridColumn: string;
  text: string;
  tooltipText: string;
  extraCount: number;
};

type CrewDispatchTruckItem = {
  id: string;
  workDate: Date;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  sourceLabel: string;
  ownerLabel: string;
  vehicleLabel: string;
  driverLabel: string | null;
  subcontractorName: string | null;
  tourCount: number;
  quantityValue: number | null;
  quantityUnit: string | null;
  materialLabel: string | null;
  detail: string | null;
};

type CrewDispatchTruckDayGroup = {
  key: string;
  workDate: Date;
  items: CrewDispatchTruckItem[];
};

type CrewDispatchTruckTimelineStrip = {
  id: string;
  gridColumn: string;
  text: string;
  tooltipText: string;
  extraCount: number;
};

type CrewDispatchTruckMaps = {
  truckMap: Map<string, CrewDispatchTruckItem[]>;
  specialVehicleMap: Map<string, CrewDispatchTruckItem[]>;
};

type CrewDispatchEquipmentDispatchAssignment = {
  id: string;
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  vehicle: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  };
  project: {
    id: string;
    projectNumber: string;
    name: string;
  };
  crew: {
    name: string;
  } | null;
};

type CrewDispatchEquipmentItem = {
  id: string;
  vehicleId: string;
  vehicleLabel: string;
  sourceLabel: string;
  startDate: Date;
  endDate: Date;
  projectId: string | null;
  projectNumber: string;
  projectName: string;
  crewName: string | null;
  notes: string | null;
};

type CrewDispatchEquipmentTimelineStrip = {
  id: string;
  gridColumn: string;
  text: string;
  tooltipText: string;
  extraCount: number;
};

type CrewDispatchNoteTimelineStrip = {
  id: string;
  gridColumn: string;
  text: string;
  tooltipText: string;
  extraCount: number;
};

type ProjectMaterialReference = {
  projectId?: string | null;
  projectNumber: string;
  projectName: string;
};

type CrewDispatchProjectNote = {
  category: string;
  content: string;
  noteDate: Date;
  noteEndDate: Date | null;
  title: string | null;
};

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

function addWeeks(date: Date, weeks: number) {
  return addDays(date, weeks * 7);
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
  const nextMonth = addMonths(startOfMonth(date), 1);
  return addDays(nextMonth, -1);
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

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthShort(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
  }).format(date);
}

function formatTons(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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

function getPlanningAxis(value: string | undefined): PlanningAxis {
  if (
    value === "projects" ||
    value === "employees" ||
    value === "teams" ||
    value === "equipment" ||
    value === "specialEquipment"
  ) {
    return value;
  }

  return "teams";
}

function getTimelineRange(value: string | undefined, view: TimelineView): TimelineRange {
  if (
    value === "7d" ||
    value === "14d" ||
    value === "21d" ||
    value === "3w" ||
    value === "6w" ||
    value === "9w" ||
    value === "4m" ||
    value === "8m" ||
    value === "12m" ||
    value === "custom"
  ) {
    return value;
  }

  if (value === "1w") return view === "weeks" ? "3w" : "7d";
  if (value === "2w") return view === "weeks" ? "6w" : "14d";
  if (value === "5w") return view === "weeks" ? "9w" : "21d";
  if (value === "5m") return "4m";

  if (view === "weeks") return "6w";
  if (view === "months") return "4m";

  return "14d";
}

function getRangeForView(range: TimelineRange, view: TimelineView): TimelineRange {
  if (range === "custom") return range;

  const isMonthRange =
    range === "4m" || range === "8m" || range === "12m";
  const isWeekRange = range === "3w" || range === "6w" || range === "9w";
  const isDayRange = range === "7d" || range === "14d" || range === "21d";

  if (view === "months") {
    return isMonthRange ? range : "4m";
  }

  if (view === "weeks") {
    return isWeekRange ? range : "6w";
  }

  return isDayRange ? range : "14d";
}

function getCustomUnit(
  value: string | undefined,
  view: TimelineView,
): CustomUnit {
  if (value === "days") return "days";
  if (value === "months") return "months";
  if (value === "weeks") return "weeks";

  if (view === "days") return "days";
  return view === "months" ? "months" : "weeks";
}

function getCustomCount(value: string | undefined, view: TimelineView) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (view === "months") return 4;
    if (view === "days") return 14;
    return 2;
  }

  return Math.max(1, Math.round(parsed));
}

function getBufferValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed));
}

function getViewBufferValues({
  view,
  params,
  fallbackBack = 0,
  fallbackForward = 0,
}: {
  view: TimelineView;
  params: {
    bufferBack?: string;
    bufferForward?: string;
    daysBufferBack?: string;
    daysBufferForward?: string;
    weeksBufferBack?: string;
    weeksBufferForward?: string;
    monthsBufferBack?: string;
    monthsBufferForward?: string;
  };
  fallbackBack?: number;
  fallbackForward?: number;
}) {
  const currentBack = getBufferValue(params.bufferBack, fallbackBack);
  const currentForward = getBufferValue(params.bufferForward, fallbackForward);

  return {
    days: {
      back: getBufferValue(
        params.daysBufferBack,
        view === "days" ? currentBack : fallbackBack,
      ),
      forward: getBufferValue(
        params.daysBufferForward,
        view === "days" ? currentForward : fallbackForward,
      ),
    },
    weeks: {
      back: getBufferValue(
        params.weeksBufferBack,
        view === "weeks" ? currentBack : fallbackBack,
      ),
      forward: getBufferValue(
        params.weeksBufferForward,
        view === "weeks" ? currentForward : fallbackForward,
      ),
    },
    months: {
      back: getBufferValue(
        params.monthsBufferBack,
        view === "months" ? currentBack : fallbackBack,
      ),
      forward: getBufferValue(
        params.monthsBufferForward,
        view === "months" ? currentForward : fallbackForward,
      ),
    },
  } satisfies Record<TimelineView, { back: number; forward: number }>;
}

function getEffectiveWeekCount({
  range,
  customCount,
}: {
  range: TimelineRange;
  customCount: number;
}) {
  if (range === "custom") {
    return customCount;
  }

  if (range === "3w") return 3;
  if (range === "9w") return 9;
  return 6;
}

function getEffectiveDayCount({
  range,
  customCount,
}: {
  range: TimelineRange;
  customCount: number;
}) {
  if (range === "custom") return customCount;
  if (range === "7d") return 7;
  if (range === "21d") return 21;
  return 14;
}

function getEffectiveMonthCount({
  range,
  customCount,
}: {
  range: TimelineRange;
  customCount: number;
}) {
  if (range === "custom") {
    return customCount;
  }

  if (range === "8m") return 8;
  if (range === "12m") return 12;
  return 4;
}

function getDateDiffInDays(startDate: Date, endDate: Date) {
  const start = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );

  return Math.round((end - start) / 86400000);
}

function getDefaultRangeEnd({
  view,
  range,
  customCount,
  customUnit,
  anchorDate,
}: {
  view: TimelineView;
  range: TimelineRange;
  customCount: number;
  customUnit: CustomUnit;
  anchorDate: Date;
}) {
  if (range === "custom" && customUnit === "days") {
    return addDays(anchorDate, customCount - 1);
  }

  if (range === "custom" && customUnit === "weeks") {
    return addDays(startOfWeek(anchorDate), customCount * 7 - 1);
  }

  if (view === "months" || (range === "custom" && customUnit === "months")) {
    const monthCount = getEffectiveMonthCount({
      range,
      customCount,
    });

    return endOfMonthInclusive(
      addMonths(startOfMonth(anchorDate), monthCount - 1),
    );
  }

  if (view === "weeks") {
    const weekCount = getEffectiveWeekCount({
      range,
      customCount,
    });

    return addDays(startOfWeek(anchorDate), weekCount * 7 - 1);
  }

  const dayCount = getEffectiveDayCount({
    range,
    customCount,
  });

  return addDays(anchorDate, dayCount - 1);
}

function getSafeDateRange({
  from,
  to,
  fallbackStart,
  fallbackEnd,
}: {
  from?: string;
  to?: string;
  fallbackStart: Date;
  fallbackEnd: Date;
}) {
  const fromDate = from ? parseDateParam(from) : fallbackStart;
  const toDate = to ? parseDateParam(to) : fallbackEnd;

  if (toDate < fromDate) {
    return {
      fromDate: toDate,
      toDate: fromDate,
      isCustomDateRange: Boolean(from || to),
    };
  }

  return {
    fromDate,
    toDate,
    isCustomDateRange: Boolean(from || to),
  };
}

function getBufferedDateRange({
  view,
  fromDate,
  toDate,
  bufferBack,
  bufferForward,
}: {
  view: TimelineView;
  fromDate: Date;
  toDate: Date;
  bufferBack: number;
  bufferForward: number;
}) {
  if (view === "months") {
    return {
      timelineFromDate: startOfMonth(addMonths(fromDate, -bufferBack)),
      timelineToDate: endOfMonthInclusive(addMonths(toDate, bufferForward)),
    };
  }

  return {
    timelineFromDate: addWeeks(fromDate, -bufferBack),
    timelineToDate: addWeeks(toDate, bufferForward),
  };
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
        label: formatMonthShort(startDate),
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
        subLabel: `${formatShortDate(startDate)} – ${formatShortDate(
          visibleEnd,
        )}`,
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

function getProjectRowTitle(row: {
  projectNumber: string;
  projectName: string;
  rowTitle: string | null;
}) {
  if (row.rowTitle) {
    return `${row.projectNumber} · ${row.projectName} · ${row.rowTitle}`;
  }

  return `${row.projectNumber} · ${row.projectName}`;
}

function getCrewBadgeClass(typeValue: string | null) {
  if (!typeValue) {
    return "border-gray-200 bg-gray-900 text-white";
  }

  if (typeValue.includes("asphalt")) {
    return "border-orange-200 bg-orange-100 text-orange-950";
  }

  if (typeValue.includes("kanal")) {
    return "border-cyan-200 bg-cyan-100 text-cyan-950";
  }

  if (typeValue.includes("wasser")) {
    return "border-blue-200 bg-blue-100 text-blue-950";
  }

  if (typeValue.includes("strasse") || typeValue.includes("strassen")) {
    return "border-gray-300 bg-gray-900 text-white";
  }

  return "border-gray-200 bg-gray-900 text-white";
}

function getAsphaltDispatchBarClass(unitCount: number) {
  return `rounded-lg border border-orange-300 bg-orange-100 font-semibold text-orange-950 shadow-sm ring-1 ring-orange-200 ${getBarPaddingClass(
    unitCount,
  )} ${getBarTextClass(unitCount)}`;
}

function getPlanningAxisBarClass(tone: PlanningAxisBar["tone"], unitCount: number) {
  const toneClass =
    tone === "project"
      ? "border-blue-300 bg-blue-600 text-white"
      : tone === "employee"
        ? "border-sky-300 bg-sky-600 text-white"
        : tone === "special"
          ? "border-violet-300 bg-violet-600 text-white"
          : "border-emerald-300 bg-emerald-600 text-white";

  return `rounded-md border font-semibold shadow-sm ${toneClass} ${getBarPaddingClass(
    unitCount,
  )} ${getBarTextClass(unitCount)}`;
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

function normalizeProjectText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeProjectNumberKey(value: string | null | undefined) {
  return normalizeProjectText(value).replace(/[^a-z0-9]/g, "");
}

function getProjectMaterialKeys(reference: ProjectMaterialReference) {
  const keys: string[] = [];

  if (reference.projectId) {
    keys.push(`id:${reference.projectId}`);
  }

  const number = normalizeProjectText(reference.projectNumber);
  const looseNumber = normalizeProjectNumberKey(reference.projectNumber);
  const name = normalizeProjectText(reference.projectName);

  /*
    Wichtig für Material aus der LKW-Disposition:
    Kurzstrecke/Langstrecke kommen je nach Erfassung teilweise mit projectId,
    teilweise nur mit Projektnummer, teilweise mit leicht abweichendem Namen.
    Deshalb matchen wir mehrstufig:
    - projectId, wenn vorhanden
    - Projektnummer normalisiert
    - Projektnummer ohne Leer-/Sonderzeichen
    - Projektnummer + Name als zusätzlicher Fallback
  */
  if (number) {
    keys.push(`number:${number}`);
  }

  if (looseNumber) {
    keys.push(`number-loose:${looseNumber}`);
  }

  if (number || name) {
    keys.push(`label:${number}|||${name}`);
  }

  return Array.from(new Set(keys));
}

function addMaterialItemToMap(
  map: Map<string, CrewDispatchMaterialItem[]>,
  item: CrewDispatchMaterialItem,
) {
  for (const key of getProjectMaterialKeys(item)) {
    const existingItems = map.get(key) ?? [];
    existingItems.push(item);
    map.set(key, existingItems);
  }
}

function getMaterialItemsForProject(
  map: Map<string, CrewDispatchMaterialItem[]>,
  reference: ProjectMaterialReference,
) {
  const items = getProjectMaterialKeys(reference).flatMap(
    (key) => map.get(key) ?? [],
  );

  const uniqueItems = new Map<string, CrewDispatchMaterialItem>();

  for (const item of items) {
    uniqueItems.set(item.id, item);
  }

  return Array.from(uniqueItems.values()).sort((a, b) => {
    const dateCompare = a.workDate.getTime() - b.workDate.getTime();

    if (dateCompare !== 0) return dateCompare;

    return `${a.sourceLabel}-${a.itemLabel}`.localeCompare(
      `${b.sourceLabel}-${b.itemLabel}`,
      "de-DE",
    );
  });
}

function getMaterialDayGroupsForProject(
  map: Map<string, CrewDispatchMaterialItem[]>,
  reference: ProjectMaterialReference,
) {
  const groups = new Map<string, CrewDispatchMaterialDayGroup>();

  for (const item of getMaterialItemsForProject(map, reference)) {
    const key = formatDateInput(item.workDate);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      workDate: item.workDate,
      items: [item],
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.workDate.getTime() - b.workDate.getTime(),
  );
}

function formatMaterialQuantity(value: number | null | undefined, unit?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  const formatted = value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return unit ? `${formatted} ${unit}` : formatted;
}

function getMaterialDaySummaryLabel(items: CrewDispatchMaterialItem[]) {
  if (items.length === 0) {
    return "Kein Material aus LKW-Disposition";
  }

  const materialTotals = new Map<
    string,
    { itemLabel: string; unit: string | null; quantity: number; count: number }
  >();
  const fallbackLabels: string[] = [];

  for (const item of items) {
    if (item.quantityValue !== null && item.quantityValue > 0) {
      const key = `${item.itemLabel}|||${item.quantityUnit ?? ""}`;
      const existing = materialTotals.get(key);

      if (existing) {
        existing.quantity += item.quantityValue;
        existing.count += 1;
      } else {
        materialTotals.set(key, {
          itemLabel: item.itemLabel,
          unit: item.quantityUnit,
          quantity: item.quantityValue,
          count: 1,
        });
      }

      continue;
    }

    const fallbackLabel = [item.quantityLabel, item.itemLabel]
      .filter(Boolean)
      .join(" ");

    if (fallbackLabel && !fallbackLabels.includes(fallbackLabel)) {
      fallbackLabels.push(fallbackLabel);
    }
  }

  const materialParts = Array.from(materialTotals.values()).map((entry) =>
    [formatMaterialQuantity(entry.quantity, entry.unit), entry.itemLabel]
      .filter(Boolean)
      .join(" "),
  );

  const unitTotals = new Map<string, number>();

  for (const entry of materialTotals.values()) {
    const unitKey = entry.unit ?? "";
    unitTotals.set(unitKey, (unitTotals.get(unitKey) ?? 0) + entry.quantity);
  }

  const totalParts = Array.from(unitTotals.entries()).map(([unit, quantity]) =>
    formatMaterialQuantity(quantity, unit || null),
  );

  const shouldShowTotal = materialParts.length + fallbackLabels.length > 1;
  const totalText =
    shouldShowTotal && totalParts.length
      ? `Gesamt ${totalParts.filter(Boolean).join(" / ")}`
      : null;

  return [totalText, ...materialParts, ...fallbackLabels]
    .filter(Boolean)
    .join(" · ");
}

function getMaterialTimelineStrips({
  groups,
  timelineUnits,
}: {
  groups: CrewDispatchMaterialDayGroup[];
  timelineUnits: TimelineUnit[];
}) {
  const stripMap = new Map<
    string,
    {
      idParts: string[];
      workDates: Date[];
      groups: CrewDispatchMaterialDayGroup[];
      gridColumn: string;
    }
  >();

  for (const group of groups) {
    const gridColumn = getTimelineGridColumnForDateRange({
      startDate: group.workDate,
      endDate: group.workDate,
      timelineUnits,
    });

    if (!gridColumn) {
      continue;
    }

    const existing = stripMap.get(gridColumn);

    if (existing) {
      existing.idParts.push(group.key);
      existing.workDates.push(group.workDate);
      existing.groups.push(group);
      continue;
    }

    stripMap.set(gridColumn, {
      idParts: [group.key],
      workDates: [group.workDate],
      groups: [group],
      gridColumn,
    });
  }

  return Array.from(stripMap.values()).map((strip): CrewDispatchMaterialTimelineStrip => {
    const allItems = strip.groups.flatMap((group) => group.items);
    const mergedMultipleDates = strip.groups.length > 1;
    const text = mergedMultipleDates
      ? strip.groups
          .map(
            (group) =>
              `${formatShortDate(group.workDate)}: ${getMaterialDaySummaryLabel(
                group.items,
              )}`,
          )
          .join(" · ")
      : getMaterialDaySummaryLabel(allItems);

    const tooltipText = strip.groups
      .map((group) => {
        const details = group.items
          .map((item) =>
            [
              item.quantityLabel,
              item.itemLabel,
              item.sourceLabel,
              item.detail,
            ]
              .filter(Boolean)
              .join(" · "),
          )
          .join("\n");

        return `${formatShortDate(group.workDate)} · ${getMaterialDaySummaryLabel(
          group.items,
        )}${details ? `\n${details}` : ""}`;
      })
      .join("\n\n");

    return {
      id: strip.idParts.join("-"),
      gridColumn: strip.gridColumn,
      text,
      tooltipText,
      extraCount: Math.max(0, allItems.length - 3),
    };
  });
}


function addTruckItemToMap(
  map: Map<string, CrewDispatchTruckItem[]>,
  item: CrewDispatchTruckItem,
) {
  for (const key of getProjectMaterialKeys(item)) {
    const existingItems = map.get(key) ?? [];
    existingItems.push(item);
    map.set(key, existingItems);
  }
}

function getTruckItemsForProject(
  map: Map<string, CrewDispatchTruckItem[]>,
  reference: ProjectMaterialReference,
) {
  const items = getProjectMaterialKeys(reference).flatMap(
    (key) => map.get(key) ?? [],
  );

  const uniqueItems = new Map<string, CrewDispatchTruckItem>();

  for (const item of items) {
    uniqueItems.set(item.id, item);
  }

  return Array.from(uniqueItems.values()).sort((a, b) => {
    const dateCompare = a.workDate.getTime() - b.workDate.getTime();

    if (dateCompare !== 0) return dateCompare;

    return `${a.sourceLabel}-${a.ownerLabel}-${a.vehicleLabel}`.localeCompare(
      `${b.sourceLabel}-${b.ownerLabel}-${b.vehicleLabel}`,
      "de-DE",
    );
  });
}

function getTruckDayGroupsForProject(
  map: Map<string, CrewDispatchTruckItem[]>,
  reference: ProjectMaterialReference,
) {
  const groups = new Map<string, CrewDispatchTruckDayGroup>();

  for (const item of getTruckItemsForProject(map, reference)) {
    const key = formatDateInput(item.workDate);
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }

    groups.set(key, {
      key,
      workDate: item.workDate,
      items: [item],
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.workDate.getTime() - b.workDate.getTime(),
  );
}

function getDriverShortName(value: string | null | undefined) {
  const text = String(value ?? "").trim();

  if (!text) return null;

  if (text.includes(",")) {
    return text.split(",")[0].trim() || text;
  }

  const parts = text.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? text;
}

function getTruckOwnerLabel(ownerType: string | null | undefined) {
  return ownerType === "SUBCONTRACTOR" ? "Fremd" : "STIX";
}

function getSpecialVehicleOwnerLabel(ownerLabel: string | null | undefined) {
  return ownerLabel === "Fremd" ? "Sonder Fremd" : "Sonder";
}

function getTruckDisplayLabel(item: CrewDispatchTruckItem) {
  const tourText = item.tourCount > 0 ? `${item.tourCount}T` : null;
  const quantityText = formatMaterialQuantity(
    item.quantityValue,
    item.quantityUnit ?? undefined,
  );
  const materialText = [quantityText, item.materialLabel]
    .filter(Boolean)
    .join(" ");

  if (item.ownerLabel === "Fremd") {
    return [
      "Fremd",
      item.subcontractorName ?? item.vehicleLabel,
      tourText,
      materialText || null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (item.ownerLabel === "Sonder" || item.ownerLabel === "Sonder Fremd") {
    return [
      item.ownerLabel,
      item.subcontractorName ?? item.vehicleLabel,
      item.driverLabel,
      tourText,
      materialText || null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    ["STIX", item.vehicleLabel].filter(Boolean).join(" "),
    item.driverLabel,
    tourText,
    materialText || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getTruckDaySummaryLabel(items: CrewDispatchTruckItem[]) {
  if (items.length === 0) {
    return "Keine LKW aus der LKW-Disposition";
  }

  return items.map(getTruckDisplayLabel).join(" · ");
}

function getTruckTimelineStrips({
  groups,
  timelineUnits,
}: {
  groups: CrewDispatchTruckDayGroup[];
  timelineUnits: TimelineUnit[];
}) {
  const stripMap = new Map<
    string,
    {
      idParts: string[];
      workDates: Date[];
      groups: CrewDispatchTruckDayGroup[];
      gridColumn: string;
    }
  >();

  for (const group of groups) {
    const gridColumn = getTimelineGridColumnForDateRange({
      startDate: group.workDate,
      endDate: group.workDate,
      timelineUnits,
    });

    if (!gridColumn) {
      continue;
    }

    const existing = stripMap.get(gridColumn);

    if (existing) {
      existing.idParts.push(group.key);
      existing.workDates.push(group.workDate);
      existing.groups.push(group);
      continue;
    }

    stripMap.set(gridColumn, {
      idParts: [group.key],
      workDates: [group.workDate],
      groups: [group],
      gridColumn,
    });
  }

  return Array.from(stripMap.values()).map((strip): CrewDispatchTruckTimelineStrip => {
    const allItems = strip.groups.flatMap((group) => group.items);
    const mergedMultipleDates = strip.groups.length > 1;
    const text = mergedMultipleDates
      ? strip.groups
          .map(
            (group) =>
              `${formatShortDate(group.workDate)}: ${getTruckDaySummaryLabel(
                group.items,
              )}`,
          )
          .join(" · ")
      : getTruckDaySummaryLabel(allItems);

    const tooltipText = strip.groups
      .map((group) => {
        const details = group.items
          .map((item) => {
            const quantityText = formatMaterialQuantity(
              item.quantityValue,
              item.quantityUnit ?? undefined,
            );

            return [
              getTruckDisplayLabel(item),
              item.sourceLabel,
              item.materialLabel ? `Material: ${item.materialLabel}` : null,
              quantityText ? `Menge: ${quantityText}` : null,
              item.detail,
            ]
              .filter(Boolean)
              .join(" · ");
          })
          .join("\n");

        return `${formatShortDate(group.workDate)} · ${group.items.length} LKW${details ? `\n${details}` : ""}`;
      })
      .join("\n\n");

    return {
      id: strip.idParts.join("-"),
      gridColumn: strip.gridColumn,
      text,
      tooltipText,
      extraCount: Math.max(0, allItems.length - 2),
    };
  });
}

function getEquipmentSummaryLabel(items: CrewDispatchEquipmentItem[]) {
  if (items.length === 0) {
    return "Keine Geräte";
  }

  return items
    .slice(0, 3)
    .map((item) => item.vehicleLabel)
    .join(" · ");
}

function getEquipmentTooltipLabel(items: CrewDispatchEquipmentItem[]) {
  if (items.length === 0) {
    return "Keine Geräte";
  }

  return items
    .map((item) =>
      [
        item.vehicleLabel,
        item.sourceLabel,
        item.crewName ? `Kolonne: ${item.crewName}` : null,
        `${formatShortDate(item.startDate)} – ${formatShortDate(item.endDate)}`,
        item.notes,
      ]
        .filter(Boolean)
        .join(" · "),
    )
    .join("\n");
}

function sameProjectReference(
  item: {
    projectId?: string | null;
    projectNumber: string;
    projectName: string;
  },
  reference: ProjectMaterialReference,
) {
  if (item.projectId && reference.projectId && item.projectId === reference.projectId) {
    return true;
  }

  const itemNumber = item.projectNumber.trim().toLowerCase();
  const referenceNumber = reference.projectNumber.trim().toLowerCase();

  if (itemNumber && referenceNumber && itemNumber === referenceNumber) {
    return true;
  }

  const compactItemNumber = itemNumber.replace(/[^a-z0-9]/g, "");
  const compactReferenceNumber = referenceNumber.replace(/[^a-z0-9]/g, "");

  if (
    compactItemNumber &&
    compactReferenceNumber &&
    compactItemNumber === compactReferenceNumber
  ) {
    return true;
  }

  return (
    item.projectName.trim().toLowerCase() ===
    reference.projectName.trim().toLowerCase()
  );
}

function manualEquipmentOverlapsVehicle({
  vehicleId,
  startDate,
  endDate,
  equipmentDispatchAssignments,
}: {
  vehicleId: string;
  startDate: Date;
  endDate: Date;
  equipmentDispatchAssignments: CrewDispatchEquipmentDispatchAssignment[];
}) {
  return equipmentDispatchAssignments.some(
    (assignment) =>
      assignment.vehicleId === vehicleId &&
      rangesOverlapInclusive(
        assignment.startDate,
        assignment.endDate,
        startDate,
        addDays(endDate, 1),
      ),
  );
}

function getEquipmentTimelineStripsForProject({
  reference,
  assignmentStartDate,
  assignmentEndDate,
  defaultVehicles,
  equipmentDispatchAssignments,
  timelineUnits,
}: {
  reference: ProjectMaterialReference;
  assignmentStartDate: Date;
  assignmentEndDate: Date;
  defaultVehicles: {
    vehicle: {
      id: string;
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
    };
  }[];
  equipmentDispatchAssignments: CrewDispatchEquipmentDispatchAssignment[];
  timelineUnits: TimelineUnit[];
}) {
  const strips: CrewDispatchEquipmentTimelineStrip[] = [];

  type EquipmentRangeGroup = {
    startIndex: number;
    endIndex: number;
    key: string;
    items: CrewDispatchEquipmentItem[];
  };

  const groups: EquipmentRangeGroup[] = [];
  let currentGroup: EquipmentRangeGroup | null = null;

  function closeCurrentGroup() {
    if (currentGroup) {
      groups.push(currentGroup);
      currentGroup = null;
    }
  }

  timelineUnits.forEach((unit, index) => {
    const unitEnd = addDays(unit.endDateExclusive, -1);
    const items = new Map<string, CrewDispatchEquipmentItem>();

    /*
      Gerätedisposition hat Vorrang und muss eigenständig sichtbar sein.
      Deshalb werden manuell disponierte Geräte nach ihrem echten Zeitraum
      angezeigt, auch wenn sie nicht aus den Standardgeräten der Kolonne kommen
      oder über den Kolonnenbalken hinausgehen.
    */
    for (const dispatchAssignment of equipmentDispatchAssignments) {
      if (
        !sameProjectReference(
          {
            projectId: dispatchAssignment.project.id,
            projectNumber: dispatchAssignment.project.projectNumber,
            projectName: dispatchAssignment.project.name,
          },
          reference,
        )
      ) {
        continue;
      }

      if (
        !rangesOverlapInclusive(
          dispatchAssignment.startDate,
          dispatchAssignment.endDate,
          unit.startDate,
          unit.endDateExclusive,
        )
      ) {
        continue;
      }

      items.set(dispatchAssignment.vehicleId, {
        id: `equipment-dispatch-${dispatchAssignment.id}`,
        vehicleId: dispatchAssignment.vehicleId,
        vehicleLabel: getVehicleLabel(dispatchAssignment.vehicle),
        sourceLabel: "Gerätedisposition",
        startDate: dispatchAssignment.startDate,
        endDate: dispatchAssignment.endDate,
        projectId: dispatchAssignment.project.id,
        projectNumber: dispatchAssignment.project.projectNumber,
        projectName: dispatchAssignment.project.name,
        crewName: dispatchAssignment.crew?.name ?? null,
        notes: dispatchAssignment.notes,
      });
    }

    /*
      Standardgeräte gelten nur im Zeitraum des Kolonnenbalkens.
      Sobald ein Gerät im gleichen Zeitraum manuell disponiert ist, wird es aus
      der Grundinfo entfernt. Dadurch verlängert/ändert sich die Gerätezeile
      korrekt, wenn zusätzliche Geräte über die Gerätedisposition auf die
      Baustelle gelegt werden.
    */
    if (
      rangesOverlapInclusive(
        assignmentStartDate,
        assignmentEndDate,
        unit.startDate,
        unit.endDateExclusive,
      )
    ) {
      for (const item of defaultVehicles) {
        if (
          manualEquipmentOverlapsVehicle({
            vehicleId: item.vehicle.id,
            startDate: unit.startDate,
            endDate: unitEnd,
            equipmentDispatchAssignments,
          })
        ) {
          continue;
        }

        items.set(item.vehicle.id, {
          id: `equipment-default-${item.vehicle.id}`,
          vehicleId: item.vehicle.id,
          vehicleLabel: getVehicleLabel(item.vehicle),
          sourceLabel: "Grundinfo aus Kolonne",
          startDate: assignmentStartDate,
          endDate: assignmentEndDate,
          projectId: reference.projectId ?? null,
          projectNumber: reference.projectNumber,
          projectName: reference.projectName,
          crewName: null,
          notes: "Standardgerät der Kolonne. Gerätedisposition hat Vorrang.",
        });
      }
    }

    const equipmentItems = Array.from(items.values()).sort((a, b) =>
      a.vehicleLabel.localeCompare(b.vehicleLabel, "de-DE"),
    );

    if (equipmentItems.length === 0) {
      closeCurrentGroup();
      return;
    }

    const key = equipmentItems
      .map((item) => `${item.vehicleId}:${item.sourceLabel}`)
      .join("|");

    if (currentGroup && currentGroup.key === key) {
      currentGroup.endIndex = index;
      currentGroup.items = equipmentItems;
      return;
    }

    closeCurrentGroup();

    currentGroup = {
      startIndex: index,
      endIndex: index,
      key,
      items: equipmentItems,
    };
  });

  closeCurrentGroup();

  groups.forEach((group) => {
    strips.push({
      id: `${timelineUnits[group.startIndex]?.key ?? group.startIndex}-${timelineUnits[group.endIndex]?.key ?? group.endIndex}-${group.key}`,
      gridColumn: `${group.startIndex + 1} / ${group.endIndex + 2}`,
      text: getEquipmentSummaryLabel(group.items),
      tooltipText: getEquipmentTooltipLabel(group.items),
      extraCount: Math.max(0, group.items.length - 3),
    });
  });

  return strips;
}

function getProjectNotesForReference({
  projectNotesById,
  projectNotesByKey,
  reference,
}: {
  projectNotesById: Map<string, CrewDispatchProjectNote[]>;
  projectNotesByKey: Map<string, CrewDispatchProjectNote[]>;
  reference: ProjectMaterialReference;
}) {
  if (reference.projectId) {
    const notes = projectNotesById.get(reference.projectId);
    if (notes?.length) return notes;
  }

  for (const key of getProjectMaterialKeys(reference)) {
    const notes = projectNotesByKey.get(key);
    if (notes?.length) return notes;
  }

  return [];
}

function getCrewDispatchNoteCategoryLabel(value: string) {
  switch (value) {
    case "OBSTRUCTION":
      return "Behinderung";
    case "INCIDENT":
      return "Vorkommnis";
    case "CLIENT":
      return "Auftraggeber";
    case "INTERNAL":
      return "Intern";
    default:
      return "Notiz";
  }
}

function getNoteTimelineStripForProject({
  assignmentEndDate,
  assignmentStartDate,
  reference,
  rowNotes,
  projectNotesById,
  projectNotesByKey,
  timelineUnits,
}: {
  assignmentEndDate: Date;
  assignmentStartDate: Date;
  reference: ProjectMaterialReference;
  rowNotes?: string | null;
  projectNotesById: Map<string, CrewDispatchProjectNote[]>;
  projectNotesByKey: Map<string, CrewDispatchProjectNote[]>;
  timelineUnits: TimelineUnit[];
}): CrewDispatchNoteTimelineStrip | null {
  const projectNotes = getProjectNotesForReference({
    projectNotesById,
    projectNotesByKey,
    reference,
  }).filter((note) =>
    rangesOverlapInclusive(
      note.noteDate,
      getProjectNoteEndDate(note),
      assignmentStartDate,
      assignmentEndDate,
    ),
  );
  const noteStartDate = projectNotes.reduce<Date | null>(
    (earliestDate, note) =>
      earliestDate && earliestDate < note.noteDate ? earliestDate : note.noteDate,
    null,
  );
  const noteEndDate = projectNotes.reduce<Date | null>((latestDate, note) => {
    const endDate = getProjectNoteEndDate(note);

    return latestDate && latestDate > endDate ? latestDate : endDate;
  }, null);
  const gridColumn =
    noteStartDate && noteEndDate
      ? getTimelineGridColumnForDateRange({
          endDate: noteEndDate,
          startDate: noteStartDate,
          timelineUnits,
        })
      : rowNotes
        ? getTimelineGridColumnForDateRange({
            endDate: assignmentEndDate,
            startDate: assignmentStartDate,
            timelineUnits,
          })
        : null;

  if (!gridColumn) return null;

  const notes = [
    ...projectNotes.map(formatProjectNoteForCrewDispatch),
    rowNotes,
  ]
    .map((note) => String(note ?? "").trim())
    .filter(Boolean);
  const uniqueNotes = Array.from(new Set(notes));

  if (uniqueNotes.length === 0) return null;

  const text = uniqueNotes[0];
  const tooltipText = uniqueNotes
    .map((note, index) => `${index + 1}. ${note}`)
    .join("\n");

  return {
    extraCount: Math.max(0, uniqueNotes.length - 1),
    gridColumn,
    id: `notes-${
      getProjectMaterialKeys(reference)[0] ?? reference.projectId ?? "project"
    }`,
    text,
    tooltipText,
  };
}

function getProjectNoteEndDate(note: CrewDispatchProjectNote) {
  return note.noteEndDate ?? note.noteDate;
}

function formatProjectNoteForCrewDispatch(note: CrewDispatchProjectNote) {
  return [
    formatProjectNoteDateRange(note),
    getCrewDispatchNoteCategoryLabel(note.category),
    note.title,
    note.content,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatProjectNoteDateRange(note: CrewDispatchProjectNote) {
  if (!note.noteEndDate) return formatShortDate(note.noteDate);

  return `${formatShortDate(note.noteDate)}–${formatShortDate(note.noteEndDate)}`;
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
      unit.endDateExclusive,
    ),
  );

  if (firstIndex === -1) {
    return null;
  }

  let lastIndex = firstIndex;

  for (let index = firstIndex; index < timelineUnits.length; index += 1) {
    const unit = timelineUnits[index];

    if (
      rangesOverlapInclusive(
        startDate,
        endDate,
        unit.startDate,
        unit.endDateExclusive,
      )
    ) {
      lastIndex = index;
    }
  }

  return `${firstIndex + 1} / ${lastIndex + 2}`;
}

function normalizeTimeFieldValue(value: unknown) {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue.length) return null;

    const timeMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})/);

    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, "0");
      return `${hour}:${timeMatch[2]}`;
    }

    return trimmedValue;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const hour = Math.floor(value);
    const minutes = Math.round((value - hour) * 60);

    return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0",
    )}`;
  }

  return null;
}

function getOptionalTimeField(source: object, keys: string[]) {
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const normalizedValue = normalizeTimeFieldValue(record[key]);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return null;
}

function getProjectDefaultStartTime(project: object) {
  return getOptionalTimeField(project, [
    "defaultStartTime",
    "workStartTime",
    "workTimeStart",
    "workingTimeStart",
    "workingStartTime",
    "workingHoursStart",
    "workdayStartTime",
    "constructionStartTime",
    "siteStartTime",
    "siteWorkStartTime",
    "normalWorkStartTime",
    "regularStartTime",
    "normalStartTime",
    "dailyStartTime",
    "startTime",
    "arbeitszeitVon",
    "arbeitsbeginn",
    "workStart",
  ]);
}

function getProjectDefaultEndTime(project: object) {
  return getOptionalTimeField(project, [
    "defaultEndTime",
    "workEndTime",
    "workTimeEnd",
    "workingTimeEnd",
    "workingEndTime",
    "workingHoursEnd",
    "workdayEndTime",
    "constructionEndTime",
    "siteEndTime",
    "siteWorkEndTime",
    "normalWorkEndTime",
    "regularEndTime",
    "normalEndTime",
    "dailyEndTime",
    "endTime",
    "arbeitszeitBis",
    "arbeitsende",
    "workEnd",
  ]);
}

function normalizeDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function normalizeCrewName(value: string) {
  return value.trim().toLowerCase();
}

function rangesOverlapInclusive(
  assignmentStart: Date,
  assignmentEnd: Date,
  unitStart: Date,
  unitEndExclusive: Date,
) {
  const start = normalizeDay(assignmentStart).getTime();
  const endInclusive = normalizeDay(assignmentEnd).getTime();
  const unitStartTime = normalizeDay(unitStart).getTime();
  const unitEndInclusive = addDays(
    normalizeDay(unitEndExclusive),
    -1,
  ).getTime();

  return start <= unitEndInclusive && endInclusive >= unitStartTime;
}

function isDayInDateRange(day: Date, startDate: Date, endDate: Date) {
  const dayTime = normalizeDay(day).getTime();

  return (
    dayTime >= normalizeDay(startDate).getTime() &&
    dayTime <= normalizeDay(endDate).getTime()
  );
}

function buildCrewDispatchHref({
  planningAxis,
  extraParams,
  fromDate,
  toDate,
  view,
  range,
  customCount,
  customUnit,
  showWeekend,
  bufferBack,
  bufferForward,
  showAsphaltDispatchCrews,
  showEquipment,
  showTrucks,
  showSpecialVehicles,
  showMaterial,
  showNotes,
  focusDate,
  highlightCrewId,
}: {
  planningAxis?: PlanningAxis;
  extraParams?: Record<string, string | number | boolean | null | undefined>;
  fromDate: Date;
  toDate: Date;
  view: TimelineView;
  range: TimelineRange;
  customCount: number;
  customUnit: CustomUnit;
  showWeekend: boolean;
  bufferBack: number;
  bufferForward: number;
  showAsphaltDispatchCrews: boolean;
  showEquipment: boolean;
  showTrucks: boolean;
  showSpecialVehicles: boolean;
  showMaterial: boolean;
  showNotes: boolean;
  focusDate?: Date | string;
  highlightCrewId?: string | null;
}) {
  const params = new URLSearchParams();

  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false || value === "") {
        return;
      }

      params.set(key, value === true ? "1" : String(value));
    });
  }

  if (planningAxis && planningAxis !== "teams") {
    params.set("axis", planningAxis);
  }

  params.set("from", formatDateInput(fromDate));
  params.set("to", formatDateInput(toDate));
  params.set("view", view);
  params.set("range", range);
  params.set("bufferBack", String(bufferBack));
  params.set("bufferForward", String(bufferForward));

  if (range === "custom") {
    params.set("customCount", String(customCount));
    params.set("customUnit", customUnit);
  }

  if (showWeekend) {
    params.set("showWeekend", "1");
  }

  if (showAsphaltDispatchCrews) {
    params.set("showAsphaltDispatchCrews", "1");
  }

  if (showEquipment) {
    params.set("showEquipment", "1");
  }

  if (showTrucks) {
    params.set("showTrucks", "1");
  }

  if (showSpecialVehicles) {
    params.set("showSpecialVehicles", "1");
  }

  if (showMaterial) {
    params.set("showMaterial", "1");
  }

  if (showNotes) {
    params.set("showNotes", "1");
  }

  if (focusDate) {
    params.set(
      "focus",
      typeof focusDate === "string" ? focusDate : formatDateInput(focusDate),
    );
  }

  if (highlightCrewId) {
    params.set("highlightCrew", highlightCrewId);
  }

  return `/crew-dispatch?${params.toString()}`;
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

    return {
      fromDate: nextFrom,
      toDate: nextTo,
    };
  }

  const dayDiff = getDateDiffInDays(fromDate, toDate) + 1;
  const nextFrom = addDays(fromDate, dayDiff * direction);
  const nextTo = addDays(toDate, dayDiff * direction);

  return {
    fromDate: nextFrom,
    toDate: nextTo,
  };
}

function getTodayRange(view: TimelineView) {
  const today = parseDateParam(formatDateInput(new Date()));

  if (view === "months") {
    return {
      fromDate: startOfMonth(today),
      toDate: endOfMonthInclusive(addMonths(startOfMonth(today), 4)),
      focusDate: startOfMonth(today),
    };
  }

  const weekStart = startOfWeek(today);

  return {
    fromDate: weekStart,
    toDate: addDays(weekStart, 13),
    focusDate: weekStart,
  };
}

function getTimelineTitle(units: TimelineUnit[], view: TimelineView) {
  if (units.length === 0) return "";

  const first = units[0];
  const last = units[units.length - 1];

  if (view === "months") {
    return `${formatMonthYear(first.startDate)} – ${formatMonthYear(
      last.startDate,
    )}`;
  }

  const startKw = getCalendarWeek(first.startDate);
  const endKw = getCalendarWeek(last.startDate);

  if (startKw === endKw) {
    return `${formatMonthYear(first.startDate)} · KW ${startKw}`;
  }

  return `${formatMonthYear(first.startDate)} · KW ${startKw}–${endKw}`;
}

function getTimelineSubtitle(units: TimelineUnit[]) {
  if (units.length === 0) return "";

  const first = units[0].startDate;
  const lastUnit = units[units.length - 1];
  const last = addDays(lastUnit.endDateExclusive, -1);

  return `${formatShortDate(first)} – ${formatShortDate(last)}`;
}

function getLeftColumnWidth(unitCount: number) {
  if (unitCount >= 30) return 280;
  if (unitCount >= 20) return 300;
  if (unitCount >= 12) return 320;
  return 340;
}

function getTimelineColumnWidth(view: TimelineView, unitCount: number) {
  if (view === "months") return 170;
  if (view === "weeks") return 145;
  if (unitCount >= 30) return 74;
  if (unitCount >= 20) return 84;
  if (unitCount >= 12) return 96;
  return 112;
}

function getTimelineMinWidth(view: TimelineView, unitCount: number) {
  if (
    (view === "days" && unitCount <= 21) ||
    (view === "weeks" && unitCount <= 9) ||
    (view === "months" && unitCount <= 12)
  ) {
    return 0;
  }

  return unitCount * getTimelineColumnWidth(view, unitCount);
}

function getTimelineGridColumns(view: TimelineView, unitCount: number) {
  if (
    (view === "days" && unitCount <= 21) ||
    (view === "weeks" && unitCount <= 9) ||
    (view === "months" && unitCount <= 12)
  ) {
    return `repeat(${unitCount}, minmax(0, 1fr))`;
  }

  return `repeat(${unitCount}, minmax(${getTimelineColumnWidth(
    view,
    unitCount,
  )}px, 1fr))`;
}

function getHeaderPaddingClass(unitCount: number) {
  if (unitCount >= 30) return "px-1 py-2";
  if (unitCount >= 20) return "px-1.5 py-2";
  if (unitCount >= 12) return "px-2 py-2.5";
  return "px-3 py-3";
}

function getHeaderTextClass(unitCount: number) {
  if (unitCount >= 30) return "text-[10px]";
  if (unitCount >= 20) return "text-[11px]";
  return "text-sm";
}

function getHeaderSubTextClass(unitCount: number) {
  if (unitCount >= 30) return "mt-0.5 text-[9px] leading-3";
  if (unitCount >= 20) return "mt-0.5 text-[10px] leading-3";
  return "mt-1 text-xs leading-4";
}

function getCellPaddingClass(unitCount: number) {
  if (unitCount >= 30) return "p-0.5";
  if (unitCount >= 20) return "p-1";
  if (unitCount >= 12) return "p-1.5";
  return "p-2";
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

function getBarPaddingClass(unitCount: number) {
  if (unitCount >= 30) return "px-1 py-1";
  if (unitCount >= 20) return "px-1.5 py-1";
  return "px-3 py-2";
}

function getBarTextClass(unitCount: number) {
  if (unitCount >= 30) return "text-[10px]";
  if (unitCount >= 20) return "text-[11px]";
  return "text-xs";
}

function getViewLabel(view: TimelineView) {
  if (view === "weeks") return "Wochen";
  if (view === "months") return "Monate";
  return "Tage";
}

function getPlanningAxisLabel(axis: PlanningAxis) {
  return planningAxisTabs.find((tab) => tab.value === axis)?.label ?? "Teams";
}

function getRangeLabel(range: TimelineRange) {
  if (range === "7d") return "7T";
  if (range === "14d") return "14T";
  if (range === "21d") return "21T";
  if (range === "3w") return "3W";
  if (range === "6w") return "6W";
  if (range === "9w") return "9W";
  if (range === "4m") return "4M";
  if (range === "8m") return "8M";
  if (range === "12m") return "12M";
  return "Eigener Wert";
}

function getCustomUnitLabel(unit: CustomUnit) {
  if (unit === "months") return "Monate";
  if (unit === "weeks") return "Wochen";
  return "Tage";
}

const CREW_TIMELINE_ROW_MIN_HEIGHT_PX = 180;
const CREW_TIMELINE_PLUS_ROW_HEIGHT_PX = 42;
const CREW_TIMELINE_BAR_TOP_PX = CREW_TIMELINE_PLUS_ROW_HEIGHT_PX + 14;
const CREW_TIMELINE_BAR_LANE_HEIGHT_PX = 72;
const CREW_TIMELINE_SUPPLEMENT_ROW_HEIGHT_PX = 24;
const CREW_TIMELINE_SUPPLEMENT_GAP_PX = 6;
const CREW_TIMELINE_BAR_VISUAL_HEIGHT_PX = 44;
const CREW_TIMELINE_ROW_BOTTOM_PADDING_PX = 52;

function getSupplementLayerCount({
  showEquipment,
  showTrucks,
  showSpecialVehicles,
  showMaterial,
  showNotes,
}: {
  showEquipment: boolean;
  showTrucks: boolean;
  showSpecialVehicles: boolean;
  showMaterial: boolean;
  showNotes: boolean;
}) {
  return (
    Number(showEquipment) +
    Number(showTrucks) +
    Number(showSpecialVehicles) +
    Number(showMaterial) +
    Number(showNotes)
  );
}

function getLayerIndex({
  showEquipment,
  showTrucks,
  showSpecialVehicles,
  showMaterial,
  layer,
}: {
  showEquipment: boolean;
  showTrucks: boolean;
  showSpecialVehicles: boolean;
  showMaterial: boolean;
  layer: "equipment" | "truck" | "special" | "material" | "notes";
}) {
  if (layer === "equipment") {
    return 0;
  }

  if (layer === "truck") {
    return Number(showEquipment);
  }

  if (layer === "special") {
    return Number(showEquipment) + Number(showTrucks);
  }

  if (layer === "material") {
    return (
      Number(showEquipment) + Number(showTrucks) + Number(showSpecialVehicles)
    );
  }

  return (
    Number(showEquipment) +
    Number(showTrucks) +
    Number(showSpecialVehicles) +
    Number(showMaterial)
  );
}

function getCrewTimelineLaneHeight(layerCount: number) {
  return (
    CREW_TIMELINE_BAR_LANE_HEIGHT_PX +
    layerCount *
      (CREW_TIMELINE_SUPPLEMENT_ROW_HEIGHT_PX + CREW_TIMELINE_SUPPLEMENT_GAP_PX)
  );
}

function getSupplementTopOffsetPx({
  baseTopOffsetPx,
  layerIndex,
}: {
  baseTopOffsetPx: number;
  layerIndex: number;
}) {
  return (
    baseTopOffsetPx +
    CREW_TIMELINE_BAR_VISUAL_HEIGHT_PX +
    CREW_TIMELINE_SUPPLEMENT_GAP_PX +
    layerIndex *
      (CREW_TIMELINE_SUPPLEMENT_ROW_HEIGHT_PX + CREW_TIMELINE_SUPPLEMENT_GAP_PX)
  );
}

function getCrewTimelineRowHeight(laneCount: number, laneHeight: number) {
  const safeLaneCount = Math.max(1, laneCount);

  /*
    Wichtig: Die Balken sind absolute Elemente und vergrößern die Zeile nicht
    automatisch. Deshalb muss die Zeilenhöhe hier bewusst aus Plus-Zeile,
    Balken-Lanes und Sicherheitsabstand berechnet werden.

    Bei eingeblendeten Geräte- oder Materialzeilen wächst jede Baustellen-Lane
    nach unten mit, damit die nächste Kolonne erst darunter beginnt.
  */
  return Math.max(
    CREW_TIMELINE_ROW_MIN_HEIGHT_PX,
    CREW_TIMELINE_BAR_TOP_PX +
      safeLaneCount * laneHeight +
      CREW_TIMELINE_ROW_BOTTOM_PADDING_PX,
  );
}

function buildCrewTimelineLaneLayout({
  crewId,
  crewName,
  visibleAssignments,
  asphaltTimelineBars,
  laneHeight,
}: {
  crewId: string;
  crewName: string;
  laneHeight: number;
  visibleAssignments: {
    assignment: {
      id: string;
      crewId: string | null;
      startDate: Date;
      endDate: Date;
    };
  }[];
  asphaltTimelineBars: AsphaltTimelineBar[];
}): CrewTimelineLaneLayout {
  const assignmentLanes = new Map<string, number>();
  const asphaltLanes = new Map<string, number>();

  const items: CrewTimelineLaneItem[] = [
    ...visibleAssignments
      .filter(({ assignment }) => assignment.crewId === crewId)
      .map(({ assignment }) => ({
        id: assignment.id,
        kind: "assignment" as const,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
      })),

    ...asphaltTimelineBars
      .filter(
        (bar) => normalizeCrewName(bar.crewName) === normalizeCrewName(crewName),
      )
      .map((bar) => ({
        id: bar.id,
        kind: "asphalt" as const,
        startDate: bar.startDate,
        endDate: bar.endDate,
      })),
  ].sort((a, b) => {
    const startCompare =
      normalizeDay(a.startDate).getTime() - normalizeDay(b.startDate).getTime();

    if (startCompare !== 0) return startCompare;

    const endCompare =
      normalizeDay(a.endDate).getTime() - normalizeDay(b.endDate).getTime();

    if (endCompare !== 0) return endCompare;

    return a.kind.localeCompare(b.kind);
  });

  /*
    Jede Baustelle / jeder Asphalt-Dispo-Balken bekommt eine eigene Lane.
    Dadurch wächst die Kolonnenzeile automatisch nach unten, sobald eine
    Kolonne 2, 3, 4, 5 oder mehr Baustellen hat. Nicht mehr nur bei zeitlicher
    Überschneidung.
  */
  items.forEach((item, laneIndex) => {
    if (item.kind === "assignment") {
      assignmentLanes.set(item.id, laneIndex);
    } else {
      asphaltLanes.set(item.id, laneIndex);
    }
  });

  const laneCount = Math.max(1, items.length);

  return {
    laneCount,
    rowHeight: getCrewTimelineRowHeight(laneCount, laneHeight),
    laneHeight,
    assignmentLanes,
    asphaltLanes,
  };
}

function buildAsphaltTimelineBars({
  entries,
  visibleCrewNames,
}: {
  entries: AsphaltDispatchEntryForTimeline[];
  visibleCrewNames: Set<string>;
}) {
  const sortedEntries = entries
    .filter((entry) => visibleCrewNames.has(normalizeCrewName(entry.crew)))
    .sort((a, b) => {
      const crewCompare = a.crew.localeCompare(b.crew, "de-DE");
      if (crewCompare !== 0) return crewCompare;

      const projectCompare =
        `${a.projectNumber}-${a.projectName}`.localeCompare(
          `${b.projectNumber}-${b.projectName}`,
          "de-DE",
        );
      if (projectCompare !== 0) return projectCompare;

      return a.workDate.getTime() - b.workDate.getTime();
    });

  const bars: AsphaltTimelineBar[] = [];

  for (const entry of sortedEntries) {
    const last = bars[bars.length - 1];
    const entryDate = normalizeDay(entry.workDate);
    const entryProjectKey = `${entry.crew}|||${entry.projectNumber}|||${entry.projectName}`;
    const lastProjectKey = last
      ? `${last.crewName}|||${last.projectNumber}|||${last.projectName}`
      : "";

    const canMerge =
      last &&
      lastProjectKey === entryProjectKey &&
      getDateDiffInDays(last.endDate, entryDate) <= 1;

    const mixLabel = [entry.asphaltMixNumber, entry.asphaltMixName]
      .filter(Boolean)
      .join(" · ");

    if (canMerge) {
      last.endDate = entryDate;
      last.quantityTons += entry.quantityTons;
      last.entryCount += 1;
      last.hasForeignMix = last.hasForeignMix || entry.isForeignMix;

      if (mixLabel && !last.mixLabels.includes(mixLabel)) {
        last.mixLabels.push(mixLabel);
      }

      if (entry.notes && !last.notes.includes(entry.notes)) {
        last.notes.push(entry.notes);
      }

      continue;
    }

    bars.push({
      id: `asphalt-${entry.id}`,
      crewName: entry.crew,
      projectId: entry.projectId,
      projectNumber: entry.projectNumber,
      projectName: entry.projectName,
      constructionManager: entry.constructionManager,
      startDate: entryDate,
      endDate: entryDate,
      quantityTons: entry.quantityTons,
      entryCount: 1,
      mixLabels: mixLabel ? [mixLabel] : [],
      hasForeignMix: entry.isForeignMix,
      notes: entry.notes ? [entry.notes] : [],
    });
  }

  return bars;
}

function buildCrewDispatchMaterialMap({
  longHaulEntries,
  shortHaulAssignments,
  asphaltLoadAllocations,
}: {
  longHaulEntries: {
    id: string;
    workDate: Date;
    assignmentType: string;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    materialName: string | null;
    materialUnit: string | null;
    materialQuantity: number;
    notes: string | null;
  }[];
  shortHaulAssignments: {
    id: string;
    workDate: Date;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    material: string | null;
    tours: {
      id: string;
      projectId: string | null;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
      quantity: number | null;
      quantityUnit: string | null;
      notes: string | null;
    }[];
  }[];
  asphaltLoadAllocations: {
    id: string;
    workDate: Date;
    sourceType: string;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    totalTons: number;
    tourCount: number;
    vehicleNumber: string | null;
    licensePlate: string | null;
  }[];
}) {
  const map = new Map<string, CrewDispatchMaterialItem[]>();

  for (const entry of longHaulEntries) {
    const itemLabel = entry.materialName ?? "Material";
    const quantityLabel = formatMaterialQuantity(
      entry.materialQuantity,
      entry.materialUnit ?? undefined,
    );

    addMaterialItemToMap(map, {
      id: `long-${entry.id}`,
      workDate: entry.workDate,
      projectId: entry.projectId,
      projectNumber: entry.projectNumber,
      projectName: entry.projectName,
      sourceLabel:
        entry.assignmentType === "ASPHALT" ? "Langstrecke Asphalt" : "Langstrecke",
      itemLabel,
      quantityValue: entry.materialQuantity,
      quantityUnit: entry.materialUnit,
      quantityLabel,
      detail: entry.notes,
    });
  }

  for (const assignment of shortHaulAssignments) {
    if (assignment.tours.length === 0 && assignment.material) {
      addMaterialItemToMap(map, {
        id: `short-${assignment.id}`,
        workDate: assignment.workDate,
        projectId: assignment.projectId,
        projectNumber: assignment.projectNumber,
        projectName: assignment.projectName,
        sourceLabel: "Kurzstrecke",
        itemLabel: assignment.material,
        quantityValue: null,
        quantityUnit: null,
        quantityLabel: null,
        detail: null,
      });
    }

    for (const tour of assignment.tours) {
      const itemLabel =
        tour.itemName ??
        tour.customPurpose ??
        tour.material ??
        (tour.purposeType === "MATERIAL"
          ? "Material"
          : tour.purposeType === "ASPHALT"
            ? "Asphalt"
            : "Transport");

      addMaterialItemToMap(map, {
        id: `short-tour-${tour.id}`,
        workDate: assignment.workDate,
        projectId: tour.projectId ?? assignment.projectId,
        projectNumber: tour.projectNumber || assignment.projectNumber,
        projectName: tour.projectName || assignment.projectName,
        sourceLabel: "Kurzstrecke",
        itemLabel,
        quantityValue: tour.quantity,
        quantityUnit: tour.quantityUnit,
        quantityLabel: formatMaterialQuantity(
          tour.quantity,
          tour.quantityUnit ?? undefined,
        ),
        detail: tour.notes,
      });
    }
  }

  for (const allocation of asphaltLoadAllocations) {
    const mixLabel =
      [allocation.asphaltMixNumber, allocation.asphaltMixName]
        .filter(Boolean)
        .join(" · ") || "Asphalt";

    const vehicleLabel = [allocation.vehicleNumber, allocation.licensePlate]
      .filter(Boolean)
      .join(" · ");

    addMaterialItemToMap(map, {
      id: `asphalt-load-${allocation.id}`,
      workDate: allocation.workDate,
      projectId: allocation.projectId,
      projectNumber: allocation.projectNumber,
      projectName: allocation.projectName,
      sourceLabel:
        allocation.sourceType === "LONG"
          ? "Asphalt Langstrecke"
          : "Asphalt Kurzstrecke",
      itemLabel: mixLabel,
      quantityValue: allocation.totalTons,
      quantityUnit: "t",
      quantityLabel: formatMaterialQuantity(allocation.totalTons, "t"),
      detail: [
        allocation.tourCount > 0 ? `${allocation.tourCount} Touren` : null,
        vehicleLabel || null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    });
  }

  return map;
}


function buildCrewDispatchTruckMaps({
  longHaulEntries,
  shortHaulAssignments,
  asphaltLoadAllocations,
  specialVehicleDispatchAssignments,
}: {
  longHaulEntries: {
    id: string;
    workDate: Date;
    assignmentType: string;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    materialName: string | null;
    materialUnit: string | null;
    materialQuantity: number;
    notes: string | null;
    truckAssignments?: {
      id: string;
      ownerType: string;
      vehicleCategory: string;
      driverName: string | null;
      vehicleNumber: string | null;
      licensePlate: string | null;
      vehicleType: string | null;
      subcontractorName: string | null;
      vehicle: { isSpecialVehicle: boolean } | null;
      plannedTourCount: number;
      plannedTotalTons: number;
      notes: string | null;
    }[];
  }[];
  shortHaulAssignments: {
    id: string;
    workDate: Date;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    vehicleNumber?: string | null;
    licensePlate?: string | null;
    vehicleType?: string | null;
    vehicleCategory?: string | null;
    driverName?: string | null;
    vehicle?: { isSpecialVehicle: boolean } | null;
    material: string | null;
    notes?: string | null;
    tours: {
      id: string;
      projectId: string | null;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
      quantity: number | null;
      quantityUnit: string | null;
      notes: string | null;
    }[];
  }[];
  asphaltLoadAllocations: {
    id: string;
    workDate: Date;
    sourceType: string;
    ownerType?: string | null;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    totalTons: number;
    tourCount: number;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleType?: string | null;
    vehicleCategory?: string | null;
    driverName?: string | null;
    subcontractorName?: string | null;
    vehicle?: { isSpecialVehicle: boolean } | null;
  }[];
  specialVehicleDispatchAssignments: {
    id: string;
    workDate: Date;
    startTime: string;
    endTime: string;
    vehicleName: string;
    transportVehicleName: string | null;
    operatorDriverName: string | null;
    projectId: string | null;
    projectNumber: string;
    projectName: string;
    crewName: string | null;
    taskText: string;
    materialName: string | null;
    quantity: number | null;
    quantityUnit: string | null;
    notes: string | null;
    vehicle?: {
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
    } | null;
  }[];
}): CrewDispatchTruckMaps {
  const truckMap = new Map<string, CrewDispatchTruckItem[]>();
  const specialVehicleMap = new Map<string, CrewDispatchTruckItem[]>();

  for (const entry of longHaulEntries) {
    const assignments = entry.truckAssignments ?? [];

    for (const assignment of assignments) {
      const ownerLabel = getTruckOwnerLabel(assignment.ownerType);
      const vehicleLabel =
        ownerLabel === "Fremd"
          ? assignment.vehicleCategory || "Fremd-LKW"
          : assignment.vehicleNumber ?? assignment.licensePlate ?? assignment.vehicleCategory;
      const plannedTotal =
        assignment.plannedTotalTons > 0
          ? assignment.plannedTotalTons
          : assignments.length <= 1 && entry.materialQuantity > 0
            ? entry.materialQuantity
            : null;

      const isSpecialVehicle = assignment.vehicle?.isSpecialVehicle === true;
      const targetMap = isSpecialVehicle ? specialVehicleMap : truckMap;

      addTruckItemToMap(targetMap, {
        id: `${isSpecialVehicle ? "long-special" : "long-truck"}-${assignment.id}`,
        workDate: entry.workDate,
        projectId: entry.projectId,
        projectNumber: entry.projectNumber,
        projectName: entry.projectName,
        sourceLabel:
          entry.assignmentType === "ASPHALT"
            ? "Langstrecke Asphalt"
            : "Langstrecke",
        ownerLabel: isSpecialVehicle
          ? getSpecialVehicleOwnerLabel(ownerLabel)
          : ownerLabel,
        vehicleLabel: vehicleLabel || (isSpecialVehicle ? "Sonderfahrzeug" : "LKW"),
        driverLabel: getDriverShortName(assignment.driverName),
        subcontractorName: assignment.subcontractorName,
        tourCount: assignment.plannedTourCount,
        quantityValue: plannedTotal,
        quantityUnit: entry.materialUnit,
        materialLabel: entry.materialName,
        detail: assignment.notes ?? entry.notes,
      });
    }
  }

  for (const assignment of shortHaulAssignments) {
    const materialTotals = new Map<
      string,
      { label: string; unit: string | null; quantity: number }
    >();
    const fallbackMaterials: string[] = [];

    for (const tour of assignment.tours) {
      const materialLabel =
        tour.itemName ??
        tour.customPurpose ??
        tour.material ??
        assignment.material ??
        (tour.purposeType === "MATERIAL"
          ? "Material"
          : tour.purposeType === "ASPHALT"
            ? "Asphalt"
            : "Transport");

      if (tour.quantity !== null && tour.quantity > 0) {
        const key = `${materialLabel}|||${tour.quantityUnit ?? ""}`;
        const existing = materialTotals.get(key);

        if (existing) {
          existing.quantity += tour.quantity;
        } else {
          materialTotals.set(key, {
            label: materialLabel,
            unit: tour.quantityUnit,
            quantity: tour.quantity,
          });
        }
      } else if (materialLabel && !fallbackMaterials.includes(materialLabel)) {
        fallbackMaterials.push(materialLabel);
      }
    }

    const totals = Array.from(materialTotals.values());
    const firstTotal = totals[0];
    const materialLabel = firstTotal
      ? [firstTotal.label, totals.length > 1 ? `+${totals.length - 1}` : null]
          .filter(Boolean)
          .join(" ")
      : fallbackMaterials.join(" / ") || assignment.material;
    const quantityValue = firstTotal?.quantity ?? null;
    const quantityUnit = firstTotal?.unit ?? null;

    const isSpecialVehicle = assignment.vehicle?.isSpecialVehicle === true;
    const targetMap = isSpecialVehicle ? specialVehicleMap : truckMap;

    addTruckItemToMap(targetMap, {
      id: `${isSpecialVehicle ? "short-special" : "short-truck"}-${assignment.id}`,
      workDate: assignment.workDate,
      projectId: assignment.projectId,
      projectNumber: assignment.projectNumber,
      projectName: assignment.projectName,
      sourceLabel: "Kurzstrecke",
      ownerLabel: isSpecialVehicle ? "Sonder" : "STIX",
      vehicleLabel:
        assignment.vehicleNumber ??
        assignment.licensePlate ??
        assignment.vehicleCategory ??
        (isSpecialVehicle ? "Sonderfahrzeug" : "LKW"),
      driverLabel: getDriverShortName(assignment.driverName),
      subcontractorName: null,
      tourCount: assignment.tours.length,
      quantityValue,
      quantityUnit,
      materialLabel,
      detail:
        totals.length > 1
          ? totals
              .map((total) =>
                [formatMaterialQuantity(total.quantity, total.unit), total.label]
                  .filter(Boolean)
                  .join(" "),
              )
              .join(" · ")
          : assignment.notes ?? null,
    });
  }

  for (const allocation of asphaltLoadAllocations) {
    const ownerLabel = getTruckOwnerLabel(allocation.ownerType);
    const mixLabel =
      [allocation.asphaltMixNumber, allocation.asphaltMixName]
        .filter(Boolean)
        .join(" · ") || "Asphalt";

    const isSpecialVehicle = allocation.vehicle?.isSpecialVehicle === true;
    const targetMap = isSpecialVehicle ? specialVehicleMap : truckMap;

    addTruckItemToMap(targetMap, {
      id: `${isSpecialVehicle ? "asphalt-special" : "asphalt-truck"}-${allocation.id}`,
      workDate: allocation.workDate,
      projectId: allocation.projectId,
      projectNumber: allocation.projectNumber,
      projectName: allocation.projectName,
      sourceLabel:
        allocation.sourceType === "LONG"
          ? "Asphalt Langstrecke"
          : "Asphalt Kurzstrecke",
      ownerLabel: isSpecialVehicle
        ? getSpecialVehicleOwnerLabel(ownerLabel)
        : ownerLabel,
      vehicleLabel:
        allocation.vehicleNumber ??
        allocation.licensePlate ??
        allocation.vehicleCategory ??
        (isSpecialVehicle ? "Sonderfahrzeug" : "LKW"),
      driverLabel: getDriverShortName(allocation.driverName),
      subcontractorName: allocation.subcontractorName ?? null,
      tourCount: allocation.tourCount,
      quantityValue: allocation.totalTons,
      quantityUnit: "t",
      materialLabel: mixLabel,
      detail: null,
    });
  }

  for (const assignment of specialVehicleDispatchAssignments) {
    const vehicleLabel = assignment.vehicle
      ? [
          assignment.vehicle.vehicleNumber,
          assignment.vehicle.licensePlate,
          assignment.vehicle.category,
          assignment.vehicle.vehicleType,
        ]
          .filter(Boolean)
          .join(" · ")
      : assignment.vehicleName || "Sonderfahrzeug";

    addTruckItemToMap(specialVehicleMap, {
      id: `special-dispatch-${assignment.id}`,
      workDate: assignment.workDate,
      projectId: assignment.projectId,
      projectNumber: assignment.projectNumber,
      projectName: assignment.projectName,
      sourceLabel: "Sonderfahrzeug-Disposition",
      ownerLabel: "Sonder",
      vehicleLabel,
      driverLabel: null,
      subcontractorName: null,
      tourCount: 1,
      quantityValue: assignment.quantity,
      quantityUnit: assignment.quantityUnit,
      materialLabel: assignment.materialName ?? assignment.taskText,
      detail: [
        `${assignment.startTime}–${assignment.endTime}`,
        assignment.taskText,
        assignment.crewName ? `Kolonne ${assignment.crewName}` : null,
        assignment.transportVehicleName ? `Transport ${assignment.transportVehicleName}` : null,
        assignment.operatorDriverName ? `Bediener ${assignment.operatorDriverName}` : null,
        assignment.notes,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    });
  }

  return {
    truckMap,
    specialVehicleMap,
  };
}

function getBestCrewFocusDate({
  crewId,
  crewName,
  visibleAssignments,
  asphaltTimelineBars,
  today,
}: {
  crewId: string;
  crewName: string;
  visibleAssignments: {
    assignment: {
      crewId: string | null;
      startDate: Date;
      endDate: Date;
    };
  }[];
  asphaltTimelineBars: AsphaltTimelineBar[];
  today: Date;
}) {
  const todayTime = normalizeDay(today).getTime();

  const normalRanges = visibleAssignments
    .filter(({ assignment }) => assignment.crewId === crewId)
    .map(({ assignment }) => ({
      startDate: normalizeDay(assignment.startDate),
      endDate: normalizeDay(assignment.endDate),
    }));

  const asphaltRanges = asphaltTimelineBars
    .filter(
      (bar) => normalizeCrewName(bar.crewName) === normalizeCrewName(crewName),
    )
    .map((bar) => ({
      startDate: normalizeDay(bar.startDate),
      endDate: normalizeDay(bar.endDate),
    }));

  const ranges = [...normalRanges, ...asphaltRanges].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime(),
  );

  const activeToday = ranges.find(
    (range) =>
      range.startDate.getTime() <= todayTime &&
      range.endDate.getTime() >= todayTime,
  );

  if (activeToday) {
    return activeToday.startDate;
  }

  const nextRange = ranges.find(
    (range) => range.startDate.getTime() > todayTime,
  );

  if (nextRange) {
    return nextRange.startDate;
  }

  const previousRange = ranges
    .filter((range) => range.endDate.getTime() < todayTime)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0];

  if (previousRange) {
    return previousRange.startDate;
  }

  return today;
}

export default async function CrewDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    from?: string;
    to?: string;
    focus?: string;
    highlightCrew?: string;
    showWeekend?: string;
    view?: string;
    range?: string;
    customCount?: string;
    customUnit?: string;
    rangeMode?: string;
    bufferBack?: string;
    bufferForward?: string;
    daysBufferBack?: string;
    daysBufferForward?: string;
    weeksBufferBack?: string;
    weeksBufferForward?: string;
    monthsBufferBack?: string;
    monthsBufferForward?: string;
    showAsphaltDispatchCrews?: string;
    showEquipment?: string;
    showTrucks?: string;
    showSpecialVehicles?: string;
    showMaterial?: string;
    showNotes?: string;
    axis?: string;
    hideWeekend?: string;
  }>;
}) {
  const params = await searchParams;

  const view = getTimelineView(params.view);
  const planningAxis = getPlanningAxis(params.axis);
  const range = getTimelineRange(params.range, view);
  const customUnit = getCustomUnit(params.customUnit, view);
  const customCount = getCustomCount(params.customCount, view);
  const hideWeekend = params.hideWeekend === "1" || params.showWeekend !== "1";
  const showWeekend = !hideWeekend;
  const showAsphaltDispatchCrews = params.showAsphaltDispatchCrews === "1";
  const showEquipment = params.showEquipment === "1";
  const showTrucks = params.showTrucks === "1";
  const showSpecialVehicles = params.showSpecialVehicles === "1";
  const showMaterial = params.showMaterial === "1";
  const showNotes = params.showNotes === "1";
  const supplementalLayerCount = getSupplementLayerCount({
    showEquipment,
    showTrucks,
    showSpecialVehicles,
    showMaterial,
    showNotes,
  });
  const crewTimelineLaneHeight = getCrewTimelineLaneHeight(supplementalLayerCount);
  const highlightedCrewId = params.highlightCrew ?? null;

  const defaultBufferBack = 0;
  const defaultBufferForward = 0;
  const viewBuffers = getViewBufferValues({
    view,
    params,
    fallbackBack: defaultBufferBack,
    fallbackForward: defaultBufferForward,
  });
  const bufferBack = viewBuffers[view].back;
  const bufferForward = viewBuffers[view].forward;

  const selectedDate = parseDateParam(params.week);
  const anchorDate =
    view === "months" ? startOfMonth(selectedDate) : startOfWeek(selectedDate);

  const fallbackStart =
    view === "months" ? startOfMonth(anchorDate) : startOfWeek(anchorDate);

  const fallbackEnd = getDefaultRangeEnd({
    view,
    range,
    customCount,
    customUnit,
    anchorDate,
  });

  const useCustomDateInputs =
    params.rangeMode === "dates" ||
    (params.rangeMode !== "count" && Boolean(params.from || params.to));

  const { fromDate, toDate } = getSafeDateRange({
    from: useCustomDateInputs ? params.from : undefined,
    to: useCustomDateInputs ? params.to : undefined,
    fallbackStart,
    fallbackEnd,
  });
  const isCustomDateRange = range === "custom" && useCustomDateInputs;

  const focusDateFromParams = params.focus
    ? parseDateParam(params.focus)
    : fromDate;

  const { timelineFromDate, timelineToDate } = getBufferedDateRange({
    view,
    fromDate,
    toDate,
    bufferBack,
    bufferForward,
  });

  const weekStartForNewRows = startOfWeek(fromDate);
  const weekStartInput = formatDateInput(weekStartForNewRows);
  const focusDate = formatDateInput(focusDateFromParams);

  const timelineUnits = buildTimelineUnitsFromDateRange({
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

  const nextRange = shiftDateRange({
    fromDate,
    toDate,
    view,
    direction: 1,
  });

  const todayRange = getTodayRange(view);
  const today = parseDateParam(formatDateInput(new Date()));

  const [
    planningRows,
    projects,
    allCrews,
    allEmployees,
    allVehicles,
    asphaltDispatchEntries,
    truckLongHaulEntries,
    shortHaulAssignments,
    asphaltLoadAllocations,
    specialVehicleDispatchAssignments,
    equipmentDispatchAssignments,
  ] = await Promise.all([
      prisma.crewPlanningRow.findMany({
        include: {
          assignments: {
            include: {
              crew: {
                include: {
                  members: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      employee: true,
                    },
                    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                  },
                  defaultVehicles: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      vehicle: true,
                    },
                    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                  },
                },
              },
              extraEmployees: {
                include: {
                  employee: true,
                },
                orderBy: [{ createdAt: "asc" }],
              },
              extraVehicles: {
                include: {
                  vehicle: true,
                },
                orderBy: [{ createdAt: "asc" }],
              },
            },
            orderBy: [{ startDate: "asc" }, { crewName: "asc" }],
          },
        },
        orderBy: [
          { weekStart: "asc" },
          { sortOrder: "asc" },
          { projectNumber: "asc" },
          { rowTitle: "asc" },
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
        include: {
          projectNotes: {
            where: {
              visibility: {
                in: ["DISPATCH", "BTB"],
              },
              OR: [
                {
                  noteDate: {
                    gte: periodStart,
                    lt: periodEndExclusive,
                  },
                  noteEndDate: null,
                },
                {
                  noteDate: {
                    lt: periodEndExclusive,
                  },
                  noteEndDate: {
                    gte: periodStart,
                  },
                },
              ],
            },
            orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: [{ projectNumber: "asc" }],
      }),

      prisma.crew.findMany({
        where: {
          isActive: true,
        },
        include: {
          members: {
            where: {
              isActive: true,
            },
            include: {
              employee: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          defaultVehicles: {
            where: {
              isActive: true,
            },
            include: {
              vehicle: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),

      prisma.employee.findMany({
        where: {
          statusValue: "active",
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),

      prisma.vehicle.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ vehicleNumber: "asc" }],
      }),

      showAsphaltDispatchCrews
        ? prisma.asphaltDispatchEntry.findMany({
            where: {
              workDate: {
                gte: periodStart,
                lt: periodEndExclusive,
              },
            },
            orderBy: [
              { crew: "asc" },
              { workDate: "asc" },
              { createdAt: "asc" },
            ],
          })
        : Promise.resolve([]),

      showMaterial || showTrucks || showSpecialVehicles
        ? prisma.truckLongHaulEntry.findMany({
            where: {
              workDate: {
                gte: periodStart,
                lt: periodEndExclusive,
              },
            },
            select: {
              id: true,
              workDate: true,
              assignmentType: true,
              projectId: true,
              projectNumber: true,
              projectName: true,
              materialName: true,
              materialUnit: true,
              materialQuantity: true,
              notes: true,
              truckAssignments: {
                select: {
                  id: true,
                  ownerType: true,
                  vehicleCategory: true,
                  driverName: true,
                  vehicleNumber: true,
                  licensePlate: true,
                  vehicleType: true,
                  subcontractorName: true,
                  vehicle: {
                    select: {
                      isSpecialVehicle: true,
                    },
                  },
                  plannedTourCount: true,
                  plannedTotalTons: true,
                  notes: true,
                },
                orderBy: [{ ownerType: "asc" }, { createdAt: "asc" }],
              },
            },
            orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),

      showMaterial || showTrucks || showSpecialVehicles
        ? prisma.shortHaulAssignment.findMany({
            where: {
              workDate: {
                gte: periodStart,
                lt: periodEndExclusive,
              },
            },
            select: {
              id: true,
              workDate: true,
              projectId: true,
              projectNumber: true,
              projectName: true,
              material: true,
              vehicleNumber: true,
              licensePlate: true,
              vehicleType: true,
              vehicleCategory: true,
              driverName: true,
              vehicle: {
                select: {
                  isSpecialVehicle: true,
                },
              },
              notes: true,
              tours: {
                select: {
                  id: true,
                  projectId: true,
                  projectNumber: true,
                  projectName: true,
                  purposeType: true,
                  itemName: true,
                  customPurpose: true,
                  material: true,
                  quantity: true,
                  quantityUnit: true,
                  notes: true,
                },
                orderBy: [{ tourNumber: "asc" }, { startTime: "asc" }],
              },
            },
            orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
          })
        : Promise.resolve([]),

      showMaterial || showTrucks || showSpecialVehicles
        ? prisma.asphaltLoadAllocation.findMany({
            where: {
              workDate: {
                gte: periodStart,
                lt: periodEndExclusive,
              },
            },
            select: {
              id: true,
              workDate: true,
              sourceType: true,
              ownerType: true,
              projectId: true,
              projectNumber: true,
              projectName: true,
              asphaltMixNumber: true,
              asphaltMixName: true,
              totalTons: true,
              tourCount: true,
              vehicleNumber: true,
              licensePlate: true,
              vehicleType: true,
              vehicleCategory: true,
              driverName: true,
              subcontractorName: true,
              vehicle: {
                select: {
                  isSpecialVehicle: true,
                },
              },
            },
            orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),

      showSpecialVehicles || planningAxis === "specialEquipment"
        ? prisma.specialVehicleDispatchAssignment.findMany({
            where: {
              workDate: {
                gte: periodStart,
                lt: periodEndExclusive,
              },
            },
            include: {
              vehicle: {
                select: {
                  vehicleNumber: true,
                  licensePlate: true,
                  vehicleType: true,
                  category: true,
                },
              },
            },
            orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
          })
        : Promise.resolve([]),

      showEquipment || planningAxis === "equipment"
        ? prisma.equipmentDispatchAssignment.findMany({
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
              crew: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
          })
        : Promise.resolve([]),
    ]);

  const crews = showAsphaltDispatchCrews
    ? allCrews
    : allCrews.filter((crew) => !crew.isAsphaltDispatchCrew);

  const asphaltDispatchCrewCount = allCrews.filter(
    (crew) => crew.isAsphaltDispatchCrew,
  ).length;

  const visibleCrewNames = new Set(
    crews.map((crew) => normalizeCrewName(crew.name)),
  );

  const asphaltTimelineBars = buildAsphaltTimelineBars({
    entries: asphaltDispatchEntries,
    visibleCrewNames,
  });

  const projectMaterialMap = buildCrewDispatchMaterialMap({
    longHaulEntries: truckLongHaulEntries,
    shortHaulAssignments,
    asphaltLoadAllocations,
  });

  const { truckMap: projectTruckMap, specialVehicleMap: projectSpecialVehicleMap } =
    buildCrewDispatchTruckMaps({
      longHaulEntries: truckLongHaulEntries,
      shortHaulAssignments,
      asphaltLoadAllocations,
      specialVehicleDispatchAssignments,
    });

  const projectOptions = projects.map((project) => ({
    id: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    defaultStartTime: getProjectDefaultStartTime(project),
    defaultEndTime: getProjectDefaultEndTime(project),
  }));
  const projectNotesById = new Map(
    projects
      .map((project) => [project.id, project.projectNotes] as const)
      .filter(([, notes]) => notes.length > 0),
  );
  const projectNotesByKey = new Map<string, CrewDispatchProjectNote[]>();

  for (const project of projects) {
    const notes = project.projectNotes;
    if (notes.length === 0) continue;

    for (const key of getProjectMaterialKeys({
      projectId: project.id,
      projectName: project.name,
      projectNumber: project.projectNumber,
    })) {
      projectNotesByKey.set(key, notes);
    }
  }

  const assignmentsWithRows = planningRows.flatMap((row) =>
    row.assignments.map((assignment) => ({
      row,
      assignment,
    })),
  );

  const visibleAssignments = assignmentsWithRows.filter(({ assignment }) =>
    timelineUnits.some((unit) =>
      rangesOverlapInclusive(
        assignment.startDate,
        assignment.endDate,
        unit.startDate,
        unit.endDateExclusive,
      ),
    ),
  );

  const conflictAssignmentsForClient = assignmentsWithRows
    .filter(({ assignment }) => Boolean(assignment.crewId))
    .map(({ row, assignment }) => ({
      id: assignment.id,
      crewId: assignment.crewId ?? "",
      projectNumber: row.projectNumber,
      projectName: row.projectName,
      rowTitle: row.rowTitle,
      startDate: formatDateInput(assignment.startDate),
      endDate: formatDateInput(assignment.endDate),
    }));

  const planningSettingsParams = {
    hideWeekend,
    daysBufferBack: view === "days" ? bufferBack : viewBuffers.days.back,
    daysBufferForward:
      view === "days" ? bufferForward : viewBuffers.days.forward,
    weeksBufferBack: view === "weeks" ? bufferBack : viewBuffers.weeks.back,
    weeksBufferForward:
      view === "weeks" ? bufferForward : viewBuffers.weeks.forward,
    monthsBufferBack: view === "months" ? bufferBack : viewBuffers.months.back,
    monthsBufferForward:
      view === "months" ? bufferForward : viewBuffers.months.forward,
  };

  const leftColumnWidth = getLeftColumnWidth(unitCount);
  const timelineGridColumns = getTimelineGridColumns(view, unitCount);
  const timelineMinWidth = getTimelineMinWidth(view, unitCount);

  const crewTimelineRows = new Map(
    crews.map((crew) => [
      crew.id,
      buildCrewTimelineLaneLayout({
        crewId: crew.id,
        crewName: crew.name,
        visibleAssignments,
        asphaltTimelineBars,
        laneHeight: crewTimelineLaneHeight,
      }),
    ] as const),
  );

  const projectAxisRows: PlanningAxisRow[] = projects.map((project) => ({
    id: project.id,
    label: `${project.projectNumber} · ${project.name}`,
    subLabel: project.constructionManager ?? undefined,
    href: `/projects/${project.id}`,
  }));

  const employeeAxisRows: PlanningAxisRow[] = allEmployees.map((employee) => ({
    id: employee.id,
    label: `${employee.lastName}, ${employee.firstName}`,
    subLabel: employee.departmentLabel ?? employee.companyLabel ?? undefined,
  }));

  const equipmentAxisRows: PlanningAxisRow[] = allVehicles
    .filter((vehicle) => !vehicle.isSpecialVehicle)
    .map((vehicle) => ({
      id: vehicle.id,
      label: getVehicleLabel(vehicle),
      subLabel: vehicle.category,
      href: `/admin/vehicles#vehicle-${vehicle.id}`,
    }));

  const specialEquipmentAxisRows: PlanningAxisRow[] = allVehicles
    .filter((vehicle) => vehicle.isSpecialVehicle)
    .map((vehicle) => ({
      id: vehicle.id,
      label: getVehicleLabel(vehicle),
      subLabel: vehicle.category,
      href: `/admin/vehicles#vehicle-${vehicle.id}`,
    }));

  const planningAxisRows =
    planningAxis === "projects"
      ? projectAxisRows
      : planningAxis === "employees"
        ? employeeAxisRows
        : planningAxis === "equipment"
          ? equipmentAxisRows
          : planningAxis === "specialEquipment"
            ? specialEquipmentAxisRows
            : [];

  const planningAxisBars = new Map<string, PlanningAxisBar[]>();
  const addPlanningAxisBar = (bar: PlanningAxisBar) => {
    const existing = planningAxisBars.get(bar.rowId) ?? [];
    existing.push(bar);
    planningAxisBars.set(bar.rowId, existing);
  };

  if (planningAxis === "projects") {
    for (const { row, assignment } of visibleAssignments) {
      if (!row.projectId) continue;

      addPlanningAxisBar({
        id: assignment.id,
        rowId: row.projectId,
        title: assignment.crewName || assignment.crew?.name || "Team",
        subtitle: getProjectRowTitle(row),
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        tone: "project",
      });
    }

    for (const bar of asphaltTimelineBars) {
      if (!bar.projectId) continue;

      addPlanningAxisBar({
        id: bar.id,
        rowId: bar.projectId,
        title: bar.crewName,
        subtitle: `${bar.projectNumber} · ${bar.projectName}`,
        startDate: bar.startDate,
        endDate: bar.endDate,
        tone: "project",
      });
    }
  } else if (planningAxis === "employees") {
    for (const { row, assignment } of visibleAssignments) {
      const employeeIds = new Set<string>();

      assignment.crew?.members.forEach((member) => {
        employeeIds.add(member.employee.id);
      });

      assignment.extraEmployees.forEach((item) => {
        employeeIds.add(item.employee.id);
      });

      employeeIds.forEach((employeeId) => {
        addPlanningAxisBar({
          id: `${assignment.id}-${employeeId}`,
          rowId: employeeId,
          title: getProjectRowTitle(row),
          subtitle: assignment.crewName || assignment.crew?.name || undefined,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          tone: "employee",
        });
      });
    }
  } else if (planningAxis === "equipment" || planningAxis === "specialEquipment") {
    const useSpecial = planningAxis === "specialEquipment";

    for (const { row, assignment } of visibleAssignments) {
      const vehicles = [
        ...(assignment.crew?.defaultVehicles.map((item) => item.vehicle) ?? []),
        ...assignment.extraVehicles.map((item) => item.vehicle),
      ].filter((vehicle) => vehicle.isSpecialVehicle === useSpecial);

      vehicles.forEach((vehicle) => {
        addPlanningAxisBar({
          id: `${assignment.id}-${vehicle.id}`,
          rowId: vehicle.id,
          title: getProjectRowTitle(row),
          subtitle: assignment.crewName || assignment.crew?.name || undefined,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          tone: useSpecial ? "special" : "equipment",
        });
      });
    }

    if (!useSpecial) {
      for (const assignment of equipmentDispatchAssignments) {
        addPlanningAxisBar({
          id: assignment.id,
          rowId: assignment.vehicleId,
          title: `${assignment.project.projectNumber} · ${assignment.project.name}`,
          subtitle: assignment.crew?.name ?? "Gerätedisposition",
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          tone: "equipment",
        });
      }
    } else {
      for (const assignment of specialVehicleDispatchAssignments) {
        if (!assignment.vehicleId) continue;

        addPlanningAxisBar({
          id: assignment.id,
          rowId: assignment.vehicleId,
          title:
            assignment.projectName ||
            assignment.taskText ||
            assignment.vehicleName ||
            "Sondergerät",
          subtitle: assignment.crewName ?? assignment.operatorDriverName ?? undefined,
          startDate: assignment.workDate,
          endDate: assignment.workDate,
          tone: "special",
        });
      }
    }
  }

  for (const bars of planningAxisBars.values()) {
    bars.sort((a, b) => {
      const startCompare =
        normalizeDay(a.startDate).getTime() - normalizeDay(b.startDate).getTime();

      if (startCompare !== 0) return startCompare;

      return a.title.localeCompare(b.title, "de-DE");
    });
  }

  const hrefBase = {
    planningAxis,
    extraParams: planningSettingsParams,
    view,
    range,
    customCount,
    customUnit,
    showWeekend,
    bufferBack,
    bufferForward,
    showAsphaltDispatchCrews,
    showEquipment,
    showTrucks,
    showSpecialVehicles,
    showMaterial,
    showNotes,
  };

  const previousHref = buildCrewDispatchHref({
    fromDate: previousRange.fromDate,
    toDate: previousRange.toDate,
    focusDate: previousRange.fromDate,
    ...hrefBase,
  });

  const todayHref = buildCrewDispatchHref({
    fromDate: todayRange.fromDate,
    toDate: todayRange.toDate,
    focusDate: todayRange.focusDate,
    ...hrefBase,
  });

  const nextHref = buildCrewDispatchHref({
    fromDate: nextRange.fromDate,
    toDate: nextRange.toDate,
    focusDate: nextRange.fromDate,
    ...hrefBase,
  });

  return (
    <AppShell
      title="Planung"
      description="Horizontale Zeitstrahlplanung für Projekte, Mitarbeiter, Teams, Geräte und Sondergeräte."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Teams sichtbar" value={String(crews.length)} />
        <SummaryCard
          label="Einteilungen sichtbar"
          value={String(visibleAssignments.length + asphaltTimelineBars.length)}
        />
        <SummaryCard
          label="Asphalt-Dispo-Kolonnen"
          value={String(asphaltDispatchCrewCount)}
        />
        <SummaryCard label="Aktive Projekte" value={String(projects.length)} />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/crews"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Teams verwalten →
        </Link>

        <Link
          href="/asphalt-dispatch"
          className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
        >
          Asphaltdisposition öffnen
        </Link>

        <Link
          href="/projects"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projekte öffnen
        </Link>

        <Link
          href="/admin/vehicles"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Großgeräte/Fahrzeuge öffnen
        </Link>
      </div>

      <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-gray-900">
          + Baustellenzeile manuell hinzufügen
        </summary>

        <CrewPlanningRowForm
          action={createCrewPlanningRow}
          weekStart={weekStartInput}
          projects={projects}
        />
      </details>

      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm font-semibold text-blue-900">
        Beim Klick auf einen Kolonnennamen springt der Zeitstrahl zur aktuellen,
        nächsten oder letzten Einteilung dieser Kolonne. Asphalt-Dispo-Einträge
        werden dabei mit berücksichtigt.
      </div>

      <div
        data-crew-dispatch-root
        className="max-w-full overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <CrewDispatchStickyOffset />
        <div
          data-crew-dispatch-sticky
          data-crew-dispatch-sticky-controls
          className="sticky top-0 z-[90] -mx-px -mt-px overflow-hidden rounded-t-2xl border border-gray-200 bg-white p-4 pt-[calc(var(--app-header-height,0px)+1rem)] shadow-sm"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Planung · {getPlanningAxisLabel(planningAxis)} · {getViewLabel(view)} ·{" "}
                {isCustomDateRange
                  ? "freier Zeitraum"
                  : range === "custom"
                    ? `Eigener Wert ${customCount} ${getCustomUnitLabel(customUnit)}`
                    : getRangeLabel(range)}
              </div>

              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {getTimelineTitle(timelineUnits, view)}
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Fokus: {formatShortDate(focusDateFromParams)} · Zeitraum:{" "}
                {formatShortDate(fromDate)} – {formatShortDate(toDate)} ·
                geladen: {getTimelineSubtitle(timelineUnits)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={previousHref}
                scroll={false}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                ← Zeitraum zurück
              </Link>

              <CrewTimelineFocusButton
                focusDate={formatDateInput(todayRange.focusDate)}
                fallbackHref={todayHref}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Heute
              </CrewTimelineFocusButton>

              <Link
                href={nextHref}
                scroll={false}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Zeitraum weiter →
              </Link>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1 border-b border-gray-200 pb-2">
            {planningAxisTabs.map((tab) => (
              <Link
                key={tab.value}
                href={buildCrewDispatchHref({
                  planningAxis: tab.value,
                  extraParams: planningSettingsParams,
                  fromDate,
                  toDate,
                  view,
                  range,
                  customCount,
                  customUnit,
                  showWeekend,
                  bufferBack,
                  bufferForward,
                  showAsphaltDispatchCrews,
                  showEquipment,
                  showTrucks,
                  showSpecialVehicles,
                  showMaterial,
                  showNotes,
                  focusDate,
                  highlightCrewId: highlightedCrewId,
                })}
                scroll={false}
                className={
                  planningAxis === tab.value
                    ? "rounded-none bg-yellow-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-950"
                    : "rounded-none px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-600 hover:bg-gray-50 hover:text-gray-950"
                }
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
                {(["days", "weeks", "months"] as TimelineView[]).map((item) => {
                  const targetRange = getRangeForView(range, item);
                  const targetStart =
                    item === "months"
                      ? startOfMonth(focusDateFromParams)
                      : startOfWeek(focusDateFromParams);
                  const targetEnd = getDefaultRangeEnd({
                    view: item,
                    range: targetRange,
                    customCount,
                    customUnit,
                    anchorDate: targetStart,
                  });
                  const targetBuffer = viewBuffers[item];

                  return (
                    <Link
                      key={item}
                      href={buildCrewDispatchHref({
                        planningAxis,
                        extraParams: planningSettingsParams,
                        fromDate: targetStart,
                        toDate: targetEnd,
                        view: item,
                        range: targetRange,
                        customCount,
                        customUnit,
                        showWeekend,
                        bufferBack: targetBuffer.back,
                        bufferForward: targetBuffer.forward,
                        showAsphaltDispatchCrews,
                        showEquipment,
                        showTrucks,
                        showSpecialVehicles,
                        showMaterial,
                        showNotes,
                        focusDate: targetStart,
                        highlightCrewId: highlightedCrewId,
                      })}
                      scroll={false}
                      className={
                        view === item
                          ? "rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                          : "rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                      }
                    >
                      {getViewLabel(item)}
                    </Link>
                  );
                })}
              </div>

              <div className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50 p-1">
                {(
                  view === "months"
                    ? (["4m", "8m", "12m"] as TimelineRange[])
                    : view === "weeks"
                      ? (["3w", "6w", "9w"] as TimelineRange[])
                      : (["7d", "14d", "21d"] as TimelineRange[])
                ).map((item) => {
                  const presetStart =
                    view === "months"
                      ? startOfMonth(focusDateFromParams)
                      : startOfWeek(focusDateFromParams);

                  const presetEnd = getDefaultRangeEnd({
                    view,
                    range: item,
                    customCount,
                    customUnit,
                    anchorDate: presetStart,
                  });

                  return (
                    <Link
                      key={item}
                      href={buildCrewDispatchHref({
                        planningAxis,
                        extraParams: planningSettingsParams,
                        fromDate: presetStart,
                        toDate: presetEnd,
                        view,
                        range: item,
                        customCount,
                        customUnit,
                        showWeekend,
                        bufferBack,
                        bufferForward,
                        showAsphaltDispatchCrews,
                        showEquipment,
                        showTrucks,
                        showSpecialVehicles,
                        showMaterial,
                        showNotes,
                        focusDate: presetStart,
                        highlightCrewId: highlightedCrewId,
                      })}
                      scroll={false}
                      className={
                        range === item
                          ? "rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                          : "rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
                      }
                    >
                      {getRangeLabel(item)}
                    </Link>
                  );
                })}
              </div>

              <DismissibleDetails className="relative inline-block w-full sm:w-auto">
                <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-950 hover:bg-blue-100">
                  ⚙ Einstellungen
                  <span className="text-blue-700">▾</span>
                </summary>

                <div className="fixed left-4 right-4 top-24 z-[80] mx-auto max-h-[calc(100vh-7rem)] max-w-xl overflow-y-auto rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl">
                  <div className="text-sm font-bold text-gray-900">
                    Zeitraum einstellen
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    Anzahl für Tage/Wochen/Monate oder einen festen Von-bis-Zeitraum wählen.
                  </p>

                  <form
                    action="/crew-dispatch"
                    className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <input type="hidden" name="view" value={view} />
                    <input type="hidden" name="axis" value={planningAxis} />
                    <input type="hidden" name="range" value="custom" />
                    <input type="hidden" name="week" value={focusDate} />
                    <input type="hidden" name="focus" value={focusDate} />
                    {view !== "days" ? (
                      <>
                        <input
                          type="hidden"
                          name="daysBufferBack"
                          value={String(viewBuffers.days.back)}
                        />
                        <input
                          type="hidden"
                          name="daysBufferForward"
                          value={String(viewBuffers.days.forward)}
                        />
                      </>
                    ) : null}
                    {view !== "weeks" ? (
                      <>
                        <input
                          type="hidden"
                          name="weeksBufferBack"
                          value={String(viewBuffers.weeks.back)}
                        />
                        <input
                          type="hidden"
                          name="weeksBufferForward"
                          value={String(viewBuffers.weeks.forward)}
                        />
                      </>
                    ) : null}
                    {view !== "months" ? (
                      <>
                        <input
                          type="hidden"
                          name="monthsBufferBack"
                          value={String(viewBuffers.months.back)}
                        />
                        <input
                          type="hidden"
                          name="monthsBufferForward"
                          value={String(viewBuffers.months.forward)}
                        />
                      </>
                    ) : null}

                    {highlightedCrewId ? (
                      <input
                        type="hidden"
                        name="highlightCrew"
                        value={highlightedCrewId}
                      />
                    ) : null}

                    <fieldset className="rounded-xl border border-gray-200 bg-white p-3">
                      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-gray-600">
                        Zeitraum
                      </legend>

                      <div className="mt-2 grid gap-3">
                        <label className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-950">
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="rangeMode"
                              value="count"
                              defaultChecked={!isCustomDateRange}
                              className="h-4 w-4"
                            />
                            Anzahl anzeigen
                          </span>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <span className="grid gap-1">
                              Anzahl
                              <input
                                type="number"
                                min="1"
                                name="customCount"
                                defaultValue={String(customCount)}
                                className="rounded-lg border border-blue-200 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                              />
                            </span>

                            <span className="grid gap-1">
                              Einheit
                              <select
                                name="customUnit"
                                defaultValue={customUnit}
                                className="rounded-lg border border-blue-200 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                              >
                                <option value="days">Tage</option>
                                <option value="weeks">Wochen</option>
                                <option value="months">Monate</option>
                              </select>
                            </span>
                          </div>
                        </label>

                        <label className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-800">
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="rangeMode"
                              value="dates"
                              defaultChecked={isCustomDateRange}
                              className="h-4 w-4"
                            />
                            Fester Zeitraum
                          </span>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <span className="grid gap-1">
                              Von
                              <input
                                type="date"
                                name="from"
                                defaultValue={formatDateInput(fromDate)}
                                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                              />
                            </span>

                            <span className="grid gap-1">
                              Bis
                              <input
                                type="date"
                                name="to"
                                defaultValue={formatDateInput(toDate)}
                                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                              />
                            </span>
                          </div>
                        </label>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs font-semibold text-gray-800">
                            Puffer zurück
                            <input
                              type="number"
                              min="0"
                              name="bufferBack"
                              defaultValue={String(bufferBack)}
                              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                            />
                          </label>

                          <label className="grid gap-1 text-xs font-semibold text-gray-800">
                            Puffer voraus
                            <input
                              type="number"
                              min="0"
                              name="bufferForward"
                              defaultValue={String(bufferForward)}
                              className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-semibold text-gray-900"
                            />
                          </label>
                        </div>
                      </div>
                    </fieldset>

                    <PlanningDisplayOptions
                      showAsphaltDispatchCrews={showAsphaltDispatchCrews}
                      showEquipment={showEquipment}
                      showMaterial={showMaterial}
                      showNotes={showNotes}
                      showSpecialVehicles={showSpecialVehicles}
                      showTrucks={showTrucks}
                      showWeekend={showWeekend}
                      view={view}
                    />

                    <button
                      type="submit"
                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      Einstellungen speichern
                    </button>
                  </form>
                </div>
              </DismissibleDetails>
            </div>

          <div
            className="mt-4 -mx-4 grid border-t border-gray-200 bg-white shadow-sm"
            style={{
              gridTemplateColumns: `${leftColumnWidth}px minmax(0, 1fr)`,
            }}
          >
            <div className="flex min-h-[64px] items-center border-r border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {getPlanningAxisLabel(planningAxis)}
            </div>

            <div
              data-crew-timeline-header-scroll
              className="min-w-0 overflow-hidden border-b border-gray-200 bg-gray-50"
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: timelineGridColumns,
                  minWidth: `${timelineMinWidth}px`,
                }}
              >
                {timelineUnits.map((unit) => (
                  <div
                    key={unit.key}
                    data-timeline-date={unit.defaultStartDate}
                    className={`flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-200 bg-gray-50 text-center last:border-r-0 ${getHeaderPaddingClass(
                      unitCount,
                    )}`}
                  >
                    <div
                      className={`truncate font-bold text-gray-900 ${getHeaderTextClass(
                        unitCount,
                      )}`}
                      title={unit.label}
                    >
                      {unit.label}
                    </div>
                    <div
                      className={`truncate text-gray-500 ${getHeaderSubTextClass(
                        unitCount,
                      )}`}
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
        </div>

        <div
          className="overflow-y-auto overflow-x-hidden overscroll-contain rounded-b-2xl"
          style={{
            maxHeight:
              "max(360px, calc(100vh - var(--crew-dispatch-sticky-offset, 280px) - var(--app-header-height, 0px) - 1rem))",
          }}
        >
        {planningAxis !== "teams" ? (
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `${leftColumnWidth}px minmax(0, 1fr)`,
            }}
          >
            <div className="border-r border-gray-200 bg-white">
              {planningAxisRows.length === 0 ? (
                <div className="p-10 text-center text-sm font-medium text-gray-500">
                  Keine Einträge für {getPlanningAxisLabel(planningAxis)} sichtbar.
                </div>
              ) : (
                planningAxisRows.map((row) => {
                  const bars = planningAxisBars.get(row.id) ?? [];
                  const rowHeight = Math.max(
                    72,
                    48 + Math.max(1, bars.length) * 30,
                  );

                  const content = (
                    <>
                      <div className="truncate text-sm font-bold text-gray-900">
                        {row.label}
                      </div>
                      {row.subLabel ? (
                        <div className="mt-1 truncate text-xs font-medium text-gray-500">
                          {row.subLabel}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        {bars.length} Planung{bars.length === 1 ? "" : "en"}
                      </div>
                    </>
                  );

                  return (
                    <div
                      key={row.id}
                      className="border-b border-gray-200 bg-white p-3"
                      style={{
                        height: `${rowHeight}px`,
                        minHeight: `${rowHeight}px`,
                      }}
                    >
                      {row.href ? (
                        <Link href={row.href} className="block min-w-0 hover:underline">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <CrewTimelineScroll focusDate={focusDate}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: timelineGridColumns,
                  minWidth: `${timelineMinWidth}px`,
                }}
              >
                {planningAxisRows.map((row) => {
                  const bars = planningAxisBars.get(row.id) ?? [];
                  const rowHeight = Math.max(
                    72,
                    48 + Math.max(1, bars.length) * 30,
                  );

                  return (
                    <div
                      key={row.id}
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
                          key={`${row.id}-${unit.key}`}
                          className={`min-w-0 border-r border-gray-100 last:border-r-0 ${getCellPaddingClass(
                            unitCount,
                          )}`}
                          style={{
                            height: `${rowHeight}px`,
                            minHeight: `${rowHeight}px`,
                          }}
                        />
                      ))}

                      <div
                        className="pointer-events-none absolute inset-0 grid p-1"
                        style={{
                          gridTemplateColumns: timelineGridColumns,
                        }}
                      >
                        {bars.map((bar, index) => {
                          const gridColumn = getTimelineGridColumnForDateRange({
                            startDate: bar.startDate,
                            endDate: bar.endDate,
                            timelineUnits,
                          });

                          if (!gridColumn) return null;

                          return (
                            <div
                              key={bar.id}
                              className={getPlanningAxisBarClass(bar.tone, unitCount)}
                              style={{
                                gridColumn,
                                gridRow: 1,
                                alignSelf: "start",
                                marginTop: `${6 + index * 28}px`,
                                minHeight: "24px",
                              }}
                              title={`${bar.title}${
                                bar.subtitle ? `\n${bar.subtitle}` : ""
                              }\n${formatShortDate(bar.startDate)} – ${formatShortDate(
                                bar.endDate,
                              )}`}
                            >
                              <div className="truncate">{bar.title}</div>
                              {bar.subtitle ? (
                                <div className="truncate text-[10px] font-medium opacity-90">
                                  {bar.subtitle}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CrewTimelineScroll>
          </div>
        ) : null}

        <div
          className={planningAxis === "teams" ? "grid w-full" : "hidden"}
          style={{
            gridTemplateColumns: `${leftColumnWidth}px minmax(0, 1fr)`,
          }}
        >
          <div className="border-r border-gray-200 bg-white">
            {crews.length === 0 ? (
              <div className="p-10 text-center text-sm font-medium text-gray-500">
                Keine Kolonnen sichtbar. Asphalt-Dispo-Kolonnen können oben
                eingeblendet werden.
              </div>
            ) : (
              crews.map((crew) => {
                const crewFocusDate = getBestCrewFocusDate({
                  crewId: crew.id,
                  crewName: crew.name,
                  visibleAssignments,
                  asphaltTimelineBars,
                  today,
                });

                const crewFocusHref = buildCrewDispatchHref({
                  planningAxis,
                  extraParams: planningSettingsParams,
                  fromDate,
                  toDate,
                  view,
                  range,
                  customCount,
                  customUnit,
                  showWeekend,
                  bufferBack,
                  bufferForward,
                  showAsphaltDispatchCrews,
                  showEquipment,
                  showTrucks,
                  showSpecialVehicles,
                  showMaterial,
                  showNotes,
                  focusDate: crewFocusDate,
                  highlightCrewId: crew.id,
                });

                const isHighlighted = highlightedCrewId === crew.id;
                const rowLayout = crewTimelineRows.get(crew.id);
                const rowHeight =
                  rowLayout?.rowHeight ?? CREW_TIMELINE_ROW_MIN_HEIGHT_PX;

                return (
                  <div
                    key={crew.id}
                    data-crew-row-id={crew.id}
                    className={
                      isHighlighted
                        ? "group relative z-0 overflow-visible border-b border-orange-200 bg-orange-50 p-3 hover:z-50"
                        : "group relative z-0 overflow-visible border-b border-gray-200 bg-white p-3 hover:z-50"
                    }
                    style={{
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <CrewTimelineFocusButton
                        focusDate={formatDateInput(crewFocusDate)}
                        crewId={crew.id}
                        fallbackHref={crewFocusHref}
                        className="block min-w-0 flex-1 truncate text-left text-sm font-bold text-gray-900 hover:underline"
                        title="Zur aktuellen oder nächsten Einteilung dieser Kolonne springen"
                      >
                        {crew.name}
                      </CrewTimelineFocusButton>

                      <Link
                        href={`/admin/crews#crew-${crew.id}`}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-700 shadow-sm hover:bg-gray-50"
                        title="Kolonne direkt bearbeiten"
                      >
                        ⚙
                      </Link>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {crew.typeLabel ? (
                        <span className="inline-flex max-w-full rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                          <span className="truncate">{crew.typeLabel}</span>
                        </span>
                      ) : null}

                      {crew.isAsphaltDispatchCrew ? (
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">
                          Asphaltdisposition
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      {crew.members.length} MA · {crew.defaultVehicles.length}{" "}
                      Geräte
                    </div>

                    {crew.members.length ? (
                      <div className="mt-2 line-clamp-2 text-xs text-gray-500">
                        {crew.members
                          .map(
                            (member) =>
                              `${member.employee.lastName}, ${member.employee.firstName}`,
                          )
                          .join(" · ")}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-400">
                        Keine Mitarbeiter hinterlegt
                      </div>
                    )}

                    <div className="pointer-events-none absolute left-3 top-12 z-[80] hidden w-[440px] max-w-[calc(100vw-3rem)] rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-2xl group-hover:block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-gray-900">
                            {crew.name}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {crew.members.length} MA ·{" "}
                            {crew.defaultVehicles.length} Geräte
                          </div>
                        </div>

                        <span className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700">
                          Details
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Mitarbeiter
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-gray-700">
                            {crew.members.length ? (
                              crew.members.map((member) => (
                                <div key={member.id}>
                                  {member.employee.lastName},{" "}
                                  {member.employee.firstName}
                                  {member.roleText
                                    ? ` · ${member.roleText}`
                                    : ""}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400">
                                Keine Mitarbeiter hinterlegt
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Geräte
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-gray-700">
                            {crew.defaultVehicles.length ? (
                              crew.defaultVehicles.map((item) => (
                                <div key={item.id}>
                                  {getVehicleLabel(item.vehicle)}
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400">
                                Keine Geräte hinterlegt
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {crew.notes ? (
                        <div className="mt-3 rounded-xl bg-orange-50 p-3 text-xs text-orange-950">
                          <div className="font-semibold">Bemerkung</div>
                          <div className="mt-1">{crew.notes}</div>
                        </div>
                      ) : null}

                      <div className="mt-3 text-xs font-semibold text-gray-500">
                        Klick auf den Kolonnennamen fokussiert den Zeitstrahl.
                        Das Zahnrad öffnet die Kolonnenverwaltung.
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <CrewTimelineScroll focusDate={focusDate}>
            <div
              className="grid"
              style={{
                gridTemplateColumns: timelineGridColumns,
                minWidth: `${timelineMinWidth}px`,
              }}
            >
              {crews.map((crew) => {
                const crewAssignments = visibleAssignments.filter(
                  ({ assignment }) => assignment.crewId === crew.id,
                );

                const crewAsphaltBars = asphaltTimelineBars.filter(
                  (bar) =>
                    normalizeCrewName(bar.crewName) ===
                    normalizeCrewName(crew.name),
                );

                const isHighlighted = highlightedCrewId === crew.id;
                const rowLayout = crewTimelineRows.get(crew.id);
                const rowHeight =
                  rowLayout?.rowHeight ?? CREW_TIMELINE_ROW_MIN_HEIGHT_PX;

                return (
                  <div
                    key={crew.id}
                    data-time-grid="true"
                    data-crew-row-id={crew.id}
                    className={
                      isHighlighted
                        ? "relative grid min-w-0 border-b border-orange-200 bg-orange-50/50"
                        : "relative grid min-w-0 border-b border-gray-100 bg-white"
                    }
                    style={{
                      gridColumn: `1 / span ${timelineUnits.length}`,
                      gridTemplateColumns: timelineGridColumns,
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  >
                    {timelineUnits.map((unit) => (
                      <div
                        key={`${crew.id}-${unit.key}`}
                        className={`min-w-0 border-r border-gray-100 last:border-r-0 ${getCellPaddingClass(
                          unitCount,
                        )}`}
                        style={{
                          height: `${rowHeight}px`,
                          minHeight: `${rowHeight}px`,
                        }}
                      >
                        <CrewPopover
                          trigger="+"
                          triggerClassName={getPlusButtonClass(unitCount)}
                          panelClassName="relative z-50 w-[400px] max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
                        >
                          <CrewPlanningAssignmentFormClient
                            mode="create"
                            projects={projectOptions}
                            weekStart={weekStartInput}
                            crews={crews}
                            fixedCrewId={crew.id}
                            fixedCrewName={crew.name}
                            defaultCrewId={crew.id}
                            defaultStartDate={unit.defaultStartDate}
                            defaultEndDate={unit.defaultEndDate}
                            conflictAssignments={conflictAssignmentsForClient}
                          />
                        </CrewPopover>
                      </div>
                    ))}

                    <div
                      className="pointer-events-none absolute inset-0 grid p-1"
                      style={{
                        gridTemplateColumns: timelineGridColumns,
                      }}
                    >
                      {crewAssignments.map(
                        ({ assignment, row }, assignmentIndex) => {
                          const projectBarTitle = getProjectRowTitle(row);

                          const barClassName = `rounded-lg border font-semibold shadow-sm ${getBarPaddingClass(
                            unitCount,
                          )} ${getBarTextClass(unitCount)} ${getCrewBadgeClass(
                            crew.typeValue,
                          )}`;

                          const laneIndex =
                            rowLayout?.assignmentLanes.get(assignment.id) ??
                            assignmentIndex;

                          const baseTopOffsetPx =
                            CREW_TIMELINE_BAR_TOP_PX +
                            laneIndex * crewTimelineLaneHeight;


                          const equipmentStrips = showEquipment
                            ? getEquipmentTimelineStripsForProject({
                                reference: {
                                  projectId: row.projectId,
                                  projectNumber: row.projectNumber,
                                  projectName: row.projectName,
                                },
                                assignmentStartDate: assignment.startDate,
                                assignmentEndDate: assignment.endDate,
                                defaultVehicles: crew.defaultVehicles,
                                equipmentDispatchAssignments,
                                timelineUnits,
                              })
                            : [];

                          const materialDayGroups = showMaterial
                            ? getMaterialDayGroupsForProject(projectMaterialMap, {
                                projectId: row.projectId,
                                projectNumber: row.projectNumber,
                                projectName: row.projectName,
                              })
                            : [];

                          const materialStrips = getMaterialTimelineStrips({
                            groups: materialDayGroups,
                            timelineUnits,
                          });
                          const noteStrip = showNotes
                            ? getNoteTimelineStripForProject({
                                assignmentEndDate: assignment.endDate,
                                assignmentStartDate: assignment.startDate,
                                projectNotesById,
                                projectNotesByKey,
                                reference: {
                                  projectId: row.projectId,
                                  projectNumber: row.projectNumber,
                                  projectName: row.projectName,
                                },
                                rowNotes: row.notes,
                                timelineUnits,
                              })
                            : null;

                          const truckDayGroups = showTrucks
                            ? getTruckDayGroupsForProject(projectTruckMap, {
                                projectId: row.projectId,
                                projectNumber: row.projectNumber,
                                projectName: row.projectName,
                              })
                            : [];

                          const truckStrips = getTruckTimelineStrips({
                            groups: truckDayGroups,
                            timelineUnits,
                          });

                          const specialVehicleDayGroups = showSpecialVehicles
                            ? getTruckDayGroupsForProject(projectSpecialVehicleMap, {
                                projectId: row.projectId,
                                projectNumber: row.projectNumber,
                                projectName: row.projectName,
                              })
                            : [];

                          const specialVehicleStrips = getTruckTimelineStrips({
                            groups: specialVehicleDayGroups,
                            timelineUnits,
                          });

                          return (
                            <Fragment key={assignment.id}>
                              <CrewAssignmentBar
                              id={assignment.id}
                              crewName={projectBarTitle}
                              crewTypeValue={crew.typeValue}
                              startDate={formatDateInput(assignment.startDate)}
                              endDate={formatDateInput(assignment.endDate)}
                              timelineUnits={timelineUnitsForClient}
                              unitCount={unitCount}
                              topOffsetPx={baseTopOffsetPx}
                              barClassName={barClassName}

                            >
                              <div className="absolute z-40 mt-2 w-[440px] max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl">
                                <div className="text-sm font-bold text-gray-900">
                                  {projectBarTitle}
                                </div>

                                <div className="mt-1 text-xs text-gray-500">
                                  Kolonne: {crew.name}
                                </div>

                                <div className="mt-2 text-xs font-medium text-gray-600">
                                  {formatShortDate(assignment.startDate)} –{" "}
                                  {formatShortDate(assignment.endDate)}
                                </div>

                                {crew.members.length ? (
                                  <div className="mt-3">
                                    <div className="text-xs font-semibold text-gray-700">
                                      Standardpersonen
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {crew.members.map((member) => (
                                        <span
                                          key={member.id}
                                          className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                                        >
                                          {member.employee.lastName},{" "}
                                          {member.employee.firstName}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                {crew.defaultVehicles.length ? (
                                  <div className="mt-3">
                                    <div className="text-xs font-semibold text-gray-700">
                                      Standardgeräte
                                    </div>
                                    <div className="mt-1 space-y-1">
                                      {crew.defaultVehicles.map((item) => (
                                        <div
                                          key={item.id}
                                          className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700"
                                        >
                                          {getVehicleLabel(item.vehicle)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}

                                <CrewPlanningAssignmentFormClient
                                  mode="update"
                                  id={assignment.id}
                                  rowId={row.id}
                                  weekStart={formatDateInput(row.weekStart)}
                                  crews={crews}
                                  fixedCrewId={crew.id}
                                  fixedCrewName={crew.name}
                                  defaultCrewId={crew.id}
                                  defaultStartDate={formatDateInput(
                                    assignment.startDate,
                                  )}
                                  defaultEndDate={formatDateInput(
                                    assignment.endDate,
                                  )}
                                  defaultStartTime={assignment.startTime}
                                  defaultEndTime={assignment.endTime}
                                  defaultNotes={assignment.notes ?? ""}
                                  conflictAssignments={conflictAssignmentsForClient}
                                  currentAssignmentId={assignment.id}
                                />

                                <form
                                  action={deleteCrewPlanningAssignment}
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
                                    Einteilung löschen
                                  </button>
                                </form>
                              </div>
                              </CrewAssignmentBar>


                              {showEquipment && equipmentStrips.length
                                ? equipmentStrips.map((strip) => (
                                    <TimelineSupplementStrip
                                      key={`${assignment.id}-equipment-${strip.id}`}
                                      gridColumn={strip.gridColumn}
                                      topOffsetPx={getSupplementTopOffsetPx({
                                        baseTopOffsetPx,
                                        layerIndex: getLayerIndex({
                                          showEquipment,
                                          showTrucks,
                                          showSpecialVehicles,
                                          showMaterial,
                                          layer: "equipment",
                                        }),
                                      })}
                                      tone="equipment"
                                      label="Geräte"
                                      text={strip.text}
                                      extraCount={strip.extraCount}
                                      tooltipText={strip.tooltipText}
                                    />
                                  ))
                                : null}

                              {showTrucks && truckStrips.length
                                ? truckStrips.map((strip) => (
                                    <TimelineSupplementStrip
                                      key={`${assignment.id}-truck-${strip.id}`}
                                      gridColumn={strip.gridColumn}
                                      topOffsetPx={getSupplementTopOffsetPx({
                                        baseTopOffsetPx,
                                        layerIndex: getLayerIndex({
                                          showEquipment,
                                          showTrucks,
                                          showSpecialVehicles,
                                          showMaterial,
                                          layer: "truck",
                                        }),
                                      })}
                                      tone="truck"
                                      label="LKW"
                                      text={strip.text}
                                      extraCount={strip.extraCount}
                                      tooltipText={strip.tooltipText}
                                    />
                                  ))
                                : null}

                              {showSpecialVehicles && specialVehicleStrips.length
                                ? specialVehicleStrips.map((strip) => (
                                    <TimelineSupplementStrip
                                      key={`${assignment.id}-special-${strip.id}`}
                                      gridColumn={strip.gridColumn}
                                      topOffsetPx={getSupplementTopOffsetPx({
                                        baseTopOffsetPx,
                                        layerIndex: getLayerIndex({
                                          showEquipment,
                                          showTrucks,
                                          showSpecialVehicles,
                                          showMaterial,
                                          layer: "special",
                                        }),
                                      })}
                                      tone="special"
                                      label="Sonder"
                                      text={strip.text}
                                      extraCount={strip.extraCount}
                                      tooltipText={strip.tooltipText}
                                    />
                                  ))
                                : null}

                              {showMaterial && materialStrips.length
                                ? materialStrips.map((strip) => (
                                    <TimelineSupplementStrip
                                      key={`${assignment.id}-material-${strip.id}`}
                                      gridColumn={strip.gridColumn}
                                      topOffsetPx={getSupplementTopOffsetPx({
                                        baseTopOffsetPx,
                                        layerIndex: getLayerIndex({
                                          showEquipment,
                                          showTrucks,
                                          showSpecialVehicles,
                                          showMaterial,
                                          layer: "material",
                                        }),
                                      })}
                                      tone="material"
                                      label="Material"
                                      text={strip.text}
                                      extraCount={strip.extraCount}
                                      tooltipText={strip.tooltipText}
                                    />
                                  ))
                                : null}

                              {noteStrip ? (
                                <TimelineSupplementStrip
                                  key={`${assignment.id}-${noteStrip.id}`}
                                  gridColumn={noteStrip.gridColumn}
                                  topOffsetPx={getSupplementTopOffsetPx({
                                    baseTopOffsetPx,
                                    layerIndex: getLayerIndex({
                                      showEquipment,
                                      showTrucks,
                                      showSpecialVehicles,
                                      showMaterial,
                                      layer: "notes",
                                    }),
                                  })}
                                  tone="notes"
                                  label="Notiz"
                                  text={noteStrip.text}
                                  extraCount={noteStrip.extraCount}
                                  tooltipText={noteStrip.tooltipText}
                                />
                              ) : null}
                            </Fragment>
                          );
                        },
                      )}

                      {crewAsphaltBars.map((bar, asphaltIndex) => {
                        const title = `${bar.projectNumber} · ${bar.projectName}`;

                        const laneIndex =
                          rowLayout?.asphaltLanes.get(bar.id) ??
                          crewAssignments.length + asphaltIndex;

                        const baseTopOffsetPx =
                          CREW_TIMELINE_BAR_TOP_PX +
                          laneIndex * crewTimelineLaneHeight;


                        const equipmentStrips = showEquipment
                          ? getEquipmentTimelineStripsForProject({
                              reference: {
                                projectId: bar.projectId,
                                projectNumber: bar.projectNumber,
                                projectName: bar.projectName,
                              },
                              assignmentStartDate: bar.startDate,
                              assignmentEndDate: bar.endDate,
                              defaultVehicles: crew.defaultVehicles,
                              equipmentDispatchAssignments,
                              timelineUnits,
                            })
                          : [];

                        const materialDayGroups = showMaterial
                          ? getMaterialDayGroupsForProject(projectMaterialMap, {
                              projectId: bar.projectId,
                              projectNumber: bar.projectNumber,
                              projectName: bar.projectName,
                            })
                          : [];

                        const materialStrips = getMaterialTimelineStrips({
                          groups: materialDayGroups,
                          timelineUnits,
                        });

                        const truckDayGroups = showTrucks
                          ? getTruckDayGroupsForProject(projectTruckMap, {
                              projectId: bar.projectId,
                              projectNumber: bar.projectNumber,
                              projectName: bar.projectName,
                            })
                          : [];

                        const truckStrips = getTruckTimelineStrips({
                          groups: truckDayGroups,
                          timelineUnits,
                        });

                        const specialVehicleDayGroups = showSpecialVehicles
                          ? getTruckDayGroupsForProject(projectSpecialVehicleMap, {
                              projectId: bar.projectId,
                              projectNumber: bar.projectNumber,
                              projectName: bar.projectName,
                            })
                          : [];

                        const specialVehicleStrips = getTruckTimelineStrips({
                          groups: specialVehicleDayGroups,
                          timelineUnits,
                        });
                        const noteStrip = showNotes
                          ? getNoteTimelineStripForProject({
                              assignmentEndDate: bar.endDate,
                              assignmentStartDate: bar.startDate,
                              projectNotesById,
                              projectNotesByKey,
                              reference: {
                                projectId: bar.projectId,
                                projectNumber: bar.projectNumber,
                                projectName: bar.projectName,
                              },
                              timelineUnits,
                            })
                          : null;

                        return (
                          <Fragment key={bar.id}>
                            <CrewAssignmentBar
                            id={bar.id}
                            crewName={title}
                            crewTypeValue="asphalt-dispatch"
                            startDate={formatDateInput(bar.startDate)}
                            endDate={formatDateInput(bar.endDate)}
                            timelineUnits={timelineUnitsForClient}
                            unitCount={unitCount}
                            topOffsetPx={baseTopOffsetPx}
                            barClassName={getAsphaltDispatchBarClass(unitCount)}

                          >
                            <div className="absolute z-40 mt-2 w-[440px] max-w-[calc(100vw-3rem)] rounded-xl border border-orange-200 bg-white p-4 text-gray-900 shadow-xl">
                              <div className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">
                                Asphaltdisposition
                              </div>

                              <div className="mt-3 text-sm font-bold text-gray-900">
                                {title}
                              </div>

                              <div className="mt-1 text-xs text-gray-500">
                                Kolonne: {crew.name}
                              </div>

                              <div className="mt-2 text-xs font-medium text-gray-600">
                                {formatShortDate(bar.startDate)} –{" "}
                                {formatShortDate(bar.endDate)}
                              </div>

                              {bar.constructionManager ? (
                                <div className="mt-2 text-xs text-gray-600">
                                  Bauleiter: {bar.constructionManager}
                                </div>
                              ) : null}

                              <div className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-950">
                                {formatTons(bar.quantityTons)} t ·{" "}
                                {bar.entryCount} Eintrag
                                {bar.entryCount === 1 ? "" : "e"}
                              </div>

                              {bar.mixLabels.length ? (
                                <div className="mt-3">
                                  <div className="text-xs font-semibold text-gray-700">
                                    Asphaltsorten
                                  </div>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {bar.mixLabels.map((mix) => (
                                      <span
                                        key={mix}
                                        className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                                      >
                                        {mix}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {bar.hasForeignMix ? (
                                <div className="mt-3 inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                                  Fremdmischgut enthalten
                                </div>
                              ) : null}

                              {bar.notes.length ? (
                                <div className="mt-3">
                                  <div className="text-xs font-semibold text-gray-700">
                                    Bemerkungen
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {bar.notes.map((note) => (
                                      <div
                                        key={note}
                                        className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-700"
                                      >
                                        {note}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <Link
                                href="/asphalt-dispatch"
                                className="mt-4 inline-flex rounded-lg border border-orange-300 px-3 py-2 text-xs font-semibold text-orange-900 hover:bg-orange-50"
                              >
                                In Asphaltdisposition bearbeiten →
                              </Link>
                            </div>
                            </CrewAssignmentBar>


                            {showEquipment && equipmentStrips.length
                              ? equipmentStrips.map((strip) => (
                                  <TimelineSupplementStrip
                                    key={`${bar.id}-equipment-${strip.id}`}
                                    gridColumn={strip.gridColumn}
                                    topOffsetPx={getSupplementTopOffsetPx({
                                      baseTopOffsetPx,
                                      layerIndex: getLayerIndex({
                                        showEquipment,
                                        showTrucks,
                                        showSpecialVehicles,
                                        showMaterial,
                                        layer: "equipment",
                                      }),
                                    })}
                                    tone="equipment"
                                    label="Geräte"
                                    text={strip.text}
                                    extraCount={strip.extraCount}
                                    tooltipText={strip.tooltipText}
                                  />
                                ))
                              : null}

                            {showTrucks && truckStrips.length
                              ? truckStrips.map((strip) => (
                                  <TimelineSupplementStrip
                                    key={`${bar.id}-truck-${strip.id}`}
                                    gridColumn={strip.gridColumn}
                                    topOffsetPx={getSupplementTopOffsetPx({
                                      baseTopOffsetPx,
                                      layerIndex: getLayerIndex({
                                        showEquipment,
                                        showTrucks,
                                        showSpecialVehicles,
                                        showMaterial,
                                        layer: "truck",
                                      }),
                                    })}
                                    tone="truck"
                                    label="LKW"
                                    text={strip.text}
                                    extraCount={strip.extraCount}
                                    tooltipText={strip.tooltipText}
                                  />
                                ))
                              : null}

                            {showSpecialVehicles && specialVehicleStrips.length
                              ? specialVehicleStrips.map((strip) => (
                                  <TimelineSupplementStrip
                                    key={`${bar.id}-special-${strip.id}`}
                                    gridColumn={strip.gridColumn}
                                    topOffsetPx={getSupplementTopOffsetPx({
                                      baseTopOffsetPx,
                                      layerIndex: getLayerIndex({
                                        showEquipment,
                                        showTrucks,
                                        showSpecialVehicles,
                                        showMaterial,
                                        layer: "special",
                                      }),
                                    })}
                                    tone="special"
                                    label="Sonder"
                                    text={strip.text}
                                    extraCount={strip.extraCount}
                                    tooltipText={strip.tooltipText}
                                  />
                                ))
                              : null}

                            {showMaterial && materialStrips.length
                              ? materialStrips.map((strip) => (
                                  <TimelineSupplementStrip
                                    key={`${bar.id}-material-${strip.id}`}
                                    gridColumn={strip.gridColumn}
                                    topOffsetPx={getSupplementTopOffsetPx({
                                      baseTopOffsetPx,
                                      layerIndex: getLayerIndex({
                                        showEquipment,
                                        showTrucks,
                                        showSpecialVehicles,
                                        showMaterial,
                                        layer: "material",
                                      }),
                                    })}
                                    tone="material"
                                    label="Material"
                                    text={strip.text}
                                    extraCount={strip.extraCount}
                                    tooltipText={strip.tooltipText}
                                  />
                                ))
                              : null}

                            {noteStrip ? (
                              <TimelineSupplementStrip
                                key={`${bar.id}-${noteStrip.id}`}
                                gridColumn={noteStrip.gridColumn}
                                topOffsetPx={getSupplementTopOffsetPx({
                                  baseTopOffsetPx,
                                  layerIndex: getLayerIndex({
                                    showEquipment,
                                    showTrucks,
                                    showSpecialVehicles,
                                    showMaterial,
                                    layer: "notes",
                                  }),
                                })}
                                tone="notes"
                                label="Notiz"
                                text={noteStrip.text}
                                extraCount={noteStrip.extraCount}
                                tooltipText={noteStrip.tooltipText}
                              />
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CrewTimelineScroll>
        </div>
        </div>
      </div>
    </AppShell>
  );
}

function TimelineInlineSupplementStrip({
  tone,
  label,
  text,
  extraCount,
  tooltipText,
}: {
  tone: "equipment" | "truck" | "special" | "material" | "notes";
  label: string;
  text: string;
  extraCount: number;
  tooltipText?: string;
}) {
  const tooltip = tooltipText ?? text;
  const className =
    tone === "equipment"
      ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold leading-none text-blue-950 shadow-sm"
      : tone === "truck"
        ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-sky-200 bg-sky-50 px-2 text-[10px] font-semibold leading-none text-sky-950 shadow-sm"
        : tone === "special"
          ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-violet-200 bg-violet-50 px-2 text-[10px] font-semibold leading-none text-violet-950 shadow-sm"
          : tone === "material"
            ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold leading-none text-emerald-950 shadow-sm"
            : "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold leading-none text-amber-950 shadow-sm";

  return (
    <CrewTimelineMouseTooltip
      className={className}
      label={label}
      text={tooltip}
      extraCount={extraCount}
      clickTitle={`${label} Details`}
      clickText={tooltip}
      clickHint="Klick außerhalb oder × schließt das Fenster."
    >
      <span className="shrink-0 font-bold uppercase tracking-wide opacity-70">
        {label}:
      </span>{" "}
      <span className="ml-1 min-w-0 flex-1 truncate whitespace-nowrap">
        {text}
      </span>
      {extraCount > 0 ? (
        <span className="ml-1 shrink-0 opacity-70">+{extraCount}</span>
      ) : null}
    </CrewTimelineMouseTooltip>
  );
}

function PlanningDisplayOptions({
  showAsphaltDispatchCrews,
  showEquipment,
  showMaterial,
  showNotes,
  showSpecialVehicles,
  showTrucks,
  showWeekend,
  view,
}: {
  showAsphaltDispatchCrews: boolean;
  showEquipment: boolean;
  showMaterial: boolean;
  showNotes: boolean;
  showSpecialVehicles: boolean;
  showTrucks: boolean;
  showWeekend: boolean;
  view: TimelineView;
}) {
  const options = [
    ...(view !== "months"
      ? [
          {
            name: "showWeekend",
            label: "Sa/So anzeigen",
            defaultChecked: showWeekend,
            className: "border-gray-300 bg-white text-gray-800",
          },
        ]
      : []),
    {
      name: "showAsphaltDispatchCrews",
      label: "Asphalt-Dispo-Kolonnen anzeigen",
      defaultChecked: showAsphaltDispatchCrews,
      className: "border-orange-300 bg-orange-50 text-orange-950",
    },
    {
      name: "showEquipment",
      label: "Geräte/Maschinen anzeigen",
      defaultChecked: showEquipment,
      className: "border-blue-300 bg-blue-50 text-blue-950",
    },
    {
      name: "showTrucks",
      label: "LKW anzeigen",
      defaultChecked: showTrucks,
      className: "border-sky-300 bg-sky-50 text-sky-950",
    },
    {
      name: "showSpecialVehicles",
      label: "Sonderfahrzeuge anzeigen",
      defaultChecked: showSpecialVehicles,
      className: "border-violet-300 bg-violet-50 text-violet-950",
    },
    {
      name: "showMaterial",
      label: "Material anzeigen",
      defaultChecked: showMaterial,
      className: "border-emerald-300 bg-emerald-50 text-emerald-950",
    },
    {
      name: "showNotes",
      label: "Notizen anzeigen",
      defaultChecked: showNotes,
      className: "border-amber-300 bg-amber-50 text-amber-950",
    },
  ];

  return (
    <fieldset className="rounded-xl border border-gray-200 bg-white p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-gray-600">
        Anzeigeoptionen
      </legend>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.name}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${option.className}`}
          >
            <input
              type="checkbox"
              name={option.name}
              value="1"
              defaultChecked={option.defaultChecked}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TimelineSupplementStrip({
  gridColumn,
  topOffsetPx,
  tone,
  label,
  text,
  extraCount,
  tooltipText,
}: {
  gridColumn: string;
  topOffsetPx: number;
  tone: "equipment" | "truck" | "special" | "material" | "notes";
  label: string;
  text: string;
  extraCount: number;
  tooltipText?: string;
}) {
  const tooltip = tooltipText ?? text;
  const className =
    tone === "equipment"
      ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-blue-200 bg-blue-50 px-2 text-[10px] font-semibold leading-none text-blue-950 shadow-sm"
      : tone === "truck"
        ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-sky-200 bg-sky-50 px-2 text-[10px] font-semibold leading-none text-sky-950 shadow-sm"
        : tone === "special"
          ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-violet-200 bg-violet-50 px-2 text-[10px] font-semibold leading-none text-violet-950 shadow-sm"
          : tone === "material"
            ? "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold leading-none text-emerald-950 shadow-sm"
            : "pointer-events-auto relative z-30 flex h-6 min-w-0 max-w-full cursor-pointer items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold leading-none text-amber-950 shadow-sm";

  return (
    <CrewTimelineMouseTooltip
      className={className}
      style={{
        gridColumn,
        gridRow: 1,
        alignSelf: "start",
        marginTop: `calc(${topOffsetPx}px + var(--crew-popover-offset, 0px))`,
      }}
      label={label}
      text={tooltip}
      extraCount={extraCount}
      clickTitle={`${label} Details`}
      clickText={tooltip}
      clickHint="Klick außerhalb oder × schließt das Fenster."
    >
      <span className="shrink-0 font-bold uppercase tracking-wide opacity-70">
        {label}:
      </span>{" "}
      <span className="ml-1 min-w-0 flex-1 truncate whitespace-nowrap">
        {text}
      </span>
      {extraCount > 0 ? (
        <span className="ml-1 shrink-0 opacity-70">+{extraCount}</span>
      ) : null}
    </CrewTimelineMouseTooltip>
  );
}

function CrewPlanningRowForm({
  action,
  id,
  weekStart,
  projects,
  defaultProjectId = "",
  defaultRowTitle = "",
  defaultNotes = "",
  defaultSortOrder = "0",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  weekStart: string;
  projects: {
    id: string;
    projectNumber: string;
    name: string;
  }[];
  defaultProjectId?: string;
  defaultRowTitle?: string;
  defaultNotes?: string;
  defaultSortOrder?: string;
}) {
  return (
    <form action={action} className="mt-5 space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <input type="hidden" name="weekStart" value={weekStart} />

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
        Abschnitt / Bezeichnung optional
        <input
          name="rowTitle"
          defaultValue={defaultRowTitle}
          placeholder="z.B. Tiefbau, Asphalt, Pflaster, Kanal"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Sortierung
        <input
          name="sortOrder"
          type="number"
          defaultValue={defaultSortOrder}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="block text-sm font-medium text-gray-800">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Speichern
      </button>
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
