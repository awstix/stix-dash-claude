"use client";

import { useState } from "react";

export type ComboOption = {
  disabled?: boolean;
  disabledLabel?: string;
  group?: string;
  id: string;
  label: string;
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Live-such-, nach Gruppe (z.B. Kategorie) sortierbares Auswahlfeld für
 * ein einzelnes Formularfeld - Ersatz für ein natives <select>, wenn die
 * Optionsliste zu lang für eine flache Dropdown wird. Setzt intern ein
 * verstecktes Feld mit dem tatsächlichen Wert, damit bestehende Server
 * Actions unverändert bleiben können. */
export function SearchableComboSelect({
  hiddenInputName,
  options,
  placeholder,
  required = false,
}: {
  hiddenInputName: string;
  options: ComboOption[];
  placeholder: string;
  required?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showList, setShowList] = useState(false);

  const normalizedSearch = normalizeSearchText(search);
  const filteredOptions = normalizedSearch
    ? options.filter((option) =>
        normalizeSearchText(`${option.group ?? ""} ${option.label}`).includes(
          normalizedSearch,
        ),
      )
    : options;

  // Grouped by first appearance rather than assuming the caller already
  // sorted options by group - keeps e.g. an employee list sorted by name
  // from fragmenting into one tiny group per name when grouped by position.
  const groupOrder: string[] = [];
  const itemsByGroup = new Map<string, ComboOption[]>();
  for (const option of filteredOptions) {
    const groupName = option.group ?? "";
    const existing = itemsByGroup.get(groupName);
    if (existing) {
      existing.push(option);
    } else {
      groupOrder.push(groupName);
      itemsByGroup.set(groupName, [option]);
    }
  }
  const groups = groupOrder.map((groupName) => ({
    group: groupName,
    items: itemsByGroup.get(groupName)!,
  }));

  function handleSelect(option: ComboOption) {
    if (option.disabled) return;

    setSelectedId(option.id);
    setSearch(option.label);
    setShowList(false);
  }

  return (
    <div className="relative">
      <input
        name={hiddenInputName}
        required={required}
        type="hidden"
        value={selectedId}
      />
      <input
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        onBlur={() => {
          window.setTimeout(() => setShowList(false), 150);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setSelectedId("");
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        placeholder={placeholder}
        value={search}
      />
      {showList ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-lg">
          {groups.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Keine Treffer.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.group || "_"}>
                {group.group ? (
                  <div className="sticky top-0 bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {group.group}
                  </div>
                ) : null}
                {group.items.map((option) => (
                  <button
                    className={
                      option.disabled
                        ? "block w-full cursor-not-allowed px-3 py-2 text-left text-sm text-gray-400"
                        : "block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                    }
                    disabled={option.disabled}
                    key={option.id}
                    onClick={() => handleSelect(option)}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    {option.disabled && option.disabledLabel
                      ? `! ${option.disabledLabel} · `
                      : ""}
                    {option.label}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
