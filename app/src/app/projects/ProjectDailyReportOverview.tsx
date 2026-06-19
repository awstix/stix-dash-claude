import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { ProjectDailyReportDeleteButton } from "./ProjectDailyReportDeleteButton";

export type ProjectDailyReportOverviewItem = {
  dateLabel: string;
  downloadHref: string;
  editHref: string;
  id: string;
  numberLabel: string;
  status: string;
  weatherSummary: string;
};

export function ProjectDailyReportOverview({
  defaultDate,
  nextSheetNumber,
  projectId,
  reports,
}: {
  defaultDate: string;
  nextSheetNumber: string;
  projectId: string;
  reports: ProjectDailyReportOverviewItem[];
}) {
  return (
    <section
      id="bautagesberichte"
      className="rounded-2xl border border-gray-200 bg-white shadow-sm lg:col-span-2"
    >
      <div className="flex flex-col gap-4 border-b border-gray-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Bautagesberichte
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Alle Berichte dieses Projekts. Die Bearbeitung bleibt zentral unter
            Projekte &gt; Bautagesberichte.
          </p>
        </div>

        <form
          action="/projects/bautagesberichte"
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          method="get"
        >
          <input name="projectId" type="hidden" value={projectId} />
          <input name="blattnr" type="hidden" value={nextSheetNumber} />
          <label className="text-sm font-medium text-gray-800">
            Datum
            <input
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={defaultDate}
              name="date"
              required
              type="date"
            />
          </label>
          <button
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Neuen Bautagesbericht schreiben
          </button>
        </form>
      </div>

      {reports.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm font-medium text-gray-500">
          Für dieses Projekt wurde noch kein Bautagesbericht gespeichert.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Datum</th>
                <th className="px-3 py-3 font-semibold">Nummer</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Wetter</th>
                <th className="px-5 py-3 text-right font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr className="border-t border-gray-100" key={report.id}>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    {report.dateLabel}
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    {report.numberLabel}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        report.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {report.status === "APPROVED"
                        ? "Freigegeben"
                        : "Entwurf"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    {report.weatherSummary}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        aria-label={`Bautagesbericht vom ${report.dateLabel} bearbeiten`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        href={report.editHref}
                        title="Bautagesbericht bearbeiten"
                      >
                        <ActionIcon className="h-4 w-4" name="edit" />
                      </Link>
                      <a
                        aria-label={`Bautagesbericht vom ${report.dateLabel} als PDF herunterladen`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        href={report.downloadHref}
                        title="PDF herunterladen"
                      >
                        <ActionIcon className="h-4 w-4" name="download" />
                      </a>
                      <ProjectDailyReportDeleteButton
                        dateLabel={report.dateLabel}
                        isCurrentReport={false}
                        projectId={projectId}
                        reportId={report.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
