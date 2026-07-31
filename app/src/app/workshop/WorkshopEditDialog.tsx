"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "@/components/ActionIcon";

export function WorkshopEditDialog({
  children,
  orderTitle,
}: {
  children: ReactNode;
  orderTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/40 p-4"
      onMouseDown={(event) => {
        if (
          event.target instanceof Node &&
          dialogRef.current &&
          !dialogRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 text-gray-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Reparaturauftrag bearbeiten"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Reparaturauftrag bearbeiten
            </h2>
            <p className="mt-1 text-sm text-gray-600">{orderTitle}</p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            aria-label="Fenster schließen"
          >
            <ActionIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div
          onSubmit={() => {
            window.setTimeout(() => setOpen(false), 0);
          }}
        >
          {children}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        title="Auftrag bearbeiten"
        aria-label="Auftrag bearbeiten"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      >
        <ActionIcon name="edit" className="h-4 w-4" />
      </button>

      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
