"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { normalizeProjectSearchText } from "@/lib/project-filters";

type SidebarProject = {
  id: string;
  name: string;
  performanceReportCount: number;
  projectNumber: string;
};

const YEAR_GROUP_ORDER = ["2026", "2025", "2024", "Rest", "Sonstige"];

function getYearGroup(projectNumber: string) {
  const prefix = projectNumber.slice(0, 2);
  if (prefix === "24") return "2024";
  if (prefix === "25") return "2025";
  if (prefix === "26") return "2026";
  if (projectNumber.startsWith("9")) return "Rest";
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

  const groups = useMemo(() => {
    const query = normalizeProjectSearchText(search);
    const filtered = query
      ? projects.filter((project) =>
          normalizeProjectSearchText(
            `${project.projectNumber} ${project.name}`,
          ).includes(query),
        )
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

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">Projekt auswählen</h2>
      <input
        className="mt-3 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-900"
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Projektnummer oder Name suchen …"
        type="search"
        value={search}
      />

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Keine Projekte gefunden.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map(({ group, projects: groupProjects }) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                {group}
              </h3>
              <div className="space-y-2">
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
