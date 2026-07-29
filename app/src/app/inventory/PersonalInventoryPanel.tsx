"use client";

import { SignatureFormField } from "@/app/safety/_components/SignatureFormField";
import {
  issuePersonalInventory,
  returnPersonalInventory,
} from "./actions";
import { EmployeeSearchSelect } from "./EmployeeSearchSelect";

type Assignment = {
  employeeName: string;
  id: string;
  issuedAt: string;
  quantity: number;
  returnedQuantity: number;
};

const input =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950";

export function PersonalInventoryPanel({
  assignments,
  currentStock,
  employees,
  inventoryManagers,
  isStockManaged,
  itemId,
  stockUnit,
}: {
  assignments: Assignment[];
  currentStock: number | null;
  employees: { firstName: string; id: string; lastName: string }[];
  inventoryManagers: { firstName: string; id: string; lastName: string }[];
  isStockManaged: boolean;
  itemId: string;
  stockUnit: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-950">
        Persönliches Inventar
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Ausgabe und Rücknahme werden mit Unterschrift quittiert und automatisch
        in der Mitarbeiterakte geführt.
      </p>

      <form action={issuePersonalInventory} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <input name="itemId" type="hidden" value={itemId} />
        <label className="text-sm font-semibold text-gray-800">
          Mitarbeiter
          <EmployeeSearchSelect employees={employees} />
        </label>
        <label className="text-sm font-semibold text-gray-800">
          Menge
          <input
            className={input}
            defaultValue="1"
            max={isStockManaged ? currentStock ?? undefined : 1}
            min="0.001"
            name="quantity"
            readOnly={!isStockManaged}
            step="0.001"
            type="number"
          />
        </label>
        <label className="text-sm font-semibold text-gray-800">
          Zustand bei Ausgabe
          <input className={input} name="condition" placeholder="z. B. neu, gut" />
        </label>
        <label className="text-sm font-semibold text-gray-800">
          Ausgegeben durch
          <select className={input} defaultValue="" name="processedByEmployeeId" required>
            <option disabled value="">Berechtigte Person auswählen</option>
            {inventoryManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.lastName}, {manager.firstName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-800 md:col-span-2">
          Bemerkung / Zubehör
          <input className={input} name="notes" placeholder="z. B. Ladegerät und Hülle mitgegeben" />
        </label>
        <div className="md:col-span-2">
          <SignatureFormField
            label="Unterschrift des Mitarbeiters zur Ausgabe"
            name="signatureDataUrl"
          />
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <button className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white" type="submit">
            Ausgabe quittieren
          </button>
        </div>
      </form>

      <details className="mt-7 border-t border-gray-200 pt-5">
        <summary className="cursor-pointer font-bold text-gray-950">
          Offene Rückgaben ({assignments.length})
        </summary>
        {assignments.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Keine offenen Ausgaben.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {assignments.map((assignment) => {
              const outstanding = assignment.quantity - assignment.returnedQuantity;
              return (
                <form
                  action={returnPersonalInventory}
                  className="grid gap-3 rounded-xl border border-gray-300 p-4 md:grid-cols-2 xl:grid-cols-4"
                  key={assignment.id}
                >
                  <input name="assignmentId" type="hidden" value={assignment.id} />
                  <div>
                    <p className="font-bold text-gray-950">{assignment.employeeName}</p>
                    <p className="text-xs text-gray-600">
                      Ausgegeben am {assignment.issuedAt} · offen {outstanding} {stockUnit}
                    </p>
                  </div>
                  <label className="text-sm font-semibold text-gray-800">
                    Rückgabemenge
                    <input className={input} defaultValue={outstanding} name="quantity" readOnly type="number" />
                  </label>
                  <label className="text-sm font-semibold text-gray-800">
                    Zustand bei Rückgabe
                    <input className={input} name="condition" placeholder="z. B. vollständig, beschädigt" />
                  </label>
                  <label className="text-sm font-semibold text-gray-800">
                    Zurückgenommen durch
                    <select className={input} defaultValue="" name="processedByEmployeeId" required>
                      <option disabled value="">Berechtigte Person auswählen</option>
                      {inventoryManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.lastName}, {manager.firstName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-gray-800 md:col-span-2">
                    Bemerkung
                    <input className={input} name="notes" />
                  </label>
                  <div className="md:col-span-2">
                    <SignatureFormField
                      label="Unterschrift zur Rückgabe"
                      name="signatureDataUrl"
                    />
                  </div>
                  <div className="md:col-span-2 xl:col-span-4">
                    <button className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white" type="submit">
                      Rücknahme quittieren
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        )}
      </details>
    </section>
  );
}
