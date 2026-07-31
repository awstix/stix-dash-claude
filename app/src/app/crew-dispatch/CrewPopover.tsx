"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { createPortal } from "react-dom";

type CrewPopoverProps = {
  trigger: ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  children: ReactNode;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
  placement: "up" | "down";
};

const VIEWPORT_PADDING_PX = 12;
const PANEL_WIDTH_PX = 400;
const PANEL_OFFSET_PX = 8;
const ROW_BOTTOM_PADDING_PX = 16;
const DEFAULT_BAR_TOP_OFFSET_PX = 56;
const FALLBACK_PANEL_HEIGHT_PX = 390;

function getPanelPosition(
  triggerElement: HTMLElement | null,
  panelElement: HTMLElement | null = null,
): PanelPosition {
  const fallbackWidth = Math.max(
    280,
    Math.min(PANEL_WIDTH_PX, window.innerWidth - VIEWPORT_PADDING_PX * 2),
  );

  if (!triggerElement) {
    return {
      top: window.scrollY + VIEWPORT_PADDING_PX,
      left: window.scrollX + VIEWPORT_PADDING_PX,
      width: fallbackWidth,
      placement: "down",
    };
  }

  const triggerRect = triggerElement.getBoundingClientRect();
  const panelHeight =
    panelElement?.getBoundingClientRect().height ?? FALLBACK_PANEL_HEIGHT_PX;
  const stickyBottom =
    document
      .querySelector<HTMLElement>("[data-crew-dispatch-sticky]")
      ?.getBoundingClientRect().bottom ?? 0;
  const width = fallbackWidth;
  const viewportLeft = Math.min(
    Math.max(VIEWPORT_PADDING_PX, triggerRect.left),
    window.innerWidth - width - VIEWPORT_PADDING_PX,
  );
  const belowTop = Math.max(
    triggerRect.bottom + PANEL_OFFSET_PX,
    stickyBottom + PANEL_OFFSET_PX,
  );
  const belowBottom = belowTop + panelHeight;
  const aboveTop = triggerRect.top - PANEL_OFFSET_PX - panelHeight;
  const shouldOpenUp = belowBottom > window.innerHeight - VIEWPORT_PADDING_PX;
  const top = shouldOpenUp
    ? Math.max(VIEWPORT_PADDING_PX, aboveTop)
    : belowTop;

  return {
    top: window.scrollY + top,
    left: window.scrollX + viewportLeft,
    width,
    placement: shouldOpenUp ? "up" : "down",
  };
}

function getCrewRowsFromTrigger(triggerElement: HTMLElement | null) {
  const currentRow = triggerElement?.closest<HTMLElement>("[data-crew-row-id]");
  const crewId = currentRow?.dataset.crewRowId;

  if (!crewId) {
    return [];
  }

  return Array.from(
    document.querySelectorAll<HTMLElement>("[data-crew-row-id]"),
  ).filter((row) => row.dataset.crewRowId === crewId);
}

function rememberBaseRowHeight(row: HTMLElement) {
  if (!row.dataset.crewBaseRowHeight) {
    row.dataset.crewBaseRowHeight = String(row.getBoundingClientRect().height);
  }

  return Number(row.dataset.crewBaseRowHeight);
}

function restoreCrewRows(triggerElement: HTMLElement | null) {
  const rows = getCrewRowsFromTrigger(triggerElement);

  rows.forEach((row) => {
    const baseHeight = row.dataset.crewBaseRowHeight;

    if (!baseHeight) {
      return;
    }

    row.style.height = `${baseHeight}px`;
    row.style.minHeight = `${baseHeight}px`;
    row.style.removeProperty("--crew-popover-offset");

    row
      .querySelectorAll<HTMLElement>("[data-crew-assignment-bar-id]")
      .forEach((bar) => {
        bar.style.transform = "";
      });
  });
}

