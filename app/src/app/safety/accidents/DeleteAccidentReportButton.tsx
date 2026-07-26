"use client";

export function DeleteAccidentReportButton({
  action,
  reportId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  reportId: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Unfallmeldung wirklich löschen? Die Meldung wird inklusive Versandprotokoll und Fotos aus der Anwendung entfernt.",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input name="reportId" type="hidden" value={reportId} />
      <button
        className="rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-50"
        type="submit"
      >
        Löschen
      </button>
    </form>
  );
}
