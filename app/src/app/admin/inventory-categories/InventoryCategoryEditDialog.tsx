"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { deleteInventoryCategory } from "./actions";

type InventoryCategoryForDialog = {
  _count: {
    childCategories: number;
    items: number;
  };
  colorClass: string | null;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  nextObjectNumber: number | null;
  objectNumberEnd: number | null;
  objectNumberStart: number | null;
  parentCategoryId: string | null;
  sortOrder: number;
  useInDailyReports: boolean;
  useInTruckDispatchMaterial: boolean;
  useInTruckDispatchObject: boolean;
  useInTruckDisposition: boolean;
};

export function InventoryCategoryEditDialog({
  category,
  children,
}: {
  category: InventoryCategoryForDialog;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="inline-flex rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Bearbeiten
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-950/55 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Kategorie bearbeiten
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Nummernkreis, Status und Verwendung pflegen.
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            {children}

            <form action={deleteInventoryCategory} className="mt-4">
              <input name="id" type="hidden" value={category.id} />
              <button
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                type="submit"
              >
                {category._count.items > 0
                  ? "Kategorie deaktivieren"
                  : "Kategorie löschen"}
              </button>
              {category._count.items > 0 ? (
                <p className="mt-2 text-xs text-gray-500">
                  Diese Kategorie enthält Objekte und wird deshalb beim Löschen
                  nur deaktiviert.
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
