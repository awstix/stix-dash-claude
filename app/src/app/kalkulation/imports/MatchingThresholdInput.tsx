"use client";

import { useState } from "react";

/** Schieberegler für die Mindest-Ähnlichkeit beim Abgleich (pro Import
 * gespeichert) - niedriger = mehr, aber unsicherere Vorschläge, höher =
 * weniger, aber treffsicherere. */
export function MatchingThresholdInput({
  defaultValue = 30,
  name,
}: {
  defaultValue?: number;
  name: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block text-sm font-semibold text-gray-900">
      Abgleich-Genauigkeit: {value}%
      <input
        className="mt-2 w-full"
        max={70}
        min={5}
        name={name}
        onChange={(event) => setValue(Number(event.target.value))}
        step={5}
        type="range"
        value={value}
      />
      <div className="mt-1 flex justify-between text-xs font-normal text-gray-500">
        <span>Locker - mehr Vorschläge</span>
        <span>Streng - nur sehr ähnliche</span>
      </div>
    </label>
  );
}
