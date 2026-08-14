import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import { getAccessibleProjectIds } from "@/lib/auth-access";
import { DismissibleDetails } from "../crew-dispatch/DismissibleDetails";
import { ProjectCreateDialog } from "./ProjectCreateDialog";
import { ProjectMap } from "./ProjectMap";
import { ProjectNavigation } from "./ProjectNavigation";

type ProjectSortOption = "newest" | "oldest" | "alphabet";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    sort?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const sortOption = getProjectSortOption(params.sort);
  const accessibleProjectIds = await getAccessibleProjectIds();

  const projects = await prisma.project.findMany({
    where:
      accessibleProjectIds === null
        ? undefined
        : { id: { in: accessibleProjectIds } },
    include: {
      asphaltDispatchEntries: true,
      crewPlanningRows: {
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
                  },
                },
              },
              extraEmployees: {
                include: {
                  employee: true,
                },
              },
              extraVehicles: {
                include: {
                  vehicle: {
                    include: vehicleInventoryLinkInclude,
                  },
                },
              },
            },
          },
        },
      },
      equipmentDispatchAssignments: {
        include: {
          crew: true,
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      shortHaulAssignments: true,
      specialVehicleDispatchAssignments: {
        include: {
          transportVehicle: {
            include: vehicleInventoryLinkInclude,
          },
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      truckLongHaulEntries: {
        include: {
          truckAssignments: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const constructionManagerEmployees = await prisma.employee.findMany({
    include: {
      positions: {
        orderBy: [{ sortOrder: "asc" }, { positionLabel: "asc" }],
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    where: {
      statusValue: "active",
    },
  });
  const constructionManagerOptions = constructionManagerEmployees
    .flatMap((employee) => {
      const positionsLabel = employee.positions
        .map((position) => position.positionLabel)
        .join(", ");
      const searchablePositionText = employee.positions
        .map((position) => `${position.positionLabel} ${position.positionValue}`)
        .join(" ")
        .toLowerCase();
      const isConstructionManager =
        searchablePositionText.includes("bauleit");

      if (!isConstructionManager) {
        return [];
      }

      return [{
        employeeId: employee.id,
        label: `${employee.firstName} ${employee.lastName}`,
        positionsLabel,
        value: `${employee.firstName} ${employee.lastName}`,
      }];
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

  const projectSummaries = projects.map((project) => {
    const people = new Map<string, string>();
    const equipment = new Map<string, string>();

    for (const row of project.crewPlanningRows) {
      for (const assignment of row.assignments) {
        for (const member of assignment.crew?.members ?? []) {
          people.set(
            member.employee.id,
            `${member.employee.lastName}, ${member.employee.firstName}`,
          );
        }

        for (const extraEmployee of assignment.extraEmployees) {
          people.set(
            extraEmployee.employee.id,
            `${extraEmployee.employee.lastName}, ${extraEmployee.employee.firstName}`,
          );
        }

        for (const extraVehicle of assignment.extraVehicles) {
          equipment.set(extraVehicle.vehicle.id, getVehicleLabel(extraVehicle.vehicle));
        }
      }
    }

    for (const assignment of project.equipmentDispatchAssignments) {
      equipment.set(assignment.vehicle.id, getVehicleLabel(assignment.vehicle));
    }

    for (const assignment of project.specialVehicleDispatchAssignments) {
      if (assignment.vehicle) {
        equipment.set(assignment.vehicle.id, getVehicleLabel(assignment.vehicle));
      } else if (assignment.vehicleName) {
        equipment.set(`special-${assignment.id}`, assignment.vehicleName);
      }

      if (assignment.transportVehicle) {
        equipment.set(
          assignment.transportVehicle.id,
          getVehicleLabel(assignment.transportVehicle),
        );
      } else if (assignment.transportVehicleName) {
        equipment.set(
          `transport-${assignment.id}`,
          assignment.transportVehicleName,
        );
      }
    }

    const totalContract = project.contractValueNet + project.changeOrdersNet;
    const performanceValue = totalContract * (project.progressPercent / 100);
    const difference = project.paymentsNet - performanceValue;
    const truckCount =
      project.shortHaulAssignments.length +
      project.truckLongHaulEntries.reduce(
        (sum, entry) => sum + entry.truckAssignments.length,
        0,
      );

    return {
      project,
      totalContract,
      performanceValue,
      difference,
      people: Array.from(people.values()).sort((a, b) =>
        a.localeCompare(b, "de-DE"),
      ),
      equipment: Array.from(equipment.values()).sort((a, b) =>
        a.localeCompare(b, "de-DE"),
      ),
      truckCount,
    };
  });
  const normalizedSearchQuery = normalizeProjectSearchText(searchQuery);
  const filteredProjectSummaries = projectSummaries
    .filter((item) => {
      if (!normalizedSearchQuery) return true;

      return normalizeProjectSearchText(
        `${item.project.projectNumber} ${item.project.name}`,
      ).includes(normalizedSearchQuery);
    })
    .sort((a, b) => {
      if (sortOption === "oldest") {
        return a.project.projectNumber.localeCompare(
          b.project.projectNumber,
          "de-DE",
          { numeric: true },
        );
      }

      if (sortOption === "alphabet") {
        const nameCompare = a.project.name.localeCompare(
          b.project.name,
          "de-DE",
        );

        if (nameCompare !== 0) return nameCompare;

        return a.project.projectNumber.localeCompare(
          b.project.projectNumber,
          "de-DE",
        );
      }

      return b.project.projectNumber.localeCompare(a.project.projectNumber, "de-DE", {
        numeric: true,
      });
    });
  const activeProjectFilterCount =
    Number(Boolean(searchQuery)) + Number(sortOption !== "newest");

  return (
    <AppShell
      title="Projekte"
      description="Projektzentrale mit Projektakte, Leistung, Dispo-Bezug, Fotos, Dokumenten, Formularen, Notizen und Bautagesberichten."
    >
      <ProjectNavigation active="overview" />

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Projektübersicht
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Die Projektakte bündelt künftig Karte, Personal, Geräte, Leistung,
              Fotos, Dokumente, Formulare, Notizen und Bautagesberichte je Baustelle.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold text-gray-700">
            {filteredProjectSummaries.length}/{projectSummaries.length} Projekte
            sichtbar
            {searchQuery ? ` · Suche: ${searchQuery}` : ""}
          </div>

          <div className="flex flex-wrap gap-2">
            <ProjectCreateDialog
              constructionManagerOptions={constructionManagerOptions}
            />
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/projects/imports"
            >
              Projekte importieren
            </Link>
            <DismissibleDetails className="relative inline-block">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                🔎 Filter
                {activeProjectFilterCount > 0 ? (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                    {activeProjectFilterCount}
                  </span>
                ) : null}
              </summary>

              <div className="absolute right-0 top-full z-[var(--z-modal)] mt-2 max-h-[70vh] w-[92vw] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                <div className="text-sm font-bold text-gray-900">
                  Projekte filtern
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Nach Projektnummer oder Name suchen und die Reihenfolge wählen.
                </p>

                <form action="/projects" className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Suche
                    <input
                      name="q"
                      defaultValue={searchQuery}
                      placeholder="Projektnummer oder Name"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    />
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Sortierung
                    <select
                      name="sort"
                      defaultValue={sortOption}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="newest">Projektnummer absteigend</option>
                      <option value="oldest">Projektnummer aufsteigend</option>
                      <option value="alphabet">Alphabetisch</option>
                    </select>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                    >
                      Filter anwenden
                    </button>

                    <Link
                      href="/projects"
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Zurücksetzen
                    </Link>
                  </div>
                </form>
              </div>
            </DismissibleDetails>

            {activeProjectFilterCount > 0 ? (
              <Link
                href="/projects"
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Zurücksetzen
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {filteredProjectSummaries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
            Keine Projekte passend zum Filter gefunden.
          </div>
        ) : (
          filteredProjectSummaries.map((item) => (
            <article
              key={item.project.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.65fr)]">
                <div>
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {item.project.projectNumber} · {item.project.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {item.project.constructionManager || "Bauleiter offen"} ·{" "}
                        {formatDate(item.project.plannedStart)} –{" "}
                        {formatDate(item.project.plannedEnd)}
                      </p>
                    </div>
                    <StatusBadge status={item.project.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MiniMetric
                      label="Auftrag inkl. Nachträge"
                      value={formatEuro(item.totalContract)}
                    />
                    <MiniMetric
                      label="Leistung IST"
                      value={formatEuro(item.performanceValue)}
                    />
                    <MiniMetric
                      label="Über-/Unterdeckung"
                      value={formatEuro(item.difference)}
                      tone={item.difference >= 0 ? "positive" : "negative"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${item.project.id}`}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                    >
                      Projektakte
                    </Link>
                    <Link
                      href="/projects/performance"
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Leistung bearbeiten
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,0.85fr)_minmax(360px,1.15fr)]">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">
                      Personal / Geräte
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <MiniMetric
                        label="Personal"
                        value={`${item.people.length}`}
                      />
                      <MiniMetric
                        label="Geräte"
                        value={`${item.equipment.length}`}
                      />
                      <MiniMetric label="LKW-Bezug" value={`${item.truckCount}`} />
                      <MiniMetric
                        label="Asphaltdispo"
                        value={`${item.project.asphaltDispatchEntries.length}`}
                      />
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs text-gray-600">
                      {item.people.length
                        ? item.people.slice(0, 8).join(", ")
                        : "Noch kein Personal aus der Disposition zugeordnet."}
                    </p>
                    {item.equipment.length ? (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                        {item.equipment.slice(0, 6).join(", ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">
                      Kartenausschnitt
                    </div>
                    <ProjectMap
                      address={item.project.siteAddress}
                      boundaryGeoJson={item.project.siteBoundaryGeoJson}
                      className="mt-3"
                      heightClass="h-48"
                      latitude={item.project.mapLatitude}
                      longitude={item.project.mapLongitude}
                      zoom={item.project.mapZoom}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

    </AppShell>
  );
}

function MiniMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "negative" | "neutral" | "positive";
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-sm font-bold ${getToneClass(tone)}`}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const colorMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    FINISHED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const labelMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "noch nicht begonnen",
    ACTIVE: "aktiv",
    PAUSED: "ruht",
    FINISHED: "beendet",
    CANCELLED: "storniert",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colorMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

function getVehicleLabel(vehicle: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
} & VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  if (inventoryItem) {
    return String(inventoryItem.name ?? "").trim() || "Fahrzeug / Gerät";
  }

  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function getProjectSortOption(value: string | undefined): ProjectSortOption {
  if (value === "oldest" || value === "alphabet") {
    return value;
  }

  return "newest";
}

function normalizeProjectSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function getToneClass(tone: "negative" | "neutral" | "positive") {
  if (tone === "positive") {
    return "text-green-700";
  }

  if (tone === "negative") {
    return "text-red-700";
  }

  return "text-gray-900";
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(value);
}
