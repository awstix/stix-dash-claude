"use client";

import { useState } from "react";

/** Komma-sichere Geldeingabe für ein ansonsten serverseitig gerendertes,
 * unkontrolliertes Formular (siehe InventoryItemForm.tsx) - reines
 * text/inputMode="decimal" statt type="number", das deutsche Kommas bei
 * manchen Browsern/Tastaturen falsch interpretiert (siehe Vorfall Objekt
 * 104000: 164,10 € wurde beim Speichern zu 1641,00 €). Formatiert erst
 * beim Verlassen des Felds auf zwei Nachkommastellen, nicht bei jedem
 * Tastendruck, damit man frei weitertippen kann. Sendet den Wert als
 * normales benanntes Formularfeld (Euro-Text, z.B. "164,10") - die
 * serverseitige Auswertung (optionalMoneyCents) verarbeitet Komma und
 * Punkt bereits korrekt. */
export function InventoryMoneyField({
  defaultValueEuro,
  label,
  name,
}: {
  defaultValueEuro: number | null;
  label: string;
  name: string;
}) {
  const [text, setText] = useState(() =>
    defaultValueEuro ? formatMoneyInputValue(defaultValueEuro) : "",
  );

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <div className="relative mt-2">
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2 pr-9 text-sm text-gray-900"
          inputMode="decimal"
          name={name}
          onBlur={() => {
            setText((current) =>
              current.trim() ? formatMoneyInputValue(parseMoneyInputValue(current)) : "",
            );
          }}
          onChange={(event) => setText(event.target.value)}
          type="text"
          value={text}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
          €
        </span>
      </div>
    </label>
  );
}

function formatMoneyInputValue(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function parseMoneyInputValue(value: string) {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}
