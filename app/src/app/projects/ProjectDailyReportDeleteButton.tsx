"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { deleteProjectDailyReport } from "./actions";

export function ProjectDailyReportDeleteButton({
  dateLabel,
  isCurrentReport,
  projectId,
  reportId,
}: {
  dateLabel: string;
  isCurrentReport: boolean;
  projectId: string;
  reportId: string;
}) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function deleteReport() {
    startTransition(async () => {
      try {
        const result = await deleteProjectDailyReport({
          id: reportId,
        });

        if (!result.deleted) {
          alert("Der Bautagesbericht wurde bereits gelöscht.");
          router.refresh();
          return;
        }

        alert(`Bautagesbericht vom ${dateLabel} wurde gelöscht.`);

        if (isCurrentReport) {
          router.replace(
            `/projects/bautagesberichte?projectId=${encodeURIComponent(projectId)}`,
          );
        } else {
          router.refresh();
        }
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Bautagesbericht konnte nicht gelöscht werden.",
        );
      }
    });
  }

  if (isConfirming) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 p-1">
        <span className="px-1 text-xs font-semibold text-red-800">
          Wirklich löschen?
        </span>
        <button
          className="rounded-md bg-red-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          disabled={isPending}
          onClick={deleteReport}
          type="button"
        >
          Löschen
        </button>
        <button
          aria-label="Löschen abbrechen"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-100 disabled:opacity-60"
          disabled={isPending}
          onClick={() => setIsConfirming(false)}
          title="Löschen abbrechen"
          type="button"
        >
          <ActionIcon name="close" className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      aria-label="Bautagesbericht löschen"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
      disabled={isPending}
      onClick={() => setIsConfirming(true)}
      title="Bautagesbericht löschen"
      type="button"
    >
      <ActionIcon name="delete" className="h-4 w-4" />
    </button>
  );
}
