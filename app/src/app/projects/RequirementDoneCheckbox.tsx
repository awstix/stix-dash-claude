"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProjectRequirementItem } from "./actions";

export function RequirementDoneCheckbox({
  done,
  id,
  projectId,
}: {
  done: boolean;
  id: string;
  projectId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      checked={done}
      className="h-5 w-5 rounded border-gray-300"
      disabled={isPending}
      onChange={(event) => {
        const nextDone = event.target.checked;
        startTransition(async () => {
          await toggleProjectRequirementItem({ done: nextDone, id, projectId });
          router.refresh();
        });
      }}
      type="checkbox"
    />
  );
}
