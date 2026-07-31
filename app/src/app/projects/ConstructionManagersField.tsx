"use client";

import { useState } from "react";
import type { ConstructionManagerEntry } from "@/lib/construction-managers";
import type { ConstructionManagerOption } from "./ProjectCreateDialog";

export function ConstructionManagersField({
  onChange,
  options,
  value,
}: {
  onChange: (value: ConstructionManagerEntry[]) => void;
  options: ConstructionManagerOption[];
  value: ConstructionManagerEntry[];
}) {
  const [freeText, setFreeText] = useState("");

  function toggleOption(option: ConstructionManagerOption) {
    const exists = value.some((entry) => entry.employeeId === option.employeeId);
    onChange(
      exists
        ? value.filter((entry) => entry.employeeId !== option.employeeId)
        : [...value, { employeeId: option.employeeId, name: option.label }],
    );
  }

  function addFreeText() {
    const name = freeText.trim();
    if (!name) return;
    if (value.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, { employeeId: null, name }]);
    setFreeText("");
  }

  function removeEntry(index: number) {
    onChange(value.filter((_, entryIndex) => entryIndex !== index));
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">
        Bauleiter (mehrere möglich)
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value.some((entry) => entry.employeeId === option.employeeId);
          return (
            <label
              key={option.employeeId}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                checked
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              <input
                checked={checked}
                className="h-4 w-4"
                onChange={() => toggleOption(option)}
                type="checkbox"
              />
              {option.label}
              {option.positionsLabel ? ` · ${option.positionsLabel}` : ""}
            </label>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          onChange={(event) => setFreeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFreeText();
            }
          }}
          placeholder="Weiteren Bauleiter frei eintragen (z.B. extern)"
          type="text"
          value={freeText}
        />
        <button
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          onClick={addFreeText}
          type="button"
        >
          Hinzufügen
        </button>
      </div>

      {value.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((entry, index) => (
            <span
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800"
              key={`${entry.employeeId ?? "extern"}-${entry.name}-${index}`}
            >
              {entry.name}
              <button
                className="text-gray-500 hover:text-gray-900"
                onClick={() => removeEntry(index)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">Noch kein Bauleiter zugeordnet.</p>
      )}
    </div>
  );
}
