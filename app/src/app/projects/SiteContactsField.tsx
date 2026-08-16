"use client";

import { useMemo, useState } from "react";
import type { SiteContactEntry } from "@/lib/construction-managers";
import type { SiteContactOption } from "@/lib/construction-manager-options";

/** Picker for the Baufeld "Kontaktpersonen": choose a category (Abteilung)
 * then an employee within it, or search by name directly across all
 * employees - either way, "+" adds the pending pick to the chip list. */
export function SiteContactsField({
  onChange,
  options,
  value,
}: {
  onChange: (value: SiteContactEntry[]) => void;
  options: SiteContactOption[];
  value: SiteContactEntry[];
}) {
  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");

  const categories = useMemo(
    () =>
      Array.from(new Set(options.map((option) => option.category))).sort((a, b) =>
        a.localeCompare(b, "de-DE"),
      ),
    [options],
  );
  const employeesInCategory = useMemo(
    () => options.filter((option) => option.category === category),
    [category, options],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    return options
      .filter((option) => option.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 8);
  }, [normalizedSearch, options]);
  const pendingOption = options.find((option) => option.employeeId === employeeId);

  function addContact(option: SiteContactOption | undefined) {
    if (!option) return;
    if (value.some((entry) => entry.employeeId === option.employeeId)) return;
    onChange([...value, { employeeId: option.employeeId, name: option.name }]);
    setEmployeeId("");
    setSearch("");
  }

  function removeContact(entryEmployeeId: string) {
    onChange(value.filter((entry) => entry.employeeId !== entryEmployeeId));
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-700">Kontaktpersonen</label>
      <p className="mt-1 text-xs text-gray-500">
        Erscheinen mit Handynummer auf der Wegbeschreibung als PDF.
      </p>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          onChange={(event) => {
            setCategory(event.target.value);
            setEmployeeId("");
          }}
          value={category}
        >
          <option value="">Kategorie wählen</option>
          {categories.map((categoryOption) => (
            <option key={categoryOption} value={categoryOption}>
              {categoryOption}
            </option>
          ))}
        </select>
        <select
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
          disabled={!category}
          onChange={(event) => setEmployeeId(event.target.value)}
          value={employeeId}
        >
          <option value="">Mitarbeiter wählen</option>
          {employeesInCategory.map((option) => (
            <option key={option.employeeId} value={option.employeeId}>
              {option.name}
              {option.positionsLabel ? ` · ${option.positionsLabel}` : ""}
            </option>
          ))}
        </select>
        <button
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          disabled={!pendingOption}
          onClick={() => addContact(pendingOption)}
          type="button"
        >
          + Hinzufügen
        </button>
      </div>

      <div className="mt-2">
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Oder direkt nach Namen suchen..."
          type="search"
          value={search}
        />
        {searchResults.length > 0 ? (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-lg">
            {searchResults.map((option) => (
              <button
                className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-gray-900 last:border-b-0 hover:bg-gray-50"
                key={option.employeeId}
                onClick={() => addContact(option)}
                type="button"
              >
                {option.name}{" "}
                <span className="text-gray-500">
                  · {option.category}
                  {option.positionsLabel ? ` · ${option.positionsLabel}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {value.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((entry) => (
            <span
              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800"
              key={entry.employeeId}
            >
              {entry.name}
              <button
                className="text-gray-500 hover:text-gray-900"
                onClick={() => removeContact(entry.employeeId)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">Noch keine Kontaktperson hinzugefügt.</p>
      )}
    </div>
  );
}
