"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteChangelogEntry } from "./actions";

export function ChangelogDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="text-xs font-semibold text-gray-400 hover:text-red-600 disabled:opacity-50"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Diesen Eintrag löschen?")) return;
        startTransition(async () => {
          await deleteChangelogEntry(id);
          router.refresh();
        });
      }}
      type="button"
    >
      Löschen
    </button>
  );
}
