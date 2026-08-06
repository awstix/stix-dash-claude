"use client";

import { ActionIcon } from "@/components/ActionIcon";
import { removeInitialTestPdf } from "./actions";

export function RemoveInitialTestPdfButton({ id }: { id: string }) {
  return (
    <form
      action={removeInitialTestPdf}
      onSubmit={(event) => {
        if (!window.confirm("Hinterlegtes PDF wirklich entfernen?")) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      <button
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-50"
        type="submit"
      >
        <ActionIcon name="delete" className="h-4 w-4" />
        PDF entfernen
      </button>
    </form>
  );
}
