"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TooltipPosition = {
  left: number;
  top: number;
};

type CrewTimelineMouseTooltipProps = {
  className?: string;
  style?: CSSProperties;
  label: string;
  text: string;
  extraCount?: number;
  disabled?: boolean;
  estimatedWidth?: number;
  estimatedHeight?: number;
  clickTitle?: string;
  clickText?: string;
  clickHint?: string;
  children: ReactNode;
};

function getTooltipPosition({
  clientX,
  clientY,
  estimatedWidth = 420,
  estimatedHeight = 180,
}: {
  clientX: number;
  clientY: number;
  estimatedWidth?: number;
  estimatedHeight?: number;
}) {
  const padding = 12;
  const offset = 14;
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;

  let left = clientX + offset;
  let top = clientY + offset;

  // Neben der Maus nach links wechseln, wenn rechts kein Platz ist.
  if (viewportWidth && left + estimatedWidth > viewportWidth - padding) {
    left = clientX - estimatedWidth - offset;
  }

  // Tooltip bleibt bevorzugt unter/neben der Maus. Nur wenn er aus dem
  // Viewport laufen würde, wird er sanft nach oben begrenzt, nicht komplett
  // über die Maus geklappt.
  if (viewportHeight && top + estimatedHeight > viewportHeight - padding) {
    top = Math.max(padding, viewportHeight - estimatedHeight - padding);
  }

  return {
    left: Math.max(padding, left),
    top: Math.max(padding, top),
  };
}

function getBaseHeight(element: HTMLElement) {
  const existing = element.dataset.tooltipBaseHeight;

  if (existing) {
    return Number(existing);
  }

  const height = element.offsetHeight || element.getBoundingClientRect().height;
  element.dataset.tooltipBaseHeight = String(height);

  return height;
}

function setElementHeight(element: HTMLElement, height: number) {
  element.style.height = `${height}px`;
  element.style.minHeight = `${height}px`;
  element.dataset.tooltipExpanded = "1";
}

function restoreElementHeight(element: HTMLElement) {
  if (element.dataset.tooltipExpanded !== "1") return;

  const baseHeight = element.dataset.tooltipBaseHeight;

  if (baseHeight) {
    element.style.height = `${baseHeight}px`;
    element.style.minHeight = `${baseHeight}px`;
  } else {
    element.style.removeProperty("height");
    element.style.removeProperty("min-height");
  }

  delete element.dataset.tooltipExpanded;
}

function getTimelineRowsForElement(element: HTMLElement) {
  const timeGridRow = element.closest<HTMLElement>('[data-time-grid="true"]');

  if (!timeGridRow) {
    return [];
  }

  const crewRowId = timeGridRow.dataset.crewRowId;

  if (!crewRowId) {
    return [timeGridRow];
  }

  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-crew-row-id="${CSS.escape(crewRowId)}"]`,
    ),
  );
}

function expandTimelineRowForTooltip({
  triggerElement,
  tooltipElement,
}: {
  triggerElement: HTMLElement | null;
  tooltipElement: HTMLElement | null;
}) {
  if (!triggerElement || !tooltipElement) return;

  const timeGridRow = triggerElement.closest<HTMLElement>(
    '[data-time-grid="true"]',
  );

  if (!timeGridRow) return;

  const tooltipRect = tooltipElement.getBoundingClientRect();
  const rowRect = timeGridRow.getBoundingClientRect();
  const requiredHeight = Math.ceil(tooltipRect.bottom - rowRect.top + 18);
  const rows = getTimelineRowsForElement(triggerElement);

  for (const row of rows) {
    const baseHeight = getBaseHeight(row);
    const nextHeight = Math.max(baseHeight, requiredHeight);
    setElementHeight(row, nextHeight);
  }
}

function restoreTimelineRowForTooltip(triggerElement: HTMLElement | null) {
  if (!triggerElement) return;

  for (const row of getTimelineRowsForElement(triggerElement)) {
    restoreElementHeight(row);
  }
}

export function CrewTimelineMouseTooltip({
  className,
  style,
  label,
  text,
  extraCount = 0,
  disabled = false,
  estimatedWidth = 420,
  estimatedHeight = 180,
  clickTitle,
  clickText,
  clickHint,
  children,
}: CrewTimelineMouseTooltipProps) {
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [dialogPosition, setDialogPosition] = useState<TooltipPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const hasClickDialog = Boolean(clickTitle || clickText);

  function updatePosition(event: React.MouseEvent<HTMLDivElement>) {
    if (disabled) {
      setPosition(null);
      restoreTimelineRowForTooltip(wrapperRef.current);
      return;
    }

    setPosition(
      getTooltipPosition({
        clientX: event.clientX,
        clientY: event.clientY,
        estimatedWidth,
        estimatedHeight,
      }),
    );
  }

  function hideTooltip() {
    setPosition(null);
    restoreTimelineRowForTooltip(wrapperRef.current);
  }

  function openClickDialog(event: React.MouseEvent<HTMLDivElement>) {
    if (!hasClickDialog || disabled) return;

    event.preventDefault();
    event.stopPropagation();

    hideTooltip();

    setDialogPosition(
      getTooltipPosition({
        clientX: event.clientX,
        clientY: event.clientY,
        estimatedWidth: 460,
        estimatedHeight: 320,
      }),
    );
  }

  function closeClickDialog() {
    setDialogPosition(null);
  }

  useEffect(() => {
    if (!position || disabled || dialogPosition) {
      restoreTimelineRowForTooltip(wrapperRef.current);
      return;
    }

    expandTimelineRowForTooltip({
      triggerElement: wrapperRef.current,
      tooltipElement: tooltipRef.current,
    });

    return () => {
      restoreTimelineRowForTooltip(wrapperRef.current);
    };
  }, [dialogPosition, disabled, position, text, extraCount]);

  useEffect(() => {
    if (!dialogPosition) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        dialogRef.current &&
        !dialogRef.current.contains(target) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        closeClickDialog();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeClickDialog();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialogPosition]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={style}
      onMouseEnter={updatePosition}
      onMouseMove={updatePosition}
      onMouseLeave={hideTooltip}
      onClick={openClickDialog}
    >
      {children}

      {position && !disabled && !dialogPosition
        ? createPortal(
            <div
              ref={tooltipRef}
              className="pointer-events-none fixed w-[420px] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-gray-800 shadow-2xl"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                zIndex: 2147483647,
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {label}
              </div>
              <div className="mt-1 whitespace-pre-line text-gray-900">
                {text}
              </div>
              {extraCount > 0 ? (
                <div className="mt-1 text-[11px] font-semibold text-gray-500">
                  +{extraCount} weitere Einträge in der Kurzansicht
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {dialogPosition && hasClickDialog && !disabled
        ? createPortal(
            <div
              ref={dialogRef}
              className="fixed w-[460px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-4 pr-10 text-left text-sm text-gray-900 shadow-2xl"
              style={{
                left: `${dialogPosition.left}px`,
                top: `${dialogPosition.top}px`,
                zIndex: 2147483647,
              }}
              role="dialog"
              aria-modal="false"
            >
              <button
                type="button"
                onClick={closeClickDialog}
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-base leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Infofenster schließen"
                title="Schließen"
              >
                ×
              </button>

              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                {clickTitle ?? label}
              </div>
              <div className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-900">
                {clickText ?? text}
              </div>
              {extraCount > 0 ? (
                <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">
                  +{extraCount} weitere Einträge in der Kurzansicht
                </div>
              ) : null}
              {clickHint ? (
                <div className="mt-3 text-xs font-medium text-gray-500">
                  {clickHint}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
