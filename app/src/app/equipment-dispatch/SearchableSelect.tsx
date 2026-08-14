"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const inputClassName =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

/** Search box that only opens its filtered option list while focused/in
 * use (like a normal combobox) - collapses back down once you pick an
 * option or click away, so the field looks like a compact input at rest
 * instead of permanently taking up space for the whole list. A hidden
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
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  function selectValue(value: string) {
    setSelectedValue(value);
    onValueChange?.(value);
    setSearch("");
    setIsOpen(false);
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

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="mt-2" ref={wrapperRef}>
      <input name={name} type="hidden" value={selectedValue} />
      <input
        className={inputClassName}
        onChange={(event) => setSearch(event.currentTarget.value)}
        onFocus={() => setIsOpen(true)}
        placeholder={selectedOption?.label ?? searchPlaceholder}
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
      {isOpen ? (
        <div
          className={`mt-2 max-h-48 overflow-y-auto rounded-xl border bg-white shadow-lg ${
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
      ) : null}
    </div>
  );
}
