"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { deleteCrewTimeEntry } from "../actions";

export function DeleteEntryButton({
  crewName,
  entryId,
  workDateLabel,
}: {
  crewName: string;
  entryId: string;
  workDateLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    setError("");
    startTransition(async () => {
      try {
        await deleteCrewTimeEntry(entryId);
        setOpen(false);
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-800"
        onClick={() => setOpen(true)}
        type="button"
      >
        Kolonne komplett löschen
      </button>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl text-gray-950">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-gray-900">Kolonne komplett löschen</h2>
              <button
                aria-label="Schließen"
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-700">
              Kompletten Eintrag <span className="font-black text-gray-950">„{crewName}&#8220;</span>{" "}
              für {workDateLabel} wirklich löschen? Das betrifft alle darin gebuchten Mitarbeiter.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-70"
                disabled={pending}
                onClick={remove}
                type="button"
              >
                {pending ? "Löscht …" : "Endgültig löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
