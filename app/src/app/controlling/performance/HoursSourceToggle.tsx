"use client";

import { useState } from "react";

/** Zwei sich gegenseitig ausschließende Checkboxen statt Dropdown/Radio -
 * explizit vom Nutzer so gewünscht: beide Modi sollen als eigene,
 * gleichwertig sichtbare Checkbox nebeneinander stehen, nicht als eine
 * einzelne Checkbox mit implizitem An/Aus-Zustand. */
export function HoursSourceToggle({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue === "APPROVED_TIME" ? "APPROVED_TIME" : "PLANNED");

  return (
    <div className="lg:col-span-6 grid gap-3 sm:grid-cols-2">
      <input name="hoursSource" type="hidden" value={value} />
      <label
        className={`flex items-start gap-3 rounded-2xl border p-4 ${
          value === "PLANNED"
            ? "border-blue-300 bg-blue-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <input
          checked={value === "PLANNED"}
          className="mt-1 h-4 w-4"
          onChange={() => setValue("PLANNED")}
          type="checkbox"
        />
        <span className="text-sm">
          <span className="block font-bold text-gray-900">
            Leistungsmeldung nach Disposition
          </span>
          <span className="mt-1 block text-xs text-gray-600">
            Personalstunden kommen aus der Personaleinsatzplanung, Material aus der
            Disposition.
          </span>
        </span>
      </label>
      <label
        className={`flex items-start gap-3 rounded-2xl border p-4 ${
          value === "APPROVED_TIME"
            ? "border-blue-300 bg-blue-50"
            : "border-gray-200 bg-gray-50"
        }`}
      >
        <input
          checked={value === "APPROVED_TIME"}
          className="mt-1 h-4 w-4"
          onChange={() => setValue("APPROVED_TIME")}
          type="checkbox"
        />
        <span className="text-sm">
          <span className="block font-bold text-gray-900">Leistungsmeldung nach Leistung</span>
          <span className="mt-1 block text-xs text-gray-600">
            Personalstunden kommen aus der freigegebenen Zeiterfassung (Stundenfreigabe).
            Material/Geräte werden zunächst nach Dispositionsmengen vorgeschlagen - die
            realen Mengen nach Lieferschein müssen von Bauleitung/Controlling eingetragen
            werden.
          </span>
        </span>
      </label>
    </div>
  );
}
