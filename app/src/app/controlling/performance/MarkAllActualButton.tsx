"use client";

export function MarkAllActualButton({
  action,
  count,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  count: number;
  projectId: string;
  reportId: string;
}) {
  if (count === 0) return null;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `${count} Position${count === 1 ? "" : "en"} mit Status "geschätzt" auf "tatsächlich verbaut" setzen?`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <button
        className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100"
        type="submit"
      >
        ✓ Alle geschätzt freigeben ({count})
      </button>
    </form>
  );
}
