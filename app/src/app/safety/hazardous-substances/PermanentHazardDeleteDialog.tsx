"use client";

import { useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";

import { deleteHazardousSubstancePermanently } from "../actions";

export function PermanentHazardDeleteDialog({
  id,
  name,
  sequentialNumber,
}: {
  id: string;
  name: string;
  sequentialNumber: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`${name} endgültig löschen`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
        title="Endgültig löschen"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="delete" />
      </button>
      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-6 text-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-black">
              Wirklich endgültig löschen?
            </h2>
            <p className="mt-2 text-sm font-semibold text-black">
              {sequentialNumber ? `${sequentialNumber} · ` : ""}
              {name}
            </p>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-black">
              Dieser Vorgang kann nicht rückgängig gemacht werden. Zugehörige
              Sicherheitsdatenblätter werden ebenfalls gelöscht. Erst danach
              wird die laufende Nummer wieder für einen neuen Gefahrstoff frei.
            </div>
            <form action={deleteHazardousSubstancePermanently} className="mt-6">
              <input name="id" type="hidden" value={id} />
              <div className="flex justify-end gap-3">
                <button
                  className="rounded-xl border border-gray-400 px-4 py-2.5 text-sm font-bold text-black"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800"
                  type="submit"
                >
                  Endgültig löschen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
