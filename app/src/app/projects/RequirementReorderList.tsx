"use client";

import { useRef, useTransition, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { reorderProjectRequirementItems } from "./actions";

export function RequirementReorderList({
  children,
  ids,
}: {
  children: ReactNode;
  ids: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const draggedId = useRef<string | null>(null);

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-requirement-id]");
    if (!target) return;
    draggedId.current = target.dataset.requirementId ?? null;
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (draggedId.current) {
      event.preventDefault();
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-requirement-id]");
    const sourceId = draggedId.current;
    const targetId = target?.dataset.requirementId;
    draggedId.current = null;
    if (!sourceId || !targetId || sourceId === targetId) return;
    event.preventDefault();

    const nextOrder = [...ids];
    const fromIndex = nextOrder.indexOf(sourceId);
    const toIndex = nextOrder.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, sourceId);

    startTransition(async () => {
      await reorderProjectRequirementItems({ ids: nextOrder });
      router.refresh();
    });
  }

  return (
    <div onDragOver={handleDragOver} onDragStart={handleDragStart} onDrop={handleDrop}>
      {children}
    </div>
  );
}
