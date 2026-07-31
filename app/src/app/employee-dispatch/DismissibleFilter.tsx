"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";

export function DismissibleFilter({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const containerRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        containerRef.current &&
        !containerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <details
      ref={containerRef}
      className={`relative ${open ? "z-[var(--z-popover)]" : ""}`}
      open={open}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
        className="inline-flex h-8 cursor-pointer list-none items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50 marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <ActionIcon name="filter" className="h-3.5 w-3.5" />
        Filter
      </summary>

      {open ? (
        <div className="absolute left-0 top-10 z-[var(--z-popover)] w-[calc(100vw-4rem)] max-w-5xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
          {children}
        </div>
      ) : null}
    </details>
  );
}
