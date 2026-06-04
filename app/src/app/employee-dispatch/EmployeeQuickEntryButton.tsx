"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createEmployeeDispositionEntry } from "./actions";
import { employeeDispositionTypes } from "./disposition-types";

export function EmployeeQuickEntryButton({
  employeeId,
  employeeName,
  defaultStartDate,
  defaultEndDate,
}: {
  employeeId: string;
  employeeName: string;
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-950/30 p-4"
      onMouseDown={(event) => {
        if (
          event.target instanceof Node &&
          dialogRef.current &&
          !dialogRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Eintrag hinzufügen
            </h2>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              {employeeName}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl leading-none text-gray-700 hover:bg-gray-50"
            aria-label="Fenster schließen"
          >
            x
          </button>
        </div>

        <form
          action={async (formData) => {
            await createEmployeeDispositionEntry(formData);
            setOpen(false);
          }}
          className="mt-5 space-y-4"
        >
          <input type="hidden" name="employeeId" value={employeeId} />

          <fieldset>
            <legend className="text-sm font-medium text-gray-800">
              Kategorien
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {employeeDispositionTypes
                .filter((type) => type.value !== "betrieb")
                .map((type) => (
                  <label
                    key={type.value}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800"
                  >
                    <input
                      type="checkbox"
                      name="typeValues"
                      value={type.value}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {type.label}
                  </label>
                ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-800">
              Von
              <input
                type="date"
                name="startDate"
                required
                defaultValue={defaultStartDate}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Bis
              <input
                type="date"
                name="endDate"
                required
                defaultValue={defaultEndDate}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Beginn
              <input
                type="time"
                name="startTime"
                defaultValue="06:30"
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Ende
              <input
                type="time"
                name="endTime"
                defaultValue="17:00"
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-800">
            Bemerkung
            <input
              name="notes"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Eintrag speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-sm font-bold text-gray-900 underline-offset-4 hover:text-gray-700 hover:underline"
      >
        {employeeName}
      </button>

      {typeof document !== "undefined" && dialog
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
