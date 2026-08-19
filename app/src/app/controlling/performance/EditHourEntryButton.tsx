"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

export type HourEntryEditValues = {
  breakHours: string;
  costCategory: string;
  employeeCount: string;
  endsAt: string;
  entryDate: string;
  hoursPerEmployee: string;
  id: string;
  internalRate: string;
  label: string;
  notes: string;
  realRate: string;
  startsAt: string;
  status: string;
};

const inputClassName =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-gray-900";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700";
const hourEntryStatuses = ["geschätzt", "geprüft", "tatsächlich verbaut", "gebucht", "offen", "erledigt"];

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseGermanNumber(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Bearbeiten-Popup für eine erfasste Stunden-Position. Betrifft
 * ausschließlich die Zahlen dieser Leistungsmeldung
 * (ControllingHourEntry) - komplett getrennt von der echten
 * Zeiterfassung/Stundenfreigabe und der Lohnabrechnung. Deshalb der
 * deutliche Hinweis oben im Popup, damit niemand denkt, eine Korrektur
 * hier würde gebuchte Stunden oder Löhne umbuchen. */
export function EditHourEntryButton({
  entry,
  projectId,
  reportId,
  updateAction,
}: {
  entry: HourEntryEditValues;
  projectId: string;
  reportId: string;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(entry.label);
  const [startsAt, setStartsAt] = useState(entry.startsAt);
  const [endsAt, setEndsAt] = useState(entry.endsAt);
  const [breakHours, setBreakHours] = useState(entry.breakHours);
  const [employeeCount, setEmployeeCount] = useState(entry.employeeCount);
  const [hoursPerEmployee, setHoursPerEmployee] = useState(entry.hoursPerEmployee);
  const [hoursWasEdited, setHoursWasEdited] = useState(false);
  const [realRate, setRealRate] = useState(entry.realRate);
  const [internalRate, setInternalRate] = useState(entry.internalRate);
  const [costCategory, setCostCategory] = useState(entry.costCategory);
  const [status, setStatus] = useState(entry.status);
  const [notes, setNotes] = useState(entry.notes);

  function recomputeHours(nextStartsAt: string, nextEndsAt: string, nextBreakHours: string) {
    if (hoursWasEdited) return;

    const startMinutes = timeToMinutes(nextStartsAt);
    const endMinutes = timeToMinutes(nextEndsAt);
    if (startMinutes === null || endMinutes === null) return;

    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes < 0) diffMinutes += 24 * 60;

    const hours = Math.max(0, diffMinutes / 60 - parseGermanNumber(nextBreakHours));
    setHoursPerEmployee(
      new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
        Math.round(hours * 100) / 100,
      ),
    );
  }

  const previewTotalHours =
    parseGermanNumber(hoursPerEmployee) * parseGermanNumber(employeeCount || "1");

  return (
    <>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title="Bearbeiten"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="edit" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Stundenposition bearbeiten</h2>
              <button
                aria-label="Schließen"
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
              ⚠ Diese Änderung betrifft nur diese Leistungsmeldung. Es werden keine gebuchten
              Stunden, Löhne oder Personalzeiten verändert oder umgebucht - die Zeiterfassung
              bleibt komplett unangetastet.
            </div>

            <form action={updateAction} className="mt-4 grid gap-3 md:grid-cols-2">
              <input name="id" type="hidden" value={entry.id} />
              <input name="reportId" type="hidden" value={reportId} />
              <input name="projectId" type="hidden" value={projectId} />

              <Field className="md:col-span-2" label="Bezeichnung">
                <input
                  className={inputClassName}
                  name="label"
                  onChange={(event) => setLabel(event.target.value)}
                  value={label}
                />
              </Field>
              <Field label="Datum">
                <input className={inputClassName} defaultValue={entry.entryDate} name="entryDate" type="date" />
              </Field>
              <Field label="Kostenart Leistungsmeldung">
                <select
                  className={inputClassName}
                  name="costCategory"
                  onChange={(event) => setCostCategory(event.target.value)}
                  value={costCategory}
                >
                  <option value="LOHN">Lohn</option>
                  <option value="GEHALT_SONSTIGES">Gehalt / Sonstiges</option>
                </select>
              </Field>
              <Field label="Beginn">
                <input
                  className={inputClassName}
                  name="startsAt"
                  onChange={(event) => {
                    setStartsAt(event.target.value);
                    recomputeHours(event.target.value, endsAt, breakHours);
                  }}
                  type="time"
                  value={startsAt}
                />
              </Field>
              <Field label="Ende">
                <input
                  className={inputClassName}
                  name="endsAt"
                  onChange={(event) => {
                    setEndsAt(event.target.value);
                    recomputeHours(startsAt, event.target.value, breakHours);
                  }}
                  type="time"
                  value={endsAt}
                />
              </Field>
              <Field label="Pause h">
                <input
                  className={inputClassName}
                  name="breakHours"
                  onChange={(event) => {
                    setBreakHours(event.target.value);
                    recomputeHours(startsAt, endsAt, event.target.value);
                  }}
                  placeholder="0"
                  value={breakHours}
                />
              </Field>
              <Field label="Anzahl Mitarbeiter">
                <input
                  className={inputClassName}
                  min="1"
                  name="employeeCount"
                  onChange={(event) => setEmployeeCount(event.target.value)}
                  step="1"
                  type="number"
                  value={employeeCount}
                />
              </Field>
              <Field label="Stunden je Mitarbeiter">
                <input
                  className={inputClassName}
                  name="hoursPerEmployee"
                  onChange={(event) => {
                    setHoursWasEdited(true);
                    setHoursPerEmployee(event.target.value);
                  }}
                  placeholder="0,00"
                  value={hoursPerEmployee}
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Arbeitszeit abzüglich Pausen.
                </span>
              </Field>
              <Field label="EK real €/h">
                <input
                  className={inputClassName}
                  name="realRate"
                  onChange={(event) => setRealRate(event.target.value)}
                  placeholder="0,00"
                  value={realRate}
                />
              </Field>
              <Field label="Interner Satz €/h">
                <input
                  className={inputClassName}
                  name="internalRate"
                  onChange={(event) => setInternalRate(event.target.value)}
                  placeholder="0,00"
                  value={internalRate}
                />
              </Field>
              <Field label="Status">
                <select
                  className={inputClassName}
                  name="status"
                  onChange={(event) => setStatus(event.target.value)}
                  value={status}
                >
                  {hourEntryStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field className="md:col-span-2" label="Bemerkung">
                <input
                  className={inputClassName}
                  name="notes"
                  onChange={(event) => setNotes(event.target.value)}
                  value={notes}
                />
              </Field>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 md:col-span-2">
                Gesamtstunden dieser Position:{" "}
                <strong>
                  {new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
                    previewTotalHours,
                  )}{" "}
                  h
                </strong>{" "}
                ({employeeCount || 0} MA × {hoursPerEmployee || 0} h)
              </div>

              <div className="flex items-center gap-3 md:col-span-2">
                <button className={primaryButtonClassName} type="submit">
                  Änderungen speichern
                </button>
                <button
                  className="text-sm font-semibold text-gray-600 hover:text-gray-900"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-gray-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}
