"use client";

import { deleteInitialTest } from "./actions";

export function DeleteInitialTestButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <form
      action={deleteInitialTest}
      onSubmit={(event) => {
        if (!window.confirm(`Erstprüfung „${name}“ wirklich löschen?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      <button
        aria-label="Erstprüfung löschen"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-white text-base font-black text-red-800 hover:bg-red-50"
        title="Löschen"
        type="submit"
      >
        🗑
      </button>
    </form>
  );
}
