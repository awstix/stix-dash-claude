"use client";

import { useMemo, useState } from "react";

const inputClassName =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

/** Search box with the filtered option list shown open at all times
 * underneath it (not a native <select>, whose dropdown stays closed
 * until clicked) - so the list visibly shrinks as you type instead of
 * having to open it first to see the effect of filtering. A hidden
 * input carries the actual selected value for the surrounding form. */
export function SearchableSelect({
  defaultValue = "",
  name,
  onValueChange,
  options,
  placeholderOption,
  required = false,
  searchPlaceholder = "Suchen...",
}: {
  defaultValue?: string;
  name: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: string }[];
  placeholderOption?: string;
  required?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedValue, setSelectedValue] = useState(defaultValue);

  function selectValue(value: string) {
    setSelectedValue(value);
    onValueChange?.(value);
  }
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, options]);
  const selectedOption = options.find((option) => option.value === selectedValue);
  const isMissingRequiredValue = required && !selectedValue;

  return (
    <div className="mt-2">
      <input name={name} type="hidden" value={selectedValue} />
      <input
        className={inputClassName}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        type="search"
        value={search}
      />
      <p
        className={`mt-1 text-xs font-semibold ${
          isMissingRequiredValue ? "text-red-600" : "text-gray-600"
        }`}
      >
        {selectedOption
          ? `Ausgewählt: ${selectedOption.label}`
          : isMissingRequiredValue
            ? `${placeholderOption ?? "Bitte auswählen"} (Pflichtfeld)`
            : (placeholderOption ?? "Nichts ausgewählt")}
      </p>
      <div
        className={`mt-2 max-h-48 overflow-y-auto rounded-xl border bg-white ${
          isMissingRequiredValue ? "border-red-300" : "border-gray-300"
        }`}
      >
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-500">Keine Treffer.</p>
        ) : (
          filteredOptions.map((option) => (
            <button
              className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-b-0 ${
                option.value === selectedValue
                  ? "bg-gray-900 font-semibold text-white"
                  : "text-gray-900 hover:bg-gray-50"
              }`}
              key={option.value}
              onClick={() => selectValue(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
