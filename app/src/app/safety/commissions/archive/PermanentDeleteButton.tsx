"use client";

import { useRef } from "react";

import { ActionIcon } from "@/components/ActionIcon";

import { permanentlyDeleteSafetyInstructionRecord } from "../../actions";

export function PermanentDeleteButton({ recordId }: { recordId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        aria-label="Endgültig löschen"
        className="rounded-lg border border-red-300 p-2 text-red-700"
        onClick={() => dialogRef.current?.showModal()}
        title="Endgültig löschen"
        type="button"
      >
        <ActionIcon name="delete" />
      </button>
      <dialog className="m-auto w-[min(92vw,32rem)] rounded-2xl bg-white p-6 shadow-2xl backdrop:bg-gray-950/60" ref={dialogRef}>
        <h3 className="text-xl font-bold text-gray-950">Endgültig löschen?</h3>
        <p className="mt-3 text-sm text-gray-700">
          Diese Admin-Aktion entfernt den unterschriebenen Nachweis dauerhaft
          und kann nicht rückgängig gemacht werden.
        </p>
        <form action={permanentlyDeleteSafetyInstructionRecord} className="mt-6 flex justify-end gap-3">
          <input name="recordId" type="hidden" value={recordId} />
          <button className="rounded-xl border border-gray-300 px-4 py-2 font-bold" onClick={() => dialogRef.current?.close()} type="button">Abbrechen</button>
          <button className="rounded-xl bg-red-800 px-4 py-2 font-bold text-white">Endgültig löschen</button>
        </form>
      </dialog>
    </>
  );
}
