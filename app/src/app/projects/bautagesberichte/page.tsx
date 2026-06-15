import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectDailyReportDeleteButton } from "../ProjectDailyReportDeleteButton";
import { ProjectDailyReportEditor } from "../ProjectDailyReportEditor";
import { ProjectDailyReportSelectionForm } from "../ProjectDailyReportSelectionForm";
import { ProjectNavigation } from "../ProjectNavigation";
import {
  addDailyReportDays,
  buildDailyReportContext,
  getDailyReportSourceProject,
  toDailyReportDate,
} from "../dailyReportContext";

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
        orderBy: [{ reportDate: "asc" }, { createdAt: "asc" }],
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
  const reportDate = toDailyReportDate(selectedDate);
  const selectedReportSource = selectedProject
    ? await getDailyReportSourceProject(
        selectedProject.id,
        reportDate,
        addDailyReportDays(reportDate, 1),
      )
    : null;
  const dailyReportContext = selectedReportSource
    ? buildDailyReportContext(selectedReportSource, selectedDate, sheetNumber)
    : null;
  const selectionSheetNumber = dailyReportContext?.sheetNumber ?? sheetNumber;
  const exportHref =
    selectedProject && dailyReportContext
      ? buildExportHref({
          date: selectedDate,
          projectId: selectedProject.id,
          sheetNumber: dailyReportContext.sheetNumber,
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

          {selectedProject && exportHref ? (
            <a
              href={exportHref}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              PDF herunterladen
            </a>
          ) : null}
        </div>

        <ProjectDailyReportSelectionForm
          key={`${selectedProject?.id ?? "ohne"}-${selectedDate}-${selectionSheetNumber}`}
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            projectNumber: project.projectNumber,
          }))}
          selectedDate={selectedDate}
          selectedProjectId={selectedProject?.id ?? ""}
          sheetNumber={selectionSheetNumber}
        />

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

      {selectedProject && dailyReportContext ? (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Bautagesbericht prüfen und freigeben
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-600">
                Die Felder sind aus der Vorlage aufgebaut. Vorschläge können
                einzeln geprüft, geändert und freigegeben werden.
              </p>
            </div>
            <Link
              className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/projects/${selectedProject.id}#bautagesberichte`}
            >
              Projektakte öffnen
            </Link>
          </div>
          <ProjectDailyReportEditor
            context={dailyReportContext}
            exportHref={exportHref}
            key={`${selectedProject.id}-${selectedDate}-${dailyReportContext.id ?? "neu"}-${dailyReportContext.status}-${dailyReportContext.reportNumber ?? "ohne"}`}
            projectId={selectedProject.id}
          />
        </section>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Erstellte Bautagesberichte
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Je Baustelle chronologisch sortiert. Entwürfe und freigegebene
            Berichte können hier wieder geöffnet und nachbearbeitet werden.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {projects.some((project) => project.dailyReports.length > 0) ? (
            projects
              .filter((project) => project.dailyReports.length > 0)
              .map((project) => (
                <div className="p-5" key={project.id}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {project.projectNumber} · {project.name}
                    </h3>
                    <span className="text-xs font-semibold text-gray-500">
                      {project.dailyReports.length} Bericht
                      {project.dailyReports.length === 1 ? "" : "e"}
                    </span>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Aktion</th>
                          <th className="px-3 py-2 font-semibold">Nr.</th>
                          <th className="px-3 py-2 font-semibold">Datum</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                          <th className="px-3 py-2 font-semibold">Wetter</th>
                          <th className="px-3 py-2 font-semibold">Geändert</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.dailyReports.map((report) => {
                          const reportDateKey = toDateInputValue(
                            report.reportDate,
                          );
                          const reportSheetNumber =
                            report.reportNumber?.toString() ||
                            report.sheetNumber ||
                            "1";
                          const reportDateLabel = formatDate(reportDateKey);

                          return (
                            <tr
                              className="border-t border-gray-100"
                              key={report.id}
                            >
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <Link
                                    aria-label="Bautagesbericht bearbeiten"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                    href={buildDailyReportEditHref({
                                      date: reportDateKey,
                                      projectId: project.id,
                                      sheetNumber: reportSheetNumber,
                                    })}
                                    title="Bautagesbericht bearbeiten"
                                  >
                                    <ActionIcon name="edit" className="h-4 w-4" />
                                  </Link>
                                  <a
                                    aria-label="Bautagesbericht PDF herunterladen"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                    href={buildExportHref({
                                      date: reportDateKey,
                                      projectId: project.id,
                                      sheetNumber: reportSheetNumber,
                                    })}
                                    title="Bautagesbericht PDF herunterladen"
                                  >
                                    <ActionIcon name="download" className="h-4 w-4" />
                                  </a>
                                  <ProjectDailyReportDeleteButton
                                    dateLabel={reportDateLabel}
                                    reportId={report.id}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2 font-semibold text-gray-900">
                                {report.reportNumber
                                  ? `Nr. ${report.reportNumber}`
                                  : report.sheetNumber
                                    ? `Blatt ${report.sheetNumber}`
                                    : "-"}
                              </td>
                              <td className="px-3 py-2 text-gray-800">
                                {reportDateLabel}
                              </td>
                              <td className="px-3 py-2">
                                <ReportStatusPill status={report.status} />
                              </td>
                              <td className="px-3 py-2 text-gray-700">
                                {formatWeatherSummary({
                                  category: report.weatherCategory,
                                  max: report.weatherTempMaxC,
                                  min: report.weatherTempMinC,
                                })}
                              </td>
                              <td className="px-3 py-2 text-gray-600">
                                {formatDateTime(report.updatedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
          ) : (
            <div className="p-8 text-center text-sm font-medium text-gray-500">
              Noch keine Bautagesberichte erstellt.
            </div>
          )}
        </div>
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
                          {project.dailyReports.slice(-3).map((report) => (
                            <div key={report.id}>
                              {report.reportNumber
                                ? `Nr. ${report.reportNumber} · `
                                : ""}
                              {formatDate(toDateInputValue(report.reportDate))}
                              {report.weatherCategory
                                ? ` · ${report.weatherCategory}`
                                : ""}
                              {report.status === "APPROVED"
                                ? " · freigegeben"
                                : ""}
                            </div>
                          ))}
                        </div>
                      ) : (
                        "Noch keine erstellten Bautagesberichte"
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

function ReportStatusPill({ status }: { status: string }) {
  const isApproved = status === "APPROVED";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        isApproved
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {isApproved ? "freigegeben" : "Entwurf"}
    </span>
  );
}

function buildDailyReportEditHref({
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

  return `/projects/bautagesberichte?${params.toString()}`;
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

function formatWeatherSummary({
  category,
  max,
  min,
}: {
  category: string | null;
  max: number | null;
  min: number | null;
}) {
  const temperatures =
    min !== null || max !== null
      ? [formatTemperature(min), formatTemperature(max)]
          .filter(Boolean)
          .join(" / ")
      : "";

  return [category, temperatures].filter(Boolean).join(" · ") || "-";
}

function formatTemperature(value: number | null) {
  if (value === null) return "";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value)} °C`;
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

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
