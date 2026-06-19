import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getDefaultWorkTime } from "@/lib/work-time";
import { ProjectDailyReportBulkList } from "../ProjectDailyReportBulkList";
import { ProjectDailyReportEditor } from "../ProjectDailyReportEditor";
import { ProjectDailyReportSelectionForm } from "../ProjectDailyReportSelectionForm";
import { ProjectNavigation } from "../ProjectNavigation";
import { ensureProjectWeatherForDate } from "../actions";
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
  const requestedSheetNumber = String(params.blattnr ?? "").trim();

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
  const sheetNumber =
    requestedSheetNumber ||
    getDailyReportSheetNumberForSelection(selectedProject, selectedDate);
  const reportDate = toDailyReportDate(selectedDate);

  if (selectedProject) {
    await ensureProjectWeatherForDate(selectedProject.id, selectedDate);
  }

  const [selectedReportSource, defaultWorkTime] = await Promise.all([
    selectedProject
      ? getDailyReportSourceProject(
          selectedProject.id,
          reportDate,
          addDailyReportDays(reportDate, 1),
        )
      : Promise.resolve(null),
    getDefaultWorkTime(),
  ]);
  const dailyReportContext = selectedReportSource
    ? buildDailyReportContext(
        selectedReportSource,
        selectedDate,
        sheetNumber,
        defaultWorkTime,
      )
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
  const dailyReportProjects = projects
    .filter((project) => project.dailyReports.length > 0)
    .map((project) => ({
      id: project.id,
      name: project.name,
      projectNumber: project.projectNumber,
      reports: project.dailyReports.map((report) => {
        const reportDateKey = toDateInputValue(report.reportDate);
        const reportSheetNumber =
          report.reportNumber?.toString() || report.sheetNumber || "1";

        return {
          dateKey: reportDateKey,
          dateLabel: formatDate(reportDateKey),
          downloadHref: buildExportHref({
            date: reportDateKey,
            projectId: project.id,
            sheetNumber: reportSheetNumber,
          }),
          editHref: buildDailyReportEditHref({
            date: reportDateKey,
            projectId: project.id,
            sheetNumber: reportSheetNumber,
          }),
          id: report.id,
          isCurrentReport:
            selectedProject?.id === project.id && selectedDate === reportDateKey,
          numberLabel: report.reportNumber
            ? `Nr. ${report.reportNumber}`
            : report.sheetNumber
              ? `Blatt ${report.sheetNumber}`
              : "-",
          projectId: project.id,
          status: report.status,
          updatedAtLabel: formatDateTime(report.updatedAt),
          weatherSummary: formatWeatherSummary({
            category: report.weatherCategory,
            max: report.weatherTempMaxC,
            min: report.weatherTempMinC,
          }),
        };
      }),
    }));

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
            dailyReports: project.dailyReports.map((report) => ({
              date: toDateInputValue(report.reportDate),
              sheetNumber:
                report.reportNumber?.toString() || report.sheetNumber || "1",
            })),
            id: project.id,
            name: project.name,
            nextSheetNumber: getNextDailyReportSheetNumber(project),
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

        <div>
          {dailyReportProjects.length > 0 ? (
            <ProjectDailyReportBulkList
              key={dailyReportProjects
                .flatMap((project) =>
                  project.reports.map((report) => report.id),
                )
                .join("-")}
              projects={dailyReportProjects}
            />
          ) : (
            <div className="p-8 text-center text-sm font-medium text-gray-500">
              Noch keine Bautagesberichte erstellt.
            </div>
          )}
        </div>
      </section>

    </AppShell>
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

function getDailyReportSheetNumberForSelection(
  project:
    | {
        dailyReports: {
          reportDate: Date;
          reportNumber: number | null;
          sheetNumber: string;
        }[];
      }
    | null,
  dateKey: string,
) {
  if (!project) return "1";

  const existingReport = project.dailyReports.find(
    (report) => toDateInputValue(report.reportDate) === dateKey,
  );

  if (existingReport) {
    return (
      existingReport.reportNumber?.toString() ||
      existingReport.sheetNumber ||
      "1"
    );
  }

  return getNextDailyReportSheetNumber(project);
}

function getNextDailyReportSheetNumber(project: {
  dailyReports: {
    reportNumber: number | null;
    sheetNumber: string;
  }[];
}) {
  const highestNumber = project.dailyReports.reduce((max, report) => {
    const sheetNumber = Number.parseInt(report.sheetNumber, 10);
    const reportNumber = report.reportNumber ?? 0;
    const numericSheetNumber = Number.isFinite(sheetNumber) ? sheetNumber : 0;

    return Math.max(max, reportNumber, numericSheetNumber);
  }, 0);

  return String(highestNumber + 1);
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
