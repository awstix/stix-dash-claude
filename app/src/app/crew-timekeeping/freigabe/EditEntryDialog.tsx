"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getBookableEmployees,
  getCrewTimeEntryForEdit,
  saveCrewTimeEntry,
  type BookableEmployee,
  type CrewTimeEmployeeInput,
  type CrewTimeEntryInput,
} from "../actions";
import { ActionIcon } from "@/components/ActionIcon";

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900";

export function EditEntryDialog({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [entryInput, setEntryInput] = useState<CrewTimeEntryInput | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bookableEmployees, setBookableEmployees] = useState<{
    crewMembers: BookableEmployee[];
    otherEmployees: BookableEmployee[];
  } | null>(null);
  const [addEmployeeId, setAddEmployeeId] = useState("");

  function openDialog() {
    setOpen(true);
    setError("");
    setMessage("");
    setEntryInput(null);
    setBookableEmployees(null);
    setAddEmployeeId("");
    startLoading(async () => {
      try {
        const result = await getCrewTimeEntryForEdit(entryId);
        setEntryInput(result.input);
        setLocked(result.locked);
        const bookable = await getBookableEmployees({
          crewId: result.input.crewId,
          workDate: result.input.workDate,
        });
        setBookableEmployees(bookable);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Laden fehlgeschlagen.");
      }
    });
  }

  function close() {
    if (isSaving) return;
    setOpen(false);
    setEntryInput(null);
  }

  function addEmployee() {
    if (!addEmployeeId || !bookableEmployees) return;
    const option = [...bookableEmployees.crewMembers, ...bookableEmployees.otherEmployees].find(
      (candidate) => candidate.employeeId === addEmployeeId,
    );
    if (!option) return;

    setEntryInput((current) => {
      if (!current) return current;
      if (current.employees.some((employee) => employee.employeeId === option.employeeId)) {
        return current;
      }
      return {
        ...current,
        employees: [
          ...current.employees,
          {
            attendanceStatus: "CHECKED_OUT",
            break1From: current.defaultBreak1From,
            break1To: current.defaultBreak1To,
            break2From: current.defaultBreak2From,
            break2To: current.defaultBreak2To,
            employeeId: option.employeeId,
            employeeName: option.employeeName,
            endTime: current.defaultEndTime,
            isPresent: true,
            notes: "",
            roleLabel: option.roleLabel,
            startTime: current.defaultStartTime,
          },
        ],
      };
    });
    setAddEmployeeId("");
  }

  function removeEmployee(index: number) {
    const employee = entryInput?.employees[index];
    if (!employee) return;
    if (!window.confirm(`Buchung von „${employee.employeeName}" wirklich entfernen?`)) return;

    setEntryInput((current) => {
      if (!current) return current;
      return {
        ...current,
        employees: current.employees.filter((_, employeeIndex) => employeeIndex !== index),
      };
    });
  }

  function patchEntry(patch: Partial<CrewTimeEntryInput>) {
    setEntryInput((current) => (current ? { ...current, ...patch } : current));
  }

  function patchEmployee(index: number, patch: Partial<CrewTimeEmployeeInput>) {
    setEntryInput((current) => {
      if (!current) return current;
      return {
        ...current,
        employees: current.employees.map((employee, employeeIndex) =>
          employeeIndex === index ? { ...employee, ...patch } : employee,
        ),
      };
    });
  }

  function applyDefaultsToAll() {
    setEntryInput((current) => {
      if (!current) return current;
      return {
        ...current,
        employees: current.employees.map((employee) => ({
          ...employee,
          break1From: current.defaultBreak1From,
          break1To: current.defaultBreak1To,
          break2From: current.defaultBreak2From,
          break2To: current.defaultBreak2To,
          endTime: current.defaultEndTime,
          startTime: current.defaultStartTime,
        })),
      };
    });
  }

  function save() {
    if (!entryInput) return;
    setError("");
    setMessage("");
    startSaving(async () => {
      try {
        await saveCrewTimeEntry(entryInput, "KORREKTUR");
        setMessage("Gespeichert.");
        router.refresh();
        window.setTimeout(() => close(), 600);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <button
        className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-black text-gray-800 hover:bg-gray-50"
        onClick={openDialog}
        type="button"
      >
        Kolonne bearbeiten
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl text-gray-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Kolonne bearbeiten</h2>
                {entryInput ? (
                  <p className="mt-1 text-sm text-gray-600">
                    {entryInput.crewName} · {entryInput.workDate} · {entryInput.projectNumber} {entryInput.projectName}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Schließen"
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                onClick={close}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>

            {isLoading ? <div className="mt-6 text-sm font-semibold text-gray-500">Lädt …</div> : null}
            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}

            {entryInput ? (
              <div className="mt-5 space-y-5">
                {locked ? (
                  <div className="rounded-xl border-2 border-green-800 bg-green-50 px-4 py-3 text-sm font-semibold text-green-950">
                    🔒 Freigegeben — Bearbeitung nur durch Bauleitung oder Admin möglich.
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3 lg:grid-cols-7">
                  <label className="text-xs font-semibold text-gray-700">
                    Beginn (alle)
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultStartTime: event.target.value })}
                      type="time"
                      value={entryInput.defaultStartTime}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    Ende (alle)
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultEndTime: event.target.value })}
                      type="time"
                      value={entryInput.defaultEndTime}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    Pause 1 von
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultBreak1From: event.target.value })}
                      type="time"
                      value={entryInput.defaultBreak1From}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    Pause 1 bis
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultBreak1To: event.target.value })}
                      type="time"
                      value={entryInput.defaultBreak1To}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    Pause 2 von
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultBreak2From: event.target.value })}
                      type="time"
                      value={entryInput.defaultBreak2From}
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-700">
                    Pause 2 bis
                    <input
                      className={inputClass}
                      disabled={locked}
                      onChange={(event) => patchEntry({ defaultBreak2To: event.target.value })}
                      type="time"
                      value={entryInput.defaultBreak2To}
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={locked}
                      onClick={applyDefaultsToAll}
                      type="button"
                    >
                      Für alle übernehmen
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-gray-900 text-white">
                      <tr>
                        <th className="p-2">Mitarbeiter</th>
                        <th className="p-2">Beginn</th>
                        <th className="p-2">Ende</th>
                        <th className="p-2">Pause 1</th>
                        <th className="p-2">Pause 2</th>
                        <th className="p-2">Bemerkung</th>
                        <th className="p-2">Aktion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryInput.employees.map((employee, index) => (
                        <tr className="border-b border-gray-100" key={employee.employeeId}>
                          <td className="p-2 font-semibold text-gray-900">{employee.employeeName}</td>
                          <td className="p-2">
                            <input
                              className={inputClass}
                              disabled={locked}
                              onChange={(event) => patchEmployee(index, { startTime: event.target.value })}
                              type="time"
                              value={employee.startTime}
                            />
                          </td>
                          <td className="p-2">
                            <input
                              className={inputClass}
                              disabled={locked}
                              onChange={(event) => patchEmployee(index, { endTime: event.target.value })}
                              type="time"
                              value={employee.endTime}
                            />
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <input
                                className={inputClass}
                                disabled={locked}
                                onChange={(event) => patchEmployee(index, { break1From: event.target.value })}
                                type="time"
                                value={employee.break1From}
                              />
                              <input
                                className={inputClass}
                                disabled={locked}
                                onChange={(event) => patchEmployee(index, { break1To: event.target.value })}
                                type="time"
                                value={employee.break1To}
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-1">
                              <input
                                className={inputClass}
                                disabled={locked}
                                onChange={(event) => patchEmployee(index, { break2From: event.target.value })}
                                type="time"
                                value={employee.break2From}
                              />
                              <input
                                className={inputClass}
                                disabled={locked}
                                onChange={(event) => patchEmployee(index, { break2To: event.target.value })}
                                type="time"
                                value={employee.break2To}
                              />
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              className={inputClass}
                              disabled={locked}
                              onChange={(event) => patchEmployee(index, { notes: event.target.value })}
                              value={employee.notes}
                            />
                          </td>
                          <td className="p-2">
                            <button
                              className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-black text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={locked}
                              onClick={() => removeEmployee(index)}
                              type="button"
                            >
                              Entfernen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {bookableEmployees ? (
                  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <label className="text-xs font-semibold text-gray-700">
                      Mitarbeiter nachträglich hinzufügen
                      <select
                        className={inputClass}
                        disabled={locked}
                        onChange={(event) => setAddEmployeeId(event.target.value)}
                        value={addEmployeeId}
                      >
                        <option value="">Bitte wählen …</option>
                        {bookableEmployees.crewMembers.filter(
                          (option) => !entryInput.employees.some((employee) => employee.employeeId === option.employeeId),
                        ).length > 0 ? (
                          <optgroup label="Eigene Kolonne">
                            {bookableEmployees.crewMembers
                              .filter(
                                (option) =>
                                  !entryInput.employees.some((employee) => employee.employeeId === option.employeeId),
                              )
                              .map((option) => (
                                <option key={option.employeeId} value={option.employeeId}>
                                  {option.employeeName}
                                  {option.roleLabel ? ` · ${option.roleLabel}` : ""}
                                  {option.bookedElsewhere ? " (anderswo gebucht)" : ""}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                        {bookableEmployees.otherEmployees.filter(
                          (option) => !entryInput.employees.some((employee) => employee.employeeId === option.employeeId),
                        ).length > 0 ? (
                          <optgroup label="Andere Mitarbeiter">
                            {bookableEmployees.otherEmployees
                              .filter(
                                (option) =>
                                  !entryInput.employees.some((employee) => employee.employeeId === option.employeeId),
                              )
                              .map((option) => (
                                <option key={option.employeeId} value={option.employeeId}>
                                  {option.employeeName}
                                  {option.roleLabel ? ` · ${option.roleLabel}` : ""}
                                  {option.bookedElsewhere ? " (anderswo gebucht)" : ""}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </label>
                    <button
                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={locked || !addEmployeeId}
                      onClick={addEmployee}
                      type="button"
                    >
                      Hinzufügen
                    </button>
                    <span className="text-xs text-gray-500">
                      Übernimmt Beginn/Ende/Pausen der Kolonne (oben), danach pro Zeile anpassbar.
                    </span>
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
                    ✓ {message}
                  </div>
                ) : null}

                <div className="flex justify-end gap-3">
                  <button
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    disabled={isSaving}
                    onClick={close}
                    type="button"
                  >
                    Abbrechen
                  </button>
                  <button
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                    disabled={isSaving || locked}
                    onClick={save}
                    type="button"
                  >
                    {isSaving ? "Speichert …" : "Speichern"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
