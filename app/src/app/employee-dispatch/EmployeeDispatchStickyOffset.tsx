"use client";

import { useEffect } from "react";

export function EmployeeDispatchStickyOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      "[data-employee-dispatch-root]",
    );
    const controls = document.querySelector<HTMLElement>(
      "[data-employee-dispatch-sticky-controls]",
    );

    if (!root || !controls) {
      return;
    }

    function updateStickyOffset() {
      root?.style.setProperty(
        "--employee-dispatch-sticky-offset",
        `${controls?.offsetHeight ?? 0}px`,
      );
    }

    updateStickyOffset();

    const resizeObserver = new ResizeObserver(updateStickyOffset);
    resizeObserver.observe(controls);
    window.addEventListener("resize", updateStickyOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStickyOffset);
    };
  }, []);

  return null;
}
