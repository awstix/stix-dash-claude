"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type ProjectOption = {
  id: string;
  name: string;
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
  const lastNavigationKey = useRef("");

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

    if (
      hasUnsavedDailyReportChanges() &&
      !window.confirm(
        "Ungespeicherte Änderungen im Bautagesbericht gehen verloren. Auswahl trotzdem wechseln?",
      )
    ) {
      setDateValue(selectedDate);
      setProjectValue(selectedProjectId);
      setSheetValue(sheetNumber);
      return;
    }

    clearUnsavedDailyReportChanges();
    lastNavigationKey.current = navigationKey;

    const params = new URLSearchParams({
      blattnr: nextSheetNumber,
      date: nextDate,
      projectId: nextProjectId,
    });

    router.push(`/projects/bautagesberichte?${params.toString()}`);
  }

  function submitCurrentSelection() {
    navigate({
      date: dateValue,
      projectId: projectValue,
      sheetNumber: sheetValue,
    });
  }

  function changeDate(nextDate: string) {
    setDateValue(nextDate);
    navigate({
      date: nextDate,
      projectId: projectValue,
      sheetNumber: sheetValue,
    });
  }

  return (
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
            setProjectValue(nextProjectId);
            navigate({
              date: dateValue,
              projectId: nextProjectId,
              sheetNumber: sheetValue,
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
  );
}
