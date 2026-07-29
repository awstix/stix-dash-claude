import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  activeDispositionDaysOff,
  dateKey,
} from "@/lib/disposition-days-off";
import { DismissibleDetails } from "../crew-dispatch/DismissibleDetails";
import { EmployeeExportDialog } from "./EmployeeExportDialog";
import { EmployeeQuickEntryButton } from "./EmployeeQuickEntryButton";
import { EmployeeDispatchStickyOffset } from "./EmployeeDispatchStickyOffset";
import { EmployeeTimelineBar } from "./EmployeeTimelineBar";
import { EmployeeTimelineSyncedScroll } from "./EmployeeTimelineSyncedScroll";
import { CrewTimelineScrollButtons } from "../crew-dispatch/CrewTimelineScrollButtons";
import {
  createEmployeeDispositionEntry,
  deleteEmployeeDispositionEntry,
  updateEmployeeDispositionEntry,
} from "./actions";
import {
  employeeDispositionTypes,
  getEmployeeDispositionType,
} from "./disposition-types";

const dayWidthPx = 48;
const employeeDispositionViewTypes = [
  ...employeeDispositionTypes,
  {
    value: "urlaub_beantragt",
    label: "Urlaub beantragt",
    barClass:
      "border-2 border-dashed border-sky-700 bg-sky-100 text-sky-950",
    badgeClass:
      "border-2 border-dashed border-sky-700 bg-sky-100 text-sky-950",
  },
];

type SortMode = "name" | "project" | "type";

type TimelineBar = {
  id: string;
  employeeId: string;
  source:
    | "asphalt"
    | "crew"
    | "lkw_allocation"
    | "lkw_long"
    | "lkw_short"
    | "leave_request"
    | "manual"
    | "special_vehicle";
  sourceLabel: string;
  typeValue: string;
  typeLabel: string;
  projectText: string | null;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  notes: string | null;
  barClass: string;
  manualEntry?: {
    id: string;
    employeeId: string;
    typeValue: string;
    startDate: Date;
    endDate: Date;
    startTime: string;
    endTime: string;
    notes: string | null;
  };
};

function dateOnly(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function todayUtc() {
  const now = new Date();
  return dateOnly(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateOnly(date), offset);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function parseWeeksParam(value: string | undefined) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1 || number > 52) {
    return null;
  }

  return number;
}

