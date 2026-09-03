"use client";

import { useEffect, useState } from "react";
import { ActionIcon, type ActionIconName } from "@/components/ActionIcon";

/** Ersetzt window.confirm() für destruktive Form-Submit-Buttons - eigenes,
 * zum Rest der App passendes Bestätigungs-Modal statt des nativen, nicht
 * stylebaren Browser-Popups. Muss innerhalb des <form>-Elements gerendert
 * werden, das beim Bestätigen abgeschickt werden soll - der
 * "Bestätigen"-Button ist selbst type="submit" in genau diesem Formular. */
export function ConfirmSubmitButton({
  ariaLabel,
  cancelLabel = "Abbrechen",
  className,
  confirmLabel,
  icon,
  iconClassName = "h-4 w-4",
  message,
  title,
}: {
  ariaLabel: string;
  cancelLabel?: string;
  className: string;
  confirmLabel: string;
  icon: ActionIconName;
  iconClassName?: string;
  message: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button aria-label={ariaLabel} className={className} onClick={() => setOpen(true)} title={title} type="button">
        <ActionIcon className={iconClassName} name={icon} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="mt-2 text-sm text-gray-700">{message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => setOpen(false)}
                type="button"
              >
                {cancelLabel}
              </button>
              <button
                className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800"
                type="submit"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
