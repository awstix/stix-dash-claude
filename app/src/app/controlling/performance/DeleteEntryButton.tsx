"use client";

import { ActionIcon } from "@/components/ActionIcon";

export function DeleteEntryButton({
  action,
  id,
  label,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label?: string;
  projectId: string;
  reportId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmText = label
          ? `„${label}" wirklich löschen?`
          : "Position wirklich löschen?";
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <button
        aria-label="Löschen"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50"
        title="Löschen"
        type="submit"
      >
        <ActionIcon className="h-4 w-4" name="delete" />
      </button>
    </form>
  );
}
