"use client";

import { useState } from "react";

import { SignatureFormField } from "./SignatureFormField";

type EmployeeOption = {
  id: string;
  label: string;
};

export function DirectParticipantSignatures({
  employees,
}: {
  employees: EmployeeOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedEmployees = employees.filter((employee) =>
    selectedIds.includes(employee.id),
  );

  function toggleEmployee(employeeId: string, selected: boolean) {
    setSelectedIds((current) =>
      selected
        ? [...current, employeeId]
        : current.filter((id) => id !== employeeId),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-950">
          Teilnehmende Mitarbeiter
        </p>
        <p className="mt-1 text-xs font-medium text-gray-600">
          Mitarbeiter auswählen und direkt darunter unterschreiben lassen.
        </p>
        <div className="mt-2 grid max-h-64 gap-2 overflow-auto rounded-xl border border-gray-300 p-3">
          {employees.map((employee) => (
            <label
              className="flex items-center gap-2 text-sm font-semibold text-gray-800"
              key={employee.id}
            >
              <input
                checked={selectedIds.includes(employee.id)}
                className="h-5 w-5 accent-gray-950"
                name="employeeIds"
                onChange={(event) =>
                  toggleEmployee(employee.id, event.currentTarget.checked)
                }
                type="checkbox"
                value={employee.id}
              />
              {employee.label}
            </label>
          ))}
        </div>
      </div>

      {selectedEmployees.length > 0 ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-gray-950">
              Unterschriften
            </p>
            <p className="mt-1 text-xs font-medium text-gray-600">
              Wenn alle ausgewählten Personen unterschrieben haben, wird die
              Unterweisung beim Speichern direkt abgeschlossen.
            </p>
          </div>
          {selectedEmployees.map((employee) => (
            <SignatureFormField
              key={employee.id}
              label={`Unterschrift · ${employee.label}`}
              name={`participantSignature_${employee.id}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
