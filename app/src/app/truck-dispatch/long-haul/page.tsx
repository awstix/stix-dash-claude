import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  formatTons,
  getAsphaltAllocationsForDay,
  getAsphaltOpenPositions,
} from "@/lib/asphalt-loads";
import {
  createAsphaltLoadAllocation,
  deleteAsphaltLoadAllocation,
  updateAsphaltLoadAllocation,
} from "../asphalt-load-actions";
import { InitialTruckRows } from "./InitialTruckRows";
import { LongHaulAssignmentTypeFields } from "./LongHaulAssignmentTypeFields";
import { LongHaulOwnTruckSuggestionForm } from "./LongHaulOwnTruckSuggestionForm";
import {
  createLongHaulEntry,
  createOwnTruckAssignment,
  createSubcontractorTruckAssignment,
  deleteLongHaulEntry,
  deleteTruckAssignment,
  updateLongHaulEntry,
} from "./actions";

const weekdayLabels = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

const weekendLabels = ["Samstag", "Sonntag"];

type DriverWithVehicles = {
  id: string;
  firstName: string;
  lastName: string;
  shortcut: string | null;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: {
      id: string;
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
    };
  }[];
};

type VehicleWithDriver = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
  driverAssignments: {
    driver: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

type AsphaltOpenPositionForPage = {
  asphaltDispatchEntryId: string;
  crew: string;
  projectNumber: string;
  projectName: string;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  totalTons: number;
  allocatedTons: number;
  openTons: number;
  isFullyAllocated: boolean;
};

type AsphaltAllocationForPage = {
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

type ShortHaulConflict = {
  workDate: Date;
  driverId: string | null;
  vehicleId: string | null;
  driverName: string | null;
  vehicleNumber: string | null;
  licensePlate: string | null;
  projectNumber: string;
  projectName: string;
  sourceLabel?: string | null;
};

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;

  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
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
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function sameDate(a: Date, b: Date) {
  return formatDateInput(a) === formatDateInput(b);
}

function formatQuantity(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildWeekHref(week: string, includeWeekend: boolean) {
  return `/truck-dispatch/long-haul?week=${week}${
    includeWeekend ? "&weekend=1" : ""
  }`;
}

function getIsoWeekInfo(date: Date) {
  const tempDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  const dayNumber = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNumber);

  const weekYear = tempDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));

  const week = Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return {
    week,
    year: weekYear,
  };
}

