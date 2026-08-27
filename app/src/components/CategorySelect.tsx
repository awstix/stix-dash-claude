"use client";

import { useState } from "react";

export type CategorySelectCategory = {
  id: string;
  name: string;
  parentCategoryId: string | null;
  suffix?: string;
};

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function compareByName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, "de-DE", { numeric: true });
}

/** Erst Überkategorie, dann Unterkategorie wählen - für die lange, flache
 * Kategorieliste, die auf dem Handy zum endlosen Scrollen zwingt. Eine
 * Live-Suche daneben springt bei Eingabe direkt in eine flache
 * Trefferliste über alle Kategorien, unabhängig von der aktuellen Stufe. */
export function CategorySelect({
  categories,
  defaultValue,
  emptyLabel = "Keine Kategorie",
  name,
  placeholder = "Überkategorie wählen oder direkt suchen ...",
}: {
  categories: CategorySelectCategory[];
  defaultValue?: string | null;
  emptyLabel?: string;
  name: string;
  placeholder?: string;
}) {
  const roots = categories
    .filter((category) => !category.parentCategoryId)
    .sort(compareByName);
  const childrenByRootId = new Map<string, CategorySelectCategory[]>();
  for (const category of categories) {
    if (!category.parentCategoryId) continue;
    const siblings = childrenByRootId.get(category.parentCategoryId) ?? [];
    siblings.push(category);
    childrenByRootId.set(category.parentCategoryId, siblings);
  }
  for (const siblings of childrenByRootId.values()) {
    siblings.sort(compareByName);
  }

  function labelFor(category: CategorySelectCategory) {
    const parent = category.parentCategoryId
      ? categories.find((candidate) => candidate.id === category.parentCategoryId)
      : null;
    return parent ? `${parent.name} › ${category.name}` : category.name;
  }

  const initialCategory = categories.find((category) => category.id === defaultValue);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [selectedLabel, setSelectedLabel] = useState(
    initialCategory ? labelFor(initialCategory) : "",
  );
  const [isOpen, setIsOpen] = useState(false);
  const [rootId, setRootId] = useState<string | null>(null);

  const normalizedSearch = normalizeSearchText(search);
  const isSearching = normalizedSearch.length > 0;

  function selectCategory(category: CategorySelectCategory | null) {
    setSelectedId(category?.id ?? "");
    setSelectedLabel(category ? labelFor(category) : "");
    setIsOpen(false);
    setSearch("");
    setRootId(null);
  }

  function selectRoot(root: CategorySelectCategory) {
    const children = childrenByRootId.get(root.id) ?? [];
    if (children.length === 0) {
      selectCategory(root);
      return;
    }
    setRootId(root.id);
  }

  function openPanel() {
    setIsOpen(true);
  }

  function closePanelSoon() {
    window.setTimeout(() => setIsOpen(false), 150);
  }

  let panelContent: React.ReactNode;

  if (isSearching) {
    const matches = categories.filter((category) =>
      normalizeSearchText(labelFor(category)).includes(normalizedSearch),
    );

    panelContent = (
      <>
        <PanelHeader label="Suchergebnisse" />
        <CategoryButtonList categories={matches} getLabel={labelFor} onSelect={selectCategory} />
      </>
    );
  } else if (!rootId) {
    panelContent = (
      <>
        <PanelHeader label="Überkategorie wählen" />
        <button
          className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          onClick={() => selectCategory(null)}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {emptyLabel}
        </button>
        {roots.map((root) => {
          const childCount = (childrenByRootId.get(root.id) ?? []).length;
          return (
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              key={root.id}
              onClick={() => selectRoot(root)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <span>{root.name}</span>
              {childCount > 0 ? (
                <span className="text-xs text-gray-400">{childCount} ›</span>
              ) : null}
            </button>
          );
        })}
      </>
    );
  } else {
    const root = categories.find((category) => category.id === rootId);
    const children = childrenByRootId.get(rootId) ?? [];

    panelContent = (
      <>
        <PanelHeader label={root?.name ?? ""} onBack={() => setRootId(null)} />
        {root ? (
          <button
            className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
            onClick={() => selectCategory(root)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            — nur {root.name} (keine Unterkategorie) —
          </button>
        ) : null}
        <CategoryButtonList categories={children} onSelect={selectCategory} />
      </>
    );
  }

  return (
    <div className="relative">
      <input name={name} type="hidden" value={selectedId} />
      <input
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        onBlur={closePanelSoon}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
        onFocus={openPanel}
        placeholder={placeholder}
        value={isOpen ? search : selectedLabel || emptyLabel}
      />
      {isOpen ? (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-lg">
          {panelContent}
        </div>
      ) : null}
    </div>
  );
}

function PanelHeader({ label, onBack }: { label: string; onBack?: () => void }) {
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

function CategoryButtonList({
  categories,
  getLabel,
  onSelect,
}: {
  categories: CategorySelectCategory[];
  getLabel?: (category: CategorySelectCategory) => string;
  onSelect: (category: CategorySelectCategory) => void;
}) {
  if (categories.length === 0) {
    return <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer.</div>;
  }

  return (
    <>
      {categories.map((category) => (
        <button
          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
          key={category.id}
          onClick={() => onSelect(category)}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {getLabel ? getLabel(category) : category.name}
          {category.suffix ?? ""}
        </button>
      ))}
    </>
  );
}
