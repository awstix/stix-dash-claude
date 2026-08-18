"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    if (
      !window.confirm(
        `Kompletten Eintrag „${crewName}" für ${workDateLabel} wirklich löschen? Das betrifft alle darin gebuchten Mitarbeiter.`,
      )
    ) {
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        await deleteCrewTimeEntry(entryId);
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-800 disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        onClick={remove}
        type="button"
      >
        {pending ? "Löscht …" : "Kolonne komplett löschen"}
      </button>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
    </div>
  );
}
