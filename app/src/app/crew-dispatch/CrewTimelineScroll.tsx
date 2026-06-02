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

function getHeaderScrollElement() {
  return document.querySelector<HTMLElement>(
    "[data-crew-timeline-header-scroll]",
  );
}

function syncHeaderScroll(scrollLeft: number) {
  const headerElement = getHeaderScrollElement();

  if (!headerElement) {
    return;
  }

  headerElement.scrollLeft = scrollLeft;
}

function highlightCrew(crewId?: string | null) {
  const allRows = document.querySelectorAll<HTMLElement>("[data-crew-row-id]");

  allRows.forEach((row) => {
    row.classList.remove(
      "bg-orange-50",
      "bg-orange-50/50",
      "border-orange-200",
    );
  });

  if (!crewId) {
    return;
  }

  const targetRows = document.querySelectorAll<HTMLElement>(
    `[data-crew-row-id="${crewId}"]`,
  );

  targetRows.forEach((row) => {
    row.classList.add("bg-orange-50", "border-orange-200");
  });
}

function scrollToDate({
  scrollElement,
  focusDate,
  fallbackHref,
  onFallback,
}: {
  scrollElement: HTMLDivElement;
  focusDate: string;
  fallbackHref?: string | null;
  onFallback?: (href: string) => void;
}) {
  if (!focusDate) {
    return;
  }

  const focusTime = getDateTime(focusDate);

  window.requestAnimationFrame(() => {
    const headerElement = getHeaderScrollElement();
    const searchRoot = headerElement ?? scrollElement;

    const exactElement = searchRoot.querySelector<HTMLElement>(
      `[data-timeline-date="${focusDate}"]`,
    );

    const allDateElements = Array.from(
      searchRoot.querySelectorAll<HTMLElement>("[data-timeline-date]"),
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
      Math.max(
        0,
        scrollElement.clientWidth / 2 - targetElement.clientWidth / 2,
      );

    const nextScrollLeft = Math.max(0, targetLeft);

    scrollElement.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    });

    syncHeaderScroll(nextScrollLeft);
  });
}

export function CrewTimelineScroll({
  focusDate,
  children,
}: {
  focusDate: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element || !focusDate) {
      return;
    }

    scrollToDate({
      scrollElement: element,
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
      const element = scrollRef.current;

      if (!element) {
        return;
      }

      const customEvent = event as CrewTimelineFocusEvent;

      highlightCrew(customEvent.detail.crewId);

      scrollToDate({
        scrollElement: element,
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

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => syncHeaderScroll(event.currentTarget.scrollLeft)}
      className="w-full min-w-0 overflow-x-auto overflow-y-visible"
    >
      {children}
    </div>
  );
}
