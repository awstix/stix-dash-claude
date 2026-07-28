"use client";

import { useMemo, useState } from "react";

export function ProjectInstructorFields({
  managerOptions,
  projects,
}: {
  managerOptions: string[];
  projects: { constructionManager: string; id: string; label: string }[];
}) {
  const [projectId, setProjectId] = useState("");
  const [instructor, setInstructor] = useState("");
  const instructors = useMemo(
    () =>
      Array.from(
        new Set([
          instructor,
          ...projects.map((project) => project.constructionManager),
          ...managerOptions,
        ]),
      ).filter(Boolean),
    [instructor, managerOptions, projects],
  );
  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm";

  return (
    <>
      <label className="block space-y-2">
        <span className="text-sm font-bold text-gray-950">Projekt</span>
        <select
          className={inputClass}
          name="projectId"
          onChange={(event) => {
            const nextProjectId = event.target.value;
            setProjectId(nextProjectId);
            const manager = projects.find(
              (project) => project.id === nextProjectId,
            )?.constructionManager;
            if (manager) setInstructor(manager);
          }}
          value={projectId}
        >
          <option value="">Ohne Projekt</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-bold text-gray-950">
          Unterwiesen durch
        </span>
        <select
          className={inputClass}
          name="instructedByName"
          onChange={(event) => setInstructor(event.target.value)}
          required
          value={instructor}
        >
          <option value="">Unterweisende Bauleitung wählen</option>
          {instructors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          onChange={(event) => setInstructor(event.target.value)}
          placeholder="Oder andere Person eintragen"
          value={instructor}
        />
        <p className="text-xs text-gray-600">
          Die dem Projekt zugeordnete Bauleitung wird automatisch
          vorausgewählt. Sie kann geändert oder durch eine andere Person
          ersetzt werden.
        </p>
      </label>
    </>
  );
}
