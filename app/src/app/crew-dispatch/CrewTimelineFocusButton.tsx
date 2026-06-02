"use client";

import { ReactNode } from "react";

export function CrewTimelineFocusButton({
  focusDate,
  crewId,
  fallbackHref,
  className,
  children,
  title,
}: {
  focusDate: string;
  crewId?: string;
  fallbackHref?: string;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  function handleClick() {
    window.dispatchEvent(
      new CustomEvent("crewTimelineFocus", {
        detail: {
          focusDate,
          crewId: crewId ?? null,
          fallbackHref: fallbackHref ?? null,
        },
      })
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
}