"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

export function DismissibleDetails({
  children,
  className,
  defaultOpen = false,
}: {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!defaultOpen) return;

    const timeoutId = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [defaultOpen]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;
      const target = event.target;

      if (!details || !(target instanceof Node)) return;
      if (!details.contains(target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details
      className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
      ref={detailsRef}
    >
      {children}
    </details>
  );
}

export function DismissibleDetailsCloseButton({
  className,
  label = "Schließen",
}: {
  className?: string;
  label?: string;
}) {
  function closeDetails(event: MouseEvent<HTMLButtonElement>) {
    const details = event.currentTarget.closest("details");
    if (details) {
      details.open = false;
      details.dispatchEvent(new Event("toggle", { bubbles: true }));
    }
  }

  return (
    <button
      aria-label={label}
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-xl font-semibold leading-none text-gray-700 shadow-sm hover:bg-gray-50"
      }
      onClick={closeDetails}
      type="button"
    >
      ×
    </button>
  );
}
