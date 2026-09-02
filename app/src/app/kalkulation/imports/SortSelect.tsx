"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { label: "Neueste zuerst", value: "newest" },
  { label: "Älteste zuerst", value: "oldest" },
  { label: "Projektnummer aufsteigend", value: "project_asc" },
  { label: "Projektnummer absteigend", value: "project_desc" },
];

/** Sortierung wie LiveSearchInput direkt über die URL - kein Submit-Button
 * nötig, ändert sich sofort beim Auswählen. */
export function SortSelect({ paramName = "sort" }: { paramName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "newest";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next && next !== "newest") {
      params.set(paramName, next);
    } else {
      params.delete(paramName);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
      onChange={(event) => handleChange(event.target.value)}
      value={value}
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
