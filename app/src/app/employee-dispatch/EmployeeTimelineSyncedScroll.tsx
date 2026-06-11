"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function EmployeeTimelineSyncedScroll({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const headerElement = headerScrollRef.current;
    const bodyElement = bodyScrollRef.current;

    if (!headerElement || !bodyElement) {
      return;
    }

    headerElement.scrollLeft = bodyElement.scrollLeft;
  }, []);

  function syncHeaderFromBody() {
    const headerElement = headerScrollRef.current;
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
    <div className="w-full min-w-0 overflow-visible">
      <div
        ref={headerScrollRef}
        data-employee-timeline-header-scroll="true"
        data-employee-timeline-sticky-header="true"
        className="sticky top-0 z-40 w-full min-w-0 overflow-hidden bg-white shadow-sm"
      >
        {header}
      </div>

      <div
        ref={bodyScrollRef}
        data-employee-timeline-body-scroll="true"
        onScroll={syncHeaderFromBody}
        className="w-full min-w-0 overflow-x-auto overflow-y-visible"
      >
        {children}
      </div>
    </div>
  );
}
