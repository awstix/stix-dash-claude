"use client";

import { useState, type ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";

export function WorkTimeModalButton({
  buttonClassName,
  children,
  label,
  title,
}: {
  buttonClassName?: string;
  children: ReactNode;
  label: string;
  title?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={
          buttonClassName ??
          "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        }
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {label}
      </button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/45 p-4"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">{title ?? label}</h2>
              <button
                aria-label="Schließen"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
