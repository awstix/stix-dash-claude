"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { deleteInventoryItem } from "./actions";

export function ArchiveInventoryItemDialog({
  itemId,
  itemName,
  objectNumber,
}: {
  itemId: string;
  itemName: string;
  objectNumber?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const title = objectNumber ? `${objectNumber} · ${itemName}` : itemName;

  return (
    <>
      <button
        aria-label={`${itemName} archivieren`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
        onClick={() => setIsOpen(true)}
        title="Archivieren"
        type="button"
      >
        <ActionIcon name="delete" className="h-4 w-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                  Objekt archivieren
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-950">
                  Sind Sie sicher?
                </h2>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {title}
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Das Objekt wird in das Inventararchiv verschoben und ist für den
              normalen Nutzer nicht mehr sichtbar. Es kann durch einen
              Administrator oder Verantwortlichen wiederhergestellt werden. Die
              Objektnummer bleibt solange vergeben, bis das Objekt endgültig im
              Archiv gelöscht wird.
            </div>

            <form action={deleteInventoryItem} className="mt-6">
              <input name="id" type="hidden" value={itemId} />
              <div className="flex justify-end gap-3">
                <button
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
                  type="submit"
                >
                  Objekt archivieren
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
