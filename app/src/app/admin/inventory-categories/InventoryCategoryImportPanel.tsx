"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import {
  importInventoryCategories,
  type CategoryImportState,
} from "./import-actions";

const initialCategoryImportState: CategoryImportState = {
  errors: [],
  imported: 0,
  message: null,
};

export function InventoryCategoryImportPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, action, isPending] = useActionState(
    importInventoryCategories,
    initialCategoryImportState,
  );

  function submitImport() {
    const formData = new FormData();
    const file = fileInputRef.current?.files?.[0];
    if (file) formData.set("categoryFile", file);

    startTransition(() => {
      action(formData);
    });
  }

  return (
    <>
      <button
        className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Importieren
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-gray-950/55 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Kategorien importieren
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Haupt- und Unterkategorien gesammelt per Excel anlegen.
                  Hauptkategorien werden automatisch zuerst verarbeitet.
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

            <a
              className="mt-5 inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/inventory-categories/import-template"
            >
              Excel-Vorlage herunterladen
            </a>

            <div className="mt-5">
              <label className="text-sm font-semibold text-gray-800">
                Ausgefüllte Excel-Datei
                <input
                  accept=".xlsx,.xls"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-semibold file:text-gray-800"
                  ref={fileInputRef}
                  type="file"
                />
              </label>
            </div>

            {state.message ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
                {state.message}
              </div>
            ) : null}

            {state.errors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="font-semibold text-red-950">
                  {state.errors.length} Importhinweis
                  {state.errors.length === 1 ? "" : "e"}
                </div>
                <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-red-900">
                  {state.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isPending}
                onClick={submitImport}
                type="button"
              >
                {isPending ? "Import läuft …" : "Excel importieren"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
