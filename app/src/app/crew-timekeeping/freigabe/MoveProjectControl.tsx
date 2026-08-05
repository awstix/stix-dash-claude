"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveEntryToProject } from "../actions";

type ProjectOption = { id: string; name: string; projectNumber: string };

export function MoveProjectControl({
  entryId,
  projectId,
  projectOptions,
}: {
  entryId: string;
  projectId: string;
  projectOptions: ProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function move() {
    if (!targetId) {
      setError("Bitte eine Zielbaustelle auswählen.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await moveEntryToProject({ entryId, toProjectId: targetId });
        setOpen(false);
        setTargetId("");
        router.refresh();
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "Umschreiben fehlgeschlagen.");
      }
    });
  }

  if (!open) {
    return (
      <button
        className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-black text-gray-800 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        Auf andere Baustelle buchen
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className="rounded-lg border border-gray-500 bg-white px-2 py-2 text-xs font-bold text-gray-950"
        onChange={(event) => setTargetId(event.target.value)}
        value={targetId}
      >
        <option value="">Zielbaustelle wählen …</option>
        {projectOptions
          .filter((project) => project.id !== projectId)
          .map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
      </select>
      <button
        className="rounded-lg bg-gray-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        onClick={move}
        type="button"
      >
        Umbuchen
      </button>
      <button
        className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-black text-gray-800"
        disabled={pending}
        onClick={() => {
          setOpen(false);
          setError("");
        }}
        type="button"
      >
        Abbrechen
      </button>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
    </div>
  );
}
