"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShortHaulTourTimeFromTimeline } from "./actions";

type UtilizationBlock = {
  id: string;
  label: string;
  detail?: string;
  startTime: string;
  endTime: string;
  type: "SHORT" | "LONG";
};

type UtilizationRow = {
  id: string;
  kind: "DRIVER" | "VEHICLE";
  title: string;
  subtitle: string;
  shortHaulAssignmentId?: string;
  dayDriverId?: string;
  dayVehicleId?: string;
  blocks: UtilizationBlock[];
};

type WorkTimeSettings = {
  name: string;
  startTime: string;
  endTime: string;
};

type FreeInterval = {
  start: string;
  end: string;
  minutes: number;
  startMinutes: number;
  endMinutes: number;
};

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  blockId: string;
  tourId: string;
  mode: DragMode;
  pointerStartX: number;
  trackLeft: number;
  trackWidth: number;
  initialStartMinutes: number;
  initialEndMinutes: number;
  rangeStart: number;
  rangeEnd: number;
};

type DragPreview = {
  blockId: string;
  startMinutes: number;
  endMinutes: number;
};

const fallbackWorkTime: WorkTimeSettings = {
  name: "Standard",
  startTime: "06:30",
  endTime: "17:00",
};

const dragStepMinutes = 15;
const minBlockMinutes = 15;

function timeToMinutes(value: string) {
  if (value === "24:00") {
    return 1440;
  }

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return Math.max(0, Math.min(1440, hours * 60 + minutes));
}

function minutesToTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(1440, minutes));

  if (safeMinutes === 1440) {
    return "24:00";
  }

  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(restMinutes).padStart(
    2,
    "0"
  )}`;
}

function snapMinutes(minutes: number) {
  return Math.round(minutes / dragStepMinutes) * dragStepMinutes;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTourIdFromBlockId(blockId: string) {
  const match = blockId.match(/^(driver|vehicle)-short-(.+)$/);

  if (!match) {
    return null;
  }

  return match[2];
}

function clampBlockToRange(
  block: UtilizationBlock,
  rangeStart: number,
  rangeEnd: number
) {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);

  const clippedStart = Math.max(start, rangeStart);
  const clippedEnd = Math.min(end, rangeEnd);

  if (clippedEnd <= clippedStart) {
    return null;
  }

  return {
    ...block,
    originalStart: start,
    originalEnd: end,
    clippedStart,
    clippedEnd,
  };
}

function getLeftPercentFromMinutes(
  minutes: number,
  rangeStart: number,
  rangeEnd: number
) {
  const range = Math.max(1, rangeEnd - rangeStart);
  return ((minutes - rangeStart) / range) * 100;
}

function getWidthPercentFromMinutes(
  start: number,
  end: number,
  rangeStart: number,
  rangeEnd: number
) {
  const range = Math.max(1, rangeEnd - rangeStart);
  const duration = Math.max(15, end - start);

  return (duration / range) * 100;
}

function getFreeIntervals(
  blocks: UtilizationBlock[],
  rangeStart: number,
  rangeEnd: number
): FreeInterval[] {
  const sortedBlocks = blocks
    .map((block) => clampBlockToRange(block, rangeStart, rangeEnd))
    .filter((block): block is NonNullable<typeof block> => Boolean(block))
    .map((block) => ({
      start: block.clippedStart,
      end: block.clippedEnd,
    }))
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  const mergedBlocks: { start: number; end: number }[] = [];

  for (const block of sortedBlocks) {
    const lastBlock = mergedBlocks[mergedBlocks.length - 1];

    if (!lastBlock || block.start > lastBlock.end) {
      mergedBlocks.push(block);
    } else {
      lastBlock.end = Math.max(lastBlock.end, block.end);
    }
  }

  const gaps: FreeInterval[] = [];
  let cursor = rangeStart;

  for (const block of mergedBlocks) {
    if (block.start > cursor) {
      gaps.push({
        start: minutesToTime(cursor),
        end: minutesToTime(block.start),
        minutes: block.start - cursor,
        startMinutes: cursor,
        endMinutes: block.start,
      });
    }

    cursor = Math.max(cursor, block.end);
  }

  if (cursor < rangeEnd) {
    gaps.push({
      start: minutesToTime(cursor),
      end: minutesToTime(rangeEnd),
      minutes: rangeEnd - cursor,
      startMinutes: cursor,
      endMinutes: rangeEnd,
    });
  }

  return gaps.filter((gap) => gap.minutes >= 30);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours === 0) {
    return `${restMinutes} min`;
  }

  if (restMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${restMinutes} min`;
}

