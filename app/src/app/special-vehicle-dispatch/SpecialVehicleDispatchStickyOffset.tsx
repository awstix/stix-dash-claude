"use client";

import { useEffect } from "react";

export function SpecialVehicleDispatchStickyOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      "[data-special-vehicle-dispatch-root]",
    );
    const controls = document.querySelector<HTMLElement>(
      "[data-special-vehicle-dispatch-sticky-controls]",
    );

    if (!root || !controls) {
      return;
    }

    function updateStickyOffset() {
      root?.style.setProperty(
        "--special-vehicle-dispatch-sticky-offset",
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
