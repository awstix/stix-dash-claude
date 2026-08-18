"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { DetailEntryForm, type DetailEntryEditValues } from "./DetailEntryForm";

type EquipmentOption = {
  id: string;
  category: string;
  costType: string;
  label: string;
  parentCategory: string;
  unit: string;
  unitPrice: string;
};

type HourEntryOption = { id: string; label: string; totalHours: string };

/** Rein clientseitiges Popup (kein editDetailId-URL-Parameter, keine
 * Navigation zum Öffnen) - die vorher genutzte URL-Param-Variante löste
 * bei jedem Öffnen einen vollen Seiten-Reload aus, wodurch der
 * Scroll-Zustand verloren ging und die Seite sichtbar nach oben sprang. */
export function EditDetailEntryButton({
  action,
  entry,
  equipmentOptions,
  hourEntryOptions,
  projectId,
  reportId,
  updateAction,
}: {
  action: (formData: FormData) => Promise<void>;
  entry: DetailEntryEditValues;
  equipmentOptions: EquipmentOption[];
  hourEntryOptions: HourEntryOption[];
  projectId: string;
  reportId: string;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Bearbeiten"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title="Bearbeiten"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="edit" />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">
                Detailposition bearbeiten
              </h2>
              <button
                aria-label="Schließen"
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <DetailEntryForm
              action={action}
              editingEntry={entry}
              equipmentOptions={equipmentOptions}
              hourEntryOptions={hourEntryOptions}
              onCancel={() => setOpen(false)}
              projectId={projectId}
              reportId={reportId}
              updateAction={updateAction}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