function parseSortMode(value: string | undefined): SortMode {
  if (value === "project" || value === "type") {
    return value;
  }

  return "name";
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatDayMonth(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function buildDays(fromDate: Date, toDate: Date) {
  const days = [];
  let current = dateOnly(fromDate);

  while (current <= toDate) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function getStatusClass(statusValue: string) {
  if (statusValue === "active") {
    return "bg-green-100 text-green-900";
  }

  if (statusValue.includes("aus") || statusValue === "left") {
    return "bg-gray-200 text-gray-700";
  }

  return "bg-yellow-100 text-yellow-900";
}

function isExitedEmployeeStatus(statusValue: string, statusLabel: string | null) {
  const normalizedStatus = `${statusValue} ${statusLabel ?? ""}`.toLowerCase();

  return statusValue === "left" || normalizedStatus.includes("ausgeschieden");
}

function getProjectText(row: {
  projectNumber: string;
  projectName: string;
  rowTitle: string | null;
}) {
  return [row.projectNumber, row.projectName, row.rowTitle]
    .filter(Boolean)
    .join(" · ");
}

function getAsphaltProjectText(entry: {
  projectNumber: string;
  projectName: string;
}) {
  return [entry.projectNumber, entry.projectName].filter(Boolean).join(" · ");
}

function getVehicleText(vehicle: {
  vehicleNumber: string | null;
  licensePlate: string | null;
  vehicleType?: string | null;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function formatTons(value: number) {
  return Number(value.toFixed(2)).toLocaleString("de-DE");
}

function formatQuantity(value: number | null | undefined, unit: string | null | undefined) {
  if (!value || value <= 0) {
    return "";
  }

  return `${formatTons(value)} ${unit ?? ""}`.trim();
}

function getAsphaltDetailText(entry: {
  asphaltMixName: string | null;
  quantityTons: number;
  tackCoatMaterialName: string | null;
  tackCoatQuantity: number;
  tackCoatUnit: string | null;
}) {
  const details = [];

  if (entry.asphaltMixName || entry.quantityTons > 0) {
    details.push(
      [entry.asphaltMixName, entry.quantityTons > 0 ? `${formatTons(entry.quantityTons)} t` : ""]
        .filter(Boolean)
        .join(" · "),
    );
  }

  if (entry.tackCoatMaterialName || entry.tackCoatQuantity > 0) {
    details.push(
      [
        entry.tackCoatMaterialName ?? "Anspritzmittel",
        entry.tackCoatQuantity > 0
          ? `${formatTons(entry.tackCoatQuantity)} ${entry.tackCoatUnit ?? "l"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  return details.filter(Boolean).join(" · ");
}

function normalizeFilterText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildQueryString(values: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default async function EmployeeDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    q?: string;
    status?: string;
    type?: string;
    project?: string;
    onlyWithEntries?: string;
    sort?: string;
    weeks?: string;
  }>;
}) {
  const params = await searchParams;
  const defaultFrom = startOfWeek(todayUtc());
  const fromDate = parseDateParam(params.from, defaultFrom);
  const weeksParam = parseWeeksParam(params.weeks);
  const parsedToDate = weeksParam
    ? addDays(fromDate, weeksParam * 7 - 1)
    : parseDateParam(params.to, addDays(fromDate, 13));
  const toDate = parsedToDate < fromDate ? addDays(fromDate, 13) : parsedToDate;
  const days = buildDays(fromDate, toDate);
  const activeDaysOff = await activeDispositionDaysOff(fromDate, toDate);
  const daysOffByDate = new Map(
    activeDaysOff.map((item) => [dateKey(item.date), item]),
  );
  const timelineUnitsForClient = days.map((day) => {
    const dateInput = formatDateInput(day);

    return {
      key: dateInput,
      label: formatGermanDate(day),
      defaultStartDate: dateInput,
      defaultEndDate: dateInput,
    };
  });
  const currentWeeks = Math.max(1, Math.ceil(days.length / 7));
  const gridTemplateColumns = `repeat(${days.length}, minmax(${dayWidthPx}px, 1fr))`;
  const searchFilter = String(params.q ?? "").trim();
  const statusFilter = String(params.status ?? "").trim();
  const typeFilter = String(params.type ?? "").trim();
  const projectFilter = String(params.project ?? "").trim();
  const onlyWithEntries = params.onlyWithEntries === "1";
  const sortMode = parseSortMode(params.sort);

  const [
    employees,
    manualEntries,
    crewAssignments,
    asphaltEntries,
    asphaltDispatchCrews,
    shortHaulAssignments,
    longHaulTruckAssignments,
    specialVehicleAssignments,
    asphaltLoadAllocations,
    tackCoatLoadAllocations,
    leaveRequests,
  ] = await Promise.all([
    prisma.employee.findMany({
      include: {
        positions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.employeeDispositionEntry.findMany({
      where: {
        startDate: {
          lte: toDate,
        },
        endDate: {
          gte: fromDate,
        },
      },
      include: {
        employee: true,
      },
      orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
    }),

    prisma.crewPlanningAssignment.findMany({
      where: {
        startDate: {
          lte: toDate,
        },
        endDate: {
          gte: fromDate,
        },
      },
      include: {
        row: true,
        crew: {
          include: {
            members: {
              where: {
                isActive: true,
              },
              include: {
                employee: true,
              },
            },
          },
        },
        extraEmployees: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { crewName: "asc" }],
    }),

    prisma.asphaltDispatchEntry.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: [{ workDate: "asc" }, { crew: "asc" }, { createdAt: "asc" }],
    }),

    prisma.crew.findMany({
      where: {
        isActive: true,
        isAsphaltDispatchCrew: true,
      },
      include: {
        members: {
          where: {
            isActive: true,
          },
          include: {
            employee: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.shortHaulAssignment.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
        driverId: {
          not: null,
        },
      },
      include: {
        tours: {
          orderBy: [{ startTime: "asc" }, { tourNumber: "asc" }],
        },
      },
      orderBy: [{ workDate: "asc" }, { driverName: "asc" }],
    }),

    prisma.truckLongHaulTruckAssignment.findMany({
      where: {
        driverId: {
          not: null,
        },
        entry: {
          workDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
      },
      include: {
        entry: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),

    prisma.specialVehicleDispatchAssignment.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
        operatorDriverId: {
          not: null,
        },
      },
      include: {
        vehicle: true,
        transportVehicle: true,
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.asphaltLoadAllocation.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
        driverId: {
          not: null,
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.tackCoatLoadAllocation.findMany({
      where: {
        workDate: {
          gte: fromDate,
          lte: toDate,
        },
        driverId: {
          not: null,
        },
      },
      orderBy: [{ workDate: "asc" }, { startTime: "asc" }],
    }),

    prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
      where: {
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
        status: { in: ["PENDING", "APPROVED"] },
        requestType: { not: "CANCEL" },
      },
    }),
  ]);

  const activeEmployees = employees.filter(
    (employee) =>
      !isExitedEmployeeStatus(employee.statusValue, employee.statusLabel),
  );
  const employeeByDriverId = new Map(
    activeEmployees
      .filter((employee) => employee.driverId)
      .map((employee) => [employee.driverId as string, employee]),
  );
  const barsByEmployeeId = new Map<string, TimelineBar[]>();
  const leaveDispositionEntryIds = new Set(
    leaveRequests
      .map((request) => request.dispositionEntryId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const entry of manualEntries) {
    if (leaveDispositionEntryIds.has(entry.id)) {
      continue;
    }
    const type = getEmployeeDispositionType(entry.typeValue);

    const bar: TimelineBar = {
      id: `manual-${entry.id}`,
      employeeId: entry.employeeId,
      source: "manual",
      sourceLabel: "Manuell",
      typeValue: entry.typeValue,
      typeLabel: type.label,
      projectText: null,
      startDate: entry.startDate,
      endDate: entry.endDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      title: entry.notes
        ? `${type.label} · ${entry.notes}`
        : type.label,
      subtitle: `${entry.startTime} – ${entry.endTime}`,
      notes: entry.notes,
      barClass: type.barClass,
      manualEntry: {
        id: entry.id,
        employeeId: entry.employeeId,
        typeValue: entry.typeValue,
        startDate: entry.startDate,
        endDate: entry.endDate,
        startTime: entry.startTime,
        endTime: entry.endTime,
        notes: entry.notes,
      },
    };

    barsByEmployeeId.set(entry.employeeId, [
      ...(barsByEmployeeId.get(entry.employeeId) ?? []),
      bar,
    ]);
  }

  for (const request of leaveRequests) {
    const approved = request.status === "APPROVED";
    const timeAccount = request.absenceType === "TIME_ACCOUNT";
    const pendingChange =
      request.status === "PENDING" && request.requestType === "CHANGE";
    const portion =
      request.dayPortion === "FIRST_HALF"
        ? "Erste Tageshälfte"
        : request.dayPortion === "SECOND_HALF"
          ? "Zweite Tageshälfte"
          : "Ganzer Tag";
    const bar: TimelineBar = {
      barClass: approved
        ? "border-2 border-sky-900 bg-sky-700 text-white"
        : "border-2 border-dashed border-sky-700 bg-sky-100 text-sky-950",
      employeeId: request.employeeId,
      endDate: request.endDate,
      endTime: request.dayPortion === "FIRST_HALF" ? "12:00" : "17:00",
      id: `leave-${request.id}`,
      notes: request.reason,
      projectText: null,
      source: "leave_request",
      sourceLabel: approved
        ? timeAccount
          ? "Zeitausgleich genehmigt"
          : "Urlaub genehmigt"
        : pendingChange
          ? "Urlaubsänderung beantragt"
          : "Urlaub beantragt",
      startDate: request.startDate,
      startTime: request.dayPortion === "SECOND_HALF" ? "12:00" : "06:30",
      subtitle:
        timeAccount && request.timeHours
          ? `${request.timeHours.toLocaleString("de-DE")} Std.`
          : portion,
      title: approved
        ? timeAccount
          ? "Zeitausgleich genehmigt"
          : "Urlaub genehmigt"
        : pendingChange
          ? "Urlaubsänderung beantragt"
          : "Urlaub beantragt",
      typeLabel: approved
        ? "Urlaub genehmigt"
        : pendingChange
          ? "Urlaubsänderung beantragt"
          : "Urlaub beantragt",
      typeValue: approved ? "urlaub" : "urlaub_beantragt",
    };
    barsByEmployeeId.set(request.employeeId, [
      ...(barsByEmployeeId.get(request.employeeId) ?? []),
      bar,
    ]);
  }

  const operationType = getEmployeeDispositionType("betrieb");
  const projectOptionsByText = new Map<string, string>();
  const projectTextsByEmployeeId = new Map<string, Set<string>>();
  const primaryProjectByEmployeeId = new Map<
    string,
    { projectText: string; startDate: Date }
  >();
  const rememberEmployeeProject = (
    employeeId: string,
    projectText: string,
    startDate: Date,
  ) => {
    if (!projectText) {
      return;
    }

    projectOptionsByText.set(projectText, projectText);

    const employeeProjects =
      projectTextsByEmployeeId.get(employeeId) ?? new Set<string>();
    employeeProjects.add(projectText);
    projectTextsByEmployeeId.set(employeeId, employeeProjects);

    const currentPrimaryProject = primaryProjectByEmployeeId.get(employeeId);

    if (!currentPrimaryProject || startDate < currentPrimaryProject.startDate) {
      primaryProjectByEmployeeId.set(employeeId, {
        projectText,
        startDate,
      });
    }
  };

  for (const assignment of crewAssignments) {
    const employeeIds = new Set<string>();

    for (const member of assignment.crew?.members ?? []) {
      employeeIds.add(member.employeeId);
    }

    for (const extraEmployee of assignment.extraEmployees) {
      employeeIds.add(extraEmployee.employeeId);
    }

    const projectText = getProjectText(assignment.row);
    if (projectText) {
      projectOptionsByText.set(projectText, projectText);
    }

    const title = projectText
      ? `Baustelle · ${projectText}`
      : `Baustelle · ${assignment.crewName}`;

    for (const employeeId of employeeIds) {
      if (projectText) {
        const employeeProjects =
          projectTextsByEmployeeId.get(employeeId) ?? new Set<string>();
        employeeProjects.add(projectText);
        projectTextsByEmployeeId.set(employeeId, employeeProjects);

        const currentPrimaryProject =
          primaryProjectByEmployeeId.get(employeeId);

        if (
          !currentPrimaryProject ||
          assignment.startDate < currentPrimaryProject.startDate
        ) {
          primaryProjectByEmployeeId.set(employeeId, {
            projectText,
            startDate: assignment.startDate,
          });
        }
      }

      const bar: TimelineBar = {
        id: `crew-${assignment.id}-${employeeId}`,
        employeeId,
        source: "crew",
        sourceLabel: "Kolonneneinteilung",
        typeValue: operationType.value,
        typeLabel: operationType.label,
        projectText,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        title,
        subtitle: assignment.crewName,
        notes: assignment.notes,
        barClass: operationType.barClass,
      };

      barsByEmployeeId.set(employeeId, [
        ...(barsByEmployeeId.get(employeeId) ?? []),
        bar,
      ]);
    }
  }

  const asphaltCrewByName = new Map(
    asphaltDispatchCrews.map((crew) => [crew.name, crew]),
  );

  for (const entry of asphaltEntries) {
    const crew = asphaltCrewByName.get(entry.crew);
    const employeeIds = new Set(
      (crew?.members ?? []).map((member) => member.employeeId),
    );
    const projectText = getAsphaltProjectText(entry);

    if (projectText) {
      projectOptionsByText.set(projectText, projectText);
    }

    const detailText = getAsphaltDetailText(entry);
    const title = projectText
      ? `Baustelle · Asphalt · ${projectText}`
      : `Baustelle · Asphalt · ${entry.crew}`;
    const subtitle = ["Asphaltdispo", entry.crew, detailText]
      .filter(Boolean)
      .join(" · ");

    for (const employeeId of employeeIds) {
      if (projectText) {
        const employeeProjects =
          projectTextsByEmployeeId.get(employeeId) ?? new Set<string>();
        employeeProjects.add(projectText);
        projectTextsByEmployeeId.set(employeeId, employeeProjects);

        const currentPrimaryProject =
          primaryProjectByEmployeeId.get(employeeId);

        if (!currentPrimaryProject || entry.workDate < currentPrimaryProject.startDate) {
          primaryProjectByEmployeeId.set(employeeId, {
            projectText,
            startDate: entry.workDate,
          });
        }
      }

      const bar: TimelineBar = {
        id: `asphalt-${entry.id}-${employeeId}`,
        employeeId,
        source: "asphalt",
        sourceLabel: "Asphaltdispo",
        typeValue: operationType.value,
        typeLabel: operationType.label,
        projectText: projectText || null,
        startDate: entry.workDate,
        endDate: entry.workDate,
        startTime: "06:30",
        endTime: "17:00",
        title,
        subtitle,
        notes: entry.notes,
        barClass: "bg-teal-800 text-white",
      };

      barsByEmployeeId.set(employeeId, [
        ...(barsByEmployeeId.get(employeeId) ?? []),
        bar,
      ]);
    }
  }

  for (const assignment of shortHaulAssignments) {
    if (!assignment.driverId) {
      continue;
    }

    const employee = employeeByDriverId.get(assignment.driverId);

    if (!employee) {
      continue;
    }

    const assignmentProjectText = getAsphaltProjectText(assignment);
    const vehicleText = getVehicleText(assignment);
    const tours = assignment.tours.length > 0 ? assignment.tours : [null];

    for (const tour of tours) {
      const projectText = tour
        ? getAsphaltProjectText({
            projectNumber: tour.projectNumber || assignment.projectNumber,
            projectName: tour.projectName || assignment.projectName,
          })
        : assignmentProjectText;
      const startTime = tour?.startTime ?? assignment.startTime;
      const endTime = tour?.endTime ?? "17:00";
      const purposeText = tour
        ? [
            tour.customPurpose,
            tour.itemName,
            tour.material,
            formatQuantity(tour.quantity, tour.quantityUnit),
          ]
            .filter(Boolean)
            .join(" · ")
        : assignment.material ?? "";
      const title = projectText
        ? `LKW Kurzstrecke · ${projectText}`
        : `LKW Kurzstrecke · ${assignment.driverName ?? ""}`;
      const subtitle = [
        vehicleText,
        tour ? `Tour ${tour.tourNumber}` : "Tageseinteilung",
        purposeText,
      ]
        .filter(Boolean)
        .join(" · ");

      rememberEmployeeProject(employee.id, projectText, assignment.workDate);

      const bar: TimelineBar = {
        id: `short-haul-${assignment.id}-${tour?.id ?? "day"}`,
        employeeId: employee.id,
        source: "lkw_short",
        sourceLabel: "LKW Kurzstrecke",
        typeValue: operationType.value,
        typeLabel: operationType.label,
        projectText: projectText || null,
        startDate: assignment.workDate,
        endDate: assignment.workDate,
        startTime,
        endTime,
        title,
        subtitle,
        notes: tour?.notes ?? assignment.notes,
        barClass: "bg-blue-800 text-white",
      };

      barsByEmployeeId.set(employee.id, [
        ...(barsByEmployeeId.get(employee.id) ?? []),
        bar,
      ]);
    }
  }

  for (const assignment of longHaulTruckAssignments) {
    if (!assignment.driverId) {
      continue;
    }

    const employee = employeeByDriverId.get(assignment.driverId);

    if (!employee) {
      continue;
    }

    const projectText = getAsphaltProjectText(assignment.entry);
    const vehicleText = getVehicleText(assignment);
    const materialText = [
      assignment.entry.materialName,
      formatQuantity(
        assignment.plannedTotalTons || assignment.entry.materialQuantity,
        assignment.entry.materialUnit ?? "t",
      ),
    ]
      .filter(Boolean)
      .join(" · ");
    const title = projectText
      ? `LKW Langstrecke · ${projectText}`
      : `LKW Langstrecke · ${assignment.driverName ?? ""}`;
    const subtitle = [
      vehicleText,
      assignment.plannedTourCount > 0
        ? `${assignment.plannedTourCount} Touren`
        : "",
      materialText,
    ]
      .filter(Boolean)
      .join(" · ");

    rememberEmployeeProject(employee.id, projectText, assignment.entry.workDate);

    const bar: TimelineBar = {
      id: `long-haul-${assignment.id}`,
      employeeId: employee.id,
      source: "lkw_long",
      sourceLabel: "LKW Langstrecke",
      typeValue: operationType.value,
      typeLabel: operationType.label,
      projectText: projectText || null,
      startDate: assignment.entry.workDate,
      endDate: assignment.entry.workDate,
      startTime: assignment.plannedStartTime,
      endTime: assignment.plannedEndTime,
      title,
      subtitle,
      notes: assignment.plannedNotes ?? assignment.notes ?? assignment.entry.notes,
      barClass: "bg-violet-800 text-white",
    };

    barsByEmployeeId.set(employee.id, [
      ...(barsByEmployeeId.get(employee.id) ?? []),
      bar,
    ]);
  }

  for (const assignment of specialVehicleAssignments) {
    if (!assignment.operatorDriverId) {
      continue;
    }

    const employee = employeeByDriverId.get(assignment.operatorDriverId);

    if (!employee) {
      continue;
    }

    const projectText = getAsphaltProjectText(assignment);
    const vehicleText = assignment.vehicle
      ? getVehicleText(assignment.vehicle)
      : assignment.vehicleName;
    const transportVehicleText = assignment.transportVehicle
      ? getVehicleText(assignment.transportVehicle)
      : assignment.transportVehicleName;
    const materialText = [
      assignment.materialName,
      formatQuantity(assignment.quantity, assignment.quantityUnit),
    ]
      .filter(Boolean)
      .join(" · ");
    const title = projectText
      ? `Sonderfahrzeug · ${projectText}`
      : `Sonderfahrzeug · ${assignment.operatorDriverName ?? ""}`;
    const subtitle = [
      vehicleText || "Sonderfahrzeug",
      assignment.taskText,
      transportVehicleText ? `Transport ${transportVehicleText}` : "",
      materialText,
    ]
      .filter(Boolean)
      .join(" · ");

    rememberEmployeeProject(employee.id, projectText, assignment.workDate);

    const bar: TimelineBar = {
      id: `special-vehicle-${assignment.id}`,
      employeeId: employee.id,
      source: "special_vehicle",
      sourceLabel: "Sonderfahrzeug-Disposition",
      typeValue: operationType.value,
      typeLabel: operationType.label,
      projectText: projectText || null,
      startDate: assignment.workDate,
      endDate: assignment.workDate,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      title,
      subtitle,
      notes: assignment.notes,
      barClass: "bg-purple-800 text-white",
    };

    barsByEmployeeId.set(employee.id, [
      ...(barsByEmployeeId.get(employee.id) ?? []),
      bar,
    ]);
  }

  for (const allocation of asphaltLoadAllocations) {
    if (!allocation.driverId) {
      continue;
    }

    const employee = employeeByDriverId.get(allocation.driverId);

    if (!employee) {
      continue;
    }

    const projectText = getAsphaltProjectText(allocation);
    const vehicleText = getVehicleText(allocation);
    const materialText = [
      allocation.asphaltMixName,
      formatQuantity(allocation.totalTons, "t"),
    ]
      .filter(Boolean)
      .join(" · ");
    const title = projectText
      ? `LKW Asphalt · ${projectText}`
      : `LKW Asphalt · ${allocation.driverName ?? ""}`;
    const subtitle = [vehicleText, materialText].filter(Boolean).join(" · ");

    rememberEmployeeProject(employee.id, projectText, allocation.workDate);

    const bar: TimelineBar = {
      id: `asphalt-load-${allocation.id}`,
      employeeId: employee.id,
      source: "lkw_allocation",
      sourceLabel: "LKW Asphalt",
      typeValue: operationType.value,
      typeLabel: operationType.label,
      projectText: projectText || null,
      startDate: allocation.workDate,
      endDate: allocation.workDate,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      title,
      subtitle,
      notes: allocation.notes,
      barClass: "bg-cyan-800 text-white",
    };

    barsByEmployeeId.set(employee.id, [
      ...(barsByEmployeeId.get(employee.id) ?? []),
      bar,
    ]);
  }

  for (const allocation of tackCoatLoadAllocations) {
    if (!allocation.driverId) {
      continue;
    }

    const employee = employeeByDriverId.get(allocation.driverId);

    if (!employee) {
      continue;
    }

    const projectText = getAsphaltProjectText(allocation);
    const vehicleText = getVehicleText(allocation);
    const materialText = [
      allocation.materialName,
      formatQuantity(allocation.totalLiters, allocation.quantityUnit),
    ]
      .filter(Boolean)
      .join(" · ");
    const title = projectText
      ? `LKW Anspritzmittel · ${projectText}`
      : `LKW Anspritzmittel · ${allocation.driverName ?? ""}`;
    const subtitle = [vehicleText, materialText].filter(Boolean).join(" · ");

    rememberEmployeeProject(employee.id, projectText, allocation.workDate);

    const bar: TimelineBar = {
      id: `tack-coat-load-${allocation.id}`,
      employeeId: employee.id,
      source: "lkw_allocation",
      sourceLabel: "LKW Anspritzmittel",
      typeValue: operationType.value,
      typeLabel: operationType.label,
      projectText: projectText || null,
      startDate: allocation.workDate,
      endDate: allocation.workDate,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      title,
      subtitle,
      notes: allocation.notes,
      barClass: "bg-slate-800 text-white",
    };

    barsByEmployeeId.set(employee.id, [
      ...(barsByEmployeeId.get(employee.id) ?? []),
      bar,
    ]);
  }

  for (const [employeeId, bars] of barsByEmployeeId) {
    barsByEmployeeId.set(
      employeeId,
      bars.sort((a, b) => {
        const byStart = a.startDate.getTime() - b.startDate.getTime();
        if (byStart !== 0) return byStart;
        return a.typeLabel.localeCompare(b.typeLabel, "de-DE");
      }),
    );
  }

  const statusOptions = Array.from(
    new Map(
      activeEmployees.map((employee) => [
        employee.statusValue,
        employee.statusLabel || employee.statusValue,
      ]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], "de-DE"));
  const projectOptions = Array.from(projectOptionsByText.values()).sort((a, b) =>
    a.localeCompare(b, "de-DE"),
  );
  const normalizedSearchFilter = normalizeFilterText(searchFilter);

  const visibleEmployees = activeEmployees
    .filter((employee) => {
      const employeeBars = barsByEmployeeId.get(employee.id) ?? [];
      const employeeProjects = projectTextsByEmployeeId.get(employee.id);
      const positionText = employee.positions
        .map((position) => position.positionLabel)
        .join(" ");
      const employeeSearchText = normalizeFilterText(
        [
          employee.firstName,
          employee.lastName,
          employee.statusLabel,
          positionText,
          ...(employeeProjects ? Array.from(employeeProjects) : []),
        ]
          .filter(Boolean)
          .join(" "),
      );

      if (
        normalizedSearchFilter &&
        !employeeSearchText.includes(normalizedSearchFilter)
      ) {
        return false;
      }

      if (statusFilter && employee.statusValue !== statusFilter) {
        return false;
      }

      if (
        typeFilter &&
        !employeeBars.some((bar) => bar.typeValue === typeFilter)
      ) {
        return false;
      }

      if (projectFilter && !employeeProjects?.has(projectFilter)) {
        return false;
      }

      if (onlyWithEntries && employeeBars.length === 0) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      const compareByName = () => {
        const byLastName = a.lastName.localeCompare(b.lastName, "de-DE");
        if (byLastName !== 0) return byLastName;
        return a.firstName.localeCompare(b.firstName, "de-DE");
      };

      if (sortMode === "project") {
        const projectA =
          primaryProjectByEmployeeId.get(a.id)?.projectText ?? "zzzzzz";
        const projectB =
          primaryProjectByEmployeeId.get(b.id)?.projectText ?? "zzzzzz";
        const byProject = projectA.localeCompare(projectB, "de-DE");

        if (byProject !== 0) {
          return byProject;
        }
      }

      if (sortMode === "type") {
        const getPrimaryType = (employeeId: string) =>
          (barsByEmployeeId.get(employeeId) ?? []).find((bar) => {
            if (typeFilter && bar.typeValue !== typeFilter) {
              return false;
            }

            if (projectFilter && bar.projectText !== projectFilter) {
              return false;
            }

            return true;
          });
        const typeA = getPrimaryType(a.id);
        const typeB = getPrimaryType(b.id);
        const rawRankA = typeA
          ? employeeDispositionTypes.findIndex(
              (type) => type.value === typeA.typeValue,
            )
          : 999;
        const rawRankB = typeB
          ? employeeDispositionTypes.findIndex(
              (type) => type.value === typeB.typeValue,
            )
          : 999;
        const rankA = rawRankA >= 0 ? rawRankA : 999;
        const rankB = rawRankB >= 0 ? rawRankB : 999;
        const byTypeRank = rankA - rankB;

        if (byTypeRank !== 0) {
          return byTypeRank;
        }

        const byTypeLabel = (typeA?.typeLabel ?? "zzzzzz").localeCompare(
          typeB?.typeLabel ?? "zzzzzz",
          "de-DE",
        );

        if (byTypeLabel !== 0) {
          return byTypeLabel;
        }
      }

      return compareByName();
    });
  const visibleEmployeeIds = new Set(
    visibleEmployees.map((employee) => employee.id),
  );
  const visibleBarsByEmployeeId = new Map<string, TimelineBar[]>();

  for (const employee of visibleEmployees) {
    visibleBarsByEmployeeId.set(
      employee.id,
      (barsByEmployeeId.get(employee.id) ?? []).filter((bar) => {
        if (typeFilter && bar.typeValue !== typeFilter) {
          return false;
        }

        if (
          projectFilter &&
          bar.projectText !== projectFilter
        ) {
          return false;
        }

        return true;
      }),
    );
  }

  const visibleManualEntries = manualEntries.filter((entry) => {
    if (!visibleEmployeeIds.has(entry.employeeId)) {
      return false;
    }

    if (typeFilter && entry.typeValue !== typeFilter) {
      return false;
    }

    return true;
  });

  const previousFrom = addDays(fromDate, -14);
  const previousTo = addDays(toDate, -14);
  const nextFrom = addDays(fromDate, 14);
  const nextTo = addDays(toDate, 14);
  const currentQueryValues = {
    from: formatDateInput(fromDate),
    to: formatDateInput(toDate),
    q: searchFilter,
    status: statusFilter,
    type: typeFilter,
    project: projectFilter,
    onlyWithEntries: onlyWithEntries ? "1" : "",
    sort: sortMode === "name" ? "" : sortMode,
  };
  const buildPageHref = (
    overrides: Record<string, string | null | undefined>,
  ) => `/employee-dispatch${buildQueryString({ ...currentQueryValues, ...overrides })}`;
  const previousHref = buildPageHref({
    from: formatDateInput(previousFrom),
    to: formatDateInput(previousTo),
  });
  const todayHref = buildPageHref({
    from: formatDateInput(defaultFrom),
    to: formatDateInput(addDays(defaultFrom, 13)),
  });
  const nextHref = buildPageHref({
    from: formatDateInput(nextFrom),
    to: formatDateInput(nextTo),
  });
  const activeFilterCount = [
    searchFilter,
    statusFilter,
    typeFilter,
    projectFilter,
    onlyWithEntries ? "onlyWithEntries" : "",
    sortMode !== "name" ? "sort" : "",
  ].filter(Boolean).length;

  return (
    <AppShell
      title="Mitarbeiterdisposition"
      description="Mitarbeiter zeilenweise verfolgen: Baustellen aus Disposition und Einteilungen plus Urlaub, Krank, Schulung, Werkstatt, Mischanlagen, Schule und Innung."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <details className="relative">
          <summary className="cursor-pointer rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            + Eintrag hinzufügen
          </summary>
          <div className="fixed left-4 right-4 top-24 z-[100] mx-auto max-h-[calc(100vh-7rem)] max-w-6xl overflow-y-auto rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Eintrag hinzufügen
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Urlaub, Krank, Schulung oder sonstige Mitarbeiterdispo eintragen.
              </p>
            </div>
            <NewEmployeeDispositionEntryForm
              employees={activeEmployees}
              defaultDate={formatDateInput(fromDate)}
            />
          </div>
        </details>

        <Link
          href="/crew-dispatch"
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          Kolonneneinteilung öffnen
        </Link>

        <EmployeeExportDialog
          currentFilters={{
            from: formatDateInput(fromDate),
            to: formatDateInput(toDate),
            q: searchFilter,
            status: statusFilter,
            type: typeFilter,
            project: projectFilter,
            onlyWithEntries,
            sort: sortMode,
          }}
          statusOptions={statusOptions.map(([value, label]) => ({
            label,
            value,
          }))}
          typeOptions={employeeDispositionViewTypes.map((type) => ({
            label: type.label,
            value: type.value,
          }))}
          projectOptions={projectOptions.map((project) => ({
            label: project,
            value: project,
          }))}
        />
      </div>

      <div
        data-employee-dispatch-root
        className="overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <EmployeeDispatchStickyOffset />
        <div
          data-employee-dispatch-sticky-controls
          className="sticky top-0 z-[90] -mx-px -mt-px overflow-visible rounded-t-2xl border border-gray-200 bg-gray-50 px-5 py-4 pt-[calc(var(--app-header-height,0px)+1rem)] shadow-sm"
        >
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Mitarbeiter-Zeitstrahl
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {formatGermanDate(fromDate)} – {formatGermanDate(toDate)} ·{" "}
                {visibleEmployees.length} von {activeEmployees.length} Mitarbeitern
              </p>
            </div>
            <div className="flex flex-col gap-2 lg:items-end">
              <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                <Link
                  href={todayHref}
                  scroll={false}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Heute
                </Link>

                {[1, 2, 5].map((weekCount) => (
                  <Link
                    key={weekCount}
                    href={buildPageHref({
                      weeks: String(weekCount),
                      to: null,
                    })}
                    scroll={false}
                    className={
                      currentWeeks === weekCount
                        ? "rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                        : "rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    }
                  >
                    {weekCount}W
                  </Link>
                ))}

                <form
                  action="/employee-dispatch"
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="from" value={formatDateInput(fromDate)} />
                  <input
                    type="hidden"
                    name="sort"
                    value={sortMode === "name" ? "" : sortMode}
                  />
                  <input type="hidden" name="q" value={searchFilter} />
                  <input type="hidden" name="status" value={statusFilter} />
                  <input type="hidden" name="type" value={typeFilter} />
                  <input type="hidden" name="project" value={projectFilter} />
                  {onlyWithEntries ? (
                    <input type="hidden" name="onlyWithEntries" value="1" />
                  ) : null}
                  <input
                    type="number"
                    name="weeks"
                    min="1"
                    max="52"
                    defaultValue={currentWeeks}
                    className="h-9 w-16 rounded-lg border border-gray-300 px-2 text-xs font-semibold text-gray-900 outline-none focus:border-gray-900"
                    aria-label="Wochenanzahl"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Wochen anzeigen
                  </button>
                </form>

                <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                  {visibleEmployees.length}/{activeEmployees.length} Mitarbeiter
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

                  <div className="fixed left-4 right-4 top-24 z-[80] mx-auto max-h-[calc(100vh-7rem)] max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                    <div className="text-sm font-bold text-gray-900">
                      Mitarbeiter filtern
                    </div>
                    <p className="mt-1 text-xs text-gray-600">
                      Zeitraum, Person, Status, Art und Baustelle einschränken.
                    </p>

                    <form
                      action="/employee-dispatch"
                      className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
                    >
                      <label className="text-sm font-medium text-gray-800">
                        Von
                        <input
                          type="date"
                          name="from"
                          defaultValue={formatDateInput(fromDate)}
                          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </label>

                      <label className="text-sm font-medium text-gray-800">
                        Bis
                        <input
                          type="date"
                          name="to"
                          defaultValue={formatDateInput(toDate)}
                          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </label>

                      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
                        Suche
                        <input
                          name="q"
                          defaultValue={searchFilter}
                          placeholder="Name, Berufsgruppe oder Baustelle"
                          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </label>

                      <label className="text-sm font-medium text-gray-800">
                        Status
                        <select
                          name="status"
                          defaultValue={statusFilter}
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        >
                          <option value="">Alle Status</option>
                          {statusOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-medium text-gray-800">
                        Art
                        <select
                          name="type"
                          defaultValue={typeFilter}
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        >
                          <option value="">Alle Arten</option>
                          {employeeDispositionViewTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
                        Projekt / Baustelle
                        <select
                          name="project"
                          defaultValue={projectFilter}
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        >
                          <option value="">Alle Projekte</option>
                          {projectOptions.map((project) => (
                            <option key={project} value={project}>
                              {project}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-medium text-gray-800">
                        <span className="block">Sortierung</span>
                        <select
                          name="sort"
                          defaultValue={sortMode}
                          className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        >
                          <option value="name">Nach Nachname</option>
                          <option value="project">Nach Projekt</option>
                          <option value="type">Nach Art</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-3 pt-7 text-sm font-semibold text-gray-800">
                        <input
                          type="checkbox"
                          name="onlyWithEntries"
                          value="1"
                          defaultChecked={onlyWithEntries}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        Nur mit Einträgen
                      </label>

                      <div className="flex flex-wrap items-end gap-3 xl:col-span-2">
                        <button
                          type="submit"
                          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                        >
                          Filter anwenden
                        </button>
                        <Link
                          href={`/employee-dispatch?from=${formatDateInput(
                            fromDate,
                          )}&to=${formatDateInput(toDate)}`}
                          scroll={false}
                          className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Filter zurücksetzen
                        </Link>
                      </div>
                    </form>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {employeeDispositionViewTypes.map((type) => (
                        <span
                          key={type.value}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${type.badgeClass}`}
                        >
                          {type.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </DismissibleDetails>
              </div>
            </div>
          </div>

          <div className="relative mt-4 -mx-5 grid border-t border-gray-200 bg-white shadow-sm grid-cols-[300px_minmax(0,1fr)]">
            <CrewTimelineScrollButtons
              leftColumnWidth={300}
              scrollContainerSelector='[data-employee-timeline-body-scroll="true"]'
              previousHref={previousHref}
              nextHref={nextHref}
            />
            <div className="flex min-h-[56px] items-center border-r border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Mitarbeiter
            </div>
            <div
              data-employee-timeline-header-scroll="true"
              className="min-w-0 overflow-hidden border-b border-gray-200 bg-gray-50"
            >
              <div className="grid" style={{ gridTemplateColumns }}>
                {days.map((day) => {
                  const dayOff = daysOffByDate.get(dateKey(day));
                  return (
                    <div
                      key={day.toISOString()}
                      title={dayOff ? `Arbeitsfrei: ${dayOff.name}` : undefined}
                      className={
                        dayOff
                          ? "flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-300 bg-slate-300 px-2 py-2 text-center last:border-r-0"
                          : isWeekend(day)
                            ? "flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-200 bg-gray-100 px-2 py-2 text-center last:border-r-0"
                            : "flex min-h-[64px] min-w-0 flex-col justify-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-center last:border-r-0"
                      }
                    >
                      <div className="truncate text-xs font-bold text-gray-900">
                        {formatWeekdayShort(day)}
                      </div>
                      <div className="mt-1 truncate text-[11px] font-medium text-gray-600">
                        {formatDayMonth(day)}
                      </div>
                      {dayOff ? (
                        <div className="mt-1 truncate text-[9px] font-black uppercase text-gray-800">
                          arbeitsfrei
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div
          className="overflow-y-auto overflow-x-hidden overscroll-contain rounded-b-2xl"
          style={{
            maxHeight:
              "max(590px, calc(100vh - var(--employee-dispatch-sticky-offset, 160px) - var(--app-header-height, 0px) - 1rem))",
          }}
        >
          <div className="grid w-full grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-r border-gray-200 bg-white">
              {visibleEmployees.map((employee) => {
                const bars = visibleBarsByEmployeeId.get(employee.id) ?? [];
                const primaryProject =
                  primaryProjectByEmployeeId.get(employee.id)?.projectText;
                const positionText =
                  employee.positions
                    .map((position) => position.positionLabel)
                    .join(", ") || "ohne Berufsgruppe";
                const rowHeight = Math.max(118, 70 + bars.length * 36);

                return (
                  <div
                    key={employee.id}
                    data-employee-name-cell="true"
                    className="border-b border-gray-200 bg-white p-3"
                    style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                  >
                    <EmployeeQuickEntryButton
                      employeeId={employee.id}
                      employeeName={`${employee.lastName}, ${employee.firstName}`}
                      defaultStartDate={formatDateInput(fromDate)}
                      defaultEndDate={formatDateInput(fromDate)}
                    />
                    <div className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {positionText}
                    </div>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClass(
                        employee.statusValue,
                      )}`}
                    >
                      {employee.statusLabel}
                    </span>
                    {primaryProject ? (
                      <div className="mt-2 line-clamp-2 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900">
                        {primaryProject}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

          <EmployeeTimelineSyncedScroll
          >
            <div className="grid" style={{ gridTemplateColumns }}>
              {visibleEmployees.map((employee) => {
                const bars = visibleBarsByEmployeeId.get(employee.id) ?? [];
                const rowHeight = Math.max(118, 70 + bars.length * 36);

                return (
                  <div
                    key={employee.id}
                    className="relative grid min-w-0 border-b border-gray-100 bg-white"
                    style={{
                      gridColumn: `1 / span ${days.length}`,
                      gridTemplateColumns,
                      height: `${rowHeight}px`,
                      minHeight: `${rowHeight}px`,
                    }}
                  >
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={
                          daysOffByDate.has(dateKey(day))
                            ? "min-w-0 border-r border-gray-200 bg-slate-200/80"
                            : isWeekend(day)
                            ? "min-w-0 border-r border-gray-100 bg-gray-50"
                            : "min-w-0 border-r border-gray-100 bg-white"
                        }
                      />
                    ))}

                      <div
                        data-employee-time-grid="true"
                        className="pointer-events-none absolute inset-0 grid gap-y-1 px-1 py-2"
                        style={{ gridTemplateColumns }}
                      >
                        {bars.length === 0 ? (
                          <div className="col-span-full py-2 text-xs font-medium text-gray-400">
                            Keine Einträge im Zeitraum
                          </div>
                        ) : (
                          bars.map((bar) => {
                            const manualEntry = bar.manualEntry;

                            return (
                              <EmployeeTimelineBar
                                key={`${bar.id}-${formatDateInput(
                                  bar.startDate,
                                )}-${formatDateInput(bar.endDate)}`}
                                id={manualEntry?.id ?? bar.id}
                                label={bar.title}
                                sourceLabel={bar.sourceLabel}
                                startDate={formatDateInput(bar.startDate)}
                                endDate={formatDateInput(bar.endDate)}
                                startTime={bar.startTime}
                                endTime={bar.endTime}
                                timelineUnits={timelineUnitsForClient}
                                barClassName={bar.barClass}
                                readOnly={!manualEntry}
                              >
                                <div className="absolute z-40 mt-2 w-[520px] max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl">
                                  <div className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                    {bar.sourceLabel}
                                  </div>
                                  <div className="mt-3 text-sm font-bold text-gray-900">
                                    {bar.title}
                                  </div>
                                  {bar.subtitle ? (
                                    <div className="mt-1 text-xs text-gray-600">
                                      {bar.subtitle}
                                    </div>
                                  ) : null}
                                  <div className="mt-2 text-xs font-medium text-gray-600">
                                    {formatGermanDate(bar.startDate)} –{" "}
                                    {formatGermanDate(bar.endDate)} ·{" "}
                                    {bar.startTime} – {bar.endTime}
                                  </div>
                                  {bar.notes ? (
                                    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                      {bar.notes}
                                    </div>
                                  ) : null}

                                  {manualEntry ? (
                                    <>
                                      <EmployeeDispositionEntryForm
                                        employees={activeEmployees}
                                        entry={manualEntry}
                                      />

                                      <form
                                        action={deleteEmployeeDispositionEntry}
                                        className="mt-3"
                                      >
                                        <input
                                          type="hidden"
                                          name="id"
                                          value={manualEntry.id}
                                        />
                                        <button
                                          type="submit"
                                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                                        >
                                          <ActionIcon
                                            name="delete"
                                            className="h-4 w-4"
                                          />
                                          Eintrag löschen
                                        </button>
                                      </form>
                                    </>
                                  ) : (
                                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                                      Dieser Balken kommt aus einer anderen
                                      Disposition und wird hier nur angezeigt.
                                      Änderungen bitte in der führenden Dispo
                                      vornehmen.
                                    </div>
                                  )}
                                </div>
                              </EmployeeTimelineBar>
                            );
                          })
                        )}
                      </div>
                  </div>
                );
              })}
            </div>
          </EmployeeTimelineSyncedScroll>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Manuelle Einträge im Zeitraum
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm text-gray-900">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="w-[88px] p-3 font-semibold">Aktion</th>
                <th className="p-3 font-semibold">Mitarbeiter</th>
                <th className="p-3 font-semibold">Art</th>
                <th className="p-3 font-semibold">Von</th>
                <th className="p-3 font-semibold">Bis</th>
                <th className="p-3 font-semibold">Zeit</th>
                <th className="p-3 font-semibold">Bemerkung</th>
              </tr>
            </thead>

            <tbody>
              {visibleManualEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    Keine manuellen Einträge im gewählten Zeitraum.
                  </td>
                </tr>
              ) : (
                visibleManualEntries.map((entry) => {
                  const entryType = getEmployeeDispositionType(entry.typeValue);

                  return (
                    <tr
                      key={entry.id}
                      className="border-t border-gray-100 text-gray-900"
                    >
                      <td className="p-3">
                        <form action={deleteEmployeeDispositionEntry}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            title="Eintrag löschen"
                            aria-label="Eintrag löschen"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {entry.employee.lastName}, {entry.employee.firstName}
                      </td>
                      <td className="p-3 text-gray-900">{entryType.label}</td>
                      <td className="p-3 text-gray-900">
                        {formatGermanDate(entry.startDate)}
                      </td>
                      <td className="p-3 text-gray-900">{formatGermanDate(entry.endDate)}</td>
                      <td className="p-3 text-gray-900">
                        {entry.startTime} – {entry.endTime}
                      </td>
                      <td className="p-3 text-gray-800">
                        {entry.notes ?? "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function EmployeeDispositionEntryForm({
  employees,
  entry,
}: {
  employees: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  entry: {
    id: string;
    employeeId: string;
    typeValue: string;
    startDate: Date;
    endDate: Date;
    startTime: string;
    endTime: string;
    notes: string | null;
  };
}) {
  return (
    <form
      action={updateEmployeeDispositionEntry}
      className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={entry.id} />

      <label className="text-xs font-semibold text-gray-700 md:col-span-2">
        Mitarbeiter
        <select
          name="employeeId"
          defaultValue={entry.employeeId}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.lastName}, {employee.firstName}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700 md:col-span-2">
        Art
        <select
          name="typeValue"
          defaultValue={entry.typeValue}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        >
          {employeeDispositionTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Von
        <input
          type="date"
          name="startDate"
          required
          defaultValue={formatDateInput(entry.startDate)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Bis
        <input
          type="date"
          name="endDate"
          required
          defaultValue={formatDateInput(entry.endDate)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Beginn
        <input
          type="time"
          name="startTime"
          defaultValue={entry.startTime}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-xs font-semibold text-gray-700">
        Ende
        <input
          type="time"
          name="endTime"
          defaultValue={entry.endTime}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-xs font-semibold text-gray-700 md:col-span-2">
        Bemerkung
        <input
          name="notes"
          defaultValue={entry.notes ?? ""}
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
        >
          <ActionIcon name="save" className="h-4 w-4" />
          Speichern
        </button>
      </div>
    </form>
  );
}

function NewEmployeeDispositionEntryForm({
  employees,
  defaultDate,
}: {
  employees: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  defaultDate: string;
}) {
  return (
    <form
      action={createEmployeeDispositionEntry}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8"
    >
      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Mitarbeiter
        <select
          name="employeeId"
          required
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          <option value="" disabled>
            Mitarbeiter wählen
          </option>

          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.lastName}, {employee.firstName}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-gray-800">
        Art
        <select
          name="typeValue"
          required
          defaultValue="urlaub"
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          {employeeDispositionTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-gray-800">
        Von
        <input
          type="date"
          name="startDate"
          required
          defaultValue={defaultDate}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Bis
        <input
          type="date"
          name="endDate"
          required
          defaultValue={defaultDate}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Beginn
        <input
          type="time"
          name="startTime"
          defaultValue="06:30"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Ende
        <input
          type="time"
          name="endTime"
          defaultValue="17:00"
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Bemerkung
        <input
          name="notes"
          placeholder="z.B. Urlaub genehmigt, Berufsschule, Innung ..."
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <div className="flex items-end">
        <button
          type="submit"
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Eintrag speichern
        </button>
      </div>
    </form>
  );
}
