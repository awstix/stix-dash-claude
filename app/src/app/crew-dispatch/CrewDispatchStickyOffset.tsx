"use client";

import { useEffect } from "react";

export function CrewDispatchStickyOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      "[data-crew-dispatch-root]"
    );
    const controls = document.querySelector<HTMLElement>(
      "[data-crew-dispatch-sticky-controls]"
    );

    if (!root || !controls) {
      return;
    }

    function updateStickyOffset() {
      const height = controls.offsetHeight;
      root.style.setProperty("--crew-dispatch-sticky-offset", `${height}px`);
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
