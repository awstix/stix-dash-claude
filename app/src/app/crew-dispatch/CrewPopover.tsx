"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type CrewPopoverProps = {
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  children: ReactNode;
};

export function CrewPopover({
  trigger,
  triggerClassName = "",
  panelClassName = "",
  children,
}: CrewPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={isOpen ? { zIndex: 100000 } : undefined}
    >
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        {trigger}
      </button>

      {isOpen ? (
        <div
          className={`${panelClassName} relative pr-8`}
          style={{ zIndex: 100001 }}
          role="dialog"
          aria-modal="false"
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-2 top-2 z-50 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-sm leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fenster schließen"
            title="Fenster schließen"
          >
            ×
          </button>

          {children}
        </div>
      ) : null}
    </div>
  );
}
