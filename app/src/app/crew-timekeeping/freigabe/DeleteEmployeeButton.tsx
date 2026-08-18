"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function remove() {
    if (!window.confirm(`Buchung von „${employeeName}" wirklich löschen?`)) return;

    setError("");
    startTransition(async () => {
      try {
        await deleteCrewTimeEmployee({ employeeId, entryId });
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-black text-red-800 disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        onClick={remove}
        type="button"
      >
        {pending ? "Löscht …" : "Löschen"}
      </button>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
    </div>
  );
}
