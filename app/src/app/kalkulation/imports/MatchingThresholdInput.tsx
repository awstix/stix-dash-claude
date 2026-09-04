"use client";

import { useState } from "react";

/** Schieberegler für eine Mindest-Ähnlichkeit (0-100%, pro Import
 * gespeichert) - niedriger = mehr, aber unsicherere Vorschläge, höher =
 * weniger, aber treffsicherere. Wiederverwendet für den Katalog-Abgleich
 * ("Abgleich-Genauigkeit") und die getrennten Kurztext-/Langtext-Kriterien
 * bei "Ähnlich in anderen LVs". */
export function MatchingThresholdInput({
  defaultValue = 30,
  label = "Abgleich-Genauigkeit",
  looseLabel = "Locker - mehr Vorschläge",
  max = 70,
  min = 5,
  name,
  strictLabel = "Streng - nur sehr ähnliche",
}: {
  defaultValue?: number;
  label?: string;
  looseLabel?: string;
  max?: number;
  min?: number;
  name: string;
  strictLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block text-sm font-semibold text-gray-900">
      {label}: {value}%
      <input
        className="mt-2 w-full"
        max={max}
        min={min}
        name={name}
        onChange={(event) => setValue(Number(event.target.value))}
        step={5}
        type="range"
        value={value}
      />
      <div className="mt-1 flex justify-between text-xs font-normal text-gray-500">
        <span>{looseLabel}</span>
        <span>{strictLabel}</span>
      </div>
    </label>
  );
}
