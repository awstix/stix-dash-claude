"use client";

import { useMemo, useState } from "react";

const inputClassName =
  "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

/** Native <select> with a live-filter search box above it, so long
 * option lists (vehicles, projects, ...) don't have to be scrolled
 * through by hand. The <select> stays the actual form field - the
 * search box only narrows which <option>s are rendered. */
export function SearchableSelect({
  defaultValue = "",
  name,
  options,
  placeholderOption,
  required = false,
  searchPlaceholder = "Suchen...",
}: {
  defaultValue?: string;
  name: string;
  options: { value: string; label: string }[];
  placeholderOption?: string;
  required?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return options;

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, options]);
  const selectedOption = options.find((option) => option.value === defaultValue);
  const shouldRenderSelectedOption =
    selectedOption &&
    !filteredOptions.some((option) => option.value === selectedOption.value);

  return (
    <div>
      <input
        className={inputClassName}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder={searchPlaceholder}
        type="search"
        value={search}
      />
      <select className={`${inputClassName} mt-2`} defaultValue={defaultValue} name={name} required={required}>
        {placeholderOption ? (
          <option disabled value="">
            {placeholderOption}
          </option>
        ) : null}
        {shouldRenderSelectedOption ? (
          <option value={selectedOption.value}>{selectedOption.label}</option>
        ) : null}
        {filteredOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {normalizedSearch ? (
        <p className="mt-1 text-xs text-gray-500">
          {filteredOptions.length} Treffer
        </p>
      ) : null}
    </div>
  );
}
