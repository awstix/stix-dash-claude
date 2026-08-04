"use client";

export type WorkTimeCalendarAssignmentGroup = {
  employees: { id: string; label: string }[];
  name: string;
};

export function WorkTimeCalendarAssignmentsForm({
  assignedIds,
  departmentGroups,
  onSetMany,
  onToggle,
}: {
  assignedIds: Set<string>;
  departmentGroups: WorkTimeCalendarAssignmentGroup[];
  onSetMany: (employeeIds: string[], assigned: boolean) => void;
  onToggle: (employeeId: string) => void;
}) {
  const allEmployeeIds = departmentGroups.flatMap((group) => group.employees.map((employee) => employee.id));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Zuweisungen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Mitarbeiter, für die dieser Kalender das Soll vorgibt. Ein Mitarbeiter kann pro Jahr nur einem
            Kalender zugewiesen sein. Änderungen erst mit „Speichern&rdquo; ganz unten wirksam.
          </p>
        </div>
        <div>
          <span className="mr-2 text-xs font-semibold text-gray-500">Alle Mitarbeiter:</span>
          <button
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => onSetMany(allEmployeeIds, true)}
            type="button"
          >
            Alle zuweisen
          </button>{" "}
          <button
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => onSetMany(allEmployeeIds, false)}
            type="button"
          >
            Alle entfernen
          </button>
        </div>
      </div>

      {departmentGroups.length === 0 ? (
        <p className="p-5 text-sm text-gray-500">Keine aktiven Mitarbeiter gefunden.</p>
      ) : (
        departmentGroups.map((group) => {
          const assignedCount = group.employees.filter((employee) => assignedIds.has(employee.id)).length;
          return (
            <details className="border-b border-gray-100" key={group.name}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 bg-gray-50 px-5 py-2">
                <h3 className="text-sm font-bold text-gray-800">{group.name}</h3>
                <span className="text-xs font-semibold text-gray-500">
                  {assignedCount}/{group.employees.length} zugewiesen
                </span>
              </summary>
              <div className="flex justify-end gap-2 border-b border-gray-100 bg-gray-50 px-5 py-2">
                <button
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => onSetMany(group.employees.map((employee) => employee.id), true)}
                  type="button"
                >
                  Alle zuweisen
                </button>
                <button
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => onSetMany(group.employees.map((employee) => employee.id), false)}
                  type="button"
                >
                  Alle entfernen
                </button>
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
                      onChange={() => onToggle(employee.id)}
                      type="checkbox"
                    />
                    {employee.label}
                  </label>
                ))}
              </div>
            </details>
          );
        })
      )}
    </div>
  );
}
