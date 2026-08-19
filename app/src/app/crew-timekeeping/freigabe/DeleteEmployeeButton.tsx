"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { deleteCrewTimeEmployee } from "../actions";

export function DeleteEmployeeButton({
  employeeId,
  employeeName,
  entryId,
}: {
  employeeId: string;
  employeeName: string;
  entryId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    setError("");
    startTransition(async () => {
      try {
        await deleteCrewTimeEmployee({ employeeId, entryId });
        setOpen(false);
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-black text-red-800"
        onClick={() => setOpen(true)}
        type="button"
      >
        Löschen
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
              <h2 className="text-lg font-black text-gray-900">Buchung löschen</h2>
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
              Buchung von <span className="font-black text-gray-950">„{employeeName}&#8220;</span>{" "}
              wirklich löschen?
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
                {pending ? "Löscht …" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
