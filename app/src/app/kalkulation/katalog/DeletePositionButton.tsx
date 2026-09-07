"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function DeletePositionButton({ title }: { title: string }) {
  return (
    <ConfirmSubmitButton
      ariaLabel={`${title} endgültig löschen`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
      confirmLabel="Endgültig löschen"
      icon="delete"
      message={`Position "${title}" endgültig löschen? Das kann nicht rückgängig gemacht werden - bereits bestätigte Preiszuordnungen in LVs bleiben erhalten, verlieren aber den Bezug zu dieser Katalogposition.`}
      title="Endgültig löschen"
    />
  );
}
