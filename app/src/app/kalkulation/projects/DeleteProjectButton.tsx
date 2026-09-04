"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function DeleteProjectButton({ projectNumber }: { projectNumber: string }) {
  return (
    <ConfirmSubmitButton
      ariaLabel={`Projekt ${projectNumber} löschen`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
      confirmLabel="Löschen"
      icon="delete"
      message={`Projekt "${projectNumber}" wirklich löschen? Alle zugehörigen Imports (LV, Kalkulation, kalkuliertes LV) samt Positionen gehen dabei unwiderruflich verloren.`}
      title="Projekt löschen"
    />
  );
}
