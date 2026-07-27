import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  getVehicleInventoryItem,
  getVehicleInventoryLabel,
  inventoryItemToVehicleWithInventoryLink,
  inventoryVehicleBridgeInclude,
  vehicleInventoryLinkInclude,
} from "@/lib/inventory-vehicle-links";
import {
  driverIsSelectableInTruckDispatch,
  vehicleIsSelectableInTruckDispatch,
} from "@/lib/truck-dispatch-selection";
import { prisma } from "@/lib/prisma";
import {
  getAsphaltAllocationsForDay,
  getAsphaltOpenPositions,
} from "@/lib/asphalt-loads";
import {
  formatLiters,
  getTackCoatAllocationsForDay,
  getTackCoatOpenPositions,
} from "@/lib/tack-coat-loads";
import { UtilizationTimeline } from "./short-haul/UtilizationTimeline";

type DetailView =
  | "short"
  | "long"
  | "foreign"
  | "drivers"
  | "vehicles"
  | "asphalt"
  | null;

function parseDateParam(value: string | undefined) {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function parseDetailParam(value: string | undefined): DetailView {
  if (
    value === "short" ||
    value === "long" ||
    value === "foreign" ||
    value === "drivers" ||
    value === "vehicles" ||
    value === "asphalt"
  ) {
    return value;
  }

  return null;
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

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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

function getVehicleLabel(vehicle: {
  vehicleNumber: string | null;
  licensePlate: string | null;
  category: string | null;
  vehicleType: string | null;
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

function getPrimaryVehicleLabel(driver: {
  vehicleAssignments: {
    vehicle: {
      vehicleNumber: string | null;
      licensePlate: string | null;
      category: string | null;
      vehicleType: string | null;
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
  if (!label) {
    return labels;
  }

  if (!labels.includes(label)) {
    labels.push(label);
  }

  return labels;
}

function buildDetailHref(date: string, detail: DetailView) {
  if (!detail) {
    return `/truck-dispatch?date=${date}`;
  }

  return `/truck-dispatch?date=${date}&detail=${detail}`;
}

function getLongHaulPerformanceLabel(assignment: {
  plannedTourCount: number;
  plannedTonsPerTour: number;
  plannedTotalTons: number;
}) {
  if (
    assignment.plannedTourCount <= 0 &&
    assignment.plannedTonsPerTour <= 0 &&
    assignment.plannedTotalTons <= 0
  ) {
    return "Keine geplante Leistung hinterlegt";
  }

  return `${assignment.plannedTourCount} Touren × ${formatTons(
    assignment.plannedTonsPerTour
  )} t = ${formatTons(assignment.plannedTotalTons)} t`;
}

function getLongHaulTimeLabel(assignment: {
  plannedStartTime: string;
  plannedEndTime: string;
}) {
  return `${assignment.plannedStartTime} – ${assignment.plannedEndTime}`;
}

function getLongHaulMaterialLabel(entry: {
  assignmentType: string;
  materialName: string | null;
  materialUnit: string | null;
  materialQuantity: number;
}) {
  const typeLabel =
    entry.assignmentType === "ASPHALT" ? "Asphalt" : "Baumaßnahme";

  const material = entry.materialName ?? "Material nicht angegeben";
  const quantity =
    entry.materialQuantity > 0
      ? ` · ${formatTons(entry.materialQuantity)} ${entry.materialUnit ?? ""}`
      : "";

  return `${typeLabel} · ${material}${quantity}`;
}

function getShortHaulTimeLabel(assignment: {
  startTime: string;
  tours: {
    startTime: string;
    endTime: string;
  }[];
}) {
  if (assignment.tours.length === 0) {
    return `${assignment.startTime} – keine Touren`;
  }

  const sortedTours = [...assignment.tours].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  return `${sortedTours[0].startTime} – ${
    sortedTours[sortedTours.length - 1].endTime
  }`;
}

function getShortHaulTourPerformanceLabel(assignment: {
  tours: {
    id: string;
    startTime: string;
    endTime: string;
    projectNumber: string;
    projectName: string;
    purposeType: string;
    itemName: string | null;
    customPurpose: string | null;
    material: string | null;
  }[];
}) {
  if (assignment.tours.length === 0) {
    return "Keine Touren hinterlegt";
  }

  return `${assignment.tours.length} Tour(en) geplant`;
}

export default async function TruckDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    detail?: string;
  }>;
}) {
  const params = await searchParams;

  const selectedDate = parseDateParam(params.date);
  const activeDetail = parseDetailParam(params.detail);

  const previousDay = formatDateInput(addDays(selectedDate, -1));
  const today = formatDateInput(new Date());
  const nextDay = formatDateInput(addDays(selectedDate, 1));
  const selectedDateInput = formatDateInput(selectedDate);
  const selectedWeek = formatDateInput(startOfWeek(selectedDate));

  const [
    allDrivers,
    allVehicleItems,
    shortHaulAssignments,
    longHaulOwnAssignments,
    longHaulSubcontractorAssignments,
    asphaltOpenPositions,
    asphaltAllocations,
    tackCoatOpenPositions,
    tackCoatAllocations,
  ] = await Promise.all([
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

    prisma.truckLongHaulTruckAssignment.findMany({
      where: {
        ownerType: "SUBCONTRACTOR",
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
  const shortAsphaltAllocations = asphaltAllocations.filter(
    (allocation) => allocation.sourceType === "SHORT"
  );
  const shortTackCoatAllocations = tackCoatAllocations.filter(
    (allocation) => allocation.sourceType === "SHORT"
  );

  const shortDriverIds = new Set(
    shortHaulAssignments
      .map((assignment) => assignment.driverId)
      .filter((id): id is string => Boolean(id))
  );

  const shortVehicleIds = new Set(
    shortHaulAssignments
      .map((assignment) => assignment.vehicleId)
      .filter((id): id is string => Boolean(id))
  );

  const longDriverIds = new Set(
    longHaulOwnAssignments
      .map((assignment) => assignment.driverId)
      .filter((id): id is string => Boolean(id))
  );

  const longVehicleIds = new Set(
    longHaulOwnAssignments
      .map((assignment) => assignment.vehicleId)
      .filter((id): id is string => Boolean(id))
  );

  const asphaltAllocationDriverIds = shortAsphaltAllocations
    .map((allocation) => allocation.driverId)
    .filter((id): id is string => Boolean(id));
  const asphaltAllocationVehicleIds = shortAsphaltAllocations
    .map((allocation) => allocation.vehicleId)
    .filter((id): id is string => Boolean(id));
  const tackCoatAllocationDriverIds = shortTackCoatAllocations
    .map((allocation) => allocation.driverId)
    .filter((id): id is string => Boolean(id));
  const tackCoatAllocationVehicleIds = shortTackCoatAllocations
    .map((allocation) => allocation.vehicleId)
    .filter((id): id is string => Boolean(id));

  const usedDriverIds = new Set([
    ...shortDriverIds,
    ...longDriverIds,
    ...asphaltAllocationDriverIds,
    ...tackCoatAllocationDriverIds,
  ]);
  const usedVehicleIds = new Set([
    ...shortVehicleIds,
    ...longVehicleIds,
    ...asphaltAllocationVehicleIds,
    ...tackCoatAllocationVehicleIds,
  ]);

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

  const allocatedTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.allocatedLiters,
    0
  );

  const openTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.openLiters,
    0
  );

  const utilizationRows = [
    ...drivers.map((driver) => {
      const blocks = [];
      const dayVehicleLabels: string[] = [];
      let shortHaulAssignmentId: string | undefined;
      let dayDriverId: string | undefined = driver.id;
      let dayVehicleId: string | undefined;
      const dayAsphaltAllocation = shortAsphaltAllocations.find(
        (allocation) => allocation.driverId === driver.id
      );
      const dayTackCoatAllocation = shortTackCoatAllocations.find(
        (allocation) => allocation.driverId === driver.id
      );

      for (const longHaulAssignment of longHaulOwnAssignments) {
        if (longHaulAssignment.driverId === driver.id) {
          blocks.push({
            id: `driver-long-${longHaulAssignment.id}`,
            label: `Langstrecke ${longHaulAssignment.entry.projectNumber}`,
            detail: `${longHaulAssignment.entry.projectName} · ${getLongHaulPerformanceLabel(
              longHaulAssignment
            )}`,
            startTime: longHaulAssignment.plannedStartTime,
            endTime: longHaulAssignment.plannedEndTime,
            type: "LONG" as const,
          });

          if (longHaulAssignment.driverId) {
            dayDriverId = longHaulAssignment.driverId;
          }

          if (longHaulAssignment.vehicleId) {
            dayVehicleId = longHaulAssignment.vehicleId;
          }

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

      for (const assignment of shortHaulAssignments) {
        if (assignment.driverId !== driver.id) {
          continue;
        }

        shortHaulAssignmentId = assignment.id;

        if (assignment.driverId) {
          dayDriverId = assignment.driverId;
        }

        if (assignment.vehicleId) {
          dayVehicleId = assignment.vehicleId;
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

        if (allocation.driverId) {
          dayDriverId = allocation.driverId;
        }

        if (allocation.vehicleId) {
          dayVehicleId = allocation.vehicleId;
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

        if (allocation.driverId) {
          dayDriverId = allocation.driverId;
        }

        if (allocation.vehicleId) {
          dayVehicleId = allocation.vehicleId;
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

      const primaryVehicleText = getPrimaryVehicleLabel(driver);

      return {
        id: `driver-${driver.id}`,
        kind: "DRIVER" as const,
        title: `${driver.lastName}, ${driver.firstName}`,
        subtitle: `${dayVehicleText} · ${primaryVehicleText}`,
        shortHaulAssignmentId,
        dayDriverId,
        dayVehicleId:
          dayVehicleId ??
          dayAsphaltAllocation?.vehicleId ??
          dayTackCoatAllocation?.vehicleId ??
          undefined,
        blocks,
      };
    }),

    ...vehicles.map((vehicle) => {
      const blocks = [];
      let shortHaulAssignmentId: string | undefined;
      let dayDriverId: string | undefined;
      let dayVehicleId: string | undefined = vehicle.id;
      const dayAsphaltAllocation = shortAsphaltAllocations.find(
        (allocation) => allocation.vehicleId === vehicle.id
      );
      const dayTackCoatAllocation = shortTackCoatAllocations.find(
        (allocation) => allocation.vehicleId === vehicle.id
      );

      for (const longHaulAssignment of longHaulOwnAssignments) {
        if (longHaulAssignment.vehicleId === vehicle.id) {
          blocks.push({
            id: `vehicle-long-${longHaulAssignment.id}`,
            label: `Langstrecke ${longHaulAssignment.entry.projectNumber}`,
            detail: `${longHaulAssignment.entry.projectName} · ${getLongHaulPerformanceLabel(
              longHaulAssignment
            )}`,
            startTime: longHaulAssignment.plannedStartTime,
            endTime: longHaulAssignment.plannedEndTime,
            type: "LONG" as const,
          });

          if (longHaulAssignment.driverId) {
            dayDriverId = longHaulAssignment.driverId;
          }

          if (longHaulAssignment.vehicleId) {
            dayVehicleId = longHaulAssignment.vehicleId;
          }
        }
      }

      for (const assignment of shortHaulAssignments) {
        if (assignment.vehicleId !== vehicle.id) {
          continue;
        }

        shortHaulAssignmentId = assignment.id;

        if (assignment.driverId) {
          dayDriverId = assignment.driverId;
        }

        if (assignment.vehicleId) {
          dayVehicleId = assignment.vehicleId;
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

        if (allocation.driverId) {
          dayDriverId = allocation.driverId;
        }

        if (allocation.vehicleId) {
          dayVehicleId = allocation.vehicleId;
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

        if (allocation.driverId) {
          dayDriverId = allocation.driverId;
        }

        if (allocation.vehicleId) {
          dayVehicleId = allocation.vehicleId;
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
      const inventoryItem = getVehicleInventoryItem(vehicle);
      const inventoryLabel = getVehicleInventoryLabel(vehicle);

      return {
        id: `vehicle-${vehicle.id}`,
        kind: "VEHICLE" as const,
        title: `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"}`,
        subtitle: assignedDriver
          ? `Zugeordneter Fahrer: ${assignedDriver.lastName}, ${assignedDriver.firstName} · ${vehicle.category}`
          : `frei zugeordnet · ${vehicle.category} · ${vehicle.vehicleType}`,
        inventoryHref: inventoryItem ? `/inventory/${inventoryItem.id}` : undefined,
        inventoryLabel: inventoryLabel ?? undefined,
        inventoryStatus: inventoryItem?.status,
        shortHaulAssignmentId,
        dayDriverId:
          dayDriverId ??
          dayAsphaltAllocation?.driverId ??
          dayTackCoatAllocation?.driverId ??
          undefined,
        dayVehicleId,
        blocks,
      };
    }),
  ];

  return (
    <AppShell
      title="LKW-Einteilung"
      description="Zentrale Übersicht für Langstrecke, Kurzstrecke und Tagesauslastung."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {formatGermanDate(selectedDate)}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Gemeinsame Tagesübersicht für Kurzstrecke, Langstrecke,
              Fremd-LKW, Asphaltmengen und Tagesauslastung.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <form
              action="/truck-dispatch"
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
                href={`/truck-dispatch?date=${previousDay}${
                  activeDetail ? `&detail=${activeDetail}` : ""
                }`}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Vortag
              </Link>

              <Link
                href={`/truck-dispatch?date=${today}${
                  activeDetail ? `&detail=${activeDetail}` : ""
                }`}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Heute
              </Link>

              <Link
                href={`/truck-dispatch?date=${nextDay}${
                  activeDetail ? `&detail=${activeDetail}` : ""
                }`}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Folgetag
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Kurzstrecke"
          value={String(shortHaulAssignments.length)}
          hint="Fahrer/Fahrzeug-Einteilungen"
          href={buildDetailHref(selectedDateInput, "short")}
          isActive={activeDetail === "short"}
        />

        <SummaryCard
          label="Langstrecke"
          value={String(longHaulOwnAssignments.length)}
          hint="eigene STIX-LKW"
          href={buildDetailHref(selectedDateInput, "long")}
          isActive={activeDetail === "long"}
        />

        <SummaryCard
          label="Fremd-LKW"
          value={String(longHaulSubcontractorAssignments.length)}
          hint="Langstrecke / Nachunternehmer"
          href={buildDetailHref(selectedDateInput, "foreign")}
          isActive={activeDetail === "foreign"}
        />

        <SummaryCard
          label="Belegte Fahrer"
          value={String(usedDriverIds.size)}
          hint="kurz, lang oder Mengen"
          href={buildDetailHref(selectedDateInput, "drivers")}
          isActive={activeDetail === "drivers"}
        />

        <SummaryCard
          label="Belegte Fahrzeuge"
          value={String(usedVehicleIds.size)}
          hint="kurz, lang oder Mengen"
          href={buildDetailHref(selectedDateInput, "vehicles")}
          isActive={activeDetail === "vehicles"}
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
          href={buildDetailHref(selectedDateInput, "asphalt")}
          isActive={activeDetail === "asphalt"}
        />
      </div>

      {activeDetail ? (
        <DetailPanel
          activeDetail={activeDetail}
          selectedDateInput={selectedDateInput}
          shortHaulAssignments={shortHaulAssignments}
          longHaulOwnAssignments={longHaulOwnAssignments}
          longHaulSubcontractorAssignments={longHaulSubcontractorAssignments}
          asphaltOpenPositions={asphaltOpenPositions}
          tackCoatOpenPositions={tackCoatOpenPositions}
          totalAsphaltTons={totalAsphaltTons}
          allocatedAsphaltTons={allocatedAsphaltTons}
          openAsphaltTons={openAsphaltTons}
          totalTackCoatLiters={totalTackCoatLiters}
          allocatedTackCoatLiters={allocatedTackCoatLiters}
          openTackCoatLiters={openTackCoatLiters}
          vehicles={vehicles}
        />
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href={`/truck-dispatch/long-haul?week=${selectedWeek}`}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">Langstrecke</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Wochenplanung für eigene LKW und Fremd-LKW nach Projekten,
            Materialien und Fahrzeugkategorien.
          </p>
          <div className="mt-4 text-sm font-semibold text-gray-900">
            Langstrecke öffnen →
          </div>
        </Link>

        <Link
          href={`/truck-dispatch/short-haul?date=${selectedDateInput}`}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-gray-900">Kurzstrecke</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Tagesplanung für Fahrer, Fahrzeuge und mehrere Touren je
            Fahrer/Fahrzeug.
          </p>
          <div className="mt-4 text-sm font-semibold text-gray-900">
            Kurzstrecke öffnen →
          </div>
        </Link>
      </div>

      <UtilizationTimeline
        rows={utilizationRows}
        selectedDate={selectedDateInput}
      />
    </AppShell>
  );
}

function DetailPanel({
  activeDetail,
  selectedDateInput,
  shortHaulAssignments,
  longHaulOwnAssignments,
  longHaulSubcontractorAssignments,
  asphaltOpenPositions,
  tackCoatOpenPositions,
  totalAsphaltTons,
  allocatedAsphaltTons,
  openAsphaltTons,
  totalTackCoatLiters,
  allocatedTackCoatLiters,
  openTackCoatLiters,
  vehicles,
}: {
  activeDetail: Exclude<DetailView, null>;
  selectedDateInput: string;
  shortHaulAssignments: {
    id: string;
    startTime: string;
    vehicleId: string | null;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string | null;
    vehicleType: string | null;
    projectNumber: string;
    projectName: string;
    tours: {
      id: string;
      startTime: string;
      endTime: string;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
    }[];
  }[];
  longHaulOwnAssignments: {
    id: string;
    vehicleId: string | null;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string;
    vehicleType: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
  longHaulSubcontractorAssignments: {
    id: string;
    vehicleCategory: string;
    subcontractorName: string | null;
    notes: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
  asphaltOpenPositions: {
    asphaltDispatchEntryId: string;
    projectNumber: string;
    projectName: string;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    totalTons: number;
    allocatedTons: number;
    openTons: number;
    isFullyAllocated: boolean;
  }[];
  tackCoatOpenPositions: {
    key: string;
    projectNumber: string;
    projectName: string;
    materialName: string;
    quantityUnit: string;
    plannedLiters: number;
    specialVehicleLiters: number;
    shortHaulLiters: number;
    allocatedLiters: number;
    openLiters: number;
    isFullyAllocated: boolean;
  }[];
  totalAsphaltTons: number;
  allocatedAsphaltTons: number;
  openAsphaltTons: number;
  totalTackCoatLiters: number;
  allocatedTackCoatLiters: number;
  openTackCoatLiters: number;
  vehicles: {
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
}) {
  const titleByDetail: Record<Exclude<DetailView, null>, string> = {
    short: "Kurzstrecke im Detail",
    long: "Langstrecke STIX-LKW im Detail",
    foreign: "Fremd-LKW im Detail",
    drivers: "Belegte Fahrer im Detail",
    vehicles: "Belegte Fahrzeuge im Detail",
    asphalt: "Offene Mengen im Detail",
  };

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {titleByDetail[activeDetail]}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Gewählter Tag: {selectedDateInput}
          </p>
        </div>

        <Link
          href={`/truck-dispatch?date=${selectedDateInput}`}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Detail ausblenden
        </Link>
      </div>

      <div className="mt-5">
        {activeDetail === "foreign" ? (
          <ForeignTruckDetails
            assignments={longHaulSubcontractorAssignments}
          />
        ) : null}

        {activeDetail === "long" ? (
          <LongTruckDetails assignments={longHaulOwnAssignments} />
        ) : null}

        {activeDetail === "short" ? (
          <ShortHaulDetails assignments={shortHaulAssignments} />
        ) : null}

        {activeDetail === "drivers" ? (
          <DriverDetails
            shortHaulAssignments={shortHaulAssignments}
            longHaulOwnAssignments={longHaulOwnAssignments}
          />
        ) : null}

        {activeDetail === "vehicles" ? (
          <VehicleDetails
            shortHaulAssignments={shortHaulAssignments}
            longHaulOwnAssignments={longHaulOwnAssignments}
            vehicles={vehicles}
          />
        ) : null}

        {activeDetail === "asphalt" ? (
          <OpenQuantitiesDetails
            asphaltOpenPositions={asphaltOpenPositions}
            tackCoatOpenPositions={tackCoatOpenPositions}
            totalAsphaltTons={totalAsphaltTons}
            allocatedAsphaltTons={allocatedAsphaltTons}
            openAsphaltTons={openAsphaltTons}
            totalTackCoatLiters={totalTackCoatLiters}
            allocatedTackCoatLiters={allocatedTackCoatLiters}
            openTackCoatLiters={openTackCoatLiters}
          />
        ) : null}
      </div>
    </div>
  );
}

function OpenQuantitiesDetails({
  asphaltOpenPositions,
  tackCoatOpenPositions,
  totalAsphaltTons,
  allocatedAsphaltTons,
  openAsphaltTons,
  totalTackCoatLiters,
  allocatedTackCoatLiters,
  openTackCoatLiters,
}: {
  asphaltOpenPositions: {
    asphaltDispatchEntryId: string;
    projectNumber: string;
    projectName: string;
    asphaltMixNumber: string | null;
    asphaltMixName: string | null;
    totalTons: number;
    allocatedTons: number;
    openTons: number;
    isFullyAllocated: boolean;
  }[];
  tackCoatOpenPositions: {
    key: string;
    projectNumber: string;
    projectName: string;
    materialName: string;
    quantityUnit: string;
    plannedLiters: number;
    specialVehicleLiters: number;
    shortHaulLiters: number;
    allocatedLiters: number;
    openLiters: number;
    isFullyAllocated: boolean;
  }[];
  totalAsphaltTons: number;
  allocatedAsphaltTons: number;
  openAsphaltTons: number;
  totalTackCoatLiters: number;
  allocatedTackCoatLiters: number;
  openTackCoatLiters: number;
}) {
  if (asphaltOpenPositions.length === 0 && tackCoatOpenPositions.length === 0) {
    return (
      <EmptyDetail text="Keine Asphalt- oder Anspritzmittelmengen aus der Asphaltdisposition für diesen Tag vorhanden." />
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Asphalt</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <MiniStat
              label="Gesamt"
              value={`${formatTons(totalAsphaltTons)} t`}
            />
            <MiniStat
              label="Verteilt"
              value={`${formatTons(allocatedAsphaltTons)} t`}
            />
            <MiniStat
              label="Offen"
              value={`${formatTons(openAsphaltTons)} t`}
            />
          </div>
        </div>

        {asphaltOpenPositions.length === 0 ? (
          <EmptyDetail text="Keine Asphaltmengen aus der Asphaltdisposition für diesen Tag vorhanden." />
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {asphaltOpenPositions.map((position) => (
              <DetailCard
                key={position.asphaltDispatchEntryId}
                badge={
                  position.isFullyAllocated
                    ? "Asphalt · vollständig verteilt"
                    : "Asphalt · offen"
                }
                title={`${position.projectNumber} · ${position.projectName}`}
                subtitle={`${position.asphaltMixNumber ?? "-"} · ${
                  position.asphaltMixName ?? "-"
                }`}
                rows={[
                  {
                    label: "Gesamt",
                    value: `${formatTons(position.totalTons)} t`,
                  },
                  {
                    label: "Verteilt",
                    value: `${formatTons(position.allocatedTons)} t`,
                  },
                  {
                    label: "Offen",
                    value: `${formatTons(position.openTons)} t`,
                  },
                  {
                    label: "Status",
                    value: position.isFullyAllocated
                      ? "vollständig verteilt"
                      : "noch offen",
                  },
                ]}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 border-t border-gray-100 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Anspritzmittel
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <MiniStat
              label="Bedarf"
              value={`${formatLiters(totalTackCoatLiters)} l`}
            />
            <MiniStat
              label="Eingeteilt"
              value={`${formatLiters(allocatedTackCoatLiters)} l`}
            />
            <MiniStat
              label="Offen"
              value={`${formatLiters(openTackCoatLiters)} l`}
            />
          </div>
        </div>

        {tackCoatOpenPositions.length === 0 ? (
          <EmptyDetail text="Keine Anspritzmittelmengen aus der Asphaltdisposition für diesen Tag vorhanden." />
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {tackCoatOpenPositions.map((position) => (
              <DetailCard
                key={position.key}
                badge={
                  position.isFullyAllocated
                    ? "Anspritzmittel · vollständig eingeteilt"
                    : "Anspritzmittel · offen"
                }
                title={`${position.projectNumber} · ${position.projectName}`}
                subtitle={`${position.materialName} · ${position.quantityUnit}`}
                rows={[
                  {
                    label: "Bedarf",
                    value: `${formatLiters(position.plannedLiters)} l`,
                  },
                  {
                    label: "Spritzwagen",
                    value: `${formatLiters(position.specialVehicleLiters)} l`,
                  },
                  {
                    label: "Kurzstrecke",
                    value: `${formatLiters(position.shortHaulLiters)} l`,
                  },
                  {
                    label: "Offen",
                    value: `${formatLiters(position.openLiters)} l`,
                  },
                ]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ForeignTruckDetails({
  assignments,
}: {
  assignments: {
    id: string;
    vehicleCategory: string;
    subcontractorName: string | null;
    notes: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
}) {
  if (assignments.length === 0) {
    return <EmptyDetail text="Keine Fremd-LKW für diesen Tag geplant." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {assignments.map((assignment) => (
        <DetailCard
          key={assignment.id}
          badge="Fremd-LKW · Langstrecke"
          title={assignment.subcontractorName ?? "Fuhrunternehmen nicht angegeben"}
          subtitle={assignment.vehicleCategory}
          rows={[
            {
              label: "Wann",
              value: getLongHaulTimeLabel(assignment),
            },
            {
              label: "Wer",
              value: assignment.subcontractorName ?? "-",
            },
            {
              label: "Wo",
              value: `${assignment.entry.projectNumber} · ${assignment.entry.projectName}`,
            },
            {
              label: "Was",
              value: getLongHaulMaterialLabel(assignment.entry),
            },
            {
              label: "Leistung",
              value: getLongHaulPerformanceLabel(assignment),
            },
            {
              label: "Bemerkung",
              value: assignment.plannedNotes ?? assignment.notes ?? "-",
            },
          ]}
        />
      ))}
    </div>
  );
}

function LongTruckDetails({
  assignments,
}: {
  assignments: {
    id: string;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string;
    vehicleType: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
}) {
  if (assignments.length === 0) {
    return <EmptyDetail text="Keine STIX-LKW in der Langstrecke geplant." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {assignments.map((assignment) => (
        <DetailCard
          key={assignment.id}
          badge="STIX-LKW · Langstrecke"
          title={assignment.driverName ?? "Fahrer nicht angegeben"}
          subtitle={getVehicleLabel({
            vehicleNumber: assignment.vehicleNumber,
            licensePlate: assignment.licensePlate,
            category: assignment.vehicleCategory,
            vehicleType: assignment.vehicleType,
          })}
          rows={[
            {
              label: "Wann",
              value: getLongHaulTimeLabel(assignment),
            },
            {
              label: "Wer",
              value: assignment.driverName ?? "-",
            },
            {
              label: "Wo",
              value: `${assignment.entry.projectNumber} · ${assignment.entry.projectName}`,
            },
            {
              label: "Was",
              value: getLongHaulMaterialLabel(assignment.entry),
            },
            {
              label: "Leistung",
              value: getLongHaulPerformanceLabel(assignment),
            },
            {
              label: "Bemerkung",
              value: assignment.plannedNotes ?? "-",
            },
          ]}
        />
      ))}
    </div>
  );
}

function ShortHaulDetails({
  assignments,
}: {
  assignments: {
    id: string;
    startTime: string;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string | null;
    vehicleType: string | null;
    projectNumber: string;
    projectName: string;
    tours: {
      id: string;
      startTime: string;
      endTime: string;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
    }[];
  }[];
}) {
  if (assignments.length === 0) {
    return <EmptyDetail text="Keine Kurzstrecken-Einteilungen für diesen Tag." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {assignments.map((assignment) => (
        <DetailCard
          key={assignment.id}
          badge="Kurzstrecke"
          title={assignment.driverName ?? "Fahrer nicht angegeben"}
          subtitle={getVehicleLabel({
            vehicleNumber: assignment.vehicleNumber,
            licensePlate: assignment.licensePlate,
            category: assignment.vehicleCategory,
            vehicleType: assignment.vehicleType,
          })}
          rows={[
            {
              label: "Wann",
              value: getShortHaulTimeLabel(assignment),
            },
            {
              label: "Wer",
              value: assignment.driverName ?? "-",
            },
            {
              label: "Wo",
              value: `${assignment.projectNumber} · ${assignment.projectName}`,
            },
            {
              label: "Leistung",
              value: getShortHaulTourPerformanceLabel(assignment),
            },
            {
              label: "Touren",
              value:
                assignment.tours.length > 0
                  ? assignment.tours
                      .map(
                        (tour) =>
                          `${tour.startTime}–${tour.endTime} · ${
                            tour.projectNumber
                          } · ${getTourPurposeLabel(tour)}`
                      )
                      .join(" / ")
                  : "-",
            },
          ]}
        />
      ))}
    </div>
  );
}

function DriverDetails({
  shortHaulAssignments,
  longHaulOwnAssignments,
}: {
  shortHaulAssignments: {
    id: string;
    startTime: string;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string | null;
    vehicleType: string | null;
    projectNumber: string;
    projectName: string;
    tours: {
      id: string;
      startTime: string;
      endTime: string;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
    }[];
  }[];
  longHaulOwnAssignments: {
    id: string;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string;
    vehicleType: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
}) {
  const rows = [
    ...longHaulOwnAssignments.map((assignment) => ({
      id: `long-driver-${assignment.id}`,
      badge: "Fahrer · Langstrecke",
      title: assignment.driverName ?? "Fahrer nicht angegeben",
      subtitle: getVehicleLabel({
        vehicleNumber: assignment.vehicleNumber,
        licensePlate: assignment.licensePlate,
        category: assignment.vehicleCategory,
        vehicleType: assignment.vehicleType,
      }),
      rows: [
        {
          label: "Wann",
          value: getLongHaulTimeLabel(assignment),
        },
        {
          label: "Wo",
          value: `${assignment.entry.projectNumber} · ${assignment.entry.projectName}`,
        },
        {
          label: "Leistung",
          value: getLongHaulPerformanceLabel(assignment),
        },
      ],
    })),
    ...shortHaulAssignments.map((assignment) => ({
      id: `short-driver-${assignment.id}`,
      badge: "Fahrer · Kurzstrecke",
      title: assignment.driverName ?? "Fahrer nicht angegeben",
      subtitle: getVehicleLabel({
        vehicleNumber: assignment.vehicleNumber,
        licensePlate: assignment.licensePlate,
        category: assignment.vehicleCategory,
        vehicleType: assignment.vehicleType,
      }),
      rows: [
        {
          label: "Wann",
          value: getShortHaulTimeLabel(assignment),
        },
        {
          label: "Wo",
          value: `${assignment.projectNumber} · ${assignment.projectName}`,
        },
        {
          label: "Leistung",
          value: getShortHaulTourPerformanceLabel(assignment),
        },
      ],
    })),
  ];

  if (rows.length === 0) {
    return <EmptyDetail text="Keine belegten Fahrer für diesen Tag." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {rows.map((row) => (
        <DetailCard
          key={row.id}
          badge={row.badge}
          title={row.title}
          subtitle={row.subtitle}
          rows={row.rows}
        />
      ))}
    </div>
  );
}

function VehicleDetails({
  shortHaulAssignments,
  longHaulOwnAssignments,
  vehicles,
}: {
  shortHaulAssignments: {
    id: string;
    startTime: string;
    vehicleId: string | null;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string | null;
    vehicleType: string | null;
    projectNumber: string;
    projectName: string;
    tours: {
      id: string;
      startTime: string;
      endTime: string;
      projectNumber: string;
      projectName: string;
      purposeType: string;
      itemName: string | null;
      customPurpose: string | null;
      material: string | null;
    }[];
  }[];
  longHaulOwnAssignments: {
    id: string;
    vehicleId: string | null;
    driverName: string | null;
    vehicleNumber: string | null;
    licensePlate: string | null;
    vehicleCategory: string;
    vehicleType: string | null;
    plannedTourCount: number;
    plannedTonsPerTour: number;
    plannedTotalTons: number;
    plannedStartTime: string;
    plannedEndTime: string;
    plannedNotes: string | null;
    entry: {
      assignmentType: string;
      projectNumber: string;
      projectName: string;
      materialName: string | null;
      materialUnit: string | null;
      materialQuantity: number;
    };
  }[];
  vehicles: {
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  }[];
}) {
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const rows = [
    ...longHaulOwnAssignments.map((assignment) => ({
      id: `long-vehicle-${assignment.id}`,
      badge: "Fahrzeug · Langstrecke",
      title: getVehicleLabel({
        vehicleNumber: assignment.vehicleNumber,
        licensePlate: assignment.licensePlate,
        category: assignment.vehicleCategory,
        vehicleType: assignment.vehicleType,
      }),
      subtitle: assignment.driverName ?? "Fahrer nicht angegeben",
      rows: [
        {
          label: "Wann",
          value: getLongHaulTimeLabel(assignment),
        },
        {
          label: "Wo",
          value: `${assignment.entry.projectNumber} · ${assignment.entry.projectName}`,
        },
        {
          label: "Leistung",
          value: getLongHaulPerformanceLabel(assignment),
        },
      ],
    })),
    ...shortHaulAssignments.map((assignment) => {
      const vehicle = assignment.vehicleId
        ? vehicleById.get(assignment.vehicleId)
        : null;

      return {
        id: `short-vehicle-${assignment.id}`,
        badge: "Fahrzeug · Kurzstrecke",
        title: vehicle
          ? getVehicleLabel(vehicle)
          : getVehicleLabel({
              vehicleNumber: assignment.vehicleNumber,
              licensePlate: assignment.licensePlate,
              category: assignment.vehicleCategory,
              vehicleType: assignment.vehicleType,
            }),
        subtitle: assignment.driverName ?? "Fahrer nicht angegeben",
        rows: [
          {
            label: "Wann",
            value: getShortHaulTimeLabel(assignment),
          },
          {
            label: "Wo",
            value: `${assignment.projectNumber} · ${assignment.projectName}`,
          },
          {
            label: "Leistung",
            value: getShortHaulTourPerformanceLabel(assignment),
          },
        ],
      };
    }),
  ];

  if (rows.length === 0) {
    return <EmptyDetail text="Keine belegten Fahrzeuge für diesen Tag." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {rows.map((row) => (
        <DetailCard
          key={row.id}
          badge={row.badge}
          title={row.title}
          subtitle={row.subtitle}
          rows={row.rows}
        />
      ))}
    </div>
  );
}

function DetailCard({
  badge,
  title,
  subtitle,
  rows,
}: {
  badge: string;
  title: string;
  subtitle: string;
  rows: {
    label: string;
    value: string;
  }[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {badge}
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900">
            {title}
          </div>
          <div className="mt-1 text-sm text-gray-600">{subtitle}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="grid grid-cols-1 gap-1 rounded-lg bg-white p-2 text-sm md:grid-cols-[110px_1fr]"
          >
            <div className="font-semibold text-gray-500">{row.label}</div>
            <div className="font-medium text-gray-900">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function EmptyDetail({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm font-medium text-gray-500">
      {text}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  href,
  isActive,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        isActive
          ? "rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
      }
    >
      <p
        className={
          isActive
            ? "text-sm font-medium text-gray-200"
            : "text-sm font-medium text-gray-500"
        }
      >
        {label}
      </p>
      <p
        className={
          isActive
            ? "mt-3 text-3xl font-bold text-white"
            : "mt-3 text-3xl font-bold text-gray-900"
        }
      >
        {value}
      </p>
      <p
        className={
          isActive ? "mt-1 text-xs text-gray-300" : "mt-1 text-xs text-gray-500"
        }
      >
        {hint}
      </p>
      <p
        className={
          isActive
            ? "mt-3 text-xs font-semibold text-white"
            : "mt-3 text-xs font-semibold text-gray-900"
        }
      >
        Details anzeigen →
      </p>
    </Link>
  );
}

function OpenQuantitiesSummaryCard({
  asphaltOpen,
  asphaltHint,
  tackCoatOpen,
  tackCoatHint,
  href,
  isActive,
}: {
  asphaltOpen: string;
  asphaltHint: string;
  tackCoatOpen: string;
  tackCoatHint: string;
  href: string;
  isActive: boolean;
}) {
  const labelClass = isActive
    ? "text-sm font-medium text-gray-200"
    : "text-sm font-medium text-gray-500";
  const rowLabelClass = isActive
    ? "text-xs font-semibold text-gray-200"
    : "text-xs font-semibold text-gray-600";
  const valueClass = isActive
    ? "text-xl font-bold text-white"
    : "text-xl font-bold text-gray-900";
  const hintClass = isActive ? "text-xs text-gray-300" : "text-xs text-gray-500";
  const dividerClass = isActive ? "border-gray-700" : "border-gray-100";

  return (
    <Link
      href={href}
      className={
        isActive
          ? "rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
      }
    >
      <p className={labelClass}>Offene Mengen</p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className={rowLabelClass}>Asphalt</span>
            <span className={valueClass}>{asphaltOpen}</span>
          </div>
          <p className={`mt-1 ${hintClass}`}>{asphaltHint}</p>
        </div>

        <div className={`border-t pt-3 ${dividerClass}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={rowLabelClass}>Anspritzmittel</span>
            <span className={valueClass}>{tackCoatOpen}</span>
          </div>
          <p className={`mt-1 ${hintClass}`}>{tackCoatHint}</p>
        </div>
      </div>

      <p
        className={
          isActive
            ? "mt-3 text-xs font-semibold text-white"
            : "mt-3 text-xs font-semibold text-gray-900"
        }
      >
        Details anzeigen →
      </p>
    </Link>
  );
}
