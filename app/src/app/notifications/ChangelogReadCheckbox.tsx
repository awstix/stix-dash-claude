"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markChangelogEntryRead, markChangelogEntryUnread } from "./actions";

export function ChangelogReadCheckbox({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
      <input
        checked={read}
        className="h-4 w-4 rounded border-gray-300"
        disabled={isPending}
        onChange={(event) => {
          const nextRead = event.target.checked;
          startTransition(async () => {
            await (nextRead ? markChangelogEntryRead(id) : markChangelogEntryUnread(id));
            router.refresh();
          });
        }}
        type="checkbox"
      />
      Gelesen
    </label>
  );
}
