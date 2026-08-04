"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWorkTimeCalendarDays, syncWorkTimeCalendarAssignments } from "../actions";
import {
  WorkTimeCalendarAssignmentsForm,
  type WorkTimeCalendarAssignmentGroup,
} from "./WorkTimeCalendarAssignmentsForm";
import {
  WorkTimeCalendarGrid,
  type WorkTimeCalendarGridDayType,
  type WorkTimeCalendarGridHolidayOverlay,
} from "./WorkTimeCalendarGrid";

export function WorkTimeCalendarEditor({
  calendarId,
  dayTypes,
  departmentGroups,
  holidayOverlay,
  initialAssignedIds,
  initialDays,
  year,
}: {
  calendarId: string;
  dayTypes: WorkTimeCalendarGridDayType[];
  departmentGroups: WorkTimeCalendarAssignmentGroup[];
  holidayOverlay: Record<string, WorkTimeCalendarGridHolidayOverlay>;
  initialAssignedIds: string[];
  initialDays: Record<string, string>;
  year: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState<Record<string, string | undefined>>(initialDays);
  const [dirtyDates, setDirtyDates] = useState<Set<string>>(new Set());
  const [activeTypeId, setActiveTypeId] = useState<string | null>(dayTypes[0]?.id ?? null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set(initialAssignedIds));
  const [isAssignmentsDirty, setIsAssignmentsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const isDirty = dirtyDates.size > 0 || isAssignmentsDirty;

  function paintDate(key: string) {
    setDays((current) => ({ ...current, [key]: activeTypeId ?? undefined }));
    setDirtyDates((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    setIsSaved(false);
  }

  function setManyAssigned(employeeIds: string[], assigned: boolean) {
    setAssignedIds((current) => {
      const next = new Set(current);
      for (const id of employeeIds) {
        if (assigned) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setIsAssignmentsDirty(true);
    setIsSaved(false);
  }

  function toggleAssigned(employeeId: string) {
    setAssignedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
    setIsAssignmentsDirty(true);
    setIsSaved(false);
  }

  function save() {
    const dayGroups = new Map<string, string[]>();
    for (const key of dirtyDates) {
      const dayTypeId = days[key] ?? "";
      const group = dayGroups.get(dayTypeId);
      if (group) group.push(key);
      else dayGroups.set(dayTypeId, [key]);
    }

    startTransition(async () => {
      await Promise.all([
        ...Array.from(dayGroups.entries()).map(([dayTypeId, dates]) =>
          setWorkTimeCalendarDays({ calendarId, dates, dayTypeId: dayTypeId || null }),
        ),
        isAssignmentsDirty
          ? syncWorkTimeCalendarAssignments({ calendarId, employeeIds: Array.from(assignedIds) })
          : Promise.resolve(),
      ]);
      setDirtyDates(new Set());
      setIsAssignmentsDirty(false);
      setIsSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      {dayTypes.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-950">
          Noch keine Planzeiten angelegt. Erst unter „Planzeiten&rdquo; mindestens eine anlegen, bevor Tage gefüllt
          werden können.
        </div>
      ) : (
        <WorkTimeCalendarGrid
          activeTypeId={activeTypeId}
          dayTypes={dayTypes}
          days={days}
          dirtyDates={dirtyDates}
          holidayOverlay={holidayOverlay}
          onActiveTypeChange={setActiveTypeId}
          onPaint={paintDate}
          year={year}
        />
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <WorkTimeCalendarAssignmentsForm
          assignedIds={assignedIds}
          departmentGroups={departmentGroups}
          onSetMany={setManyAssigned}
          onToggle={toggleAssigned}
        />
      </div>

      <div className="sticky bottom-4 z-20 mt-6 flex justify-end">
        <button
          className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-gray-700 disabled:opacity-60"
          disabled={isPending || !isDirty}
          onClick={save}
          type="button"
        >
          {isPending ? "Speichert..." : isDirty ? "Speichern *" : isSaved ? "Gespeichert" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
