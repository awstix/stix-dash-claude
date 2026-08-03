"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncWorkTimeCalendarAssignments } from "../actions";

export type WorkTimeCalendarAssignmentGroup = {
  employees: { id: string; label: string }[];
  name: string;
};

export function WorkTimeCalendarAssignmentsForm({
  calendarId,
  departmentGroups,
  initialAssignedIds,
}: {
  calendarId: string;
  departmentGroups: WorkTimeCalendarAssignmentGroup[];
  initialAssignedIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set(initialAssignedIds));
  const [isDirty, setIsDirty] = useState(false);

  function setMany(employeeIds: string[], assigned: boolean) {
    setAssignedIds((current) => {
      const next = new Set(current);
      for (const id of employeeIds) {
        if (assigned) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setIsDirty(true);
  }

  function toggle(employeeId: string) {
    setAssignedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
    setIsDirty(true);
  }

  function save() {
    startTransition(async () => {
      await syncWorkTimeCalendarAssignments({ calendarId, employeeIds: Array.from(assignedIds) });
      setIsDirty(false);
      router.refresh();
    });
  }

  const allEmployeeIds = departmentGroups.flatMap((group) => group.employees.map((employee) => employee.id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Zuweisungen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Mitarbeiter, für die dieser Kalender das Soll vorgibt. Ein Mitarbeiter kann pro Jahr nur einem
            Kalender zugewiesen sein. Änderungen erst mit „Speichern&rdquo; wirksam.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="mr-2 text-xs font-semibold text-gray-500">Alle Mitarbeiter:</span>
            <button
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
              onClick={() => setMany(allEmployeeIds, true)}
              type="button"
            >
              Alle zuweisen
            </button>{" "}
            <button
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
              onClick={() => setMany(allEmployeeIds, false)}
              type="button"
            >
              Alle entfernen
            </button>
          </div>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
            disabled={isPending || !isDirty}
            onClick={save}
            type="button"
          >
            {isPending ? "Speichert..." : isDirty ? "Speichern *" : "Gespeichert"}
          </button>
        </div>
      </div>

      {departmentGroups.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">Keine aktiven Mitarbeiter gefunden.</p>
      ) : (
        departmentGroups.map((group) => (
          <div key={group.name} className="border-b border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-5 py-2">
              <h3 className="text-sm font-bold text-gray-800">{group.name}</h3>
              <div>
                <button
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setMany(group.employees.map((employee) => employee.id), true)}
                  type="button"
                >
                  Alle zuweisen
                </button>{" "}
                <button
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setMany(group.employees.map((employee) => employee.id), false)}
                  type="button"
                >
                  Alle entfernen
                </button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {group.employees.map((employee) => (
                <label
                  className="flex items-center gap-3 p-3 pl-8 text-sm font-medium text-gray-800"
                  key={employee.id}
                >
                  <input
                    checked={assignedIds.has(employee.id)}
                    className="h-4 w-4 rounded border-gray-300"
                    onChange={() => toggle(employee.id)}
                    type="checkbox"
                  />
                  {employee.label}
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
