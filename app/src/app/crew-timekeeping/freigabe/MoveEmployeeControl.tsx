"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveEmployeesToProject } from "../actions";

type ProjectOption = { id: string; name: string; projectNumber: string };

export function MoveEmployeeControl({
  employeeId,
  entryId,
  projectId,
  projectOptions,
}: {
  employeeId: string;
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
        await moveEmployeesToProject({ employeeIds: [employeeId], entryId, toProjectId: targetId });
        setOpen(false);
        setTargetId("");
        router.refresh();
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "Umbuchen fehlgeschlagen.");
      }
    });
  }

  if (!open) {
    return (
      <button
        className="text-left text-xs font-black text-purple-800 hover:underline"
        onClick={() => setOpen(true)}
        type="button"
      >
        → andere Baustelle
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        className="rounded-lg border border-gray-500 bg-white px-2 py-1.5 text-xs font-bold text-gray-950"
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
      <div className="flex gap-1">
        <button
          className="rounded-lg bg-purple-800 px-2 py-1 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={move}
          type="button"
        >
          Umbuchen
        </button>
        <button
          className="rounded-lg border border-gray-400 bg-white px-2 py-1 text-xs font-black text-gray-800"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          type="button"
        >
          Abbrechen
        </button>
      </div>
      {error ? <span className="text-xs font-black text-red-700">Fehler: {error}</span> : null}
    </div>
  );
}
