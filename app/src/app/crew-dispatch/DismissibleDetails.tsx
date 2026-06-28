"use client";

import {
  type ButtonHTMLAttributes,
  type DetailsHTMLAttributes,
  useEffect,
  useRef,
} from "react";

type DismissibleDetailsProps = DetailsHTMLAttributes<HTMLDetailsElement>;

export function DismissibleDetails({
  children,
  ...props
}: DismissibleDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeDetails() {
      const details = detailsRef.current;

      if (details) {
        details.open = false;
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (!details?.open) return;

      const target = event.target;

      if (target instanceof Node && details.contains(target)) {
        return;
      }

      closeDetails();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDetails();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details ref={detailsRef} {...props}>
      {children}
    </details>
  );
}

export function CloseDetailsButton({
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        event.currentTarget.closest("details")?.removeAttribute("open");
      }}
    >
      {children}
    </button>
  );
}
