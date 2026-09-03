"use client";

import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export function ArchivePositionButton({ title }: { title: string }) {
  return (
    <ConfirmSubmitButton
      ariaLabel={`${title} archivieren`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
      confirmLabel="Archivieren"
      icon="delete"
      message={`Position "${title}" archivieren? Sie verschwindet dann aus dem aktiven Katalog.`}
      title="Archivieren"
    />
  );
}
