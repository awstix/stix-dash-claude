"use client";

import { useEffect, useRef, type ReactNode } from "react";

function getDateTime(value: string) {
  return new Date(`${value}T00:00:00.000Z`).getTime();
}

function getHeaderScrollElement() {
  return document.querySelector<HTMLElement>(
    "[data-equipment-timeline-header-scroll]",
  );
}

function syncHeaderScroll(scrollLeft: number) {
  const headerElement = getHeaderScrollElement();

  if (!headerElement) {
    return;
  }

  headerElement.scrollLeft = scrollLeft;
}

function scrollToDate({
  scrollElement,
  focusDate,
}: {
  scrollElement: HTMLDivElement;
  focusDate: string;
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
          dateTime,
          distance: Number.isNaN(dateTime)
            ? Number.POSITIVE_INFINITY
            : Math.abs(dateTime - focusTime),
        };
      })
      .filter((item) => !Number.isNaN(item.dateTime));

    const targetElement =
      exactElement ??
      datedElements.sort((a, b) => a.distance - b.distance)[0]?.element ??
      null;

    if (!targetElement) {
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

export function EquipmentTimelineScroll({
  focusDate,
  children,
}: {
  focusDate: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element || !focusDate) {
      return;
    }

    scrollToDate({
      scrollElement: element,
      focusDate,
    });
  }, [focusDate]);

  return (
    <div
      ref={scrollRef}
      data-equipment-timeline-scroll-container="true"
      onScroll={(event) => syncHeaderScroll(event.currentTarget.scrollLeft)}
      className="w-full min-w-0 overflow-x-auto overflow-y-visible"
    >
      {children}
    </div>
  );
}
