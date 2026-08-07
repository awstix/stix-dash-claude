"use client";

import { useRef, useState } from "react";
import {
  buildCrewColorPalette,
  defaultCrewColor,
  isHexColor,
  normalizeCrewColor,
} from "@/lib/crew-colors";

const palette = buildCrewColorPalette();

export function CrewColorPicker({
  defaultValue,
  name,
  usedColors,
}: {
  defaultValue?: string;
  name: string;
  usedColors: { hex: string; label: string }[];
}) {
  const [value, setValue] = useState(normalizeCrewColor(defaultValue));
  const [hexDraft, setHexDraft] = useState(value);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const usedByHex = new Map<string, string[]>();
  for (const used of usedColors) {
    const hex = normalizeCrewColor(used.hex);
    usedByHex.set(hex, [...(usedByHex.get(hex) ?? []), used.label]);
  }

  function choose(hex: string) {
    setValue(hex);
    setHexDraft(hex);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function applyHexDraft(raw: string) {
    const normalized = raw.startsWith("#") ? raw : `#${raw}`;
    if (isHexColor(normalized)) {
      setValue(normalized.toLowerCase());
    }
  }

  return (
    <details className="relative" ref={detailsRef}>
      <input name={name} type="hidden" value={value} />
      <summary
        className="flex h-9 w-full cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 marker:content-none"
        title="Farbe wählen"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: value }}
        />
        <span className="truncate font-mono">{value}</span>
      </summary>

      <div className="absolute z-30 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
        <div className="grid grid-cols-10 gap-1">
          {palette.flat().map((hex) => {
            const usedLabels = usedByHex.get(hex);
            const isUsed = Boolean(usedLabels?.length);
            const isSelected = hex === value;
            return (
              <button
                className={`h-5 w-5 rounded-sm border ${
                  isSelected ? "ring-2 ring-offset-1 ring-gray-900" : "border-black/10"
                }`}
                key={hex}
                onClick={() => choose(hex)}
                style={{
                  backgroundColor: hex,
                  opacity: isUsed ? 0.45 : 1,
                }}
                title={isUsed ? `${hex} · bereits verwendet: ${usedLabels!.join(", ")}` : hex}
                type="button"
              />
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <span
            className="h-6 w-6 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: isHexColor(hexDraft) ? hexDraft : defaultCrewColor }}
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-2 py-1 font-mono text-xs text-gray-900"
            onChange={(event) => {
              setHexDraft(event.target.value);
              applyHexDraft(event.target.value);
            }}
            placeholder="#3b82f6"
            value={hexDraft}
          />
        </div>
        <p className="mt-2 text-[10px] leading-snug text-gray-500">
          Blassere Felder sind bereits einer Kolonne zugewiesen – lassen sich aber
          trotzdem mehrfach verwenden.
        </p>
      </div>
    </details>
  );
}
