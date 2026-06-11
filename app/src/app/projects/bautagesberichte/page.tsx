import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectNavigation } from "../ProjectNavigation";

export default async function ProjectDailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    blattnr?: string;
    date?: string;
    projectId?: string;
  }>;
}) {
  const params = await searchParams;
  const today = toDateInputValue(new Date());
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? String(params.date)
    : today;
  const selectedProjectId = String(params.projectId ?? "");
  const sheetNumber = String(params.blattnr ?? "1").trim() || "1";

  const projects = await prisma.project.findMany({
    include: {
      dailyReports: {
        orderBy: [{ reportDate: "desc" }],
        take: 3,
      },
      weatherLogs: {
        orderBy: [{ weatherDate: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { projectNumber: "asc" }],
  });

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ??
    projects[0] ??
    null;
  const exportHref = selectedProject
    ? buildExportHref({
        date: selectedDate,
        projectId: selectedProject.id,
        sheetNumber,
      })
    : "";

  return (
    <AppShell
      title="Projekte Bautagesberichte"
      description="STIX-Baubericht aus Projektakte, Wetterprotokoll und Disposition automatisch vorbefüllen und als PDF ausgeben."
    >
      <ProjectNavigation active="daily-reports" />

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Baubericht aus Vorlage erzeugen
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">
              Die Vorlage wird automatisch mit Projekt, Projektnummer, Datum,
              Wetter, Temperaturen, Arbeitszeit, Arbeitskräften, Maschinen,
              LKW und Tagesleistungen aus den vorhandenen Projektdaten befüllt.
            </p>
          </div>

          {selectedProject ? (
            <a
              href={exportHref}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              PDF herunterladen
            </a>
          ) : null}
        </div>

        <form
          action="/projects/bautagesberichte"
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_180px_120px_auto]"
        >
          <label className="text-sm font-medium text-gray-800">
            Projekt
            <select
              name="projectId"
              defaultValue={selectedProject?.id ?? ""}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {projects.length === 0 ? (
                <option value="">Keine Projekte vorhanden</option>
              ) : null}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectNumber} · {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-800">
            Datum
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Blattnr.
            <input
              name="blattnr"
              defaultValue={sheetNumber}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Auswahl übernehmen
            </button>
          </div>
        </form>

        {selectedProject ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            Aktuelle Auswahl:{" "}
            <strong>
              {selectedProject.projectNumber} · {selectedProject.name}
            </strong>{" "}
            für den {formatDate(selectedDate)}.
          </div>
        ) : null}
      </section>

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Vorlage" value="STIX Baubericht PDF" />
        <InfoCard label="Wetter" value="Prognose + manuelle Korrektur" />
        <InfoCard label="Personal" value="Kolonneneinteilung" />
        <InfoCard label="Geräte/LKW" value="Dispo zusammengeführt" />
      </section>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Projekte
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Schnellzugriff auf Projektakte und Baubericht-Export.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 font-semibold">Projekt</th>
                <th className="p-4 font-semibold">Bauleiter</th>
                <th className="p-4 font-semibold">Wetterstand</th>
                <th className="p-4 font-semibold">Bautagesberichte</th>
                <th className="p-4 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Noch keine Projekte vorhanden.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-t border-gray-100">
                    <td className="p-4 align-top">
                      <div className="font-semibold text-gray-900">
                        {project.projectNumber}
                      </div>
                      <div className="mt-1 text-gray-600">{project.name}</div>
                    </td>
                    <td className="p-4 align-top text-gray-700">
                      {project.constructionManager || "-"}
                    </td>
                    <td className="p-4 align-top text-gray-700">
                      {project.weatherLogs[0]
                        ? formatDate(toDateInputValue(project.weatherLogs[0].weatherDate))
                        : "Noch kein Wetterprotokoll"}
                    </td>
                    <td className="p-4 align-top text-gray-700">
                      {project.dailyReports.length > 0 ? (
                        <div className="space-y-1">
                          {project.dailyReports.map((report) => (
                            <div key={report.id}>
                              {formatDate(toDateInputValue(report.reportDate))}
                              {report.weatherCategory
                                ? ` · ${report.weatherCategory}`
                                : ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "Noch keine gespeicherten Wetterkorrekturen"
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/projects/${project.id}#bautagesberichte`}
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Projektakte
                        </Link>
                        <a
                          href={buildExportHref({
                            date: selectedDate,
                            projectId: project.id,
                            sheetNumber,
                          })}
                          className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-base font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function buildExportHref({
  date,
  projectId,
  sheetNumber,
}: {
  date: string;
  projectId: string;
  sheetNumber: string;
}) {
  const params = new URLSearchParams({
    blattnr: sheetNumber,
    date,
    projectId,
  });

  return `/projects/bautagesberichte/export?${params.toString()}`;
}

function toDateInputValue(date: Date) {
  const adjusted = new Date(date);
  adjusted.setMinutes(adjusted.getMinutes() - adjusted.getTimezoneOffset());
  return adjusted.toISOString().slice(0, 10);
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}
