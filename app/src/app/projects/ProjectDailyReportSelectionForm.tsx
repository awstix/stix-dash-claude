"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type ProjectOption = {
  dailyReports: {
    date: string;
    sheetNumber: string;
  }[];
  id: string;
  name: string;
  nextSheetNumber: string;
  projectNumber: string;
};

const dirtyWindowKey = "__projectDailyReportDirty";

function hasUnsavedDailyReportChanges() {
  return Boolean(
    (window as Window & { [dirtyWindowKey]?: boolean })[dirtyWindowKey],
  );
}

function clearUnsavedDailyReportChanges() {
  (window as Window & { [dirtyWindowKey]?: boolean })[dirtyWindowKey] = false;
}

type PendingNavigation = {
  date: string;
  navigationKey: string;
  projectId: string;
  sheetNumber: string;
};

export function ProjectDailyReportSelectionForm({
  projects,
  selectedDate,
  selectedProjectId,
  sheetNumber,
}: {
  projects: ProjectOption[];
  selectedDate: string;
  selectedProjectId: string;
  sheetNumber: string;
}) {
  const router = useRouter();
  const [dateValue, setDateValue] = useState(selectedDate);
  const [projectValue, setProjectValue] = useState(selectedProjectId);
  const [sheetValue, setSheetValue] = useState(sheetNumber);
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const lastNavigationKey = useRef("");

  function performNavigate(target: PendingNavigation) {
    clearUnsavedDailyReportChanges();
    lastNavigationKey.current = target.navigationKey;

    const params = new URLSearchParams({
      blattnr: target.sheetNumber,
      date: target.date,
      projectId: target.projectId,
    });

    router.push(`/projects/bautagesberichte?${params.toString()}`);
  }

  function revertSelection() {
    setDateValue(selectedDate);
    setProjectValue(selectedProjectId);
    setSheetValue(sheetNumber);
  }

  function navigate(nextValues: {
    date: string;
    projectId: string;
    sheetNumber: string;
  }) {
    const nextDate = nextValues.date.trim();
    const nextProjectId = nextValues.projectId.trim();
    const nextSheetNumber = nextValues.sheetNumber.trim() || "1";

    if (!nextProjectId || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      return;
    }

    const navigationKey = `${nextProjectId}|${nextDate}|${nextSheetNumber}`;

    if (lastNavigationKey.current === navigationKey) {
      return;
    }

    const isCurrentSelection =
      nextDate === selectedDate &&
      nextProjectId === selectedProjectId &&
      nextSheetNumber === sheetNumber;

    if (isCurrentSelection) {
      return;
    }

    const target: PendingNavigation = {
      date: nextDate,
      navigationKey,
      projectId: nextProjectId,
      sheetNumber: nextSheetNumber,
    };

    if (hasUnsavedDailyReportChanges()) {
      setPendingNavigation(target);
      return;
    }

    performNavigate(target);
  }

  function submitCurrentSelection() {
    navigate({
      date: dateValue,
      projectId: projectValue,
      sheetNumber: sheetValue,
    });
  }

  function getSheetNumberForSelection(projectId: string, date: string) {
    const project = projects.find((entry) => entry.id === projectId);

    if (!project) return "1";

    const existingReport = project.dailyReports.find(
      (report) => report.date === date,
    );

    return existingReport?.sheetNumber || project.nextSheetNumber || "1";
  }

  function changeDate(nextDate: string) {
    const nextSheetNumber = getSheetNumberForSelection(
      projectValue,
      nextDate,
    );

    setDateValue(nextDate);
    setSheetValue(nextSheetNumber);
    navigate({
      date: nextDate,
      projectId: projectValue,
      sheetNumber: nextSheetNumber,
    });
  }

  return (
    <>
      <form
        action="/projects/bautagesberichte"
        className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_180px_120px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          submitCurrentSelection();
        }}
      >
        <label className="text-sm font-medium text-gray-800">
          Projekt
          <select
            name="projectId"
            value={projectValue}
            onChange={(event) => {
              const nextProjectId = event.currentTarget.value;
              const nextSheetNumber = getSheetNumberForSelection(
                nextProjectId,
                dateValue,
              );

              setProjectValue(nextProjectId);
              setSheetValue(nextSheetNumber);
              navigate({
                date: dateValue,
                projectId: nextProjectId,
                sheetNumber: nextSheetNumber,
              });
            }}
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
            value={dateValue}
            onChange={(event) => changeDate(event.currentTarget.value)}
            onInput={(event) => changeDate(event.currentTarget.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Blattnr.
          <input
            name="blattnr"
            value={sheetValue}
            onBlur={submitCurrentSelection}
            onChange={(event) => setSheetValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitCurrentSelection();
              }
            }}
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

      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => {
            setPendingNavigation(null);
            revertSelection();
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-950">
              Ungespeicherte Änderungen
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Ungespeicherte Änderungen im Bautagesbericht gehen verloren, wenn
              du die Auswahl jetzt wechselst.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => {
                  setPendingNavigation(null);
                  revertSelection();
                }}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                onClick={() => {
                  const target = pendingNavigation;
                  setPendingNavigation(null);
                  performNavigate(target);
                }}
                type="button"
              >
                Trotzdem wechseln
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
