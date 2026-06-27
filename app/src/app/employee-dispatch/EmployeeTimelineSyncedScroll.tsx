"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function EmployeeTimelineSyncedScroll({
  children,
}: {
  children: ReactNode;
}) {
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const headerElement = document.querySelector<HTMLElement>(
      "[data-employee-timeline-header-scroll]",
    );
    const bodyElement = bodyScrollRef.current;

    if (!headerElement || !bodyElement) {
      return;
    }

    headerElement.scrollLeft = bodyElement.scrollLeft;
  }, []);

  function syncHeaderFromBody() {
    const headerElement = document.querySelector<HTMLElement>(
      "[data-employee-timeline-header-scroll]",
    );
    const bodyElement = bodyScrollRef.current;

    if (!headerElement || !bodyElement || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    headerElement.scrollLeft = bodyElement.scrollLeft;
    window.requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  }

  return (
    <div
      ref={bodyScrollRef}
      data-employee-timeline-body-scroll="true"
      onScroll={syncHeaderFromBody}
      className="w-full min-w-0 overflow-x-auto overflow-y-visible"
    >
      {children}
    </div>
  );
}
