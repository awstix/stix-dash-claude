"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { ProjectDailyReportDeleteButton } from "./ProjectDailyReportDeleteButton";

type DailyReportListItem = {
  dateKey: string;
  dateLabel: string;
  downloadHref: string;
  editHref: string;
  id: string;
  isCurrentReport: boolean;
  numberLabel: string;
  projectId: string;
  status: string;
  updatedAtLabel: string;
  weatherSummary: string;
};

type DailyReportProjectGroup = {
  id: string;
  name: string;
  projectNumber: string;
  reports: DailyReportListItem[];
};

export function ProjectDailyReportBulkList({
  projects,
}: {
  projects: DailyReportProjectGroup[];
}) {
  const allReportIds = useMemo(
    () => projects.flatMap((project) => project.reports.map((report) => report.id)),
    [projects],
  );
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const allSelected =
    allReportIds.length > 0 && selectedIds.size === allReportIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && !allSelected;
    }
  }, [allSelected, selectedIds.size]);

  function setReportSelected(reportId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(reportId);
      } else {
        next.delete(reportId);
      }

      return next;
    });
  }

  function setAllSelected(checked: boolean) {
    setSelectedIds(checked ? new Set(allReportIds) : new Set());
  }

  async function downloadReports(reportIds: string[] | null) {
    setIsDownloading(true);

    try {
      const response = await fetch("/projects/bautagesberichte/download", {
        body: JSON.stringify(
          reportIds
            ? {
                reportIds,
              }
            : {
                all: true,
              },
        ),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) || "Bautagesberichte konnten nicht geladen werden.",
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        "Bautagesberichte.zip";

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Bautagesberichte konnten nicht heruntergeladen werden.",
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
          <input
            checked={allSelected}
            onChange={(event) => setAllSelected(event.currentTarget.checked)}
            ref={selectAllRef}
            type="checkbox"
          />
          Alle markieren
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            disabled={isDownloading || selectedIds.size === 0}
            onClick={() => downloadReports(Array.from(selectedIds))}
            type="button"
          >
            <ActionIcon className="h-4 w-4" name="download" />
            Markierte herunterladen ({selectedIds.size})
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            disabled={isDownloading || allReportIds.length === 0}
            onClick={() => downloadReports(null)}
            type="button"
          >
            <ActionIcon className="h-4 w-4" name="download" />
            Alle herunterladen ({allReportIds.length})
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {projects.map((project) => (
          <div className="p-5" key={project.id}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 className="font-semibold text-gray-900">
                {project.projectNumber} · {project.name}
              </h3>
              <span className="text-xs font-semibold text-gray-500">
                {project.reports.length} Bericht
                {project.reports.length === 1 ? "" : "e"}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="w-12 px-3 py-2 font-semibold">
                      <span className="sr-only">Markieren</span>
                    </th>
                    <th className="px-3 py-2 font-semibold">Aktion</th>
                    <th className="px-3 py-2 font-semibold">Nr.</th>
                    <th className="px-3 py-2 font-semibold">Datum</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Wetter</th>
                    <th className="px-3 py-2 font-semibold">Geändert</th>
                  </tr>
                </thead>
                <tbody>
                  {project.reports.map((report) => (
                    <tr className="border-t border-gray-100" key={report.id}>
                      <td className="px-3 py-2">
                        <input
                          aria-label={`Bautagesbericht ${report.numberLabel} vom ${report.dateLabel} markieren`}
                          checked={selectedIds.has(report.id)}
                          onChange={(event) =>
                            setReportSelected(
                              report.id,
                              event.currentTarget.checked,
                            )
                          }
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            aria-label="Bautagesbericht bearbeiten"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            href={report.editHref}
                            title="Bautagesbericht bearbeiten"
                          >
                            <ActionIcon className="h-4 w-4" name="edit" />
                          </Link>
                          <a
                            aria-label="Bautagesbericht PDF herunterladen"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            href={report.downloadHref}
                            title="Bautagesbericht PDF herunterladen"
                          >
                            <ActionIcon className="h-4 w-4" name="download" />
                          </a>
                          <ProjectDailyReportDeleteButton
                            dateLabel={report.dateLabel}
                            isCurrentReport={report.isCurrentReport}
                            projectId={report.projectId}
                            reportId={report.id}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-900">
                        {report.numberLabel}
                      </td>
                      <td className="px-3 py-2 text-gray-800">
                        {report.dateLabel}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            report.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {report.status === "APPROVED"
                            ? "freigegeben"
                            : "Entwurf"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {report.weatherSummary}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {report.updatedAtLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
