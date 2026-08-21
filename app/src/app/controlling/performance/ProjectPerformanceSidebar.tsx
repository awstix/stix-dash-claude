"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { normalizeProjectSearchText } from "@/lib/project-filters";

type SidebarProject = {
  id: string;
  name: string;
  performanceReportCount: number;
  projectNumber: string;
  searchText: string;
};

const YEAR_GROUP_ORDER = [
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "Vor 2022",
  "Rest",
  "Sonstige",
];

function getYearGroup(projectNumber: string) {
  if (projectNumber.startsWith("9")) return "Rest";

  const prefix = Number(projectNumber.slice(0, 2));
  if (!Number.isInteger(prefix)) return "Sonstige";
  if (prefix >= 22 && prefix <= 26) return String(2000 + prefix);
  if (prefix >= 0 && prefix < 22) return "Vor 2022";

  return "Sonstige";
}

export function ProjectPerformanceSidebar({
  activeProjectId,
  projects,
}: {
  activeProjectId: string | null;
  projects: SidebarProject[];
}) {
  const [search, setSearch] = useState("");
  // Collapsed by default - only the year holding the currently active
  // project starts open, so switching projects doesn't bury you in every
  // other year's list. Toggling is remembered per group; while a search
  // is active, every group with a match force-opens regardless of this
  // (handled below, not stored here) so results are never hidden behind
  // a collapsed year.
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const activeProject = projects.find((project) => project.id === activeProjectId);
    return new Set(activeProject ? [getYearGroup(activeProject.projectNumber)] : []);
  });

  const isSearching = search.trim().length > 0;

  const groups = useMemo(() => {
    const query = normalizeProjectSearchText(search);
    const filtered = query
      ? projects.filter((project) => project.searchText.includes(query))
      : projects;

    const byGroup = new Map<string, SidebarProject[]>();
    for (const project of filtered) {
      const group = getYearGroup(project.projectNumber);
      const entries = byGroup.get(group) ?? [];
      entries.push(project);
      byGroup.set(group, entries);
    }

    return YEAR_GROUP_ORDER.map((group) => ({
      group,
      projects: byGroup.get(group) ?? [],
    })).filter((entry) => entry.projects.length > 0);
  }, [projects, search]);

  function toggleGroup(group: string, open: boolean) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (open) next.add(group);
      else next.delete(group);
      return next;
    });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">Projekt auswählen</h2>
      <input
        className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-900"
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Nummer, Name, Auftraggeber, Bauleiter, Adresse, Notizen …"
        type="search"
        value={search}
      />

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Keine Projekte gefunden.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {groups.map(({ group, projects: groupProjects }) => (
            <details
              className="group"
              key={group}
              onToggle={(event) => toggleGroup(group, event.currentTarget.open)}
              open={isSearching || openGroups.has(group)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-1 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-800">
                <span>
                  {group} · {groupProjects.length}
                </span>
                <span className="text-gray-400 transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                {groupProjects.map((project) => {
                  const active = project.id === activeProjectId;
                  return (
                    <Link
                      className={`block rounded-xl border px-3 py-3 text-sm ${
                        active
                          ? "border-gray-900 bg-gray-950 text-white"
                          : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                      }`}
                      href={`/controlling/performance?projectId=${project.id}`}
                      key={project.id}
                      scroll={false}
                    >
                      <span className="block font-semibold">
                        {project.projectNumber} · {project.name}
                      </span>
                      <span className={active ? "text-gray-200" : "text-gray-500"}>
                        {project.performanceReportCount} Leistungsmeldung(en)
                      </span>
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
