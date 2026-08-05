"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveCrewTimeEntry } from "../actions";

export function ApproveButton({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function approve() {
    setError("");
    startTransition(async () => {
      try {
        await approveCrewTimeEntry(entryId);
        router.refresh();
      } catch (approveError) {
        setError(approveError instanceof Error ? approveError.message : "Freigabe fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded-xl bg-green-800 px-4 py-2 text-sm font-black text-white disabled:cursor-wait disabled:opacity-70"
        disabled={pending}
        onClick={approve}
        type="button"
      >
        {pending ? "Wird freigegeben …" : "Zeiten freigeben"}
      </button>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
    </div>
  );
}
