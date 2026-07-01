"use client";

import { useState } from "react";

type SubcategoryRow = {
  id: string;
  isExisting: boolean;
  name: string;
  nextObjectNumber: string;
  objectNumberEnd: string;
  objectNumberStart: string;
  sortOrder: string;
  isActive: boolean;
};

export function InventorySubcategoryRows({
  initialRows,
}: {
  initialRows: SubcategoryRow[];
}) {
  const [rows, setRows] = useState<SubcategoryRow[]>(initialRows);

  function addRow() {
    setRows((currentRows) => [
      ...currentRows,
      {
        id: `new-${crypto.randomUUID()}`,
        isActive: true,
        isExisting: false,
        name: "",
        nextObjectNumber: "",
        objectNumberEnd: "",
        objectNumberStart: "",
        sortOrder: "0",
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<SubcategoryRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === id
          ? row.isExisting
            ? { ...row, isActive: false, name: "" }
            : row
          : row,
      ).filter((row) => row.isExisting || row.id !== id),
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 xl:col-span-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Unterkategorien
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Hier direkt z. B. 2-Achser, 3-Achser oder Sattel mit eigenem
            Nummernkreis innerhalb der Hauptkategorie anlegen.
          </p>
        </div>
        <button
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          onClick={addRow}
          type="button"
        >
          + Unterkategorie
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
            Noch keine Unterkategorien. Mit dem Plus kannst du direkt welche
            anlegen.
          </div>
        ) : null}

        {rows.map((row) => (
          <div
            className={`grid grid-cols-1 gap-3 rounded-xl border p-3 md:grid-cols-12 ${
              row.isExisting && !row.name
                ? "border-red-200 bg-red-50"
                : "border-gray-200 bg-gray-50"
            }`}
            key={row.id}
          >
            <input
              name="subcategoryId"
              type="hidden"
              value={row.isExisting ? row.id : ""}
            />
            <input
              name="subcategoryIsActiveValue"
              type="hidden"
              value={row.isActive ? "1" : "0"}
            />
            <label className="text-xs font-semibold text-gray-700 md:col-span-3">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                name="subcategoryName"
                onChange={(event) =>
                  updateRow(row.id, { name: event.target.value })
                }
                placeholder="z. B. 2-Achser"
                value={row.name}
              />
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-2">
              Von
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                inputMode="numeric"
                maxLength={6}
                name="subcategoryObjectNumberStart"
                onChange={(event) =>
                  updateRow(row.id, { objectNumberStart: event.target.value })
                }
                placeholder="100000"
                value={row.objectNumberStart}
              />
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-2">
              Bis
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                inputMode="numeric"
                maxLength={6}
                name="subcategoryObjectNumberEnd"
                onChange={(event) =>
                  updateRow(row.id, { objectNumberEnd: event.target.value })
                }
                placeholder="100499"
                value={row.objectNumberEnd}
              />
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-2">
              Nächste ID
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                inputMode="numeric"
                maxLength={6}
                name="subcategoryNextObjectNumber"
                onChange={(event) =>
                  updateRow(row.id, { nextObjectNumber: event.target.value })
                }
                placeholder="leer = von"
                value={row.nextObjectNumber}
              />
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-1">
              Sort.
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                name="subcategorySortOrder"
                onChange={(event) =>
                  updateRow(row.id, { sortOrder: event.target.value })
                }
                type="number"
                value={row.sortOrder}
              />
            </label>
            <div className="flex items-end justify-between gap-2 md:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                <input
                  checked={row.isActive}
                  className="h-4 w-4 rounded border-gray-300"
                  onChange={(event) =>
                    updateRow(row.id, { isActive: event.target.checked })
                  }
                  type="checkbox"
                  value={row.id}
                />
                Aktiv
              </label>
              <button
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                onClick={() => removeRow(row.id)}
                type="button"
              >
                Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
