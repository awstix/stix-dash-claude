"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function CrewRowHoverDetails({
  children,
  panel,
}: {
  children: ReactNode;
  panel: ReactNode;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const panelElement = panelRef.current;
    const width = panelElement?.offsetWidth ?? 440;
    const height = panelElement?.offsetHeight ?? 260;
    const padding = 12;

    const left = Math.max(
      padding,
      Math.min(rect.left + 12, window.innerWidth - width - padding),
    );
    const top = Math.max(
      padding,
      Math.min(rect.top + 48, window.innerHeight - height - padding),
    );

    setPlacement({ left, top });
  }, [open]);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      ref={triggerRef}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[var(--z-popover)] w-[440px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-2xl"
              ref={panelRef}
              style={{
                left: placement?.left ?? -9999,
                top: placement?.top ?? -9999,
                visibility: placement ? "visible" : "hidden",
              }}
            >
              {panel}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
