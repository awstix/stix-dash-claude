"use client";

import {
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  getCrewTimeEntryForEdit,
  saveCrewTimeEntry,
  type CrewTimeEmployeeInput,
  type CrewTimeEntryInput,
} from "@/app/crew-timekeeping/actions";
import { ActionIcon } from "@/components/ActionIcon";

const RANGE_START_MIN = 4 * 60; // 04:00
const RANGE_END_MIN = 20 * 60; // 20:00
const RANGE_SPAN_MIN = RANGE_END_MIN - RANGE_START_MIN;

function timeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function ratioFromMinutes(minutes: number) {
  return Math.min(1, Math.max(0, (minutes - RANGE_START_MIN) / RANGE_SPAN_MIN));
}

function formatChangedAt(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const hourTicks = Array.from(
  { length: RANGE_SPAN_MIN / 60 + 1 },
  (_, index) => RANGE_START_MIN + index * 60,
);

type DragTarget = "startTime" | "endTime" | "break1From" | "break1To" | "break2From" | "break2To";

const breakColor = "bg-amber-500";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900";

export function PersonalZeitenEditDialog({
  employeeId,
  entryId,
  trigger,
}: {
  employeeId: string;
  entryId: string;
  trigger: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [entryInput, setEntryInput] = useState<CrewTimeEntryInput | null>(null);
  const [locked, setLocked] = useState(false);
  const [lastChange, setLastChange] = useState<{ at: string; byName: string | null } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function openDialog() {
    setOpen(true);
    setError("");
    setMessage("");
    setEntryInput(null);
    setLastChange(null);
    startLoading(async () => {
      try {
        const result = await getCrewTimeEntryForEdit(entryId);
        setEntryInput(result.input);
        setLocked(result.locked);
        setLastChange({ at: result.lastChangedAt, byName: result.lastChangedByName });
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

  const employeeIndex = entryInput?.employees.findIndex((item) => item.employeeId === employeeId) ?? -1;
  const employee = employeeIndex >= 0 ? entryInput?.employees[employeeIndex] : undefined;

  function patchEmployee(patch: Partial<CrewTimeEmployeeInput>) {
    setEntryInput((current) => {
      if (!current || employeeIndex < 0) return current;
      return {
        ...current,
        employees: current.employees.map((item, index) =>
          index === employeeIndex ? { ...item, ...patch } : item,
        ),
      };
    });
  }

  function moveDrag(target: DragTarget, clientX: number, barElement: HTMLElement | null) {
    if (!barElement) return;
    const rect = barElement.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const minutesValue = RANGE_START_MIN + ratio * RANGE_SPAN_MIN;
    const snapped = Math.round(minutesValue / 5) * 5;
    patchEmployee({ [target]: minutesToTime(snapped) } as Partial<CrewTimeEmployeeInput>);
  }

  function dragHandleProps(target: DragTarget) {
    return {
      onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (locked) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        moveDrag(target, event.clientX, event.currentTarget.parentElement);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        moveDrag(target, event.clientX, event.currentTarget.parentElement);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
    };
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

  const startMinutes = employee ? timeToMinutes(employee.startTime) : null;
  const endMinutes = employee ? timeToMinutes(employee.endTime) : null;
  const startRatio = startMinutes !== null ? ratioFromMinutes(startMinutes) : 0.2;
  const endRatio = endMinutes !== null ? ratioFromMinutes(endMinutes) : 0.6;

  function addBreak(breakNumber: 1 | 2) {
    if (!employee) return;
    const workStart = timeToMinutes(employee.startTime) ?? RANGE_START_MIN + 120;
    const workEnd = timeToMinutes(employee.endTime) ?? RANGE_START_MIN + 480;
    const midpoint = Math.round((workStart + workEnd) / 2 / 5) * 5;
    const from = minutesToTime(breakNumber === 1 ? midpoint - 15 : midpoint + 45);
    const to = minutesToTime(breakNumber === 1 ? midpoint + 15 : midpoint + 75);
    patchEmployee(
      breakNumber === 1
        ? { break1From: from, break1To: to }
        : { break2From: from, break2To: to },
    );
  }

  function removeBreak(breakNumber: 1 | 2) {
    patchEmployee(
      breakNumber === 1
        ? { break1From: "", break1To: "" }
        : { break2From: "", break2To: "" },
    );
  }

  function breakRatios(from: string, to: string) {
    const fromMinutes = timeToMinutes(from);
    const toMinutes = timeToMinutes(to);
    if (fromMinutes === null || toMinutes === null) return null;
    return { from: ratioFromMinutes(fromMinutes), to: ratioFromMinutes(toMinutes) };
  }

  const break1Ratios = employee ? breakRatios(employee.break1From, employee.break1To) : null;
  const break2Ratios = employee ? breakRatios(employee.break2From, employee.break2To) : null;

  return (
    <>
      <button className="text-left font-semibold text-gray-900 hover:underline" onClick={openDialog} type="button">
        {trigger}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Arbeitszeit anpassen</h2>
                {entryInput ? (
                  <p className="mt-1 text-sm text-gray-600">
                    {employee?.employeeName} · {entryInput.workDate} · {entryInput.projectNumber}{" "}
                    {entryInput.projectName}
                  </p>
                ) : null}
                {lastChange ? (
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Zuletzt geändert von {lastChange.byName || "unbekannt"} am{" "}
                    {formatChangedAt(lastChange.at)}
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

            {isLoading ? (
              <div className="mt-6 text-sm font-semibold text-gray-500">Lädt …</div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                {error}
              </div>
            ) : null}

            {employee && entryInput ? (
              <div className="mt-5 space-y-5">
                {locked ? (
                  <div className="rounded-xl border-2 border-green-800 bg-green-50 px-4 py-3 text-sm font-semibold text-green-950">
                    🔒 Freigegeben — Bearbeitung nur durch Bauleitung oder Admin möglich.
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input
                    checked={employee.isPresent}
                    className="h-4 w-4"
                    disabled={locked}
                    onChange={(event) => patchEmployee({ isPresent: event.target.checked })}
                    type="checkbox"
                  />
                  Anwesend
                </label>

                {employee.isPresent ? (
                  <>
                    <div>
                      <p className="mb-2 text-xs font-semibold text-gray-600">
                        Blau ziehen = Beginn/Ende, Gelb ziehen = Pause. Ränder pro 2 Std. markiert.
                      </p>
                      <div className="relative mb-1 h-4 text-[10px] font-medium text-gray-500">
                        {hourTicks.map((tick) =>
                          tick % 120 === 0 ? (
                            <span
                              className="absolute -translate-x-1/2"
                              key={tick}
                              style={{ left: `${ratioFromMinutes(tick) * 100}%` }}
                            >
                              {minutesToTime(tick).slice(0, 2)}
                            </span>
                          ) : null,
                        )}
                      </div>
                      <div className="relative h-10">
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl bg-gray-100">
                          {hourTicks.map((tick) => (
                            <div
                              className="absolute top-0 h-10 w-px bg-gray-300"
                              key={tick}
                              style={{ left: `${ratioFromMinutes(tick) * 100}%` }}
                            />
                          ))}
                          <div
                            className="absolute top-0 h-10 bg-blue-600/80"
                            style={{
                              left: `${startRatio * 100}%`,
                              width: `${Math.max(0, endRatio - startRatio) * 100}%`,
                            }}
                          />
                          {break1Ratios ? (
                            <div
                              className={`absolute top-0 h-10 ${breakColor}`}
                              style={{
                                left: `${break1Ratios.from * 100}%`,
                                width: `${Math.max(0, break1Ratios.to - break1Ratios.from) * 100}%`,
                              }}
                            />
                          ) : null}
                          {break2Ratios ? (
                            <div
                              className={`absolute top-0 h-10 ${breakColor}`}
                              style={{
                                left: `${break2Ratios.from * 100}%`,
                                width: `${Math.max(0, break2Ratios.to - break2Ratios.from) * 100}%`,
                              }}
                            />
                          ) : null}
                        </div>
                        <button
                          aria-label="Beginn ziehen"
                          className="absolute top-0 h-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-blue-800 disabled:cursor-not-allowed"
                          disabled={locked}
                          style={{ left: `${startRatio * 100}%`, touchAction: "none" }}
                          type="button"
                          {...dragHandleProps("startTime")}
                        />
                        <button
                          aria-label="Ende ziehen"
                          className="absolute top-0 h-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-blue-800 disabled:cursor-not-allowed"
                          disabled={locked}
                          style={{ left: `${endRatio * 100}%`, touchAction: "none" }}
                          type="button"
                          {...dragHandleProps("endTime")}
                        />
                        {break1Ratios ? (
                          <>
                            <button
                              aria-label="Pause 1 Beginn ziehen"
                              className="absolute top-0 h-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-amber-700 disabled:cursor-not-allowed"
                              disabled={locked}
                              style={{ left: `${break1Ratios.from * 100}%`, touchAction: "none" }}
                              type="button"
                              {...dragHandleProps("break1From")}
                            />
                            <button
                              aria-label="Pause 1 Ende ziehen"
                              className="absolute top-0 h-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-amber-700 disabled:cursor-not-allowed"
                              disabled={locked}
                              style={{ left: `${break1Ratios.to * 100}%`, touchAction: "none" }}
                              type="button"
                              {...dragHandleProps("break1To")}
                            />
                          </>
                        ) : null}
                        {break2Ratios ? (
                          <>
                            <button
                              aria-label="Pause 2 Beginn ziehen"
                              className="absolute top-0 h-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-amber-700 disabled:cursor-not-allowed"
                              disabled={locked}
                              style={{ left: `${break2Ratios.from * 100}%`, touchAction: "none" }}
                              type="button"
                              {...dragHandleProps("break2From")}
                            />
                            <button
                              aria-label="Pause 2 Ende ziehen"
                              className="absolute top-0 h-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border-2 border-white bg-amber-700 disabled:cursor-not-allowed"
                              disabled={locked}
                              style={{ left: `${break2Ratios.to * 100}%`, touchAction: "none" }}
                              type="button"
                              {...dragHandleProps("break2To")}
                            />
                          </>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={locked}
                          onClick={() => (break1Ratios ? removeBreak(1) : addBreak(1))}
                          type="button"
                        >
                          {break1Ratios ? "Pause 1 löschen" : "+ Pause 1 hinzufügen"}
                        </button>
                        <button
                          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={locked}
                          onClick={() => (break2Ratios ? removeBreak(2) : addBreak(2))}
                          type="button"
                        >
                          {break2Ratios ? "Pause 2 löschen" : "+ Pause 2 hinzufügen"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm font-semibold text-gray-800">
                        Beginn
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ startTime: event.target.value })}
                          type="time"
                          value={employee.startTime}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Ende
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ endTime: event.target.value })}
                          type="time"
                          value={employee.endTime}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Pause 1 von
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ break1From: event.target.value })}
                          type="time"
                          value={employee.break1From}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Pause 1 bis
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ break1To: event.target.value })}
                          type="time"
                          value={employee.break1To}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Pause 2 von
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ break2From: event.target.value })}
                          type="time"
                          value={employee.break2From}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-800">
                        Pause 2 bis
                        <input
                          className={inputClass}
                          disabled={locked}
                          onChange={(event) => patchEmployee({ break2To: event.target.value })}
                          type="time"
                          value={employee.break2To}
                        />
                      </label>
                    </div>
                  </>
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