function getPrimaryVehicle(driver: DriverWithVehicles) {
  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

function getPrimaryVehicleLabel(driver: DriverWithVehicles) {
  const vehicle = getPrimaryVehicle(driver);

  if (!vehicle) {
    return "kein Stammfahrzeug";
  }

  return `${vehicle.licensePlate ?? "-"} · ${vehicle.category}`;
}

function getOwnAssignmentLabel(assignment: {
  driverName: string | null;
  vehicleNumber: string | null;
  licensePlate: string | null;
  vehicleType: string | null;
  vehicleCategory: string;
}) {
  const driverName = assignment.driverName ?? "ohne Fahrer";
  const licensePlate = assignment.licensePlate ?? "-";
  const vehicleNumber = assignment.vehicleNumber
    ? `Nr. ${assignment.vehicleNumber}`
    : "ohne Nr.";
  const vehicleType = assignment.vehicleType ?? assignment.vehicleCategory;

  return `${driverName} · ${licensePlate} · ${vehicleNumber} · ${vehicleType}`;
}

function getSubAssignmentLabel(
  assignment: {
    vehicleCategory: string;
    subcontractorName: string | null;
    notes?: string | null;
  },
  index?: number,
) {
  const prefix =
    typeof index === "number" ? `Fremd-LKW ${index + 1}` : "Fremd-LKW";
  const company = assignment.subcontractorName ?? "ohne Fuhrunternehmen";

  return `${prefix} · ${assignment.vehicleCategory} · ${company}`;
}

function buildConflictMaps(conflicts: ShortHaulConflict[]) {
  const driverConflicts = new Map<string, string>();
  const vehicleConflicts = new Map<string, string>();

  for (const conflict of conflicts) {
    const label = conflict.sourceLabel
      ? `${conflict.projectNumber} · ${conflict.sourceLabel}`
      : `${conflict.projectNumber} · ${conflict.projectName}`;

    if (conflict.driverId) {
      driverConflicts.set(conflict.driverId, label);
    }

    if (conflict.vehicleId) {
      vehicleConflicts.set(conflict.vehicleId, label);
    }
  }

  return {
    driverConflicts,
    vehicleConflicts,
  };
}

function getAllocationsForTruckAssignment({
  allocations,
  truckAssignmentId,
}: {
  allocations: AsphaltAllocationForPage[];
  truckAssignmentId: string;
}) {
  return allocations.filter(
    (allocation) => allocation.longHaulTruckAssignmentId === truckAssignmentId,
  );
}

function getAllocationSummary(allocations: AsphaltAllocationForPage[]) {
  if (allocations.length === 0) {
    return null;
  }

  const totalTours = allocations.reduce(
    (sum, allocation) => sum + allocation.tourCount,
    0,
  );

  const totalTons = allocations.reduce(
    (sum, allocation) => sum + allocation.totalTons,
    0,
  );

  if (allocations.length === 1) {
    const allocation = allocations[0];

    return {
      title: `${allocation.tourCount} Touren × ${formatTons(
        allocation.tonsPerTour,
      )} t = ${formatTons(allocation.totalTons)} t`,
      detail: `${allocation.startTime} – ${allocation.endTime}${
        allocation.asphaltMixName ? ` · ${allocation.asphaltMixName}` : ""
      }`,
    };
  }

  return {
    title: `${totalTours} Touren · ${formatTons(totalTons)} t gesamt`,
    detail: `${allocations.length} Asphaltpositionen zugeteilt`,
  };
}

function PlannedAsphaltInfo({
  allocations,
}: {
  allocations: AsphaltAllocationForPage[];
}) {
  const summary = getAllocationSummary(allocations);

  if (!summary) {
    return null;
  }

  return (
    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
      <div className="font-semibold">Geplant: {summary.title}</div>
      <div className="mt-1 text-orange-800">{summary.detail}</div>
    </div>
  );
}

export default async function LongHaulPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    weekend?: string;
  }>;
}) {
  const params = await searchParams;
  const includeWeekend = params.weekend === "1";

  const weekStart = params.week
    ? startOfWeek(new Date(`${params.week}T00:00:00.000Z`))
    : startOfWeek(new Date());

  const weekEnd = addDays(weekStart, 7);
  const isoWeek = getIsoWeekInfo(weekStart);

  const dayLabels = includeWeekend
    ? [...weekdayLabels, ...weekendLabels]
    : weekdayLabels;

  const days = dayLabels.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  }));

  const previousWeek = formatDateInput(addDays(weekStart, -7));
  const currentWeek = formatDateInput(startOfWeek(new Date()));
  const nextWeek = formatDateInput(addDays(weekStart, 7));

  const [
    entries,
    projects,
    materials,
    vehicles,
    drivers,
    shortHaulConflicts,
    shortAsphaltConflicts,
    shortTackCoatConflicts,
    vehicleCategoryOptions,
    asphaltCrewOptions,
    subcontractorOptions,
  ] = await Promise.all([
    prisma.truckLongHaulEntry.findMany({
      where: {
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        truckAssignments: {
          orderBy: [{ ownerType: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
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

    prisma.materialType.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),

    prisma.vehicle.findMany({
      where: {
        isActive: true,
      },
      include: {
        driverAssignments: {
          where: {
            isActive: true,
          },
          include: {
            driver: true,
          },
        },
      },
      orderBy: [{ category: "asc" }, { vehicleNumber: "asc" }],
    }),

    prisma.driver.findMany({
      where: {
        isActive: true,
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
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.shortHaulAssignment.findMany({
      where: {
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        workDate: true,
        driverId: true,
        vehicleId: true,
        driverName: true,
        vehicleNumber: true,
        licensePlate: true,
        projectNumber: true,
        projectName: true,
      },
    }),

    prisma.asphaltLoadAllocation.findMany({
      where: {
        sourceType: "SHORT",
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        workDate: true,
        driverId: true,
        vehicleId: true,
        driverName: true,
        vehicleNumber: true,
        licensePlate: true,
        projectNumber: true,
        projectName: true,
        asphaltMixName: true,
      },
    }),

    prisma.tackCoatLoadAllocation.findMany({
      where: {
        sourceType: "SHORT",
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        workDate: true,
        driverId: true,
        vehicleId: true,
        driverName: true,
        vehicleNumber: true,
        licensePlate: true,
        projectNumber: true,
        projectName: true,
        materialName: true,
      },
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: "vehicle_category",
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    prisma.crew.findMany({
      where: {
        isActive: true,
        isAsphaltDispatchCrew: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: "subcontractor_company",
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const vehicleCategories =
    vehicleCategoryOptions.length > 0
      ? vehicleCategoryOptions.map((option) => option.label)
      : [
          "2-Achser",
          "3-Achser",
          "3-Achser + Anhänger",
          "4-Achser",
          "Sattelzug",
        ];

  const asphaltCrews = asphaltCrewOptions.map((crew) => crew.name);

  const subcontractors = subcontractorOptions.map((option) => option.label);

  const shortSourceConflicts: ShortHaulConflict[] = [
    ...shortHaulConflicts,
    ...shortAsphaltConflicts.map((conflict) => ({
      ...conflict,
      sourceLabel: `Asphalt ${conflict.asphaltMixName ?? "Asphalt"}`,
    })),
    ...shortTackCoatConflicts.map((conflict) => ({
      ...conflict,
      sourceLabel: `Anspritzmittel ${conflict.materialName}`,
    })),
  ];

  const asphaltOpenPositionsByDayEntries = await Promise.all(
    days.map(async (day) => {
      const key = formatDateInput(day.date);
      const positions = await getAsphaltOpenPositions(day.date);

      return [key, positions] as const;
    }),
  );

  const asphaltAllocationsByDayEntries = await Promise.all(
    days.map(async (day) => {
      const key = formatDateInput(day.date);
      const allocations = await getAsphaltAllocationsForDay(day.date);

      return [key, allocations] as const;
    }),
  );

  const asphaltOpenPositionsByDay = new Map(asphaltOpenPositionsByDayEntries);
  const asphaltAllocationsByDay = new Map(asphaltAllocationsByDayEntries);

  const totalAsphaltOpenTons = asphaltOpenPositionsByDayEntries.reduce(
    (sum, [, positions]) =>
      sum +
      positions.reduce((daySum, position) => daySum + position.openTons, 0),
    0,
  );

  const totalAsphaltAllocatedTons = asphaltOpenPositionsByDayEntries.reduce(
    (sum, [, positions]) =>
      sum +
      positions.reduce(
        (daySum, position) => daySum + position.allocatedTons,
        0,
      ),
    0,
  );

  const totalMaterialQuantity = entries.reduce(
    (sum, entry) => sum + entry.materialQuantity,
    0,
  );

  const totalOwnTrucks = entries.reduce(
    (sum, entry) =>
      sum +
      entry.truckAssignments.filter(
        (assignment) => assignment.ownerType === "OWN",
      ).length,
    0,
  );

  const totalSubTrucks = entries.reduce(
    (sum, entry) =>
      sum +
      entry.truckAssignments.filter(
        (assignment) => assignment.ownerType === "SUBCONTRACTOR",
      ).length,
    0,
  );

  return (
    <AppShell
      title="LKW-Einteilung Langstrecke"
      description="Wochenplanung für eigene LKW und Fremd-LKW nach Projekten, Materialien und Fahrzeugkategorien."
    >
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            KW {isoWeek.week}/{isoWeek.year} · {formatGermanDate(weekStart)} –{" "}
            {formatGermanDate(addDays(weekStart, includeWeekend ? 6 : 4))}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Tage sind untereinander dargestellt, damit LKW-Einteilung und
            Asphaltverteilung breit und sauber bedienbar bleiben.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <form
            action="/truck-dispatch/long-haul"
            className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3"
          >
            <label className="text-xs font-semibold text-gray-700">
              Woche wählen
              <input
                type="date"
                name="week"
                defaultValue={formatDateInput(weekStart)}
                className="mt-1 block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900"
              />
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700">
              <input
                type="checkbox"
                name="weekend"
                value="1"
                defaultChecked={includeWeekend}
                className="h-4 w-4"
              />
              Sa/So
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
              href={buildWeekHref(previousWeek, includeWeekend)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Vorwoche
            </Link>

            <Link
              href={buildWeekHref(currentWeek, includeWeekend)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Aktuelle Woche
            </Link>

            <Link
              href={buildWeekHref(nextWeek, includeWeekend)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Folgewoche
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard label="Einträge" value={String(entries.length)} />
        <SummaryCard
          label="Materialmenge"
          value={`${formatQuantity(totalMaterialQuantity)} t / m³`}
        />
        <SummaryCard label="LKW-STIX" value={String(totalOwnTrucks)} />
        <SummaryCard label="Fremd-LKW" value={String(totalSubTrucks)} />
        <SummaryCard
          label="Asphalt offen"
          value={`${formatTons(totalAsphaltOpenTons)} t`}
          hint={`${formatTons(totalAsphaltAllocatedTons)} t verteilt`}
        />
      </div>

      <div className="space-y-6">
        {days.map((day) => {
          const dayEntries = entries.filter((entry) =>
            sameDate(entry.workDate, day.date),
          );

          const dayKey = formatDateInput(day.date);
          const asphaltOpenPositions =
            asphaltOpenPositionsByDay.get(dayKey) ?? [];
          const asphaltAllocations = asphaltAllocationsByDay.get(dayKey) ?? [];

          const longAsphaltAllocations = asphaltAllocations.filter(
            (allocation) => allocation.sourceType === "LONG",
          );

          const shortConflictsForDay = shortSourceConflicts.filter((conflict) =>
            sameDate(conflict.workDate, day.date),
          );

          const {
            driverConflicts: shortDriverConflicts,
            vehicleConflicts: shortVehicleConflicts,
          } = buildConflictMaps(shortConflictsForDay);

          const dayAsphaltOpenTons = asphaltOpenPositions.reduce(
            (sum, position) => sum + position.openTons,
            0,
          );

          const dayAsphaltAllocatedTons = asphaltOpenPositions.reduce(
            (sum, position) => sum + position.allocatedTons,
            0,
          );

          const busyDrivers = new Map<string, string>();
          const busyVehicles = new Map<string, string>();

          for (const entry of dayEntries) {
            for (const assignment of entry.truckAssignments) {
              const label = `${entry.projectNumber} · ${entry.projectName}`;

              if (assignment.driverId) {
                busyDrivers.set(assignment.driverId, label);
              }

              if (assignment.vehicleId) {
                busyVehicles.set(assignment.vehicleId, label);
              }
            }
          }

          const dayMaterialQuantity = dayEntries.reduce(
            (sum, entry) => sum + entry.materialQuantity,
            0,
          );

          const dayOwnTrucks = dayEntries.reduce(
            (sum, entry) =>
              sum +
              entry.truckAssignments.filter(
                (assignment) => assignment.ownerType === "OWN",
              ).length,
            0,
          );

          const daySubTrucks = dayEntries.reduce(
            (sum, entry) =>
              sum +
              entry.truckAssignments.filter(
                (assignment) => assignment.ownerType === "SUBCONTRACTOR",
              ).length,
            0,
          );

          return (
            <section
              key={formatDateInput(day.date)}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="border-b border-gray-200 bg-gray-50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      {day.label} · {formatGermanDate(day.date)}
                    </h2>

                    <p className="mt-1 text-sm text-gray-600">
                      {dayEntries.length === 0
                        ? "Noch keine Langstrecken-Einteilung für diesen Tag."
                        : `${dayEntries.length} Einteilung(en) für diesen Tag.`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5 lg:min-w-[720px]">
                    <MiniDayStat
                      label="Menge"
                      value={formatQuantity(dayMaterialQuantity)}
                    />
                    <MiniDayStat label="STIX" value={String(dayOwnTrucks)} />
                    <MiniDayStat label="Fremd" value={String(daySubTrucks)} />
                    <MiniDayStat
                      label="Asphalt offen"
                      value={`${formatTons(dayAsphaltOpenTons)} t`}
                      tone="orange"
                    />
                    <MiniDayStat
                      label="Verteilt"
                      value={`${formatTons(dayAsphaltAllocatedTons)} t`}
                      tone="blue"
                    />
                  </div>
                </div>

                {shortConflictsForDay.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm font-medium text-yellow-900">
                    Hinweis: An diesem Tag gibt es bereits{" "}
                    {shortConflictsForDay.length} Kurzstrecken-Belegung(en).
                    Betroffene Fahrer oder Fahrzeuge werden unten markiert.
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 p-5">
                {dayEntries.map((entry) => (
                  <LongHaulEntryCard
                    key={entry.id}
                    entry={entry}
                    projects={projects}
                    materials={materials}
                    vehicles={vehicles}
                    drivers={drivers}
                    vehicleCategories={vehicleCategories}
                    asphaltCrews={asphaltCrews}
                    subcontractors={subcontractors}
                    busyDrivers={busyDrivers}
                    busyVehicles={busyVehicles}
                    shortDriverConflicts={shortDriverConflicts}
                    shortVehicleConflicts={shortVehicleConflicts}
                    workDate={dayKey}
                    asphaltOpenPositions={asphaltOpenPositions}
                    asphaltAllocations={longAsphaltAllocations}
                  />
                ))}

                <details className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Einteilung hinzufügen
                  </summary>

                  <LongHaulForm
                    action={createLongHaulEntry}
                    workDate={formatDateInput(day.date)}
                    projects={projects}
                    materials={materials}
                    asphaltCrews={asphaltCrews}
                    asphaltOpenPositions={asphaltOpenPositions}
                    showInitialTruckRows
                    drivers={drivers}
                    vehicles={vehicles}
                    vehicleCategories={vehicleCategories}
                    subcontractors={subcontractors}
                    busyDrivers={busyDrivers}
                    busyVehicles={busyVehicles}
                    shortDriverConflicts={shortDriverConflicts}
                    shortVehicleConflicts={shortVehicleConflicts}
                  />
                </details>
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

function EntryAsphaltAllocationBox({
  workDate,
  entry,
  vehicles,
  asphaltPositions,
  asphaltAllocations,
}: {
  workDate: string;
  entry: {
    id: string;
    projectNumber: string;
    projectName: string;
    truckAssignments: {
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
    }[];
  };
  vehicles: VehicleWithDriver[];
  asphaltPositions: AsphaltOpenPositionForPage[];
  asphaltAllocations: AsphaltAllocationForPage[];
}) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const openTons = asphaltPositions.reduce(
    (sum, position) => sum + position.openTons,
    0,
  );

  const allocatedTons = asphaltPositions.reduce(
    (sum, position) => sum + position.allocatedTons,
    0,
  );

  const ownAssignments = entry.truckAssignments.filter(
    (assignment) => assignment.ownerType === "OWN",
  );

  const subAssignments = entry.truckAssignments.filter(
    (assignment) => assignment.ownerType === "SUBCONTRACTOR",
  );

  const allTruckAssignments = [...ownAssignments, ...subAssignments];

  return (
    <details className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-orange-950">
        Asphalt verteilen · {formatTons(openTons)} t offen
      </summary>

      <div className="mt-4 space-y-4">
        {asphaltPositions.length === 0 ? (
          <div className="rounded-lg border border-orange-200 bg-white p-4 text-sm text-orange-800">
            Keine passende Asphaltposition zu dieser Maßnahme gefunden. Prüfe,
            ob die Projektnummer in Asphaltdisposition und Langstrecke gleich
            ist.
          </div>
        ) : (
          asphaltPositions.map((position) => (
            <div
              key={position.asphaltDispatchEntryId}
              className="rounded-xl border border-orange-200 bg-white p-4"
            >
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-base font-semibold text-gray-900">
                    {position.projectNumber} · {position.projectName}
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    {position.asphaltMixNumber ?? "-"} ·{" "}
                    {position.asphaltMixName ?? "-"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                    Gesamt {formatTons(position.totalTons)} t
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-800">
                    Verteilt {formatTons(position.allocatedTons)} t
                  </span>
                  <span
                    className={
                      position.isFullyAllocated
                        ? "rounded-full bg-green-100 px-3 py-1 text-green-800"
                        : "rounded-full bg-orange-100 px-3 py-1 text-orange-800"
                    }
                  >
                    Offen {formatTons(position.openTons)} t
                  </span>
                </div>
              </div>

              {allTruckAssignments.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  Noch kein LKW eingeteilt. Bitte zuerst STIX-LKW oder Fremd-LKW
                  hinzufügen.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[950px] text-left text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="rounded-l-lg p-3 font-semibold">LKW</th>
                        <th className="p-3 font-semibold">Vorschlag</th>
                        <th className="p-3 font-semibold">Touren</th>
                        <th className="p-3 font-semibold">t / Tour</th>
                        <th className="p-3 font-semibold">Beginn</th>
                        <th className="p-3 font-semibold">Ende</th>
                        <th className="rounded-r-lg p-3 font-semibold">
                          Aktion
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {allTruckAssignments.map((assignment) => {
                        const vehicle = assignment.vehicleId
                          ? vehicleById.get(assignment.vehicleId)
                          : null;

                        const payloadTons = vehicle?.asphaltPayloadTons ?? 0;

                        const formId = `allocate-${position.asphaltDispatchEntryId}-${assignment.id}`;

                        const assignmentLabel =
                          assignment.ownerType === "OWN"
                            ? `STIX · ${assignment.driverName ?? "-"}`
                            : `Fremd · ${assignment.subcontractorName ?? "-"}`;

                        const vehicleLabel =
                          assignment.ownerType === "OWN"
                            ? `${assignment.vehicleNumber ?? "-"} · ${
                                assignment.licensePlate ?? "-"
                              }`
                            : assignment.vehicleCategory;

                        const assignmentAllocations =
                          getAllocationsForTruckAssignment({
                            allocations: asphaltAllocations,
                            truckAssignmentId: assignment.id,
                          });

                        return (
                          <tr
                            key={`${position.asphaltDispatchEntryId}-${assignment.id}`}
                            className="border-t border-gray-100"
                          >
                            <td className="p-3 align-top">
                              <form
                                id={formId}
                                action={createAsphaltLoadAllocation}
                              >
                                <input
                                  type="hidden"
                                  name="workDate"
                                  value={workDate}
                                />
                                <input
                                  type="hidden"
                                  name="sourceType"
                                  value="LONG"
                                />
                                <input
                                  type="hidden"
                                  name="asphaltDispatchEntryId"
                                  value={position.asphaltDispatchEntryId}
                                />
                                <input
                                  type="hidden"
                                  name="longHaulTruckAssignmentId"
                                  value={assignment.id}
                                />
                              </form>

                              <div className="font-semibold text-gray-900">
                                {assignmentLabel}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {vehicleLabel}
                              </div>
                              <PlannedAsphaltInfo
                                allocations={assignmentAllocations}
                              />
                            </td>

                            <td className="p-3 align-top text-xs text-gray-600">
                              {assignment.ownerType === "OWN" ? (
                                payloadTons > 0 ? (
                                  <span>
                                    Stammdaten:{" "}
                                    <strong>{formatTons(payloadTons)} t</strong>
                                  </span>
                                ) : (
                                  <span>Keine Nutzlast hinterlegt</span>
                                )
                              ) : (
                                <span>Fremd-LKW manuell</span>
                              )}
                            </td>

                            <td className="p-3 align-top">
                              <input
                                form={formId}
                                name="tourCount"
                                type="number"
                                min="1"
                                defaultValue="1"
                                disabled={position.isFullyAllocated}
                                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </td>

                            <td className="p-3 align-top">
                              <input
                                form={formId}
                                name="tonsPerTour"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={
                                  payloadTons > 0 ? String(payloadTons) : ""
                                }
                                placeholder="t"
                                disabled={position.isFullyAllocated}
                                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                              <div className="mt-1 text-[11px] text-gray-500">
                                Handeingabe hat Vorrang.
                              </div>
                            </td>

                            <td className="p-3 align-top">
                              <input
                                form={formId}
                                name="startTime"
                                type="time"
                                defaultValue="06:30"
                                disabled={position.isFullyAllocated}
                                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </td>

                            <td className="p-3 align-top">
                              <input
                                form={formId}
                                name="endTime"
                                type="time"
                                defaultValue="17:00"
                                disabled={position.isFullyAllocated}
                                className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                              />
                            </td>

                            <td className="p-3 align-top">
                              <button
                                form={formId}
                                type="submit"
                                disabled={position.isFullyAllocated}
                                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-500"
                              >
                                Zuteilen
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Bereits verteilte Asphaltmengen
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Verteilt gesamt in dieser Einteilung:{" "}
                {formatTons(allocatedTons)} t
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {asphaltAllocations.length === 0 ? (
              <p className="text-sm text-gray-500">
                Noch keine Asphaltmengen auf diese Langstrecken-Einteilung
                verteilt.
              </p>
            ) : (
              asphaltAllocations.map((allocation) => {
                const formId = `long-allocation-${allocation.id}`;

                return (
                  <div
                    key={allocation.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {allocation.asphaltMixNumber ?? "-"} ·{" "}
                          {allocation.asphaltMixName ?? "-"}
                        </div>

                        <div className="mt-1 text-xs text-gray-600">
                          {allocation.ownerType === "SUBCONTRACTOR"
                            ? `Fremd · ${allocation.subcontractorName ?? "-"}`
                            : allocation.vehicleLabel}
                          {allocation.driverName
                            ? ` · ${allocation.driverName}`
                            : ""}
                        </div>
                      </div>

                      <div className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
                        {formatTons(allocation.totalTons)} t gesamt
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
                      <label className="text-xs font-medium text-gray-700">
                        Touren
                        <input
                          form={formId}
                          name="tourCount"
                          type="number"
                          min="1"
                          defaultValue={allocation.tourCount}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="text-xs font-medium text-gray-700">
                        t / Tour
                        <input
                          form={formId}
                          name="tonsPerTour"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={String(allocation.tonsPerTour)}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="text-xs font-medium text-gray-700">
                        Beginn
                        <input
                          form={formId}
                          name="startTime"
                          type="time"
                          defaultValue={allocation.startTime}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="text-xs font-medium text-gray-700">
                        Ende
                        <input
                          form={formId}
                          name="endTime"
                          type="time"
                          defaultValue={allocation.endTime}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <div className="flex items-end gap-2">
                        <form id={formId} action={updateAsphaltLoadAllocation}>
                          <input
                            type="hidden"
                            name="id"
                            value={allocation.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                          >
                            Speichern
                          </button>
                        </form>

                        <form action={deleteAsphaltLoadAllocation}>
                          <input
                            type="hidden"
                            name="id"
                            value={allocation.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Löschen
                          </button>
                        </form>
                      </div>
                    </div>

                    <input
                      form={formId}
                      name="notes"
                      defaultValue={allocation.notes ?? ""}
                      placeholder="Bemerkung"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function MiniDayStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "orange" | "blue";
}) {
  const className =
    tone === "orange"
      ? "rounded-xl border border-orange-200 bg-orange-50 p-3"
      : tone === "blue"
        ? "rounded-xl border border-blue-200 bg-blue-50 p-3"
        : "rounded-xl border border-gray-200 bg-white p-3";

  const labelClassName =
    tone === "orange"
      ? "text-xs font-medium text-orange-700"
      : tone === "blue"
        ? "text-xs font-medium text-blue-700"
        : "text-xs font-medium text-gray-500";

  const valueClassName =
    tone === "orange"
      ? "mt-1 text-base font-bold text-orange-900"
      : tone === "blue"
        ? "mt-1 text-base font-bold text-blue-900"
        : "mt-1 text-base font-bold text-gray-900";

  return (
    <div className={className}>
      <div className={labelClassName}>{label}</div>
      <div className={valueClassName}>{value}</div>
    </div>
  );
}

function LongHaulEntryCard({
  entry,
  projects,
  materials,
  vehicles,
  drivers,
  vehicleCategories,
  asphaltCrews,
  subcontractors,
  busyDrivers,
  busyVehicles,
  shortDriverConflicts,
  shortVehicleConflicts,
  asphaltOpenPositions,
  asphaltAllocations,
  workDate,
}: {
  entry: {
    id: string;
    workDate: Date;
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
    truckAssignments: {
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
    }[];
  };
  projects: {
    id: string;
    projectNumber: string;
    name: string;
    constructionManager: string | null;
  }[];
  materials: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
  }[];
  vehicles: VehicleWithDriver[];
  drivers: DriverWithVehicles[];
  vehicleCategories: string[];
  asphaltCrews: string[];
  subcontractors: string[];
  busyDrivers: Map<string, string>;
  busyVehicles: Map<string, string>;
  shortDriverConflicts: Map<string, string>;
  shortVehicleConflicts: Map<string, string>;
  workDate: string;
  asphaltOpenPositions: AsphaltOpenPositionForPage[];
  asphaltAllocations: AsphaltAllocationForPage[];
}) {
  const ownAssignments = entry.truckAssignments.filter(
    (assignment) => assignment.ownerType === "OWN",
  );

  const subAssignments = entry.truckAssignments.filter(
    (assignment) => assignment.ownerType === "SUBCONTRACTOR",
  );

  const matchingAsphaltPositions = entry.asphaltDispatchEntryId
    ? asphaltOpenPositions.filter(
        (position) =>
          position.asphaltDispatchEntryId === entry.asphaltDispatchEntryId,
      )
    : asphaltOpenPositions.filter(
        (position) => position.projectNumber === entry.projectNumber,
      );

  const matchingAsphaltAllocations = asphaltAllocations.filter(
    (allocation) =>
      allocation.longHaulEntryId === entry.id ||
      (entry.asphaltDispatchEntryId
        ? allocation.asphaltDispatchEntryId === entry.asphaltDispatchEntryId
        : allocation.projectNumber === entry.projectNumber),
  );

  const matchingAsphaltOpenTons = matchingAsphaltPositions.reduce(
    (sum, position) => sum + position.openTons,
    0,
  );

  const hasShortConflict = entry.truckAssignments.some(
    (assignment) =>
      (assignment.driverId && shortDriverConflicts.has(assignment.driverId)) ||
      (assignment.vehicleId && shortVehicleConflicts.has(assignment.vehicleId)),
  );

  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {entry.projectNumber} · {entry.projectName}
            </div>

            <div className="mt-1 text-sm text-gray-600">
              {entry.constructionManager
                ? `Polier/Bauleiter: ${entry.constructionManager}`
                : "Polier/Bauleiter: -"}
            </div>

            <div className="mt-1 text-sm text-gray-600">
              {entry.materialName ?? "Kein Material"} ·{" "}
              {formatQuantity(entry.materialQuantity)}{" "}
              {entry.materialUnit ?? ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              STIX {ownAssignments.length}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
              Fremd {subAssignments.length}
            </span>

            {matchingAsphaltPositions.length > 0 ? (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                Asphalt offen{" "}
                {formatTons(
                  matchingAsphaltPositions.reduce(
                    (sum, position) => sum + position.openTons,
                    0,
                  ),
                )}{" "}
                t
              </span>
            ) : null}

            {hasShortConflict ? (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-900">
                Hinweis Kurzstrecke
              </span>
            ) : null}

            {entry.assignmentType === "ASPHALT" && entry.asphaltCrew ? (
              <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                {entry.asphaltCrew}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          <TruckAssignmentPreview
            ownAssignments={ownAssignments}
            subAssignments={subAssignments}
            shortDriverConflicts={shortDriverConflicts}
            shortVehicleConflicts={shortVehicleConflicts}
            asphaltAllocations={matchingAsphaltAllocations}
          />
        </div>
      </summary>

      {hasShortConflict ? (
        <div className="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm font-medium text-yellow-900">
          Achtung: Mindestens ein Fahrer oder Fahrzeug ist an diesem Tag bereits
          in der Kurzstrecke geplant. Langstrecke bleibt möglich, bitte bewusst
          prüfen.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-semibold text-gray-900">
            Einteilung bearbeiten
          </div>

          <LongHaulForm
            action={updateLongHaulEntry}
            id={entry.id}
            projects={projects}
            materials={materials}
            asphaltCrews={asphaltCrews}
            asphaltOpenPositions={asphaltOpenPositions}
            defaultAssignmentType={entry.assignmentType}
            defaultAsphaltCrew={entry.asphaltCrew ?? ""}
            defaultAsphaltDispatchEntryId={entry.asphaltDispatchEntryId ?? ""}
            defaultProjectId={entry.projectId ?? ""}
            defaultMaterialTypeId={entry.materialTypeId ?? ""}
            defaultMaterialQuantity={entry.materialQuantity}
            defaultNotes={entry.notes ?? ""}
          />

          <form action={deleteLongHaulEntry} className="mt-3">
            <input type="hidden" name="id" value={entry.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Einteilung löschen
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <EntryAsphaltAllocationBox
            workDate={workDate}
            entry={entry}
            vehicles={vehicles}
            asphaltPositions={matchingAsphaltPositions}
            asphaltAllocations={matchingAsphaltAllocations}
          />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">
                LKW-STIX
              </div>

              <div className="mt-3 space-y-2">
                {ownAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Noch kein eigener LKW.
                  </p>
                ) : (
                  ownAssignments.map((assignment) => (
                    <TruckAssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      shortDriverConflicts={shortDriverConflicts}
                      shortVehicleConflicts={shortVehicleConflicts}
                      asphaltAllocations={matchingAsphaltAllocations}
                    />
                  ))
                )}
              </div>

              {matchingAsphaltOpenTons > 0 ? (
                <LongHaulOwnTruckSuggestionForm
                  entryId={entry.id}
                  openTons={matchingAsphaltOpenTons}
                  drivers={drivers}
                  vehicles={vehicles}
                  busyDrivers={Object.fromEntries(busyDrivers)}
                  busyVehicles={Object.fromEntries(busyVehicles)}
                  shortDriverConflicts={Object.fromEntries(shortDriverConflicts)}
                  shortVehicleConflicts={Object.fromEntries(shortVehicleConflicts)}
                />
              ) : null}

              <OwnTruckForm
                entryId={entry.id}
                drivers={drivers}
                vehicles={vehicles}
                busyDrivers={busyDrivers}
                busyVehicles={busyVehicles}
                shortDriverConflicts={shortDriverConflicts}
                shortVehicleConflicts={shortVehicleConflicts}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">
                Fremd-LKW
              </div>

              <div className="mt-3 space-y-2">
                {subAssignments.length === 0 ? (
                  <p className="text-sm text-gray-500">Noch kein Fremd-LKW.</p>
                ) : (
                  subAssignments.map((assignment) => (
                    <TruckAssignmentRow
                      key={assignment.id}
                      assignment={assignment}
                      shortDriverConflicts={shortDriverConflicts}
                      shortVehicleConflicts={shortVehicleConflicts}
                      asphaltAllocations={matchingAsphaltAllocations}
                    />
                  ))
                )}
              </div>

              <SubcontractorTruckForm
                entryId={entry.id}
                vehicleCategories={vehicleCategories}
                subcontractors={subcontractors}
              />
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}

function TruckAssignmentPreview({
  ownAssignments,
  subAssignments,
  shortDriverConflicts,
  shortVehicleConflicts,
  asphaltAllocations,
}: {
  ownAssignments: {
    id: string;
    vehicleCategory: string;
    driverId: string | null;
    driverName: string | null;
    vehicleId: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleType: string | null;
  }[];
  subAssignments: {
    id: string;
    vehicleCategory: string;
    subcontractorName: string | null;
    notes: string | null;
  }[];
  shortDriverConflicts: Map<string, string>;
  shortVehicleConflicts: Map<string, string>;
  asphaltAllocations: AsphaltAllocationForPage[];
}) {
  if (ownAssignments.length === 0 && subAssignments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
        Noch keine LKW zugeordnet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {ownAssignments.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
            STIX-LKW
          </div>

          <div className="mt-2 space-y-2">
            {ownAssignments.map((assignment) => {
              const driverConflict = assignment.driverId
                ? shortDriverConflicts.get(assignment.driverId)
                : null;

              const vehicleConflict = assignment.vehicleId
                ? shortVehicleConflicts.get(assignment.vehicleId)
                : null;

              const assignmentAllocations = getAllocationsForTruckAssignment({
                allocations: asphaltAllocations,
                truckAssignmentId: assignment.id,
              });

              return (
                <div
                  key={assignment.id}
                  className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-800"
                >
                  {getOwnAssignmentLabel(assignment)}
                  {driverConflict || vehicleConflict ? (
                    <div className="mt-1 text-xs font-semibold text-yellow-800">
                      Bereits Kurzstrecke: {driverConflict ?? vehicleConflict}
                    </div>
                  ) : null}

                  <PlannedAsphaltInfo allocations={assignmentAllocations} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {subAssignments.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Fremd-LKW
          </div>

          <div className="mt-2 space-y-2">
            {subAssignments.map((assignment, index) => {
              const assignmentAllocations = getAllocationsForTruckAssignment({
                allocations: asphaltAllocations,
                truckAssignmentId: assignment.id,
              });

              return (
                <div
                  key={assignment.id}
                  className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-800"
                >
                  <div>{getSubAssignmentLabel(assignment, index)}</div>

                  {assignment.notes ? (
                    <div className="mt-1 text-xs font-normal text-gray-500">
                      Bemerkung: {assignment.notes}
                    </div>
                  ) : null}

                  <PlannedAsphaltInfo allocations={assignmentAllocations} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TruckAssignmentRow({
  assignment,
  shortDriverConflicts,
  shortVehicleConflicts,
  asphaltAllocations,
}: {
  assignment: {
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
  shortDriverConflicts: Map<string, string>;
  shortVehicleConflicts: Map<string, string>;
  asphaltAllocations: AsphaltAllocationForPage[];
}) {
  const driverConflict = assignment.driverId
    ? shortDriverConflicts.get(assignment.driverId)
    : null;

  const vehicleConflict = assignment.vehicleId
    ? shortVehicleConflicts.get(assignment.vehicleId)
    : null;

  const assignmentAllocations = getAllocationsForTruckAssignment({
    allocations: asphaltAllocations,
    truckAssignmentId: assignment.id,
  });

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">
          {assignment.vehicleCategory}
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {assignment.ownerType === "OWN"
            ? `${assignment.driverName ?? "-"} · ${
                assignment.licensePlate ?? "-"
              } · ${assignment.vehicleNumber ?? "-"}`
            : `${assignment.subcontractorName ?? "-"} · ${
                assignment.vehicleCategory
              }`}
        </div>

        {driverConflict || vehicleConflict ? (
          <div className="mt-2 rounded-md bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-900">
            Bereits Kurzstrecke: {driverConflict ?? vehicleConflict}
          </div>
        ) : null}

        <PlannedAsphaltInfo allocations={assignmentAllocations} />

        {assignment.notes ? (
          <div className="mt-1 text-sm text-gray-500">{assignment.notes}</div>
        ) : null}
      </div>

      <form action={deleteTruckAssignment}>
        <input type="hidden" name="id" value={assignment.id} />
        <button
          type="submit"
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
        >
          X
        </button>
      </form>
    </div>
  );
}

function DriverSelectOptions({
  drivers,
  busyDrivers = new Map<string, string>(),
  busyVehicles = new Map<string, string>(),
  shortDriverConflicts = new Map<string, string>(),
  shortVehicleConflicts = new Map<string, string>(),
}: {
  drivers: DriverWithVehicles[];
  busyDrivers?: Map<string, string>;
  busyVehicles?: Map<string, string>;
  shortDriverConflicts?: Map<string, string>;
  shortVehicleConflicts?: Map<string, string>;
}) {
  return (
    <>
      {drivers.map((driver) => {
        const driverConflict = busyDrivers.get(driver.id);
        const primaryVehicle = getPrimaryVehicle(driver);
        const primaryVehicleConflict = primaryVehicle
          ? busyVehicles.get(primaryVehicle.id)
          : undefined;

        const shortDriverConflict = shortDriverConflicts.get(driver.id);
        const shortVehicleConflict = primaryVehicle
          ? shortVehicleConflicts.get(primaryVehicle.id)
          : undefined;

        const conflict =
          driverConflict ??
          primaryVehicleConflict ??
          shortDriverConflict ??
          shortVehicleConflict;

        return (
          <option
            key={driver.id}
            value={driver.id}
            disabled={Boolean(conflict)}
          >
            {conflict ? "! " : ""}
            {driver.lastName}, {driver.firstName} ·{" "}
            {getPrimaryVehicleLabel(driver)}
            {driverConflict ? ` · bereits Langstrecke ${driverConflict}` : ""}
            {!driverConflict && primaryVehicleConflict
              ? ` · Stammfahrzeug bereits Langstrecke ${primaryVehicleConflict}`
              : ""}
            {shortDriverConflict
              ? ` · bereits Kurzstrecke ${shortDriverConflict}`
              : ""}
            {!shortDriverConflict && shortVehicleConflict
              ? ` · Stammfahrzeug bereits Kurzstrecke ${shortVehicleConflict}`
              : ""}
          </option>
        );
      })}
    </>
  );
}

function VehicleSelectOptions({
  vehicles,
  busyVehicles = new Map<string, string>(),
  shortVehicleConflicts = new Map<string, string>(),
}: {
  vehicles: VehicleWithDriver[];
  busyVehicles?: Map<string, string>;
  shortVehicleConflicts?: Map<string, string>;
}) {
  return (
    <>
      {vehicles.map((vehicle) => {
        const assignedDriver = vehicle.driverAssignments[0]?.driver;
        const assignmentText = assignedDriver
          ? `Stamm: ${assignedDriver.lastName}, ${assignedDriver.firstName}`
          : "frei";

        const vehicleConflict = busyVehicles.get(vehicle.id);
        const shortConflict = shortVehicleConflicts.get(vehicle.id);
        const conflict = vehicleConflict ?? shortConflict;

        const payloadText =
          vehicle.asphaltPayloadTons > 0
            ? ` · Nutzlast ${formatTons(vehicle.asphaltPayloadTons)} t`
            : "";

        return (
          <option
            key={vehicle.id}
            value={vehicle.id}
            disabled={Boolean(conflict)}
          >
            {conflict ? "! " : ""}
            {vehicleConflict ? `bereits Langstrecke ${vehicleConflict} · ` : ""}
            {!vehicleConflict && shortConflict
              ? `bereits Kurzstrecke ${shortConflict} · `
              : ""}
            {assignmentText} · {vehicle.category} ·{" "}
            {vehicle.licensePlate ?? "-"} · Nr. {vehicle.vehicleNumber}
            {payloadText}
          </option>
        );
      })}
    </>
  );
}

function OwnTruckForm({
  entryId,
  drivers,
  vehicles,
  busyDrivers = new Map<string, string>(),
  busyVehicles = new Map<string, string>(),
  shortDriverConflicts = new Map<string, string>(),
  shortVehicleConflicts = new Map<string, string>(),
}: {
  entryId: string;
  drivers: DriverWithVehicles[];
  vehicles: VehicleWithDriver[];
  busyDrivers?: Map<string, string>;
  busyVehicles?: Map<string, string>;
  shortDriverConflicts?: Map<string, string>;
  shortVehicleConflicts?: Map<string, string>;
}) {
  return (
    <form
      action={createOwnTruckAssignment}
      className="mt-3 grid grid-cols-1 gap-2"
    >
      <input type="hidden" name="entryId" value={entryId} />

      <select
        name="driverId"
        required
        defaultValue=""
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="" disabled>
          Fahrer wählen
        </option>
        <DriverSelectOptions
          drivers={drivers}
          busyDrivers={busyDrivers}
          busyVehicles={busyVehicles}
          shortDriverConflicts={shortDriverConflicts}
          shortVehicleConflicts={shortVehicleConflicts}
        />
      </select>

      <select
        name="vehicleId"
        defaultValue=""
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">
          Stammfahrzeug automatisch verwenden / sonst Fahrzeug wählen
        </option>
        <VehicleSelectOptions
          vehicles={vehicles}
          busyVehicles={busyVehicles}
          shortVehicleConflicts={shortVehicleConflicts}
        />
      </select>

      <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
        <div className="text-xs font-semibold text-orange-950">
          Geplante Leistung
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            name="ownTourCount_0"
            type="number"
            min="1"
            defaultValue="1"
            placeholder="Touren"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="ownTonsPerTour_0"
            type="number"
            min="0"
            step="0.01"
            placeholder="t / Tour"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="ownStartTime_0"
            type="time"
            defaultValue="06:30"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="ownEndTime_0"
            type="time"
            defaultValue="17:00"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <input
          name="ownAsphaltNotes_0"
          placeholder="Bemerkung zur geplanten Leistung"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      <input
        name="notes"
        placeholder="Bemerkung LKW optional"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <button
        type="submit"
        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Eigenen LKW hinzufügen
      </button>
    </form>
  );
}

function SubcontractorTruckForm({
  entryId,
  vehicleCategories,
  subcontractors,
}: {
  entryId: string;
  vehicleCategories: string[];
  subcontractors: string[];
}) {
  return (
    <form
      action={createSubcontractorTruckAssignment}
      className="mt-3 grid grid-cols-1 gap-2"
    >
      <input type="hidden" name="entryId" value={entryId} />

      <select
        name="vehicleCategory"
        required
        defaultValue=""
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="" disabled>
          Fahrzeugkategorie wählen
        </option>
        {vehicleCategories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>

      <select
        name="subcontractorName"
        defaultValue=""
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        <option value="">Fuhrunternehmen wählen</option>
        {subcontractors.map((company) => (
          <option key={company} value={company}>
            {company}
          </option>
        ))}
      </select>

      <input
        name="subcontractorNameCustom"
        placeholder="oder Fuhrunternehmen frei eintragen"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
        <div className="text-xs font-semibold text-orange-950">
          Geplante Leistung
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            name="subTourCount_0"
            type="number"
            min="1"
            defaultValue="1"
            placeholder="Touren"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="subTonsPerTour_0"
            type="number"
            min="0"
            step="0.01"
            placeholder="t / Tour"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="subStartTime_0"
            type="time"
            defaultValue="06:30"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
          <input
            name="subEndTime_0"
            type="time"
            defaultValue="17:00"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </div>
        <input
          name="subAsphaltNotes_0"
          placeholder="Bemerkung zur geplanten Leistung"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      <input
        name="notes"
        placeholder="Bemerkung Fremd-LKW optional"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />

      <button
        type="submit"
        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Fremd-LKW hinzufügen
      </button>
    </form>
  );
}

function LongHaulForm({
  action,
  id,
  workDate,
  projects,
  materials,
  asphaltCrews,
  asphaltOpenPositions = [],
  showInitialTruckRows = false,
  drivers = [],
  vehicles = [],
  vehicleCategories = [],
  subcontractors = [],
  busyDrivers = new Map<string, string>(),
  busyVehicles = new Map<string, string>(),
  shortDriverConflicts = new Map<string, string>(),
  shortVehicleConflicts = new Map<string, string>(),
  defaultAssignmentType = "CONSTRUCTION",
  defaultAsphaltCrew = "",
  defaultAsphaltDispatchEntryId = "",
  defaultProjectId = "",
  defaultMaterialTypeId = "",
  defaultMaterialQuantity = 0,
  defaultNotes = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  workDate?: string;
  projects: {
    id: string;
    projectNumber: string;
    name: string;
    constructionManager: string | null;
  }[];
  materials: {
    id: string;
    name: string;
    unit: string;
    category: string | null;
  }[];
  asphaltCrews: string[];
  asphaltOpenPositions?: AsphaltOpenPositionForPage[];
  showInitialTruckRows?: boolean;
  drivers?: DriverWithVehicles[];
  vehicles?: VehicleWithDriver[];
  vehicleCategories?: string[];
  subcontractors?: string[];
  busyDrivers?: Map<string, string>;
  busyVehicles?: Map<string, string>;
  shortDriverConflicts?: Map<string, string>;
  shortVehicleConflicts?: Map<string, string>;
  defaultAssignmentType?: string;
  defaultAsphaltCrew?: string;
  defaultAsphaltDispatchEntryId?: string;
  defaultProjectId?: string;
  defaultMaterialTypeId?: string;
  defaultMaterialQuantity?: number;
  defaultNotes?: string;
}) {
  return (
    <form
      action={action}
      className="mt-4 space-y-3 border-t border-gray-100 pt-3"
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {workDate ? (
        <input type="hidden" name="workDate" value={workDate} />
      ) : null}

      <LongHaulAssignmentTypeFields
        asphaltCrews={asphaltCrews}
        asphaltOpenPositions={asphaltOpenPositions}
        defaultAssignmentType={defaultAssignmentType}
        defaultAsphaltCrew={defaultAsphaltCrew}
        defaultAsphaltDispatchEntryId={defaultAsphaltDispatchEntryId}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="text-sm font-semibold text-gray-900">
          Normale Baumaßnahme
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Nur ausfüllen, wenn oben bei Art „Normale Baumaßnahme“ gewählt ist.
        </p>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Projekt
          <select
            name="projectId"
            defaultValue={defaultProjectId}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          >
            <option value="">Projekt wählen</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} · {project.name}
                {project.constructionManager
                  ? ` · ${project.constructionManager}`
                  : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Material
          <select
            name="materialTypeId"
            defaultValue={defaultMaterialTypeId}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          >
            <option value="">Material wählen</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · {material.unit}
                {material.category ? ` · ${material.category}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm font-medium text-gray-700">
          Materialmenge
          <input
            name="materialQuantity"
            type="number"
            step="0.01"
            defaultValue={defaultMaterialQuantity}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          />
        </label>
      </div>

      {showInitialTruckRows ? (
        <InitialTruckRows
          drivers={drivers}
          vehicles={vehicles}
          vehicleCategories={vehicleCategories}
          subcontractors={subcontractors}
          busyDrivers={Object.fromEntries(busyDrivers)}
          busyVehicles={Object.fromEntries(busyVehicles)}
          shortDriverConflicts={Object.fromEntries(shortDriverConflicts)}
          shortVehicleConflicts={Object.fromEntries(shortVehicleConflicts)}
        />
      ) : null}

      <label className="block text-sm font-medium text-gray-700">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Speichern
      </button>
    </form>
  );
}
