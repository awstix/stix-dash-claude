import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectMap } from "./ProjectMap";
import { ProjectNavigation } from "./ProjectNavigation";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
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
                  vehicle: true,
                },
              },
            },
          },
        },
      },
      equipmentDispatchAssignments: {
        include: {
          crew: true,
          vehicle: true,
        },
      },
      shortHaulAssignments: true,
      specialVehicleDispatchAssignments: {
        include: {
          transportVehicle: true,
          vehicle: true,
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

  const activeProjects = projects.filter(
    (project) => project.status !== ProjectStatus.CANCELLED,
  );
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

  return (
    <AppShell
      title="Projekte"
      description="Projektzentrale mit Projektakte, Leistung, Dispo-Bezug, Fotos, Dokumenten, Formularen, Notizen und Bautagesberichten."
    >
      <ProjectNavigation active="overview" />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Projekte gesamt" value={`${projects.length}`} />
        <SummaryCard label="Aktive Projekte" value={`${activeProjects.length}`} />
        <SummaryCard
          label="Leistung IST"
          value={formatEuro(
            projectSummaries.reduce(
              (sum, item) => sum + item.performanceValue,
              0,
            ),
          )}
        />
        <SummaryCard
          label="Über-/Unterdeckung"
          value={formatEuro(
            projectSummaries.reduce((sum, item) => sum + item.difference, 0),
          )}
        />
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Projektübersicht
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Die Projektakte bündelt künftig Karte, Personal, Geräte, Leistung,
              Fotos, Dokumente, Formulare, Notizen und Bautagesberichte je Baustelle.
            </p>
          </div>

          <Link
            href="/projects/performance"
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Projekte Leistung öffnen
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {projectSummaries.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
            Noch keine Projekte vorhanden.
          </div>
        ) : (
          projectSummaries.map((item) => (
            <article
              key={item.project.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr_1fr]">
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

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    Personal / Geräte
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <MiniMetric label="Personal" value={`${item.people.length}`} />
                    <MiniMetric label="Geräte" value={`${item.equipment.length}`} />
                    <MiniMetric label="LKW-Bezug" value={`${item.truckCount}`} />
                    <MiniMetric
                      label="Asphaltdispo"
                      value={`${item.project.asphaltDispatchEntries.length}`}
                    />
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs text-gray-600">
                    {item.people.length
                      ? item.people.slice(0, 6).join(", ")
                      : "Noch kein Personal aus der Disposition zugeordnet."}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-semibold text-gray-900">
                    Kartenausschnitt
                  </div>
                  <ProjectMap
                    address={item.project.siteAddress}
                    boundaryGeoJson={item.project.siteBoundaryGeoJson}
                    className="mt-3"
                    heightClass="h-28"
                    latitude={item.project.mapLatitude}
                    longitude={item.project.mapLongitude}
                    zoom={item.project.mapZoom}
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ArchiveSection
          id="fotos"
          title="Fotos"
          text="Projektfotos können jetzt unter Projekte > Fotos hochgeladen, mit Notizen versehen und für Bautagesberichte vorgemerkt werden."
        />
        <ArchiveSection
          id="dokumente"
          title="Dokumente"
          text="Pläne, Aufträge, Nachträge, Prüfzeugnisse und Schriftverkehr bekommen hier ihren Platz."
        />
        <ArchiveSection
          id="formulare"
          title="Formulare"
          text="Vorlagen und ausgefüllte Formulare werden später projektbezogen geführt."
        />
        <ArchiveSection
          id="notizen"
          title="Notizen"
          text="Notizen werden pro Projekt gesammelt und später mit Bearbeiter/Datum geführt."
        />
        <ArchiveSection
          id="bautagesberichte"
          title="Bautagesberichte"
          text="Bautagesberichte werden aus Projekt, Personal, Geräten, Wetter und Tagesnotizen zusammengesetzt."
        />
      </div>
    </AppShell>
  );
}

function ArchiveSection({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  text: string;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{text}</p>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-3 text-xl font-bold text-gray-900">{value}</p>
    </div>
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
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
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
