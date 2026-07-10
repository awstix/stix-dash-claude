"use client";

import { useState } from "react";
import { deleteCompleteInventory } from "./actions";

export function DeleteInventoryDialog({
  itemCount,
}: {
  itemCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const canDelete = confirmation.trim().toUpperCase() === "INVENTAR LÖSCHEN";

  return (
    <>
      <button
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Inventar löschen
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-950">
                  Inventar vollständig löschen?
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {itemCount} Inventarobjekt{itemCount === 1 ? "" : "e"} samt
                  Lagerbeständen, Zuordnungen, Historien und Fotos werden
                  unwiderruflich entfernt.
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              Kategorien und Nummernkreise bleiben erhalten. Die nächste
              Objekt-ID beginnt danach wieder am jeweiligen Nummernkreis-Anfang.
            </div>

            <form action={deleteCompleteInventory} className="mt-5">
              <label className="block text-sm font-semibold text-gray-800">
                Zur Bestätigung „INVENTAR LÖSCHEN“ eingeben
                <input
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900"
                  name="confirmation"
                  onChange={(event) => setConfirmation(event.target.value)}
                  value={confirmation}
                />
              </label>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canDelete}
                  type="submit"
                >
                  Alles endgültig löschen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
