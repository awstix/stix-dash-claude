"use client";

export function DeletePerformanceReportButton({
  action,
  label,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  projectId: string;
  reportId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Leistungsmeldung „${label}" wirklich löschen?`)) {
          event.preventDefault();
        }
      }}
    >
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <button
        className="inline-flex rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        type="submit"
      >
        Löschen
      </button>
    </form>
  );
}
