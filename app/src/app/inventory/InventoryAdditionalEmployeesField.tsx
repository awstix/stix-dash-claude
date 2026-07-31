"use client";

import { useMemo, useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

type EmployeeOption = {
  firstName: string;
  id: string;
  lastName: string;
};

export function InventoryAdditionalEmployeesField({
  employees,
  initialEmployeeIds,
}: {
  employees: EmployeeOption[];
  initialEmployeeIds: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialEmployeeIds),
  );
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return employees;

    return employees.filter((employee) =>
      `${employee.firstName} ${employee.lastName} ${employee.lastName}, ${employee.firstName}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [employees, query]);
  const selectedEmployees = employees.filter((employee) =>
    selectedIds.has(employee.id),
  );

  function toggleEmployee(employeeId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }

  return (
    <>
      {selectedEmployees.map((employee) => (
        <input
          key={employee.id}
          name="additionalEmployeeIds"
          type="hidden"
          value={employee.id}
        />
      ))}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Weitere Mitarbeiter / Fahrer
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {selectedEmployees.length === 0
                ? "Keine weiteren Personen ausgewählt."
                : `${selectedEmployees.length} weitere ${
                    selectedEmployees.length === 1 ? "Person" : "Personen"
                  } ausgewählt.`}
            </p>
          </div>
          <button
            className="shrink-0 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            Auswählen
          </button>
        </div>

        {selectedEmployees.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedEmployees.map((employee) => (
              <span
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900"
                key={employee.id}
              >
                {employee.lastName}, {employee.firstName}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/55 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-950">
                  Weitere Mitarbeiter / Fahrer
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Eine oder mehrere zusätzliche Personen auswählen.
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>

            <input
              autoFocus
              className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Mitarbeiter suchen …"
              value={query}
            />

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Kein Mitarbeiter gefunden.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {filteredEmployees.map((employee) => (
                    <label
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-white"
                      key={employee.id}
                    >
                      <input
                        checked={selectedIds.has(employee.id)}
                        className="h-4 w-4 rounded border-gray-300"
                        onChange={() => toggleEmployee(employee.id)}
                        type="checkbox"
                      />
                      <span className="truncate">
                        {employee.lastName}, {employee.firstName}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-600">
                {selectedEmployees.length} ausgewählt
              </span>
              <button
                className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Auswahl übernehmen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
