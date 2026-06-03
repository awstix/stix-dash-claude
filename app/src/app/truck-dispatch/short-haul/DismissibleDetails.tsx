"use client";

import {
  useEffect,
  useRef,
  useState,
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
    if (!defaultOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOpen(true);
    }, 0);

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
      ref={detailsRef}
      open={open}
      className={className}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {children}
    </details>
  );
}
