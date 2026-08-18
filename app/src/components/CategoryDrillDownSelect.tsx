"use client";

import { useState } from "react";

export type CategoryDrillDownItem = {
  category: string;
  disabled?: boolean;
  disabledLabel?: string;
  id: string;
  label: string;
  parentCategory: string;
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/** Erst Überkategorie, dann Unterkategorie, dann die Objekte darin wählen -
 * für lange Inventarlisten, bei denen eine einzige lange (auch gruppierte)
 * Liste unübersichtlich wird. Eine Live-Suche daneben springt bei Eingabe
 * direkt in eine flache Trefferliste, unabhängig von der aktuellen Stufe. */
export function CategoryDrillDownSelect<T extends CategoryDrillDownItem>({
  hiddenInputName,
  items,
  onSelect,
  placeholder,
  required = false,
}: {
  hiddenInputName?: string;
  items: T[];
  onSelect?: (item: T) => void;
  placeholder: string;
  required?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const normalizedSearch = normalizeSearchText(search);
  const isSearching = normalizedSearch.length > 0;

  function handleSelect(item: T) {
    if (item.disabled) return;

    setSelectedId(item.id);
    setSelectedLabel(item.label);
    setIsOpen(false);
    setSearch("");
    setParentCategory(null);
    setCategory(null);
    onSelect?.(item);
  }

  function openPanel() {
    setIsOpen(true);
  }

  function closePanelSoon() {
    window.setTimeout(() => setIsOpen(false), 150);
  }

  let panelContent: React.ReactNode;

  if (isSearching) {
    const matches = items.filter((item) =>
      normalizeSearchText(`${item.parentCategory} ${item.category} ${item.label}`).includes(
        normalizedSearch,
      ),
    );

    panelContent = (
      <>
        <PanelHeader label="Suchergebnisse" />
        <ItemList items={matches} onSelect={handleSelect} />
      </>
    );
  } else if (!parentCategory) {
    const parentCategories = uniqueInOrder(items.map((item) => item.parentCategory));

    panelContent = (
      <>
        <PanelHeader label="Überkategorie wählen" />
        {parentCategories.map((name) => (
          <button
            className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            key={name}
            onClick={() => setParentCategory(name)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            {name}
          </button>
        ))}
      </>
    );
  } else if (!category) {
    const categories = uniqueInOrder(
      items
        .filter((item) => item.parentCategory === parentCategory)
        .map((item) => item.category),
    );

    panelContent = (
      <>
        <PanelHeader
          label={parentCategory}
          onBack={() => setParentCategory(null)}
        />
        {categories.map((name) => (
          <button
            className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            key={name}
            onClick={() => setCategory(name)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            {name}
          </button>
        ))}
      </>
    );
  } else {
    const categoryItems = items.filter(
      (item) => item.parentCategory === parentCategory && item.category === category,
    );

    panelContent = (
      <>
        <PanelHeader
          label={`${parentCategory} / ${category}`}
          onBack={() => setCategory(null)}
        />
        <ItemList items={categoryItems} onSelect={handleSelect} />
      </>
    );
  }

  return (
    <div className="relative">
      {hiddenInputName ? (
        <input
          name={hiddenInputName}
          required={required}
          type="hidden"
          value={selectedId}
        />
      ) : null}
      <input
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
        onBlur={closePanelSoon}
        onChange={(event) => {
          setSearch(event.target.value);
          setSelectedId("");
          setIsOpen(true);
        }}
        onFocus={openPanel}
        placeholder={placeholder}
        value={isOpen ? search : selectedLabel}
      />
      {isOpen ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-lg">
          {panelContent}
        </div>
      ) : null}
    </div>
  );
}

function PanelHeader({
  label,
  onBack,
}: {
  label: string;
  onBack?: () => void;
}) {
  return (
    <div className="sticky top-0 flex items-center gap-2 bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
      {onBack ? (
        <button
          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold normal-case text-gray-700 hover:bg-gray-50"
          onClick={onBack}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          ← zurück
        </button>
      ) : null}
      <span>{label}</span>
    </div>
  );
}

function ItemList<T extends CategoryDrillDownItem>({
  items,
  onSelect,
}: {
  items: T[];
  onSelect: (item: T) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer.</div>
    );
  }

  return (
    <>
      {items.map((item) => (
        <button
          className={
            item.disabled
              ? "block w-full cursor-not-allowed px-3 py-2 text-left text-sm text-gray-400"
              : "block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
          }
          disabled={item.disabled}
          key={item.id}
          onClick={() => onSelect(item)}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {item.disabled && item.disabledLabel ? `! ${item.disabledLabel} · ` : ""}
          {item.label}
        </button>
      ))}
    </>
  );
}
