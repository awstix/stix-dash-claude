"use client";

export function MarkDetailEntryActualButton({
  action,
  id,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  projectId: string;
  reportId: string;
}) {
  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
        title="Menge ist tatsächlich verbaut - so bestätigen"
        type="submit"
      >
        ✓
      </button>
    </form>
  );
}