function expandCrewRowsForPanel({
  triggerElement,
  panelElement,
  placement,
}: {
  triggerElement: HTMLElement | null;
  panelElement: HTMLElement | null;
  placement: PanelPosition["placement"];
}) {
  if (!triggerElement || !panelElement) {
    return;
  }

  const rows = getCrewRowsFromTrigger(triggerElement);

  if (rows.length === 0) {
    return;
  }

  if (placement === "up") {
    restoreCrewRows(triggerElement);
    return;
  }

  const currentRow =
    triggerElement.closest<HTMLElement>("[data-crew-row-id]") ?? rows[0];
  const rowRect = currentRow.getBoundingClientRect();
  const panelRect = panelElement.getBoundingClientRect();
  const baseHeight = rememberBaseRowHeight(currentRow);
  const panelBottomInRow = panelRect.bottom - rowRect.top;
  const timelineOffset = Math.max(
    0,
    Math.ceil(
      panelBottomInRow + ROW_BOTTOM_PADDING_PX - DEFAULT_BAR_TOP_OFFSET_PX,
    ),
  );
  const requiredHeight =
    panelBottomInRow + ROW_BOTTOM_PADDING_PX;

  rows.forEach((row) => {
    const rowBaseHeight =
      row === currentRow ? baseHeight : rememberBaseRowHeight(row);
    const nextHeight = Math.max(
      rowBaseHeight + timelineOffset,
      Math.ceil(requiredHeight),
    );

    row.style.height = `${nextHeight}px`;
    row.style.minHeight = `${nextHeight}px`;
    row.style.setProperty("--crew-popover-offset", `${timelineOffset}px`);

    row
      .querySelectorAll<HTMLElement>("[data-crew-assignment-bar-id]")
      .forEach((bar) => {
        bar.style.transform = `translateY(${timelineOffset}px)`;
      });
  });
}

export function CrewPopover({
  trigger,
  triggerClassName = "",
  panelClassName = "",
  children,
}: CrewPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(
    null,
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const nextPosition = getPanelPosition(wrapperRef.current, panelRef.current);

    setPanelPosition(nextPosition);
    expandCrewRowsForPanel({
      triggerElement: wrapperRef.current,
      panelElement: panelRef.current,
      placement: nextPosition.placement,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      restoreCrewRows(wrapperRef.current);
      return;
    }

    const triggerElement = wrapperRef.current;

    function updatePanelLayout() {
      const nextPosition = getPanelPosition(triggerElement, panelRef.current);
      setPanelPosition(nextPosition);
      window.requestAnimationFrame(() => {
        expandCrewRowsForPanel({
          triggerElement,
          panelElement: panelRef.current,
          placement: nextPosition.placement,
        });
      });
    }

    updatePanelLayout();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      if (triggerElement?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updatePanelLayout);

    if (panelRef.current) {
      resizeObserver?.observe(panelRef.current);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePanelLayout);
    window.addEventListener("scroll", updatePanelLayout, true);

    return () => {
      resizeObserver?.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePanelLayout);
      window.removeEventListener("scroll", updatePanelLayout, true);
      restoreCrewRows(triggerElement);
    };
  }, [isOpen]);

  const panel = isOpen ? (
    <div className="absolute left-0 top-0 z-[var(--z-popover)]">
      <div
        ref={panelRef}
        className={`${panelClassName} pr-8`}
        style={{
          left: `${panelPosition?.left ?? VIEWPORT_PADDING_PX}px`,
          position: "absolute",
          top: `${panelPosition?.top ?? VIEWPORT_PADDING_PX}px`,
          width: `${panelPosition?.width ?? PANEL_WIDTH_PX}px`,
          zIndex: 1200,
        }}
        role="dialog"
        aria-modal="false"
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-2 top-2 z-50 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-sm leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Fenster schließen"
          title="Fenster schließen"
        >
          <ActionIcon name="close" className="h-4 w-4" />
        </button>

        {children}
      </div>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }

          setPanelPosition(getPanelPosition(wrapperRef.current, null));
          setIsOpen(true);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {trigger}
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
