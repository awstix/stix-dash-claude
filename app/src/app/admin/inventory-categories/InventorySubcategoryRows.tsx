"use client";

import { useState } from "react";

type SubcategoryRow = {
  asphaltDispositionUsage: string;
  dailyReportMachineLabel: string;
  id: string;
  isExisting: boolean;
  name: string;
  nextObjectNumber: string;
  objectNumberEnd: string;
  objectNumberStart: string;
  sortOrder: string;
  isActive: boolean;
  useInSpecialVehicleDisposition: boolean;
  useInTeamManagement: boolean;
  useInEmployeeFile: boolean;
  useInTruckDispatchSelection: boolean;
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
        asphaltDispositionUsage: "NONE",
        dailyReportMachineLabel: "",
        id: `new-${crypto.randomUUID()}`,
        isActive: true,
        isExisting: false,
        name: "",
        nextObjectNumber: "",
        objectNumberEnd: "",
        objectNumberStart: "",
        sortOrder: "",
        useInSpecialVehicleDisposition: false,
        useInTeamManagement: false,
        useInEmployeeFile: false,
        useInTruckDispatchSelection: false,
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
              name="subcategoryAsphaltDispositionUsage"
              type="hidden"
              value={row.asphaltDispositionUsage}
            />
            <input
              name="subcategoryDailyReportMachineLabel"
              type="hidden"
              value={row.dailyReportMachineLabel}
            />
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
            <input
              name="subcategoryUseInSpecialVehicleDisposition"
              type="hidden"
              value={row.useInSpecialVehicleDisposition ? "1" : "0"}
            />
            <input
              name="subcategoryUseInTeamManagement"
              type="hidden"
              value={row.useInTeamManagement ? "1" : "0"}
            />
            <input
              name="subcategoryUseInEmployeeFile"
              type="hidden"
              value={row.useInEmployeeFile ? "1" : "0"}
            />
            <input
              name="subcategoryUseInTruckDispatchSelection"
              type="hidden"
              value={row.useInTruckDispatchSelection ? "1" : "0"}
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
                placeholder="auto"
                type="number"
                value={row.sortOrder}
              />
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-3">
              Asphalt-Verwendung
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                onChange={(event) =>
                  updateRow(row.id, {
                    asphaltDispositionUsage: event.target.value,
                  })
                }
                value={row.asphaltDispositionUsage}
              >
                <option value="NONE">Keine</option>
                <option value="ASPHALT_MIX">Asphaltsorte</option>
                <option value="TACK_COAT">Anspritzmittel</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-700 md:col-span-3">
              Zuordnung im BTB
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                onChange={(event) =>
                  updateRow(row.id, {
                    dailyReportMachineLabel: event.target.value,
                  })
                }
                value={row.dailyReportMachineLabel}
              >
                <option value="">Automatisch / Hauptkategorie</option>
                {dailyReportMachineLabelOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end justify-between gap-2 md:col-span-3">
              <div className="mb-1 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
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
                <label className="flex items-center gap-2 text-xs font-semibold text-purple-800">
                  <input
                    checked={row.useInSpecialVehicleDisposition}
                    className="h-4 w-4 rounded border-gray-300"
                    onChange={(event) =>
                      updateRow(row.id, {
                        useInSpecialVehicleDisposition: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Sonderfahrzeug
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-cyan-800">
                  <input
                    checked={row.useInTeamManagement}
                    className="h-4 w-4 rounded border-gray-300"
                    onChange={(event) =>
                      updateRow(row.id, {
                        useInTeamManagement: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Teams wählbar
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <input
                    checked={row.useInEmployeeFile}
                    className="h-4 w-4 rounded border-gray-300"
                    onChange={(event) =>
                      updateRow(row.id, {
                        useInEmployeeFile: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Personalakte
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-sky-800">
                  <input
                    checked={row.useInTruckDispatchSelection}
                    className="h-4 w-4 rounded border-gray-300"
                    onChange={(event) =>
                      updateRow(row.id, {
                        useInTruckDispatchSelection: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Fahrer-Fahrzeug-Zuordnung
                </label>
              </div>
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

const dailyReportMachineLabelOptions = [
  "Mobilbagger",
  "Kettenbagger",
  "LKW 2-Achser",
  "LKW 3-Achser",
  "LKW 4-Achser",
  "LKW Abrollkipper",
  "LKW Sattelzug",
  "Planierraupe",
  "Grader",
  "Erdbauwalze / Walzenzug",
  "Radlader",
  "Kompressor",
] as const;
