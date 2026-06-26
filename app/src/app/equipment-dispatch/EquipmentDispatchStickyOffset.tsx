"use client";

import { useEffect } from "react";

export function EquipmentDispatchStickyOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      "[data-equipment-dispatch-root]",
    );
    const controls = document.querySelector<HTMLElement>(
      "[data-equipment-dispatch-sticky-controls]",
    );

    if (!root || !controls) {
      return;
    }

    function updateStickyOffset() {
      const height = controls?.offsetHeight ?? 0;
      root?.style.setProperty("--equipment-dispatch-sticky-offset", `${height}px`);
    }

    updateStickyOffset();

    const resizeObserver = new ResizeObserver(() => {
      updateStickyOffset();
    });

    resizeObserver.observe(controls);
    window.addEventListener("resize", updateStickyOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStickyOffset);
    };
  }, []);

  return null;
}
