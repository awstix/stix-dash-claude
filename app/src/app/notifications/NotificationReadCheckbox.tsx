"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead, markNotificationUnread } from "./actions";

export function NotificationReadCheckbox({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      checked={read}
      className="h-4 w-4 rounded border-gray-300"
      disabled={isPending}
      onChange={(event) => {
        const nextRead = event.target.checked;
        startTransition(async () => {
          await (nextRead ? markNotificationRead(id) : markNotificationUnread(id));
          router.refresh();
        });
      }}
      type="checkbox"
    />
  );
}
