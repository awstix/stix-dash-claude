"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

export function DeleteEntryButton({
  action,
  id,
  label,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  projectId: string;
  reportId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Löschen"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
        title="Löschen"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="delete" />
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
              <h2 className="text-lg font-bold text-gray-900">Position löschen</h2>
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
              {label ? (
                <>
                  <span className="font-semibold text-gray-900">„{label}&#8220;</span> wirklich
                  löschen?
                </>
              ) : (
                "Position wirklich löschen?"
              )}
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
                <input name="id" type="hidden" value={id} />
                <input name="reportId" type="hidden" value={reportId} />
                <input name="projectId" type="hidden" value={projectId} />
                <button
                  className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                  type="submit"
                >
                  Löschen
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
