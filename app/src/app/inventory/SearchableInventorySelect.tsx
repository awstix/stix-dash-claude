"use client";

import { useMemo, useState } from "react";

export function SearchableInventorySelect({
  defaultValue,
  label,
  name,
  options,
  placeholder = "Suchen...",
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: { id: string; name: string }[];
  placeholder?: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return options;

    return options.filter((option) =>
      option.name.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, options]);
  const selectedOption = options.find((option) => option.id === defaultValue);
  const shouldRenderSelectedOption =
    selectedOption &&
    !filteredOptions.some((option) => option.id === selectedOption.id);

  return (
    <div>
      <label className="text-sm font-semibold text-gray-800">
        {label}
        <span className="mt-1 block text-xs font-normal leading-5 text-gray-500">
          Suche nach Name oder Nummer und wähle anschließend das Containerobjekt
          aus.
        </span>
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={placeholder}
          type="search"
          value={search}
        />
      </label>
      <select
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
      >
        <option value="__none">Kein Container</option>
        {shouldRenderSelectedOption ? (
          <option value={selectedOption.id}>{selectedOption.name}</option>
        ) : null}
        {filteredOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        {filteredOptions.length} Containerobjekt
        {filteredOptions.length === 1 ? "" : "e"} gefunden.
      </p>
    </div>
  );
}
