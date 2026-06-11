"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  createEquipmentDispatchAssignmentFromDefaultDates,
  updateEquipmentDispatchAssignmentDates,
} from "./actions";

type TimelineUnitForClient = {
  key: string;
  label: string;
  subLabel: string;
  defaultStartDate: string;
  defaultEndDate: string;
};

type EquipmentAssignmentBarProps = {
  id: string;
  crewName: string;
  crewTypeValue: string | null;
  startDate: string;
  endDate: string;
  timelineUnits: TimelineUnitForClient[];
  unitCount: number;
  topOffsetPx: number;
  barClassName: string;
  readOnly?: boolean;
  supplements?: ReactNode;
  dragCreatePayload?: {
    vehicleId: string;
    projectId: string;
    crewId?: string | null;
    notes?: string | null;
  };
  children: ReactNode;
};

type CloseablePanelProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  mode: DragMode;
  pointerId: number;
  pointerStartX: number;
  initialStartDate: string;
  initialEndDate: string;
  currentStartDate: string;
  currentEndDate: string;
  durationDays: number;
  pointerStartUnitIndex: number;
  initialStartUnitIndex: number;
  hasMoved: boolean;
};

function normalizeDateValue(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return null;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function rangesOverlapInclusive(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const startATime = normalizeDateValue(startA);
  const endATime = normalizeDateValue(endA);
  const startBTime = normalizeDateValue(startB);
  const endBTime = normalizeDateValue(endB);

  if (
    startATime === null ||
    endATime === null ||
    startBTime === null ||
    endBTime === null
  ) {
    return false;
  }

  return startATime <= endBTime && endATime >= startBTime;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getVisibleGridColumn({
  startDate,
  endDate,
  timelineUnits,
}: {
  startDate: string;
  endDate: string;
  timelineUnits: TimelineUnitForClient[];
}) {
  const firstIndex = timelineUnits.findIndex((unit) =>
    rangesOverlapInclusive(
      startDate,
      endDate,
      unit.defaultStartDate,
      unit.defaultEndDate,
    ),
  );

  if (firstIndex === -1) {
    return null;
  }

  let lastIndex = firstIndex;

  for (let index = firstIndex; index < timelineUnits.length; index += 1) {
    const unit = timelineUnits[index];

    if (
      rangesOverlapInclusive(
        startDate,
        endDate,
        unit.defaultStartDate,
        unit.defaultEndDate,
      )
    ) {
      lastIndex = index;
    }
  }

  return `${firstIndex + 1} / ${lastIndex + 2}`;
}


function getVisibleUnitSpan({
  startDate,
  endDate,
  timelineUnits,
}: {
  startDate: string;
  endDate: string;
  timelineUnits: TimelineUnitForClient[];
}) {
  const firstIndex = timelineUnits.findIndex((unit) =>
    rangesOverlapInclusive(
      startDate,
      endDate,
      unit.defaultStartDate,
      unit.defaultEndDate,
    ),
  );

  if (firstIndex === -1) {
    return 0;
  }

  let lastIndex = firstIndex;

  for (let index = firstIndex; index < timelineUnits.length; index += 1) {
    const unit = timelineUnits[index];

    if (
      rangesOverlapInclusive(
        startDate,
        endDate,
        unit.defaultStartDate,
        unit.defaultEndDate,
      )
    ) {
      lastIndex = index;
    }
  }

  return Math.max(1, lastIndex - firstIndex + 1);
}

function getBarLabelRepeatCount(visibleUnitSpan: number) {
  if (visibleUnitSpan >= 14) return 6;
  if (visibleUnitSpan >= 10) return 5;
  if (visibleUnitSpan >= 7) return 4;
  if (visibleUnitSpan >= 5) return 3;
  if (visibleUnitSpan >= 3) return 2;

  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDateDiffInDays(startDateInput: string, endDateInput: string) {
  const startTime = normalizeDateValue(startDateInput);
  const endTime = normalizeDateValue(endDateInput);

  if (startTime === null || endTime === null) return 0;

  return Math.round((endTime - startTime) / 86400000);
}

function addDaysToDateInput(dateInput: string, days: number) {
  const date = new Date(`${dateInput}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return dateInput;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function dateIsAfter(first: string, second: string) {
  const firstTime = normalizeDateValue(first);
  const secondTime = normalizeDateValue(second);

  if (firstTime === null || secondTime === null) return false;

  return firstTime > secondTime;
}

function getPointerUnitIndex({
  clientX,
  wrapper,
  timelineUnits,
}: {
  clientX: number;
  wrapper: HTMLDivElement | null;
  timelineUnits: TimelineUnitForClient[];
}) {
  if (!wrapper || timelineUnits.length === 0) return null;

  const gridElement = wrapper.closest<HTMLElement>('[data-time-grid="true"]');

  if (!gridElement) return null;

  const rect = gridElement.getBoundingClientRect();
  const unitWidth = rect.width / timelineUnits.length;

  if (unitWidth <= 0) return null;

  return clamp(
    Math.floor((clientX - rect.left) / unitWidth),
    0,
    timelineUnits.length - 1,
  );
}

function getUnitIndexForDate({
  dateInput,
  timelineUnits,
}: {
  dateInput: string;
  timelineUnits: TimelineUnitForClient[];
}) {
  const index = timelineUnits.findIndex((unit) =>
    rangesOverlapInclusive(
      dateInput,
      dateInput,
      unit.defaultStartDate,
      unit.defaultEndDate,
    ),
  );

  return index === -1 ? 0 : index;
}

function getScrollContainer(wrapper: HTMLDivElement | null) {
  return wrapper?.closest<HTMLElement>(
    '[data-equipment-timeline-scroll-container="true"]',
  ) ?? null;
}

function autoScrollTimelineAtPointer({
  clientX,
  wrapper,
}: {
  clientX: number;
  wrapper: HTMLDivElement | null;
}) {
  const scrollElement = getScrollContainer(wrapper);

  if (!scrollElement) return;

  const rect = scrollElement.getBoundingClientRect();
  const edgeSize = 90;
  const scrollStep = 34;

  if (clientX > rect.right - edgeSize) {
    scrollElement.scrollLeft += scrollStep;
  } else if (clientX < rect.left + edgeSize) {
    scrollElement.scrollLeft -= scrollStep;
  }
}

function renderChildrenWithCloseButton({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="absolute right-2 top-2 z-50 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-sm leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      aria-label="Fenster schließen"
      title="Fenster schließen"
    >
      ×
    </button>
  );

  const childArray = Children.toArray(children);

  if (childArray.length === 1 && isValidElement(childArray[0])) {
    const panel = childArray[0] as ReactElement<CloseablePanelProps>;

    return cloneElement(panel, {
      className: `${panel.props.className ?? ""} relative pr-8`,
      style: { ...(panel.props.style ?? {}), zIndex: 100001 },
      children: (
        <>
          {closeButton}
          {panel.props.children}
        </>
      ),
    });
  }

  return (
    <div className="relative pr-8">
      {closeButton}
      {children}
    </div>
  );
}

export function EquipmentAssignmentBar({
  id,
  crewName,
  crewTypeValue,
  startDate,
  endDate,
  timelineUnits,
  unitCount,
  topOffsetPx,
  barClassName,
  readOnly = false,
  supplements = null,
  dragCreatePayload,
  children,
}: EquipmentAssignmentBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDateRange, setDraftDateRange] = useState<{
    endDate: string;
    startDate: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const isDateEditable =
    !readOnly && (Boolean(dragCreatePayload) || !id.startsWith("default-"));
  const displayStartDate = draftDateRange?.startDate ?? startDate;
  const displayEndDate = draftDateRange?.endDate ?? endDate;

  const gridColumn = useMemo(
    () =>
      getVisibleGridColumn({
        startDate: displayStartDate,
        endDate: displayEndDate,
        timelineUnits,
      }),
    [displayEndDate, displayStartDate, timelineUnits],
  );

  const visibleUnitSpan = useMemo(
    () =>
      getVisibleUnitSpan({
        startDate: displayStartDate,
        endDate: displayEndDate,
        timelineUnits,
      }),
    [displayEndDate, displayStartDate, timelineUnits],
  );

  const repeatLabelCount = getBarLabelRepeatCount(visibleUnitSpan);
  const dateLabel = `${formatShortDate(displayStartDate)} – ${formatShortDate(
    displayEndDate,
  )}`;
  const tooltipText = isDateEditable
    ? `${crewName} · ${dateLabel} · Ziehen = verschieben · Rand ziehen = verlängern/verkürzen`
    : `${crewName} · ${dateLabel}`;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function saveDates(nextStartDate: string, nextEndDate: string) {
    if (nextStartDate === startDate && nextEndDate === endDate && !dragCreatePayload) return;

    const formData = new FormData();
    formData.set("startDate", nextStartDate);
    formData.set("endDate", nextEndDate);

    if (dragCreatePayload) {
      formData.set("vehicleId", dragCreatePayload.vehicleId);
      formData.set("projectId", dragCreatePayload.projectId);

      if (dragCreatePayload.crewId) {
        formData.set("crewId", dragCreatePayload.crewId);
      }

      if (dragCreatePayload.notes) {
        formData.set("notes", dragCreatePayload.notes);
      }
    } else {
      formData.set("id", id);
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (dragCreatePayload) {
        await createEquipmentDispatchAssignmentFromDefaultDates(formData);
      } else {
        await updateEquipmentDispatchAssignmentDates(formData);
      }
    } catch (error) {
      setDraftDateRange(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : dragCreatePayload
            ? "Manuelle Gerätezuweisung konnte nicht erzeugt werden."
            : "Zeitraum konnte nicht gespeichert werden.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startDrag(event: React.PointerEvent<HTMLElement>, mode: DragMode) {
    if (!isDateEditable || timelineUnits.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    setIsOpen(false);
    setErrorMessage(null);

    const pointerStartUnitIndex =
      getPointerUnitIndex({
        clientX: event.clientX,
        wrapper: wrapperRef.current,
        timelineUnits,
      }) ?? 0;

    const initialStartUnitIndex = getUnitIndexForDate({
      dateInput: displayStartDate,
      timelineUnits,
    });

    dragStateRef.current = {
      mode,
      pointerId: event.pointerId,
      pointerStartX: event.clientX,
      initialStartDate: displayStartDate,
      initialEndDate: displayEndDate,
      currentStartDate: displayStartDate,
      currentEndDate: displayEndDate,
      durationDays: getDateDiffInDays(displayStartDate, displayEndDate),
      pointerStartUnitIndex,
      initialStartUnitIndex,
      hasMoved: false,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== moveEvent.pointerId) return;

      autoScrollTimelineAtPointer({
        clientX: moveEvent.clientX,
        wrapper: wrapperRef.current,
      });

      const targetIndex = getPointerUnitIndex({
        clientX: moveEvent.clientX,
        wrapper: wrapperRef.current,
        timelineUnits,
      });

      if (targetIndex === null) return;

      const movement = Math.abs(moveEvent.clientX - dragState.pointerStartX);

      if (movement > 4) {
        dragState.hasMoved = true;
      }

      const targetUnit = timelineUnits[targetIndex];
      let nextStartDate = displayStartDate;
      let nextEndDate = displayEndDate;

      if (dragState.mode === "move") {
        const unitDelta = targetIndex - dragState.pointerStartUnitIndex;
        const nextStartUnitIndex = clamp(
          dragState.initialStartUnitIndex + unitDelta,
          0,
          timelineUnits.length - 1,
        );
        const nextStartUnit = timelineUnits[nextStartUnitIndex];

        nextStartDate = nextStartUnit.defaultStartDate;
        nextEndDate = addDaysToDateInput(
          nextStartDate,
          dragState.durationDays,
        );
      }

      if (dragState.mode === "resize-start") {
        nextStartDate = targetUnit.defaultStartDate;
        nextEndDate = dragState.initialEndDate;

        if (dateIsAfter(nextStartDate, nextEndDate)) {
          nextStartDate = nextEndDate;
        }
      }

      if (dragState.mode === "resize-end") {
        nextStartDate = dragState.initialStartDate;
        nextEndDate = targetUnit.defaultEndDate;

        if (dateIsAfter(nextStartDate, nextEndDate)) {
          nextEndDate = nextStartDate;
        }
      }

      dragState.currentStartDate = nextStartDate;
      dragState.currentEndDate = nextEndDate;

      setDraftDateRange({
        endDate: nextEndDate,
        startDate: nextStartDate,
      });
    };

    const handleUp = (upEvent: PointerEvent) => {
      const dragState = dragStateRef.current;

      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      if (!dragState || dragState.pointerId !== upEvent.pointerId) {
        dragStateRef.current = null;
        return;
      }

      const moved = dragState.hasMoved;
      dragStateRef.current = null;

      if (!moved && dragState.mode === "move") {
        setIsOpen((current) => !current);
        return;
      }

      if (!moved) {
        setDraftDateRange({
          endDate: dragState.initialEndDate,
          startDate: dragState.initialStartDate,
        });
        return;
      }

      void saveDates(dragState.currentStartDate, dragState.currentEndDate);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  }

  if (!gridColumn) return null;

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-auto relative z-20 min-w-0"
      data-equipment-assignment-bar-id={id}
      data-equipment-assignment-type={crewTypeValue ?? ""}
      data-visible-unit-count={unitCount}
      style={{
        gridColumn,
        gridRow: 1,
        alignSelf: "start",
        marginTop: `${topOffsetPx}px`,
        zIndex: isOpen ? 100000 : 20,
      }}
    >
      <div className="group relative min-w-0">
        <button
          type="button"
          onPointerDown={(event) => startDrag(event, "move")}
          onClick={() => {
            if (!isDateEditable) {
              setIsOpen((current) => !current);
            }
          }}
          className={`${barClassName} flex min-h-[44px] w-full min-w-0 touch-none select-none items-center overflow-hidden text-left hover:brightness-95 ${
            isDateEditable ? "cursor-grab active:cursor-grabbing" : ""
          } ${isSaving ? "opacity-70" : ""}`}
          aria-expanded={isOpen}
          title={tooltipText}
        >
          <span className="flex w-full min-w-0 items-center gap-4 overflow-hidden">
            {Array.from({ length: repeatLabelCount }).map((_, index) => (
              <span
                key={`${id}-label-${index}`}
                className={
                  repeatLabelCount > 1
                    ? "min-w-[150px] flex-1 overflow-hidden border-l border-current/20 pl-3 first:border-l-0 first:pl-0"
                    : "max-w-full flex-1 overflow-hidden"
                }
              >
                <span className="block max-w-full truncate leading-tight">
                  {crewName}
                </span>
                <span className="mt-0.5 block max-w-full truncate font-medium leading-tight opacity-80">
                  {dateLabel}
                </span>
              </span>
            ))}
          </span>
        </button>

        {!isOpen ? (
          <div className="pointer-events-none absolute left-0 top-full z-[100002] mt-2 hidden w-[360px] max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-xl group-hover:block">
            <div className="font-bold text-gray-900">{crewName}</div>
            <div className="mt-1 text-gray-600">{dateLabel}</div>
            {isDateEditable ? (
              <div className="mt-2 text-[11px] font-semibold text-gray-500">
                Gerätebalken ziehen = verschieben · linken/rechten Rand ziehen =
                verlängern oder verkürzen
                {dragCreatePayload ? " · wird als manuelle Gerätedisposition übernommen" : ""}
              </div>
            ) : null}
          </div>
        ) : null}

        {isDateEditable ? (
          <>
            <button
              type="button"
              onPointerDown={(event) => startDrag(event, "resize-start")}
              className="absolute left-0 top-0 h-full w-4 touch-none cursor-ew-resize rounded-l-lg border-l-2 border-white/70 bg-black/0 hover:bg-black/10"
              aria-label="Gerätebeginn verschieben"
              title="Beginn ziehen zum Verkürzen/Verlängern"
            />
            <button
              type="button"
              onPointerDown={(event) => startDrag(event, "resize-end")}
              className="absolute right-0 top-0 h-full w-4 touch-none cursor-ew-resize rounded-r-lg border-r-2 border-white/70 bg-black/0 hover:bg-black/10"
              aria-label="Geräteende verschieben"
              title="Ende ziehen zum Verkürzen/Verlängern"
            />
          </>
        ) : null}
      </div>

      {supplements ? (
        <div className="pointer-events-auto mt-1 space-y-1">{supplements}</div>
      ) : null}

      {errorMessage ? (
        <div className="absolute left-0 top-full z-[100002] mt-1 max-w-[360px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 shadow-lg">
          {errorMessage}
        </div>
      ) : null}

      {isOpen
        ? renderChildrenWithCloseButton({
            children,
            onClose: () => setIsOpen(false),
          })
        : null}
    </div>
  );
}
