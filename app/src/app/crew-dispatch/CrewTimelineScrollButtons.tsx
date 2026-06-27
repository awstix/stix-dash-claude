"use client";

import Link from "next/link";

function getTimelineScrollElement(scrollContainerSelector: string) {
  return document.querySelector<HTMLElement>(scrollContainerSelector);
}

function scrollTimeline(direction: -1 | 1, scrollContainerSelector: string) {
  const scrollElement = getTimelineScrollElement(scrollContainerSelector);

  if (!scrollElement) {
    return;
  }

  const distance = Math.max(240, Math.round(scrollElement.clientWidth * 0.75));

  scrollElement.scrollBy({
    left: direction * distance,
    behavior: "smooth",
  });
}

export function CrewTimelineScrollButtons({
  leftColumnWidth,
  scrollContainerSelector = "[data-crew-timeline-scroll-container]",
  previousHref,
  nextHref,
}: {
  leftColumnWidth: number;
  scrollContainerSelector?: string;
  previousHref?: string;
  nextHref?: string;
}) {
  const buttonClassName =
    "pointer-events-auto absolute top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-lg font-bold leading-none text-gray-800 shadow-sm hover:bg-gray-50";

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-30">
      {previousHref ? (
        <Link
          href={previousHref}
          scroll={false}
          className={buttonClassName}
          style={{ left: `${leftColumnWidth - 16}px` }}
          aria-label="Zeitraum zurück"
          title="Zeitraum zurück"
        >
          ‹
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => scrollTimeline(-1, scrollContainerSelector)}
          className={buttonClassName}
          style={{ left: `${leftColumnWidth - 16}px` }}
          aria-label="Zeitstrahl nach links scrollen"
          title="Zeitstrahl nach links scrollen"
        >
          ‹
        </button>
      )}

      {nextHref ? (
        <Link
          href={nextHref}
          scroll={false}
          className={`${buttonClassName} -right-4 z-50`}
          aria-label="Zeitraum weiter"
          title="Zeitraum weiter"
        >
          ›
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => scrollTimeline(1, scrollContainerSelector)}
          className={`${buttonClassName} -right-4 z-50`}
          aria-label="Zeitstrahl nach rechts scrollen"
          title="Zeitstrahl nach rechts scrollen"
        >
          ›
        </button>
      )}
    </div>
  );
}