function getBlockClass(type: "SHORT" | "LONG") {
  if (type === "LONG") {
    return "border-gray-900 bg-gray-900 text-white";
  }

  return "border-blue-200 bg-blue-100 text-blue-950";
}

function buildHourMarks(rangeStart: number, rangeEnd: number) {
  const marks = [rangeStart];

  const firstFullHour = Math.ceil(rangeStart / 60) * 60;

  for (let minute = firstFullHour; minute < rangeEnd; minute += 60) {
    if (!marks.includes(minute)) {
      marks.push(minute);
    }
  }

  if (!marks.includes(rangeEnd)) {
    marks.push(rangeEnd);
  }

  return marks;
}

function getDateFromBrowserUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get("date");

  if (dateParam) {
    return dateParam;
  }

  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function getPrefillHref({
  row,
  startTime,
  endTime,
  date,
}: {
  row: UtilizationRow;
  startTime: string;
  endTime: string;
  date: string;
}) {
  const params = new URLSearchParams();

  params.set("date", date);
  params.set("prefillStartTime", startTime);
  params.set("prefillEndTime", endTime);
  params.set("fromTimeline", "1");

  if (row.kind === "DRIVER") {
    params.set(
      "prefillDriverId",
      row.dayDriverId ?? row.id.replace(/^driver-/, "")
    );

    if (row.dayVehicleId) {
      params.set("prefillVehicleId", row.dayVehicleId);
    }
  }

  if (row.kind === "VEHICLE") {
    params.set(
      "prefillVehicleId",
      row.dayVehicleId ?? row.id.replace(/^vehicle-/, "")
    );

    if (row.dayDriverId) {
      params.set("prefillDriverId", row.dayDriverId);
    }
  }

  if (row.shortHaulAssignmentId) {
    params.set("editAssignmentId", row.shortHaulAssignmentId);

    return `/truck-dispatch/short-haul?${params.toString()}#assignment-${
      row.shortHaulAssignmentId
    }`;
  }

  return `/truck-dispatch/short-haul?${params.toString()}#fahrer-fahrzeug-einteilen`;
}

function getTrackFromElement(element: HTMLElement) {
  return element.closest("[data-timeline-track]") as HTMLElement | null;
}

