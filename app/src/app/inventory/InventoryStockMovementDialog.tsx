"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { recordInventoryStockMovement } from "./actions";

export function InventoryStockMovementDialog({
  currentProjectId,
  currentStockLabel,
  employees,
  itemId,
  itemName,
  projects,
  stockUnit,
}: {
  currentProjectId: string | null;
  currentStockLabel: string;
  employees: { firstName: string; id: string; lastName: string }[];
  itemId: string;
  itemName: string;
  projects: { id: string; name: string; projectNumber: string }[];
  stockUnit: string;
}) {
  const [open, setOpen] = useState(false);
  const [movementType, setMovementType] = useState("ISSUE");
  const isAdjustment = movementType === "ADJUSTMENT";

  return (
    <>
      <button
        aria-label={`Lagerbewegung für ${itemName} erfassen`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title="Lagerbewegung"
        type="button"
      >
        <ActionIcon name="move" className="h-4 w-4" />
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white p-6 text-gray-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Lagerbewegung
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-950">
                  {itemName}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Aktueller Bestand: {currentStockLabel}
                </p>
              </div>
              <button
                aria-label="Schließen"
                className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form
              action={recordInventoryStockMovement}
              className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
              <input name="id" type="hidden" value={itemId} />
              <label className="text-sm font-semibold text-gray-800">
                Art
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  name="movementType"
                  onChange={(event) => setMovementType(event.currentTarget.value)}
                  value={movementType}
                >
                  <option value="ISSUE">Ausgabe</option>
                  <option value="RETURN">Rücknahme</option>
                  <option value="ADJUSTMENT">Bestand korrigieren</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                {isAdjustment ? "Neuer Bestand" : "Menge"}
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  min="0"
                  name="quantity"
                  placeholder={stockUnit}
                  step="0.001"
                  type="number"
                />
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Mitarbeiter
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue="__none"
                  name="employeeId"
                >
                  <option value="__none">Nicht angegeben</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.lastName}, {employee.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Baustelle
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue={currentProjectId ?? "__none"}
                  name="projectId"
                >
                  <option value="__none">Keine Baustelle</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.projectNumber} · {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                Bemerkung
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  name="notes"
                  placeholder={
                    isAdjustment
                      ? "z.B. Inventurkorrektur"
                      : movementType === "RETURN"
                        ? "z.B. Rückgabe unbenutzt"
                        : "z.B. Ausgabe an Mitarbeiter"
                  }
                />
              </label>
              <div className="rounded-xl bg-gray-50 p-3 text-xs font-medium leading-5 text-gray-600 md:col-span-2">
                {movementType === "ISSUE"
                  ? "Ausgabe zieht die Menge vom aktuellen Bestand ab."
                  : movementType === "RETURN"
                    ? "Rücknahme bucht die Menge zum aktuellen Bestand dazu."
                    : "Bestandskorrektur setzt den aktuellen Bestand direkt auf den eingegebenen Wert."}
              </div>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  type="submit"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
