"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

type SuggestionPayloadItem =
  | {
      costCategory: string;
      crewName: string;
      internalRate: string;
      personnelHours: number;
      realRate: string;
      type: "PERSONNEL";
    }
  | {
      crewName: string;
      equipmentHours: number;
      itemId: string;
      label: string;
      type: "EQUIPMENT";
      unitPrice: string;
    };

export function ConfirmAllSuggestionsButton({
  action,
  entryDate,
  items,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  entryDate: string;
  items: SuggestionPayloadItem[];
  projectId: string;
  reportId: string;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const personnelCount = items.filter((item) => item.type === "PERSONNEL").length;
  const equipmentCount = items.filter((item) => item.type === "EQUIPMENT").length;

  return (
    <>
      <button
        className="rounded-lg border border-blue-300 bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-200"
        onClick={() => setOpen(true)}
        type="button"
      >
        Alle Vorschläge übernehmen
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
              <h2 className="text-lg font-bold text-gray-900">Alle Vorschläge übernehmen</h2>
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
              Bucht{" "}
              <span className="font-semibold text-gray-900">
                {personnelCount} Personalstunden-Position{personnelCount === 1 ? "" : "en"}
              </span>{" "}
              und{" "}
              <span className="font-semibold text-gray-900">
                {equipmentCount} Geräte-Position{equipmentCount === 1 ? "" : "en"}
              </span>{" "}
              mit Datum {entryDate}. Danach über &quot;Bearbeiten&quot; einzeln korrigierbar.
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
                <input name="entryDate" type="hidden" value={entryDate} />
                <input name="suggestions" type="hidden" value={JSON.stringify(items)} />
                <button
                  className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  type="submit"
                >
                  Alle buchen
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
