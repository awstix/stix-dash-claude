"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type CrewTimelineFocusEvent = CustomEvent<{
  focusDate: string;
  crewId?: string | null;
  fallbackHref?: string | null;
}>;

function getDateTime(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function highlightCrew(crewId?: string | null) {
  const allRows = document.querySelectorAll<HTMLElement>("[data-crew-row-id]");

  allRows.forEach((row) => {
    row.classList.remove("bg-orange-50", "bg-orange-50/50", "border-orange-200");
  });

  if (!crewId) {
    return;
  }

  const targetRows = document.querySelectorAll<HTMLElement>(
    `[data-crew-row-id="${crewId}"]`
  );

  targetRows.forEach((row) => {
    row.classList.add("bg-orange-50", "border-orange-200");
  });
}

function scrollToDate({
  headerElement,
  bodyElement,
  focusDate,
  fallbackHref,
  onFallback,
}: {
  headerElement: HTMLDivElement;
  bodyElement: HTMLDivElement;
  focusDate: string;
  fallbackHref?: string | null;
  onFallback?: (href: string) => void;
}) {
  if (!focusDate) {
    return;
  }

  const focusTime = getDateTime(focusDate);

  window.requestAnimationFrame(() => {
    const exactElement = headerElement.querySelector<HTMLElement>(
      `[data-timeline-date="${focusDate}"]`
    );

    const allDateElements = Array.from(
      headerElement.querySelectorAll<HTMLElement>("[data-timeline-date]")
    );

    const datedElements = allDateElements
      .map((dateElement) => {
        const dateValue = dateElement.dataset.timelineDate;
        const dateTime = dateValue ? getDateTime(dateValue) : Number.NaN;

        return {
          element: dateElement,
          dateValue,
          dateTime,
          distance: Number.isNaN(dateTime)
            ? Number.POSITIVE_INFINITY
            : Math.abs(dateTime - focusTime),
        };
      })
      .filter((item) => !Number.isNaN(item.dateTime));

    const firstDate = datedElements[0];
    const lastDate = datedElements[datedElements.length - 1];

    const focusIsOutsideLoadedRange =
      firstDate &&
      lastDate &&
      (focusTime < firstDate.dateTime || focusTime > lastDate.dateTime);

    if (!exactElement && fallbackHref && focusIsOutsideLoadedRange) {
      onFallback?.(fallbackHref);
      return;
    }

    const targetElement =
      exactElement ??
      datedElements.sort((a, b) => a.distance - b.distance)[0]?.element ??
      null;

    if (!targetElement) {
      if (fallbackHref) {
        onFallback?.(fallbackHref);
      }

      return;
    }

    const targetLeft =
      targetElement.offsetLeft -
      Math.max(0, bodyElement.clientWidth / 2 - targetElement.clientWidth / 2);

    bodyElement.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });

    headerElement.scrollLeft = Math.max(0, targetLeft);
  });
}

export function CrewTimelineSyncedScroll({
  focusDate,
  header,
  children,
}: {
  focusDate: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const headerElement = headerScrollRef.current;
    const bodyElement = bodyScrollRef.current;

    if (!headerElement || !bodyElement || !focusDate) {
      return;
    }

    scrollToDate({
      headerElement,
      bodyElement,
      focusDate,
      onFallback: (href) => {
        router.push(href, {
          scroll: false,
        });
      },
    });
  }, [focusDate, router]);

  useEffect(() => {
    function handleFocus(event: Event) {
      const headerElement = headerScrollRef.current;
      const bodyElement = bodyScrollRef.current;

      if (!headerElement || !bodyElement) {
        return;
      }

      const customEvent = event as CrewTimelineFocusEvent;

      highlightCrew(customEvent.detail.crewId);

      scrollToDate({
        headerElement,
        bodyElement,
        focusDate: customEvent.detail.focusDate,
        fallbackHref: customEvent.detail.fallbackHref,
        onFallback: (href) => {
          router.push(href, {
            scroll: false,
          });
        },
      });
    }

    window.addEventListener("crewTimelineFocus", handleFocus);

    return () => {
      window.removeEventListener("crewTimelineFocus", handleFocus);
    };
  }, [router]);

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
        className="sticky z-30 w-full min-w-0 overflow-hidden bg-white shadow-sm"
        style={{ top: "var(--crew-dispatch-sticky-offset, 0px)" }}
      >
        {header}
      </div>

      <div
        ref={bodyScrollRef}
        onScroll={syncHeaderFromBody}
        className="w-full min-w-0 overflow-x-auto overflow-y-visible"
      >
        {children}
      </div>
    </div>
  );
}
