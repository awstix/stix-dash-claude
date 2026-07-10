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
    const body = document.querySelector<HTMLElement>(
      "[data-crew-dispatch-scroll-body]"
    );

    if (!root || !controls) {
      return;
    }

    const stickyRoot = root;
    const stickyControls = controls;
    const scrollBody = body;

    function updateStickyOffset() {
      const height = stickyControls.offsetHeight;
      stickyRoot.style.setProperty(
        "--crew-dispatch-sticky-offset",
        `${height}px`,
      );

      if (!scrollBody) {
        stickyRoot.style.setProperty("--crew-dispatch-body-safe-offset", "0px");
        return;
      }

      const currentOffset = Number.parseFloat(
        stickyRoot.style.getPropertyValue("--crew-dispatch-body-safe-offset") ||
          "0",
      );
      const stickyBottom = stickyControls.getBoundingClientRect().bottom;
      const bodyTopWithoutOffset =
        scrollBody.getBoundingClientRect().top - currentOffset;
      const nextOffset = Math.max(
        0,
        Math.ceil(stickyBottom + 8 - bodyTopWithoutOffset),
      );

      stickyRoot.style.setProperty(
        "--crew-dispatch-body-safe-offset",
        `${nextOffset}px`,
      );
    }

    updateStickyOffset();

    const resizeObserver = new ResizeObserver(() => {
      updateStickyOffset();
    });

    resizeObserver.observe(stickyControls);
    window.addEventListener("resize", updateStickyOffset);
    window.addEventListener("scroll", updateStickyOffset, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateStickyOffset);
      window.removeEventListener("scroll", updateStickyOffset, true);
    };
  }, []);

  return null;
}
