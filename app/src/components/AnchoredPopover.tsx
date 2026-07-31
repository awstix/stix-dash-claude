"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export function AnchoredPopover({
  align = "end",
  panelClassName,
  panel,
  trigger,
  triggerClassName,
  variant = "anchor",
}: {
  align?: "start" | "end";
  panelClassName?: string;
  panel: ReactNode;
  trigger: ReactNode;
  triggerClassName?: string;
  /** "anchor" opens right below the trigger. "center" opens near the top-center of the
   * viewport with a backdrop, giving tall panels much more room to scroll internally. */
  variant?: "anchor" | "center";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const triggerElement = triggerRef.current;
    if (!triggerElement) return;

    const panelElement = panelRef.current;
    const width = panelElement?.offsetWidth ?? 400;
    const padding = 12;

    if (variant === "center") {
      const left = Math.max(
        padding,
        Math.min((window.innerWidth - width) / 2, window.innerWidth - width - padding),
      );
      const top = Math.max(padding, window.innerHeight * 0.06);
      setPlacement({ left, top });
      return;
    }

    const rect = triggerElement.getBoundingClientRect();
    const height = panelElement?.offsetHeight ?? 300;

    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.max(padding, Math.min(left, window.innerWidth - width - padding));

    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - height - padding);
    }

    setPlacement({ left, top });
  }, [open, align, variant]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        className={triggerClassName}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              {variant === "center" ? (
                <div
                  className="fixed inset-0 z-[var(--z-modal)] bg-gray-900/40"
                  onClick={() => setOpen(false)}
                  style={{ visibility: placement ? "visible" : "hidden" }}
                />
              ) : null}
              <div
                className={panelClassName}
                ref={panelRef}
                style={{
                  left: placement?.left ?? -9999,
                  position: "fixed",
                  top: placement?.top ?? -9999,
                  visibility: placement ? "visible" : "hidden",
                }}
              >
                {panel}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
