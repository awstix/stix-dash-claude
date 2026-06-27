"use client";

function getTimelineScrollElement() {
  return document.querySelector<HTMLElement>(
    "[data-crew-timeline-scroll-container]",
  );
}

function scrollTimeline(direction: -1 | 1) {
  const scrollElement = getTimelineScrollElement();

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
}: {
  leftColumnWidth: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-30">
      <button
        type="button"
        onClick={() => scrollTimeline(-1)}
        className="pointer-events-auto absolute top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-lg font-bold leading-none text-gray-800 shadow-sm hover:bg-gray-50"
        style={{ left: `${leftColumnWidth - 16}px` }}
        aria-label="Zeitstrahl nach links scrollen"
        title="Zeitstrahl nach links scrollen"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => scrollTimeline(1)}
        className="pointer-events-auto absolute -right-4 top-1/2 z-50 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-lg font-bold leading-none text-gray-800 shadow-sm hover:bg-gray-50"
        aria-label="Zeitstrahl nach rechts scrollen"
        title="Zeitstrahl nach rechts scrollen"
      >
        ›
      </button>
    </div>
  );
}
