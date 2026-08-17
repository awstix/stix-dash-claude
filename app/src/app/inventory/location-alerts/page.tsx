import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  assignInventoryLocationAlert,
  dismissInventoryLocationAlert,
} from "./actions";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function formatDistance(value: number | null) {
  if (value === null) return "—";
  if (value < 1000) return `${Math.round(value)} m`;

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
  }).format(value / 1000)} km`;
}

function projectLabel(
  project: { name: string; projectNumber: string; siteAddress?: string | null } | null,
) {
  if (!project) return "Keine Baustelle zugewiesen";

  return `${project.projectNumber} · ${project.name}`;
}

function getReasonLabel(reason: string) {
  if (reason === "NO_DISPOSITION_PROJECT") {
    return "Scan hat Baustelle erkannt, Objekt hat aber keinen Dispo-Standort.";
  }

  if (reason === "SCAN_OUTSIDE_DISPOSITION_PROJECT") {
    return "Scan liegt nicht beim aktuell zugewiesenen Dispo-Standort.";
  }

  return "Scan passt zu einer anderen Baustelle als der Dispo-Standort.";
}

function formatScanLocationLabel(alert: {
  scanAddressLabel: string | null;
  scanLog: {
    latitude: number | null;
    longitude: number | null;
  };
}) {
  if (alert.scanAddressLabel) return alert.scanAddressLabel;

  const coordinateLabel = [alert.scanLog.latitude, alert.scanLog.longitude]
    .filter((value) => value !== null)
    .join(", ");

  return coordinateLabel || "Ohne Standortdaten";
}

export default async function InventoryLocationAlertsPage() {
  const [alerts, projects] = await Promise.all([
    prisma.inventoryLocationAlert.findMany({
      include: {
        currentProject: true,
        item: {
          include: {
            category: true,
          },
        },
        scanLog: true,
        suggestedProject: true,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      take: 80,
      where: {
        status: "OPEN",
      },
    }),
    prisma.project.findMany({
      orderBy: [
        {
          projectNumber: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        projectNumber: true,
        siteAddress: true,
      },
      where: {
        status: {
          in: [
            ProjectStatus.ACTIVE,
            ProjectStatus.NOT_STARTED,
            ProjectStatus.PAUSED,
          ],
        },
      },
    }),
  ]);

  return (
    <AppShell
      title="Inventar-Standortmeldungen"
      description="Wenn ein QR-/DataMatrix-Scan nicht zum Dispo-Standort passt, landet die Meldung hier für Admin, Disponent und später Bauleiter."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Offene Standortprüfungen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {alerts.length} offene Meldungen. Final zuweisen dürfen später nur
              Admin, Disponent und Bauleiter.
            </p>
          </div>
          <Link
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory/scanner"
          >
            Scanner öffnen
          </Link>
        </div>
      </section>

      {alerts.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm font-medium text-emerald-900">
          Alles ruhig: aktuell gibt es keine offenen Standortmeldungen.
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {alerts.map((alert) => (
            <article
              className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm"
              key={alert.id}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-900">
                      Standort prüfen
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDateTime(alert.createdAt)}
                    </span>
                  </div>

                  <div>
                    <Link
                      className="text-lg font-bold text-gray-950 hover:text-gray-700"
                      href={`/inventory/${alert.itemId}`}
                    >
                      {alert.item.objectNumber
                        ? `${alert.item.objectNumber} · ${alert.item.name}`
                        : alert.item.name}
                    </Link>
                    <p className="mt-1 text-sm text-gray-600">
                      {alert.item.category?.name ?? "Ohne Kategorie"} ·{" "}
                      {getReasonLabel(alert.reason)}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <InfoBox
                      label="Standort laut Dispo"
                      text={projectLabel(alert.currentProject)}
                      subtext={
                        alert.currentProject?.siteAddress ??
                        `Entfernung zum Scan: ${formatDistance(
                          alert.distanceToCurrentMeters,
                        )}`
                      }
                    />
                    <InfoBox
                      label="Standort letzter Scan"
                      text={formatScanLocationLabel(alert)}
                      subtext={`Gescannt von ${alert.scannedByName ?? "Unbekannt"}`}
                    />
                    <InfoBox
                      label="Vorschlag über GPS"
                      text={projectLabel(alert.suggestedProject)}
                      subtext={`Entfernung: ${formatDistance(
                        alert.distanceToSuggestedMeters,
                      )}`}
                    />
                  </div>
                </div>

                <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 xl:max-w-sm">
                  <form action={assignInventoryLocationAlert} className="space-y-3">
                    <input name="alertId" type="hidden" value={alert.id} />
                    <label className="block text-sm font-semibold text-gray-800">
                      Objekt der Baustelle zuweisen
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        defaultValue={alert.suggestedProjectId ?? ""}
                        name="projectId"
                      >
                        <option value="">Baustelle auswählen</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {projectLabel(project)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold text-gray-800">
                      Zugewiesen / geprüft von
                      <input
                        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        name="assignedByName"
                        placeholder="später automatisch Benutzer"
                        type="text"
                      />
                    </label>
                    <button className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
                      Final zuweisen
                    </button>
                  </form>

                  <form action={dismissInventoryLocationAlert} className="mt-3">
                    <input name="alertId" type="hidden" value={alert.id} />
                    <input
                      name="resolvedByName"
                      type="hidden"
                      value="Admin / Disponent / Bauleiter"
                    />
                    <button className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-white">
                      Meldung schließen
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}

function InfoBox({
  label,
  subtext,
  text,
}: {
  label: string;
  subtext?: string | null;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-950">{text}</p>
      {subtext ? <p className="mt-1 text-xs text-gray-500">{subtext}</p> : null}
    </div>
  );
}
