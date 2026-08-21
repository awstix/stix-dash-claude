"use client";

import { type ReactNode, useMemo, useState } from "react";
import { normalizeProjectSearchText } from "@/lib/project-filters";

type SearchableItem = {
  id: string;
  node: ReactNode;
  searchText: string;
};

export function ProjectLiveSearch({
  items,
  toolbar,
  totalCount,
}: {
  items: SearchableItem[];
  toolbar: ReactNode;
  totalCount: number;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = useMemo(() => normalizeProjectSearchText(query), [query]);
  const visibleItems = normalizedQuery
    ? items.filter((item) => item.searchText.includes(normalizedQuery))
    : items;

  return (
    <>
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Projektübersicht
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Die Projektakte bündelt künftig Karte, Personal, Geräte, Leistung,
              Fotos, Dokumente, Formulare, Notizen und Bautagesberichte je Baustelle.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-sm font-semibold text-gray-700">
            {visibleItems.length}/{totalCount} Projekte sichtbar
            {query ? ` · Live-Suche: "${query}"` : ""}
          </div>

          <div className="flex flex-wrap gap-2">{toolbar}</div>
        </div>

        <div className="mt-3">
          <input
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm outline-none focus:border-gray-900"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Live-Suche: Projektnummer, Name, Auftraggeber, Bauleiter, Adresse, Notizen, Personal, Geräte ..."
            type="search"
            value={query}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
            Keine Projekte gefunden.
          </div>
        ) : (
          visibleItems.map((item) => item.node)
        )}
      </div>
    </>
  );
}
