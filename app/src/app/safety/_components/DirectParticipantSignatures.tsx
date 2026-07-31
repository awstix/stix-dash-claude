"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

import { SignatureFormField } from "./SignatureFormField";

type EmployeeOption = {
  id: string;
  label: string;
};

export function DirectParticipantSignatures({
  employees,
  initialSelectedIds = [],
}: {
  employees: EmployeeOption[];
  initialSelectedIds?: string[];
}) {
  const [selectedIds, setSelectedIds] =
    useState<string[]>(initialSelectedIds);
  const [externalParticipants, setExternalParticipants] = useState<string[]>([]);
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

      <div className="border-t border-gray-300 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-950">
              Externe teilnehmende Personen
            </p>
            <p className="mt-1 text-xs font-medium text-gray-600">
              Für Nachunternehmer, Besucher oder andere Personen außerhalb der Firma.
            </p>
          </div>
          <button
            className="rounded-xl border border-gray-950 bg-white px-4 py-2 text-sm font-bold text-gray-950"
            onClick={() =>
              setExternalParticipants((current) => [
                ...current,
                crypto.randomUUID(),
              ])
            }
            type="button"
          >
            + Externe Person
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {externalParticipants.map((id, index) => (
            <div className="rounded-xl border border-gray-300 p-4" key={id}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-gray-950">
                  Externe Person {index + 1}
                </p>
                <button
                  aria-label="Externe Person entfernen"
                  className="text-xl font-bold text-gray-700"
                  onClick={() =>
                    setExternalParticipants((current) =>
                      current.filter((entry) => entry !== id),
                    )
                  }
                  type="button"
                >
                  <ActionIcon name="close" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <input
                  className="rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-950"
                  name="externalParticipantCompany"
                  placeholder="Firma / Abteilung"
                />
                <input
                  className="rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-950"
                  name="externalParticipantFirstName"
                  placeholder="Vorname"
                  required
                />
                <input
                  className="rounded-xl border border-gray-400 bg-white px-3 py-3 text-gray-950"
                  name="externalParticipantLastName"
                  placeholder="Nachname"
                  required
                />
              </div>
              <div className="mt-3">
                <SignatureFormField
                  label="Unterschrift der externen Person"
                  name="externalParticipantSignature"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
