"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { deleteProjectDailyReport } from "./actions";

export function ProjectDailyReportDeleteButton({
  dateLabel,
  reportId,
}: {
  dateLabel: string;
  reportId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function deleteReport() {
    const confirmed = window.confirm(
      `Bautagesbericht vom ${dateLabel} wirklich löschen?`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectDailyReport({
          id: reportId,
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Bautagesbericht konnte nicht gelöscht werden.",
        );
      }
    });
  }

  return (
    <button
      aria-label="Bautagesbericht löschen"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
      disabled={isPending}
      onClick={deleteReport}
      title="Bautagesbericht löschen"
      type="button"
    >
      <ActionIcon name="delete" className="h-4 w-4" />
    </button>
  );
}
