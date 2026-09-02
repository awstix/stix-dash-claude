"use client";

import { ActionIcon } from "@/components/ActionIcon";

export function ArchivePositionButton({ title }: { title: string }) {
  return (
    <button
      aria-label={`${title} archivieren`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
      onClick={(event) => {
        if (!window.confirm(`Position "${title}" archivieren? Sie verschwindet dann aus dem aktiven Katalog.`)) {
          event.preventDefault();
        }
      }}
      title="Archivieren"
      type="submit"
    >
      <ActionIcon name="delete" className="h-4 w-4" />
    </button>
  );
}
