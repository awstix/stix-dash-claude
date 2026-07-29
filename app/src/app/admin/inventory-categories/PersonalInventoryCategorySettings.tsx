"use client";

import { useState } from "react";

export function PersonalInventoryCategorySettings({
  defaultChecked,
}: {
  defaultChecked: boolean;
}) {
  const [enabled, setEnabled] = useState(defaultChecked);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <input
          checked={enabled}
          className="h-4 w-4 rounded border-gray-300"
          name="isPersonalInventory"
          onChange={(event) => setEnabled(event.currentTarget.checked)}
          type="checkbox"
        />
        Persönliches Inventar
      </label>
      {enabled ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs leading-5 text-gray-700">
          <p className="font-bold text-gray-950">Sichtbarkeit</p>
          <p className="mt-1">
            Vorgesehen für den zugewiesenen Mitarbeiter sowie Personen mit dem
            Recht „Persönliches Inventar verwalten“. Die berechtigten Personen
            werden zentral im Admin-Menü ausgewählt.
          </p>
          <p className="mt-2 font-semibold text-amber-900">
            Die technische Zugriffsbeschränkung wird aktiv, sobald
            Benutzerkonten mit Mitarbeiterakten verknüpft sind.
          </p>
        </div>
      ) : null}
    </div>
  );
}
