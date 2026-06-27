import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  employeeDispositionTypes,
  getEmployeeDispositionType,
} from "../disposition-types";

export const runtime = "nodejs";

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

function parseDateParam(value: string | null, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function parseSortMode(value: string | null): SortMode {
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatGermanDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getWeekday(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  }).format(date);
}

function formatTimelineCellBar(bar: TimelineBar) {
  if (bar.source === "manual") {
    return bar.notes ? `${bar.typeLabel}: ${bar.notes}` : bar.typeLabel;
  }

  return `${bar.typeLabel}: ${bar.title}`;
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

function normalizeFilterText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function formatQuantity(
  value: number | null | undefined,
  unit: string | null | undefined,
) {
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
      [
        entry.asphaltMixName,
        entry.quantityTons > 0 ? `${formatTons(entry.quantityTons)} t` : "",
      ]
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

function makeWorksheet<T extends Record<string, unknown>>(
  rows: T[],
  headers: string[],
) {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([headers]);
  }

  return XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
}

function isBarOnDay(bar: TimelineBar, day: Date) {
  const normalizedDay = dateOnly(day);
  return dateOnly(bar.startDate) <= normalizedDay && dateOnly(bar.endDate) >= normalizedDay;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const defaultFrom = startOfWeek(todayUtc());
  const fromDate = parseDateParam(url.searchParams.get("from"), defaultFrom);
  const parsedToDate = parseDateParam(
    url.searchParams.get("to"),
    addDays(fromDate, 13),
  );
  const toDate = parsedToDate < fromDate ? addDays(fromDate, 13) : parsedToDate;
  const days = buildDays(fromDate, toDate);
  const exportScope =
    url.searchParams.get("scope") === "complete" ? "complete" : "filtered";
  const searchFilter =
    exportScope === "complete"
      ? ""
      : String(url.searchParams.get("q") ?? "").trim();
  const statusFilter =
    exportScope === "complete"
      ? ""
      : String(url.searchParams.get("status") ?? "").trim();
  const typeFilter =
    exportScope === "complete"
      ? ""
      : String(url.searchParams.get("type") ?? "").trim();
  const projectFilter =
    exportScope === "complete"
      ? ""
      : String(url.searchParams.get("project") ?? "").trim();
  const onlyWithEntries =
    exportScope !== "complete" && url.searchParams.get("onlyWithEntries") === "1";
  const sortMode = parseSortMode(url.searchParams.get("sort"));

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

  for (const entry of manualEntries) {
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
      subtitle: `${entry.startTime} - ${entry.endTime}`,
      notes: entry.notes,
    };

    barsByEmployeeId.set(entry.employeeId, [
      ...(barsByEmployeeId.get(entry.employeeId) ?? []),
      bar,
    ]);
  }

  const operationType = getEmployeeDispositionType("betrieb");
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

        if (
          !currentPrimaryProject ||
          entry.workDate < currentPrimaryProject.startDate
        ) {
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
          bar.source !== "manual" &&
          bar.projectText !== projectFilter
        ) {
          return false;
        }

        return true;
      }),
    );
  }

  const workbook = XLSX.utils.book_new();
  const exportInfoRows = [
    {
      Feld: "Export",
      Wert: "Mitarbeiterdisposition",
    },
    {
      Feld: "Zeitraum von",
      Wert: formatGermanDate(fromDate),
    },
    {
      Feld: "Zeitraum bis",
      Wert: formatGermanDate(toDate),
    },
    {
      Feld: "Mitarbeiter sichtbar",
      Wert: visibleEmployees.length,
    },
    {
      Feld: "Mitarbeiter gesamt",
      Wert: activeEmployees.length,
    },
    {
      Feld: "Umfang",
      Wert:
        exportScope === "complete"
          ? "Komplette Liste"
          : "Mit Filtern",
    },
    {
      Feld: "Suche",
      Wert: searchFilter || "-",
    },
    {
      Feld: "Statusfilter",
      Wert: statusFilter || "-",
    },
    {
      Feld: "Artfilter",
      Wert: typeFilter || "-",
    },
    {
      Feld: "Projektfilter",
      Wert: projectFilter || "-",
    },
    {
      Feld: "Nur mit Einträgen",
      Wert: onlyWithEntries ? "ja" : "nein",
    },
    {
      Feld: "Sortierung",
      Wert:
        sortMode === "project"
          ? "Projekt"
          : sortMode === "type"
            ? "Art"
            : "Nachname",
    },
    {
      Feld: "Erstellt am",
      Wert: formatGermanDateTime(new Date()),
    },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(exportInfoRows, ["Feld", "Wert"]),
    "Exportinfo",
  );

  const dayHeaders = days.map(
    (day) => `${getWeekday(day)} ${formatGermanDate(day)}`,
  );
  const timelineRows = visibleEmployees.map((employee) => {
    const positionText =
      employee.positions.map((position) => position.positionLabel).join(", ") ||
      "";
    const employeeBars = visibleBarsByEmployeeId.get(employee.id) ?? [];
    const row: Record<string, unknown> = {
      Mitarbeiter: `${employee.lastName}, ${employee.firstName}`,
      Status: employee.statusLabel,
      Berufsgruppe: positionText,
      "Projekt / Baustelle":
        primaryProjectByEmployeeId.get(employee.id)?.projectText ?? "",
    };

    for (const day of days) {
      const header = `${getWeekday(day)} ${formatGermanDate(day)}`;
      row[header] = employeeBars
        .filter((bar) => isBarOnDay(bar, day))
        .map(formatTimelineCellBar)
        .join(" | ");
    }

    return row;
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(timelineRows, [
      "Mitarbeiter",
      "Status",
      "Berufsgruppe",
      "Projekt / Baustelle",
      ...dayHeaders,
    ]),
    "Zeitstrahl",
  );

  const detailRows = visibleEmployees.flatMap((employee) => {
    const employeeBars = visibleBarsByEmployeeId.get(employee.id) ?? [];
    const positionText =
      employee.positions.map((position) => position.positionLabel).join(", ") ||
      "";

    return employeeBars.map((bar) => ({
      Mitarbeiter: `${employee.lastName}, ${employee.firstName}`,
      Status: employee.statusLabel,
      Berufsgruppe: positionText,
      Quelle: bar.sourceLabel,
      Art: bar.typeLabel,
      "Projekt / Baustelle": bar.projectText ?? "",
      Von: formatGermanDate(bar.startDate),
      Bis: formatGermanDate(bar.endDate),
      Beginn: bar.startTime,
      Ende: bar.endTime,
      Eintrag: bar.title,
      Kolonne: bar.source === "manual" ? "" : bar.subtitle,
      Bemerkung: bar.notes ?? "",
    }));
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(detailRows, [
      "Mitarbeiter",
      "Status",
      "Berufsgruppe",
      "Quelle",
      "Art",
      "Projekt / Baustelle",
      "Von",
      "Bis",
      "Beginn",
      "Ende",
      "Eintrag",
      "Kolonne",
      "Bemerkung",
    ]),
    "Einträge",
  );

  const manualDetailRows = visibleEmployees.flatMap((employee) => {
    const positionText =
      employee.positions.map((position) => position.positionLabel).join(", ") ||
      "";

    return (visibleBarsByEmployeeId.get(employee.id) ?? [])
      .filter((bar) => bar.source === "manual")
      .map((bar) => ({
        Mitarbeiter: `${employee.lastName}, ${employee.firstName}`,
        Status: employee.statusLabel,
        Berufsgruppe: positionText,
        Art: bar.typeLabel,
        Von: formatGermanDate(bar.startDate),
        Bis: formatGermanDate(bar.endDate),
        Beginn: bar.startTime,
        Ende: bar.endTime,
        Bemerkung: bar.notes ?? "",
      }));
  });

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(manualDetailRows, [
      "Mitarbeiter",
      "Status",
      "Berufsgruppe",
      "Art",
      "Von",
      "Bis",
      "Beginn",
      "Ende",
      "Bemerkung",
    ]),
    "Zusatz",
  );

  const projectSummaryMap = new Map<string, Set<string>>();

  for (const employee of visibleEmployees) {
    for (const bar of visibleBarsByEmployeeId.get(employee.id) ?? []) {
      if (bar.source === "manual" || !bar.projectText) {
        continue;
      }

      const employeesForProject =
        projectSummaryMap.get(bar.projectText) ?? new Set<string>();
      employeesForProject.add(`${employee.lastName}, ${employee.firstName}`);
      projectSummaryMap.set(bar.projectText, employeesForProject);
    }
  }

  const projectSummaryRows = Array.from(projectSummaryMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de-DE"))
    .map(([project, projectEmployees]) => ({
      "Projekt / Baustelle": project,
      Mitarbeiter: Array.from(projectEmployees)
        .sort((a, b) => a.localeCompare(b, "de-DE"))
        .join(", "),
      Anzahl: projectEmployees.size,
    }));

  XLSX.utils.book_append_sheet(
    workbook,
    makeWorksheet(projectSummaryRows, [
      "Projekt / Baustelle",
      "Mitarbeiter",
      "Anzahl",
    ]),
    "Projektübersicht",
  );

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    sheet["!cols"] = Array.from({ length: 40 }).map(() => ({
      wch: 24,
    }));
  }

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });
  const rangeName = `${formatDateInput(fromDate)}_bis_${formatDateInput(toDate)}`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mitarbeiterdisposition-${rangeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
