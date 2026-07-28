"use client";

import { useRef } from "react";

import { ActionIcon } from "@/components/ActionIcon";

import { archiveSafetyInstructionRecord } from "../actions";

export function CommissionArchiveButton({
  recordId,
  title,
}: {
  recordId: string;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        aria-label="Beauftragung löschen"
        className="rounded-lg border border-red-300 p-2 text-red-700 hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
        title="Ins Archiv verschieben"
        type="button"
      >
        <ActionIcon name="delete" />
      </button>
      <dialog
        className="m-auto w-[min(92vw,32rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-gray-950/60"
        ref={dialogRef}
      >
        <div className="p-6 text-gray-950">
          <h3 className="text-xl font-bold">Beauftragung archivieren?</h3>
          <p className="mt-3 text-sm text-gray-700">
            „{title}“ wird nach der Bestätigung ins Archiv verschoben. Die
            unterschriebene Fassung bleibt dort zur Nachverfolgung erhalten.
            Erst im Admin-Archiv kann sie endgültig gelöscht werden.
          </p>
          <form action={archiveSafetyInstructionRecord} className="mt-6 flex justify-end gap-3">
            <input name="recordId" type="hidden" value={recordId} />
            <button
              className="rounded-xl border border-gray-300 px-4 py-2 font-bold"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Abbrechen
            </button>
            <button className="rounded-xl bg-red-700 px-4 py-2 font-bold text-white">
              Ins Archiv verschieben
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