export function UtilizationTimeline({ rows }: { rows: UtilizationRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [showFullDay, setShowFullDay] = useState(false);
  const [workTime, setWorkTime] = useState<WorkTimeSettings>(fallbackWorkTime);
  const [selectedDate, setSelectedDate] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(getDateFromBrowserUrl());
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkTime() {
      try {
        const response = await fetch("/api/work-time", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as WorkTimeSettings;

        if (isMounted && data.startTime && data.endTime) {
          setWorkTime(data);
        }
      } catch {
        // Fallback bleibt aktiv.
      }
    }

    loadWorkTime();

    return () => {
      isMounted = false;
    };
  }, []);

  const rangeStart = showFullDay ? 0 : timeToMinutes(workTime.startTime);
  const rangeEnd = showFullDay ? 1440 : timeToMinutes(workTime.endTime);
  const hourMarks = buildHourMarks(rangeStart, rangeEnd);

  const rowsWithFreeIntervals = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        visibleBlocks: row.blocks
          .map((block) => clampBlockToRange(block, rangeStart, rangeEnd))
          .filter((block): block is NonNullable<typeof block> =>
            Boolean(block)
          ),
        freeIntervals: getFreeIntervals(row.blocks, rangeStart, rangeEnd),
      })),
    [rows, rangeStart, rangeEnd]
  );

  const visibleRows = showFreeOnly
    ? rowsWithFreeIntervals.filter((row) => row.freeIntervals.length > 0)
    : rowsWithFreeIntervals;

  const freeDriverRows = rowsWithFreeIntervals.filter(
    (row) => row.kind === "DRIVER" && row.freeIntervals.length > 0
  );

  const freeVehicleRows = rowsWithFreeIntervals.filter(
    (row) => row.kind === "VEHICLE" && row.freeIntervals.length > 0
  );

  const fullyFreeRows = rowsWithFreeIntervals.filter(
    (row) => row.visibleBlocks.length === 0
  );

  function startDrag(
    event: React.PointerEvent<HTMLElement>,
    block: NonNullable<
      ReturnType<typeof clampBlockToRange>
    >,
    mode: DragMode
  ) {
    const tourId = getTourIdFromBlockId(block.id);

    if (!tourId || block.type !== "SHORT" || savingBlockId) {
      return;
    }

    const track = getTrackFromElement(event.currentTarget);

    if (!track) {
      return;
    }

    const rect = track.getBoundingClientRect();

    event.preventDefault();
    event.stopPropagation();

    setDragState({
      blockId: block.id,
      tourId,
      mode,
      pointerStartX: event.clientX,
      trackLeft: rect.left,
      trackWidth: Math.max(1, rect.width),
      initialStartMinutes: block.clippedStart,
      initialEndMinutes: block.clippedEnd,
      rangeStart,
      rangeEnd,
    });

    setDragPreview({
      blockId: block.id,
      startMinutes: block.clippedStart,
      endMinutes: block.clippedEnd,
    });
  }

  useEffect(() => {
    if (!dragState) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const range = dragState.rangeEnd - dragState.rangeStart;
      const deltaPixels = event.clientX - dragState.pointerStartX;
      const deltaMinutes = snapMinutes(
        (deltaPixels / dragState.trackWidth) * range
      );

      let nextStart = dragState.initialStartMinutes;
      let nextEnd = dragState.initialEndMinutes;

      if (dragState.mode === "move") {
        const duration = dragState.initialEndMinutes - dragState.initialStartMinutes;

        nextStart = clamp(
          dragState.initialStartMinutes + deltaMinutes,
          dragState.rangeStart,
          dragState.rangeEnd - duration
        );
        nextEnd = nextStart + duration;
      }

      if (dragState.mode === "resize-start") {
        nextStart = clamp(
          dragState.initialStartMinutes + deltaMinutes,
          dragState.rangeStart,
          dragState.initialEndMinutes - minBlockMinutes
        );
      }

      if (dragState.mode === "resize-end") {
        nextEnd = clamp(
          dragState.initialEndMinutes + deltaMinutes,
          dragState.initialStartMinutes + minBlockMinutes,
          dragState.rangeEnd
        );
      }

      setDragPreview({
        blockId: dragState.blockId,
        startMinutes: snapMinutes(nextStart),
        endMinutes: snapMinutes(nextEnd),
      });
    }

    function handlePointerUp() {
      const preview = dragPreview;

      if (!preview || preview.blockId !== dragState.blockId) {
        setDragState(null);
        setDragPreview(null);
        return;
      }

      const nextStartTime = minutesToTime(preview.startMinutes);
      const nextEndTime = minutesToTime(preview.endMinutes);
      const oldStartTime = minutesToTime(dragState.initialStartMinutes);
      const oldEndTime = minutesToTime(dragState.initialEndMinutes);

      setDragState(null);

      if (nextStartTime === oldStartTime && nextEndTime === oldEndTime) {
        setDragPreview(null);
        return;
      }

      setSavingBlockId(dragState.blockId);

      startTransition(() => {
        void (async () => {
          try {
            await updateShortHaulTourTimeFromTimeline({
              tourId: dragState.tourId,
              startTime: nextStartTime,
              endTime: nextEndTime,
            });

            router.refresh();
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Zeit konnte nicht gespeichert werden.";

            alert(message);
          } finally {
            setSavingBlockId(null);
            setDragPreview(null);
          }
        })();
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, dragPreview, router, startTransition]);

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Auslastung Fahrer & Fahrzeuge
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Zeitstrahl aktuell:{" "}
            <strong>
              {showFullDay
                ? "00:00 – 24:00"
                : `${workTime.startTime} – ${workTime.endTime}`}
            </strong>
            {showFullDay ? "" : ` · Vorlage: ${workTime.name}`}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Kurzstrecken-Balken können verschoben oder links/rechts vergrößert
            werden. Gespeichert wird beim Loslassen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFreeOnly((value) => !value)}
            className={
              showFreeOnly
                ? "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                : "rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            }
          >
            {showFreeOnly ? "Alle anzeigen" : "Freie Kapazitäten anzeigen"}
          </button>

          <button
            type="button"
            onClick={() => setShowFullDay((value) => !value)}
            className={
              showFullDay
                ? "rounded-xl bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                : "rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            }
          >
            {showFullDay
              ? "Arbeitszeit anzeigen"
              : "Vollständigen Tag anzeigen"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <MiniStat label="Zeilen" value={String(rows.length)} />
        <MiniStat label="Freie Fahrer" value={String(freeDriverRows.length)} />
        <MiniStat
          label="Freie Fahrzeuge"
          value={String(freeVehicleRows.length)}
        />
        <MiniStat
          label="Komplett frei"
          value={String(fullyFreeRows.length)}
        />
      </div>

      {showFreeOnly ? (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="text-sm font-semibold text-green-950">
            Freie mögliche Kapazitäten für Transporte
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visibleRows.length === 0 ? (
              <p className="text-sm text-green-800">
                Keine freien Kapazitäten gefunden.
              </p>
            ) : (
              visibleRows.map((row) => (
                <div
                  key={`free-${row.id}`}
                  className="rounded-xl border border-green-200 bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {row.title}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {row.subtitle}
                      </div>
                    </div>

                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      {row.kind === "DRIVER" ? "Fahrer" : "Fahrzeug"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.freeIntervals.map((interval) => (
                      <Link
                        key={`${row.id}-${interval.start}-${interval.end}`}
                        href={getPrefillHref({
                          row,
                          startTime: interval.start,
                          endTime: interval.end,
                          date: selectedDate,
                        })}
                        className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-900 hover:bg-green-100"
                      >
                        + {interval.start} – {interval.end} ·{" "}
                        {formatDuration(interval.minutes)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-gray-200">
        <div className="sticky top-0 z-50 grid grid-cols-[260px_minmax(0,1fr)] border-b border-gray-200 bg-white shadow-md">
          <div className="bg-white px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Fahrer / Fahrzeug
          </div>

          <div className="relative h-12 bg-white">
            {hourMarks.map((minute) => (
              <div
                key={minute}
                className="absolute top-3 -translate-x-1/2 whitespace-nowrap text-xs font-semibold text-gray-600"
                style={{
                  left: `${getLeftPercentFromMinutes(
                    minute,
                    rangeStart,
                    rangeEnd
                  )}%`,
                }}
              >
                {minutesToTime(minute)}
              </div>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {visibleRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[260px_minmax(0,1fr)] gap-0 bg-white"
            >
              <div className="bg-white px-3 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      row.kind === "DRIVER"
                        ? "rounded-full bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
                        : "rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800"
                    }
                  >
                    {row.kind === "DRIVER" ? "Fahrer" : "Fahrzeug"}
                  </span>

                  {row.visibleBlocks.length === 0 ? (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                      frei
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-sm font-semibold text-gray-900">
                  {row.title}
                </div>
                <div className="mt-1 text-xs leading-5 text-gray-500">
                  {row.subtitle}
                </div>
              </div>

              <div
                data-timeline-track="true"
                className="relative my-4 mr-3 h-16 rounded-xl border border-gray-200 bg-gray-50"
              >
                {hourMarks.map((minute) => (
                  <div
                    key={`${row.id}-${minute}`}
                    className="absolute top-0 h-full border-l border-gray-200"
                    style={{
                      left: `${getLeftPercentFromMinutes(
                        minute,
                        rangeStart,
                        rangeEnd
                      )}%`,
                    }}
                  />
                ))}

                {row.freeIntervals.map((interval) => (
                  <Link
                    key={`${row.id}-gap-${interval.start}-${interval.end}`}
                    href={getPrefillHref({
                      row,
                      startTime: interval.start,
                      endTime: interval.end,
                      date: selectedDate,
                    })}
                    title={`Freie Lücke einteilen: ${interval.start} – ${interval.end}`}
                    className="absolute top-3 flex h-10 items-center justify-center overflow-hidden rounded-lg border border-green-200 bg-green-50 px-2 text-xs font-semibold text-green-800 opacity-0 transition hover:opacity-100 hover:bg-green-100"
                    style={{
                      left: `${getLeftPercentFromMinutes(
                        interval.startMinutes,
                        rangeStart,
                        rangeEnd
                      )}%`,
                      width: `${getWidthPercentFromMinutes(
                        interval.startMinutes,
                        interval.endMinutes,
                        rangeStart,
                        rangeEnd
                      )}%`,
                    }}
                  >
                    + {interval.start} – {interval.end}
                  </Link>
                ))}

                {row.visibleBlocks.length === 0 ? (
                  <Link
                    href={getPrefillHref({
                      row,
                      startTime: minutesToTime(rangeStart),
                      endTime: minutesToTime(rangeEnd),
                      date: selectedDate,
                    })}
                    className="absolute inset-y-3 left-0 right-0 mx-2 flex items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 hover:bg-green-100"
                  >
                    + frei
                  </Link>
                ) : null}

                {row.visibleBlocks.map((block) => {
                  const preview =
                    dragPreview?.blockId === block.id ? dragPreview : null;

                  const displayStart = preview
                    ? preview.startMinutes
                    : block.clippedStart;
                  const displayEnd = preview ? preview.endMinutes : block.clippedEnd;

                  const editableTourId = getTourIdFromBlockId(block.id);
                  const isEditable = Boolean(editableTourId && block.type === "SHORT");
                  const isSaving = savingBlockId === block.id;

                  return (
                    <div
                      key={block.id}
                      title={`${minutesToTime(displayStart)} – ${minutesToTime(
                        displayEnd
                      )} · ${block.label}`}
                      onPointerDown={
                        isEditable
                          ? (event) => startDrag(event, block, "move")
                          : undefined
                      }
                      className={`absolute top-3 h-10 overflow-hidden rounded-lg border px-2 py-1 text-xs font-semibold shadow-sm ${
                        isEditable ? "cursor-grab touch-none active:cursor-grabbing" : ""
                      } ${getBlockClass(block.type)} ${
                        preview ? "ring-2 ring-gray-900 ring-offset-1" : ""
                      } ${isSaving ? "opacity-60" : ""}`}
                      style={{
                        left: `${getLeftPercentFromMinutes(
                          displayStart,
                          rangeStart,
                          rangeEnd
                        )}%`,
                        width: `${getWidthPercentFromMinutes(
                          displayStart,
                          displayEnd,
                          rangeStart,
                          rangeEnd
                        )}%`,
                      }}
                    >
                      {isEditable ? (
                        <div
                          onPointerDown={(event) =>
                            startDrag(event, block, "resize-start")
                          }
                          className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-white/40"
                          title="Beginn ziehen"
                        />
                      ) : null}

                      {isEditable ? (
                        <div
                          onPointerDown={(event) =>
                            startDrag(event, block, "resize-end")
                          }
                          className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-white/40"
                          title="Ende ziehen"
                        />
                      ) : null}

                      <div className="truncate">
                        {isSaving
                          ? "Speichern..."
                          : `${minutesToTime(displayStart)} – ${minutesToTime(
                              displayEnd
                            )}`}
                      </div>
                      <div className="truncate">{block.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {visibleRows.length === 0 ? (
            <div className="bg-white py-8 text-center text-sm text-gray-500">
              Keine Einträge für diese Ansicht.
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded bg-blue-100 ring-1 ring-blue-200" />
          Kurzstrecke / Tour
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded bg-gray-900" />
          Langstrecke
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-5 rounded bg-green-50 ring-1 ring-green-200" />
          frei / klickbar
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}