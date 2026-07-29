"use client";

import { useMemo, useState } from "react";

export function EmployeeSearchSelect({
  employees,
  name = "employeeId",
}: {
  employees: { firstName: string; id: string; lastName: string }[];
  name?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const selected = employees.find((employee) => employee.id === selectedId);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    if (!normalized) return [];
    return employees
      .filter((employee) =>
        `${employee.lastName} ${employee.firstName}`
          .toLocaleLowerCase("de-DE")
          .includes(normalized),
      )
      .slice(0, 8);
  }, [employees, query]);

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedId} />
      <input
        autoComplete="off"
        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setSelectedId("");
        }}
        placeholder="Name suchen …"
        required={!selectedId}
        value={
          selected
            ? `${selected.lastName}, ${selected.firstName}`
            : query
        }
      />
      {!selected && matches.length > 0 ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-300 bg-white p-1 shadow-xl">
          {matches.map((employee) => (
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-100"
              key={employee.id}
              onClick={() => {
                setSelectedId(employee.id);
                setQuery("");
              }}
              type="button"
            >
              {employee.lastName}, {employee.firstName}
            </button>
          ))}
        </div>
      ) : null}
      {query && !selected && matches.length === 0 ? (
        <p className="mt-1 text-xs font-semibold text-red-700">
          Kein aktiver Mitarbeiter gefunden.
        </p>
      ) : null}
    </div>
  );
}
