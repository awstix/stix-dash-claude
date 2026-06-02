"use client";

import { useMemo, useState } from "react";
import { updateCrewPlanningAssignment } from "./actions";
import { createCrewPlanningAssignmentFromProject } from "./assignmentProjectActions";

type ProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
};

type CrewOption = {
  id: string;
  name: string;
};

type ConflictAssignment = {
  id: string;
  crewId: string;
  projectNumber: string;
  projectName: string;
  rowTitle: string | null;
  startDate: string;
  endDate: string;
};

type CrewPlanningAssignmentFormClientProps = {
  mode: "create" | "update";
  id?: string;
  rowId?: string;
  weekStart: string;
  projects?: ProjectOption[];
  crews: CrewOption[];
  fixedCrewId?: string;
  fixedCrewName?: string;
  defaultCrewId?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  defaultNotes?: string;
  conflictAssignments?: ConflictAssignment[];
  currentAssignmentId?: string;
};

function parseDateValue(value: string) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function normalizeDayTime(value: string) {
  const date = parseDateValue(value);

  if (!date) return null;

  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function rangesOverlapInclusive(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const startATime = normalizeDayTime(startA);
  const endATime = normalizeDayTime(endA);
  const startBTime = normalizeDayTime(startB);
  const endBTime = normalizeDayTime(endB);

  if (
    startATime === null ||
    endATime === null ||
    startBTime === null ||
    endBTime === null
  ) {
    return false;
  }

  return startATime <= endBTime && endATime >= startBTime;
}

function formatShortDate(value: string) {
  const date = parseDateValue(value);

  if (!date) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getProjectLabel(conflict: ConflictAssignment) {
  const baseLabel = `${conflict.projectNumber} · ${conflict.projectName}`;

  if (!conflict.rowTitle) {
    return baseLabel;
  }

  return `${baseLabel} · ${conflict.rowTitle}`;
}

function stripConflictHintFromNotes(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("Konflikt-Hinweis:"))
    .join("\n")
    .trim();
}

function getSafeTimeValue(value: string | null | undefined, fallback: string) {
  return value && value.length ? value : fallback;
}

export function CrewPlanningAssignmentFormClient({
  mode,
  id,
  rowId,
  weekStart,
  projects = [],
  crews,
  fixedCrewId,
  fixedCrewName,
  defaultCrewId = "",
  defaultStartDate = "",
  defaultEndDate = "",
  defaultStartTime = "07:00",
  defaultEndTime = "16:00",
  defaultNotes = "",
  conflictAssignments = [],
  currentAssignmentId,
}: CrewPlanningAssignmentFormClientProps) {
  const [selectedCrewId, setSelectedCrewId] = useState(
    fixedCrewId || defaultCrewId,
  );
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const selectedCrewName =
    fixedCrewName || crews.find((crew) => crew.id === selectedCrewId)?.name || "";

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const effectiveStartTime =
    mode === "create"
      ? getSafeTimeValue(
          selectedProject?.defaultStartTime,
          defaultStartTime || "07:00",
        )
      : getSafeTimeValue(defaultStartTime, "07:00");

  const effectiveEndTime =
    mode === "create"
      ? getSafeTimeValue(
          selectedProject?.defaultEndTime,
          defaultEndTime || "16:00",
        )
      : getSafeTimeValue(defaultEndTime, "16:00");

  const sanitizedDefaultNotes = useMemo(
    () => stripConflictHintFromNotes(defaultNotes),
    [defaultNotes],
  );

  const dateRangeError = useMemo(() => {
    const startTime = normalizeDayTime(startDate);
    const endTime = normalizeDayTime(endDate);

    if (startTime === null || endTime === null) return null;

    if (endTime < startTime) {
      return "Das Bis-Datum liegt vor dem Von-Datum.";
    }

    return null;
  }, [startDate, endDate]);

  const conflict = useMemo(() => {
    if (!selectedCrewId || !startDate || !endDate || dateRangeError) {
      return null;
    }

    return (
      conflictAssignments.find((assignment) => {
        if (assignment.id === currentAssignmentId) return false;
        if (assignment.crewId !== selectedCrewId) return false;

        return rangesOverlapInclusive(
          startDate,
          endDate,
          assignment.startDate,
          assignment.endDate,
        );
      }) ?? null
    );
  }, [
    conflictAssignments,
    currentAssignmentId,
    dateRangeError,
    endDate,
    selectedCrewId,
    startDate,
  ]);

  const action =
    mode === "create"
      ? createCrewPlanningAssignmentFromProject
      : updateCrewPlanningAssignment;

  return (
    <form action={action} className="space-y-4">
      <div>
        <div className="text-sm font-bold text-gray-900">
          {mode === "create" ? "Baustelle eintragen" : "Einteilung ändern"}
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {selectedCrewName ? `Kolonne: ${selectedCrewName}` : "Kolonne wählen"}
        </div>
      </div>

      {id ? <input type="hidden" name="id" value={id} /> : null}
      {rowId ? <input type="hidden" name="rowId" value={rowId} /> : null}
      <input type="hidden" name="weekStart" value={weekStart} />

      {fixedCrewId ? (
        <input type="hidden" name="crewId" value={fixedCrewId} />
      ) : (
        <label className="block text-xs font-semibold text-gray-700">
          Kolonne
          <select
            name="crewId"
            required
            value={selectedCrewId}
            onChange={(event) => setSelectedCrewId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
          >
            <option value="" disabled>
              Kolonne wählen
            </option>
            {crews.map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === "create" ? (
        <label className="block text-xs font-semibold text-gray-700">
          Baustelle
          <select
            name="projectId"
            required
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
          >
            <option value="" disabled>
              {projects.length
                ? "Baustelle wählen"
                : "Keine aktiven Baustellen vorhanden"}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} · {project.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-700">
          Von
          <input
            type="date"
            name="startDate"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
          />
        </label>

        <label className="block text-xs font-semibold text-gray-700">
          Bis
          <input
            type="date"
            name="endDate"
            required
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
          />
        </label>
      </div>

      {dateRangeError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          {dateRangeError}
        </div>
      ) : null}

      {conflict ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          Konflikt-Hinweis: Diese Kolonne ist bereits vom{" "}
          {formatShortDate(conflict.startDate)} bis{" "}
          {formatShortDate(conflict.endDate)} auf {getProjectLabel(conflict)}{" "}
          eingeplant.
        </div>
      ) : null}

      <input type="hidden" name="startTime" value={effectiveStartTime} />
      <input type="hidden" name="endTime" value={effectiveEndTime} />

      <label className="block text-xs font-semibold text-gray-700">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={sanitizedDefaultNotes}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        disabled={Boolean(dateRangeError)}
      >
        {mode === "create" ? "Einteilung speichern" : "Änderung speichern"}
      </button>
    </form>
  );
}
