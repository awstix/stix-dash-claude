import Link from "next/link";
import type { ReactNode } from "react";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { AsphaltShortAllocationForm } from "./AsphaltShortAllocationForm";
import { AsphaltShortSuggestionForm } from "./AsphaltShortSuggestionForm";
import {
  formatTons,
  getAsphaltAllocationsForDay,
  getAsphaltOpenPositions,
} from "@/lib/asphalt-loads";
import {
  deleteAsphaltLoadAllocation,
  updateAsphaltLoadAllocation,
} from "../asphalt-load-actions";
import { ShortHaulForm } from "./ShortHaulForm";
import { UtilizationTimeline } from "./UtilizationTimeline";
import {
  createShortHaulAssignment,
  createSpecialVehicleTask,
  deleteShortHaulAssignment,
  deleteSpecialVehicleTask,
  updateShortHaulAssignment,
  updateSpecialVehicleTask,
} from "./actions";

const specialVehicleFallback = [
  "Kranwagen",
  "Tieflader",
  "Unimog mit Asphaltfräse",
  "Abroller 1",
  "Abroller 2",
];

const transportFallback = [
  { value: "maschine", label: "Maschine transportieren" },
  { value: "geraete", label: "Geräte transportieren" },
  { value: "anhaenger", label: "Anhänger umsetzen" },
  { value: "container", label: "Container / Abroller" },
  { value: "rueckladung", label: "Rückladung" },
];

const unitFallback = ["t", "m³", "m3", "Stk", "h", "km", "m", "Pauschal"];

const dayLabels = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

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

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;

  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);

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

function sameDate(a: Date, b: Date) {
  return formatDateInput(a) === formatDateInput(b);
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
    return "Stammfahrzeug: kein Stammfahrzeug";
  }

  return `Stammfahrzeug: ${getVehicleLabel(primaryVehicle)}`;
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

  if (tour.purposeType === "MATERIAL") {
    return "Material";
  }

  if (tour.purposeType === "ASPHALT") {
    return "Asphalt";
  }

  if (tour.purposeType === "TRANSPORT") {
    return "Transport / Maschine";
  }

  return "Freier Zweck";
}

function getTourPurposeTypeLabel(value: string) {
  if (value === "MATERIAL") return "Material";
  if (value === "ASPHALT") return "Asphalt";
  if (value === "TRANSPORT") return "Transport / Maschine";
  return "Freier Zweck";
}

