"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function DeleteImportButton({ fileName }: { fileName: string }) {
  return (
    <ConfirmSubmitButton
      ariaLabel={`LV ${fileName} löschen`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
      confirmLabel="Löschen"
      icon="delete"
      message={`LV "${fileName}" wirklich löschen? Alle zugeordneten Positionen gehen dabei verloren.`}
      title="Löschen"
    />
  );
}
