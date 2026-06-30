"use client";

import { useState } from "react";
import { recordInventoryStockMovement } from "./actions";

export function InventoryStockMovementForm({
  currentProjectId,
  employees,
  itemId,
  projects,
  stockUnit,
}: {
  currentProjectId: string | null;
  employees: { firstName: string; id: string; lastName: string }[];
  itemId: string;
  projects: { id: string; name: string; projectNumber: string }[];
  stockUnit: string;
}) {
  const [movementType, setMovementType] = useState("ISSUE");
  const isAdjustment = movementType === "ADJUSTMENT";

  return (
    <form
      action={recordInventoryStockMovement}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
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
      <div className="rounded-xl bg-gray-50 p-3 text-xs font-medium leading-5 text-gray-600 md:col-span-2 xl:col-span-6">
        {movementType === "ISSUE"
          ? `Ausgabe zieht die Menge vom aktuellen Bestand ab.`
          : movementType === "RETURN"
            ? `Rücknahme bucht die Menge zum aktuellen Bestand dazu.`
            : `Bestandskorrektur setzt den aktuellen Bestand direkt auf den eingegebenen Wert.`}
      </div>
      <div className="flex items-end xl:col-span-6">
        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Lagerbewegung speichern
        </button>
      </div>
    </form>
  );
}