export default async function ShortHaulPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
  }>;
}) {
  const params = await searchParams;

  const selectedDate = parseDateParam(params.date);
  const selectedDateInput = formatDateInput(selectedDate);
  const previousDay = formatDateInput(addDays(selectedDate, -1));
  const today = formatDateInput(new Date());
  const nextDay = formatDateInput(addDays(selectedDate, 1));

  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 7);

  const weekDays = dayLabels.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  }));

  const [
    assignments,
    specialTasks,
    projects,
    vehicles,
    drivers,
    specialVehicles,
    longHaulAssignments,
    materials,
    asphaltMixes,
    transportOptions,
    unitAdminOptions,
    asphaltOpenPositions,
    asphaltAllocations,
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

    prisma.specialVehicleTask.findMany({
      where: {
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      orderBy: [{ workDate: "asc" }, { vehicleName: "asc" }],
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

    prisma.vehicle.findMany({
      where: {
        isActive: true,
        isSpecialVehicle: true,
      },
      orderBy: [{ vehicleNumber: "asc" }],
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

    prisma.materialType.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),

    prisma.asphaltMixType.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ mixNumber: "asc" }, { name: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: "transport_item",
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
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
  ]);

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const transportItems =
    transportOptions.length > 0
      ? transportOptions.map((option) => ({
          value: option.value,
          label: option.label,
        }))
      : transportFallback;

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

    return conflicts;
  }

  const shortDriverConflicts = buildShortDriverConflicts();
  const shortVehicleConflicts = buildShortVehicleConflicts();

  const usedDriverIds = new Set(
    assignments
      .map((assignment) => assignment.driverId)
      .filter((id): id is string => Boolean(id))
  );

  const usedVehicleIds = new Set(
    assignments
      .map((assignment) => assignment.vehicleId)
      .filter((id): id is string => Boolean(id))
  );

  const freeDrivers = drivers.filter(
    (driver) => !usedDriverIds.has(driver.id) && !driverConflicts[driver.id]
  );

  const freeVehicles = vehicles.filter(
    (vehicle) => !usedVehicleIds.has(vehicle.id) && !vehicleConflicts[vehicle.id]
  );

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

  const shortAsphaltAllocations = asphaltAllocations.filter(
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

  const asphaltAllocationDriverConflicts = {
    ...driverConflicts,
    ...shortDriverConflicts,
    ...shortAsphaltDriverConflicts,
  };

  const asphaltAllocationVehicleConflicts = {
    ...vehicleConflicts,
    ...shortVehicleConflicts,
    ...shortAsphaltVehicleConflicts,
  };

  const utilizationRows = [
    ...drivers.map((driver) => {
      const blocks = [];
      const dayVehicleLabels: string[] = [];

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
        blocks,
      };
    }),

    ...vehicles.map((vehicle) => {
      const blocks = [];

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
          type: "SHORT" as const,
        });
      }

      const assignedDriver = vehicle.driverAssignments[0]?.driver;

      return {
        id: `vehicle-${vehicle.id}`,
        kind: "VEHICLE" as const,
        title: `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"}`,
        subtitle: assignedDriver
          ? `Stammfahrer: ${assignedDriver.lastName}, ${assignedDriver.firstName} · ${vehicle.category}`
          : `frei zugeordnet · ${vehicle.category} · ${vehicle.vehicleType}`,
        blocks,
      };
    }),
  ];

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
            Fahrer mit Stammfahrzeug können direkt gewählt werden. Neue Touren
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

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
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

        <SummaryCard
          label="Asphalt offen"
          value={`${formatTons(openAsphaltTons)} t`}
          hint={`${formatTons(allocatedAsphaltTons)} t verteilt`}
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

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Baustelle</Th>
                <Th>Asphaltsorte</Th>
                <Th>Gesamt</Th>
                <Th>Verteilt</Th>
                <Th>Offen</Th>
                <Th>Menge zuteilen</Th>
              </tr>
            </thead>

            <tbody>
              {asphaltOpenPositions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Für diesen Tag sind keine Asphaltmengen in der
                    Asphaltdisposition vorhanden.
                  </td>
                </tr>
              ) : (
                asphaltOpenPositions.map((position) => (
                  <tr
                    key={position.asphaltDispatchEntryId}
                    className="border-t border-gray-100"
                  >
                    <Td>
                      <div className="font-semibold text-gray-900">
                        {position.projectNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {position.projectName}
                      </div>
                    </Td>

                    <Td>
                      <div className="font-semibold text-gray-900">
                        {position.asphaltMixNumber ?? "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {position.asphaltMixName ?? "-"}
                      </div>
                    </Td>

                    <Td>
                      <strong>{formatTons(position.totalTons)} t</strong>
                    </Td>

                    <Td>{formatTons(position.allocatedTons)} t</Td>

                    <Td>
                      {position.isFullyAllocated ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                          vollständig verteilt
                        </span>
                      ) : (
                        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
                          {formatTons(position.openTons)} t offen
                        </span>
                      )}
                    </Td>

                    <Td>
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
                        driverConflicts={asphaltAllocationDriverConflicts}
                        vehicleConflicts={asphaltAllocationVehicleConflicts}
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
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Verteilte Asphaltmengen Kurzstrecke
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Hier siehst du, welcher LKW wie viele Touren und Tonnen für Asphalt
            eingeteilt bekommen hat.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>LKW / Fahrer</Th>
                <Th>Bereich</Th>
                <Th>Zeit</Th>
                <Th>Touren</Th>
                <Th>t / Tour</Th>
                <Th>Gesamt</Th>
                <Th>Bemerkung</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody>
              {shortAsphaltAllocations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Noch keine Asphaltmengen auf Kurzstrecken-LKW verteilt.
                  </td>
                </tr>
              ) : (
                shortAsphaltAllocations.map((allocation) => {
                  const formId = `allocation-form-${allocation.id}`;

                  return (
                    <tr key={allocation.id} className="border-t border-gray-100">
                      <Td>
                        <div className="font-semibold text-gray-900">
                          {allocation.vehicleLabel}
                        </div>
                        <div className="text-xs text-gray-500">
                          {allocation.driverName ?? "-"}
                        </div>
                      </Td>

                      <Td>Kurzstrecke</Td>

                      <Td>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            form={formId}
                            name="startTime"
                            type="time"
                            defaultValue={allocation.startTime}
                            className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                          />
                          <input
                            form={formId}
                            name="endTime"
                            type="time"
                            defaultValue={allocation.endTime}
                            className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                          />
                        </div>
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="tourCount"
                          type="number"
                          min="1"
                          defaultValue={allocation.tourCount}
                          className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                        />
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="tonsPerTour"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={String(allocation.tonsPerTour)}
                          className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-sm font-medium text-gray-900"
                        />
                      </Td>

                      <Td>
                        <strong>{formatTons(allocation.totalTons)} t</strong>
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="notes"
                          defaultValue={allocation.notes ?? ""}
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                      </Td>

                      <Td>
                        <div className="flex gap-2">
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
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Fahrer/Fahrzeug einteilen
        </h2>

        <ShortHaulForm
          action={createShortHaulAssignment}
          workDate={selectedDateInput}
          projects={projects}
          vehicles={vehicles}
          drivers={drivers}
          materials={materials}
          asphaltMixes={asphaltMixes}
          transportItems={transportItems}
          unitOptions={unitOptions}
          driverConflicts={driverConflicts}
          vehicleConflicts={vehicleConflicts}
          shortDriverConflicts={shortDriverConflicts}
          shortVehicleConflicts={shortVehicleConflicts}
        />
      </div>

      <UtilizationTimeline rows={utilizationRows} />

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AvailabilityList
          title="Freie Fahrer"
          emptyText="Keine freien Fahrer verfügbar."
          items={freeDrivers.map((driver) => ({
            id: driver.id,
            title: `${driver.lastName}, ${driver.firstName}`,
            description:
              driver.vehicleAssignments[0]?.vehicle != null
                ? `Stammfahrzeug: ${getVehicleLabel(
                    driver.vehicleAssignments[0].vehicle
                  )}`
                : "kein Stammfahrzeug",
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

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Tagesaushang Kurzstrecke
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Fahrer</Th>
                <Th>Fahrzeug</Th>
                <Th>Kennzeichen</Th>
                <Th>Touren</Th>
                <Th>Hinweis</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody>
              {assignments.length === 0 && shortAsphaltAllocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Noch keine Kurzstrecken-Einteilung und keine Asphalt-Zuteilung für diesen Tag vorhanden.
                  </td>
                </tr>
              ) : (
                <>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-t border-gray-100">
                    <Td>
                      <div className="font-semibold text-gray-900">
                        {assignment.driverName ?? "-"}
                      </div>
                    </Td>

                    <Td>
                      <div className="font-semibold text-gray-900">
                        {assignment.vehicleNumber ?? "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {assignment.vehicleCategory ?? "-"} ·{" "}
                        {assignment.vehicleType ?? "-"}
                      </div>
                    </Td>

                    <Td>{assignment.licensePlate ?? "-"}</Td>

                    <Td>
                      <div className="space-y-2">
                        {assignment.tours.length === 0 ? (
                          <span className="text-gray-400">Keine Touren</span>
                        ) : (
                          assignment.tours.map((tour) => {
                            const quantityText = formatQuantity(
                              tour.quantity,
                              tour.quantityUnit
                            );

                            return (
                              <div
                                key={tour.id}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900">
                                  <span>Tour {tour.tourNumber}</span>
                                  <span>
                                    {tour.startTime} – {tour.endTime}
                                  </span>
                                  <span className="rounded-full bg-white px-2 py-1 text-gray-700">
                                    {getTourPurposeTypeLabel(tour.purposeType)}
                                  </span>
                                </div>

                                <div className="mt-1 text-sm font-medium text-gray-900">
                                  {tour.projectNumber} · {tour.projectName}
                                </div>

                                <div className="mt-1 text-xs text-gray-600">
                                  Zweck: {getTourPurposeLabel(tour)}
                                  {quantityText ? ` · ${quantityText}` : ""}
                                </div>

                                {tour.notes ? (
                                  <div className="mt-1 text-xs text-gray-500">
                                    {tour.notes}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </Td>

                    <Td>
                      {assignment.conflictNote ? (
                        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
                          {assignment.conflictNote}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Td>

                    <Td>
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                          Bearbeiten
                        </summary>

                        <ShortHaulForm
                          action={updateShortHaulAssignment}
                          id={assignment.id}
                          projects={projects}
                          vehicles={vehicles}
                          drivers={drivers}
                          materials={materials}
                          asphaltMixes={asphaltMixes}
                          transportItems={transportItems}
                          unitOptions={unitOptions}
                          driverConflicts={driverConflicts}
                          vehicleConflicts={vehicleConflicts}
                          shortDriverConflicts={buildShortDriverConflicts(
                            assignment.id
                          )}
                          shortVehicleConflicts={buildShortVehicleConflicts(
                            assignment.id
                          )}
                          defaultVehicleId={assignment.vehicleId ?? ""}
                          defaultDriverId={assignment.driverId ?? ""}
                          defaultNotes={assignment.notes ?? ""}
                          defaultAllowLongHaulConflict={
                            assignment.allowLongHaulConflict
                          }
                          defaultTours={
                            assignment.tours.length > 0
                              ? assignment.tours.map((tour) => ({
                                  startTime: tour.startTime,
                                  endTime: tour.endTime,
                                  projectId: tour.projectId ?? "",
                                  purposeType: tour.purposeType ?? "CUSTOM",
                                  itemId: tour.itemId ?? "",
                                  customPurpose: tour.customPurpose ?? "",
                                  quantity:
                                    tour.quantity !== null &&
                                    tour.quantity !== undefined
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

                        <form
                          action={deleteShortHaulAssignment}
                          className="mt-3"
                        >
                          <input type="hidden" name="id" value={assignment.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Löschen
                          </button>
                        </form>
                      </details>
                    </Td>
                  </tr>
                ))}

                {shortAsphaltAllocations.map((allocation) => (
                  <tr
                    key={`daily-asphalt-${allocation.id}`}
                    id={`asphalt-allocation-${allocation.id}`}
                    className="border-t border-orange-100 bg-orange-50/30"
                  >
                    <Td>
                      <div className="font-semibold text-gray-900">
                        {allocation.driverName ?? "-"}
                      </div>
                      <div className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold text-orange-900">
                        Asphalt Kurzstrecke
                      </div>
                    </Td>

                    <Td>
                      <div className="font-semibold text-gray-900">
                        {allocation.vehicleLabel || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Kurzstrecken-Asphalt
                      </div>
                    </Td>

                    <Td>siehe Fahrzeug</Td>

                    <Td>
                      <div className="rounded-lg border border-orange-200 bg-white p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-900">
                          <span>
                            {allocation.tourCount} Tour
                            {allocation.tourCount === 1 ? "" : "en"}
                          </span>
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
                          <div className="mt-1 text-xs text-gray-500">
                            {allocation.notes}
                          </div>
                        ) : null}
                      </div>
                    </Td>

                    <Td>
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-xs font-medium text-orange-950">
                        Asphalt-Zuteilung aus „Nicht verteilte Asphaltmengen“
                      </div>
                    </Td>

                    <Td>
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                          Bearbeiten
                        </summary>

                        <div className="mt-3 rounded-xl border border-orange-200 bg-white p-3">
                          <div className="grid grid-cols-2 gap-2">
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
                              <input
                                type="hidden"
                                name="id"
                                value={allocation.id}
                              />
                              <button
                                type="submit"
                                title="Asphalt-Zuteilung speichern"
                                aria-label="Asphalt-Zuteilung speichern"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-base text-white hover:bg-gray-700"
                              >
                                💾
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
                                title="Asphalt-Zuteilung löschen"
                                aria-label="Asphalt-Zuteilung löschen"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-base text-red-700 hover:bg-red-50"
                              >
                                🗑️
                              </button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </Td>
                  </tr>
                ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Sonderfahrzeuge Wochenplan
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
          {weekDays.map((day) => {
            const tasksForDay = specialTasks.filter((task) =>
              sameDate(task.workDate, day.date)
            );

            return (
              <div
                key={formatDateInput(day.date)}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="font-semibold text-gray-900">{day.label}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {formatGermanDate(day.date)}
                </div>

                <div className="mt-4 space-y-3">
                  {tasksForDay.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {task.vehicleName}
                      </div>

                      <form action={updateSpecialVehicleTask} className="mt-2">
                        <input type="hidden" name="id" value={task.id} />
                        <textarea
                          name="taskText"
                          rows={3}
                          defaultValue={task.taskText}
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                        <button
                          type="submit"
                          className="mt-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Speichern
                        </button>
                      </form>

                      <form action={deleteSpecialVehicleTask} className="mt-2">
                        <input type="hidden" name="id" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Löschen
                        </button>
                      </form>
                    </div>
                  ))}
                </div>

                <details className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Aufgabe hinzufügen
                  </summary>

                  <form
                    action={createSpecialVehicleTask}
                    className="mt-3 space-y-3"
                  >
                    <input
                      type="hidden"
                      name="workDate"
                      value={formatDateInput(day.date)}
                    />

                    {specialVehicles.length > 0 ? (
                      <label className="block text-xs font-medium text-gray-700">
                        Sonderfahrzeug
                        <select
                          name="vehicleId"
                          required
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                        >
                          <option value="" disabled>
                            Fahrzeug wählen
                          </option>

                          {specialVehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {getVehicleLabel(vehicle)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="block text-xs font-medium text-gray-700">
                        Sonderfahrzeug
                        <select
                          name="vehicleName"
                          required
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                        >
                          <option value="" disabled>
                            Fahrzeug wählen
                          </option>

                          {specialVehicleFallback.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="block text-xs font-medium text-gray-700">
                      Aufgabe
                      <textarea
                        name="taskText"
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                      />
                    </label>

                    <button
                      type="submit"
                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                    >
                      Aufgabe speichern
                    </button>
                  </form>
                </details>
              </div>
            );
          })}
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

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top text-gray-700">{children}</td>;
}