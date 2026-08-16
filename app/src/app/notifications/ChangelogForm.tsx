"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChangelogEntry } from "./actions";

export function ChangelogForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function submit() {
    startTransition(async () => {
      try {
        await createChangelogEntry({ description, title });
        setTitle("");
        setDescription("");
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Fehler beim Speichern.");
      }
    });
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <label className="text-xs font-semibold text-gray-700">Titel</label>
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        onChange={(event) => setTitle(event.target.value)}
        placeholder="z. B. Wegbeschreibung als PDF"
        type="text"
        value={title}
      />
      <label className="mt-2 block text-xs font-semibold text-gray-700">
        Beschreibung (optional)
      </label>
      <textarea
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Was genau wurde angepasst/verändert?"
        rows={2}
        value={description}
      />
      <div className="mt-2 flex justify-end">
        <button
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          disabled={isPending || !title.trim()}
          onClick={submit}
          type="button"
        >
          {isPending ? "Speichert..." : "Eintrag hinzufügen"}
        </button>
      </div>
    </div>
  );
}
