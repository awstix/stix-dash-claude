"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

export function MarkAllActualButton({
  action,
  count,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  count: number;
  projectId: string;
  reportId: string;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        ✓ Alle freigeben ({count})
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Alle freigeben</h2>
              <button
                aria-label="Schließen"
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {count} Position{count === 1 ? "" : "en"}
              </span>{" "}
              als freigegeben markieren? Der Status der Positionen bleibt dabei unverändert.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                Abbrechen
              </button>
              <form action={action}>
                <input name="reportId" type="hidden" value={reportId} />
                <input name="projectId" type="hidden" value={projectId} />
                <button
                  className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
                  type="submit"
                >
                  Freigeben
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
