"use client";

export function DeleteImportButton({ fileName }: { fileName: string }) {
  return (
    <button
      className="text-xs text-red-700 underline"
      onClick={(event) => {
        if (!window.confirm(`LV "${fileName}" wirklich löschen? Alle zugeordneten Positionen gehen dabei verloren.`)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      Löschen
    </button>
  );
}
