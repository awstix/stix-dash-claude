"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { saveInventoryIdlePeriods } from "./actions";

type IdlePeriod = {
  endsAt: string;
  id: string;
  notes: string;
  startsAt: string;
};

export function InventoryIdlePeriodsDialog({
  itemId,
  periods,
}: {
  itemId: string;
  periods: IdlePeriod[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<IdlePeriod[]>(
    periods.length > 0
      ? periods
      : [
          {
            endsAt: "",
            id: "new-1",
            notes: "",
            startsAt: "",
          },
        ],
  );

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      {
        endsAt: "",
        id: `new-${Date.now()}`,
        notes: "",
        startsAt: "",
      },
    ]);
  }

  function removeRow(rowId: string) {
    setRows((currentRows) =>
      currentRows.length <= 1
        ? [
            {
              endsAt: "",
              id: "new-1",
              notes: "",
              startsAt: "",
            },
          ]
        : currentRows.filter((row) => row.id !== rowId),
    );
  }

  return (
    <>
      <button
        className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-100"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Objekt stilllegen
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/55 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-950">
                  Objekt stilllegen
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Zeiträume erfassen, in denen das Objekt zwar auf Baustelle,
                  Werkstatt oder Bauhof steht, aber nicht voll arbeitet. Für
                  spätere Leistungsmeldung zählt dann der Stilllegungs-Satz.
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form action={saveInventoryIdlePeriods} className="mt-5 space-y-4">
              <input name="itemId" type="hidden" value={itemId} />

              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_minmax(0,1.5fr)_44px]"
                    key={row.id}
                  >
                    <label className="text-sm font-semibold text-gray-800">
                      Von
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        defaultValue={row.startsAt}
                        name="idleStartsAt"
                        type="date"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-800">
                      Bis
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        defaultValue={row.endsAt}
                        name="idleEndsAt"
                        type="date"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-800">
                      Bemerkung
                      <input
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        defaultValue={row.notes}
                        name="idleNotes"
                        placeholder={
                          index === 0
                            ? "z.B. steht auf Baustelle, nicht im Einsatz"
                            : undefined
                        }
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        aria-label="Zeile entfernen"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-700 hover:bg-red-50"
                        onClick={() => removeRow(row.id)}
                        title="Zeile entfernen"
                        type="button"
                      >
                        <ActionIcon name="delete" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={addRow}
                  type="button"
                >
                  <span className="text-lg leading-none">+</span>
                  Zeitraum hinzufügen
                </button>
                <button
                  className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                  type="submit"
                >
                  Stilllegung speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
