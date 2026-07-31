export type ViewportAnchor = {
  x: number;
  y: number;
};

export type ViewportBox = {
  height: number;
  width: number;
};

export type ViewportPlacement = {
  left: number;
  top: number;
};

/**
 * Positions a box (e.g. a popup measured after render) relative to an
 * anchor point in screen coordinates, preferring below/centered, and
 * clamps the result so the box always stays fully inside the viewport
 * regardless of container size or anchor position near an edge.
 */
export function clampToViewport({
  anchor,
  box,
  offset = 14,
  padding = 12,
}: {
  anchor: ViewportAnchor;
  box: ViewportBox;
  offset?: number;
  padding?: number;
}): ViewportPlacement {
  const viewportWidth =
    typeof window === "undefined" ? 0 : window.innerWidth || 0;
  const viewportHeight =
    typeof window === "undefined" ? 0 : window.innerHeight || 0;

  let left = anchor.x - box.width / 2;
  let top = anchor.y + offset;

  if (viewportHeight && top + box.height > viewportHeight - padding) {
    const above = anchor.y - offset - box.height;
    top = above >= padding ? above : Math.max(padding, viewportHeight - box.height - padding);
  }

  if (viewportWidth) {
    left = Math.min(left, viewportWidth - box.width - padding);
  }
  left = Math.max(padding, left);

  return { left, top };
}
