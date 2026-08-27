"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "@/components/ActionIcon";
import { clampToViewport } from "@/lib/viewport-position";

const TILE_SIZE = 256;
const DEFAULT_MAP_WIDTH = 768;
const DEFAULT_MAP_HEIGHT = 288;

type Coordinate = [number, number];
type MapView = {
  latitude: number;
  longitude: number;
  zoom: number;
};

type SiteMarkerType = "ZUFAHRT" | "AUSFAHRT" | "ZUFAHRT_AUSFAHRT" | "BAUSTELLENEINRICHTUNG";

type SiteMarker = {
  id: string;
  latitude: number;
  longitude: number;
  rotationDegrees: number;
  type: SiteMarkerType;
};

type EditMode = "boundary" | SiteMarkerType;

const SITE_MARKER_LABELS: Record<SiteMarkerType, string> = {
  AUSFAHRT: "Ausfahrt",
  BAUSTELLENEINRICHTUNG: "Baustelleneinrichtung",
  ZUFAHRT: "Zufahrt",
  ZUFAHRT_AUSFAHRT: "Zufahrt & Ausfahrt",
};

const SITE_MARKER_COLORS: Record<SiteMarkerType, string> = {
  AUSFAHRT: "#dc2626",
  BAUSTELLENEINRICHTUNG: "#b45309",
  ZUFAHRT: "#16a34a",
  ZUFAHRT_AUSFAHRT: "#7c3aed",
};

const EDIT_MODE_OPTIONS: { label: string; mode: EditMode }[] = [
  { label: "Baufeld-Punkt", mode: "boundary" },
  { label: "Zufahrt", mode: "ZUFAHRT" },
  { label: "Ausfahrt", mode: "AUSFAHRT" },
  { label: "Zufahrt & Ausfahrt", mode: "ZUFAHRT_AUSFAHRT" },
  { label: "Baustelleneinrichtung", mode: "BAUSTELLENEINRICHTUNG" },
];

type ProjectMapProps = {
  address?: string | null;
  boundaryGeoJson?: string | null;
  className?: string;
  editable?: boolean;
  heightClass?: string;
  latitude?: number | null;
  longitude?: number | null;
  markers?: Array<{
    employees?: string[];
    label: string;
    latitude: number;
    longitude: number;
  }>;
  onBoundaryChange?: (value: string) => void;
  onViewChange?: (view: MapView) => void;
  zoom?: number | null;
};

export function ProjectMap({
  address,
  boundaryGeoJson,
  className = "",
  editable = false,
  heightClass = "h-72",
  latitude,
  longitude,
  markers = [],
  onBoundaryChange,
  onViewChange,
  zoom,
}: ProjectMapProps) {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  const normalizedZoom = clampInt(Math.round(zoom ?? 17), 1, 19);
  const canRenderMap = lat !== null && lng !== null;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState({
    height: DEFAULT_MAP_HEIGHT,
    width: DEFAULT_MAP_WIDTH,
  });
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<EditMode>("boundary");
  const [selectedSiteMarkerId, setSelectedSiteMarkerId] = useState<string | null>(null);
  const [wasEditable, setWasEditable] = useState(editable);

  // Reset the marker-drawing mode/selection when leaving edit mode - done
  // during render (comparing against the previous editable value) rather
  // than in an effect, so it doesn't trigger an extra render pass.
  if (editable !== wasEditable) {
    setWasEditable(editable);
    if (!editable) {
      setEditMode("boundary");
      setSelectedSiteMarkerId(null);
    }
  }

  const popupRef = useRef<HTMLDivElement | null>(null);
  const [popupPlacement, setPopupPlacement] = useState<{ left: number; top: number } | null>(null);
  const boundaryRef = useRef(boundaryGeoJson ?? "");
  const dragRef = useRef<{
    pointerId: number;
    rectHeight: number;
    rectWidth: number;
    startCenter: { x: number; y: number };
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const markerDragRef = useRef<{
    markerId: string;
    pointerId: number;
    rectHeight: number;
    rectWidth: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const [markerDragOffset, setMarkerDragOffset] = useState<{
    dx: number;
    dy: number;
    id: string;
  } | null>(null);
  // Eigenständiges Ziehen des Mittelpunkt-Punkts (Adresspunkt): die Karte
  // bleibt dabei visuell fest, nur der Punkt bewegt sich per CSS-Transform -
  // erst beim Loslassen wird der Kartenausschnitt einmalig auf die neue
  // Punktposition zentriert. Unabhängig von dragRef (Karte verschieben) und
  // markerDragRef (Baufeld-Marker), da der Punkt kein SVG-Element ist.
  const centerPinDragRef = useRef<{
    pointerId: number;
    rectHeight: number;
    rectWidth: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const [centerPinOffset, setCenterPinOffset] = useState<{ dx: number; dy: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    boundaryRef.current = boundaryGeoJson ?? "";
  }, [boundaryGeoJson]);

  useEffect(() => {
    const element = mapContainerRef.current;
    if (!element) return;

    const updateSize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width <= 0 || height <= 0) return;

      setMapSize((current) => {
        return current.width === width && current.height === height
          ? current
          : { height, width };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, [canRenderMap]);

  useEffect(() => {
    if (selectedMarkerIndex === null) return;

    const closePopup = () => setSelectedMarkerIndex(null);
    window.addEventListener("resize", closePopup);
    window.addEventListener("scroll", closePopup, true);

    return () => {
      window.removeEventListener("resize", closePopup);
      window.removeEventListener("scroll", closePopup, true);
    };
  }, [selectedMarkerIndex]);

  const mapData = useMemo(() => {
    if (!canRenderMap) {
      return null;
    }

    const center = lngLatToPixel(lng, lat, normalizedZoom);
    const origin = {
      x: center.x - mapSize.width / 2,
      y: center.y - mapSize.height / 2,
    };
    const tileMinX = Math.floor(origin.x / TILE_SIZE);
    const tileMaxX = Math.floor((origin.x + mapSize.width) / TILE_SIZE);
    const tileMinY = Math.floor(origin.y / TILE_SIZE);
    const tileMaxY = Math.floor((origin.y + mapSize.height) / TILE_SIZE);
    const tileLimit = 2 ** normalizedZoom;
    const tiles: {
      key: string;
      src: string;
      style: CSSProperties;
    }[] = [];

    for (let tileX = tileMinX; tileX <= tileMaxX; tileX += 1) {
      for (let tileY = tileMinY; tileY <= tileMaxY; tileY += 1) {
        if (tileY < 0 || tileY >= tileLimit) continue;

        const wrappedTileX = ((tileX % tileLimit) + tileLimit) % tileLimit;
        tiles.push({
          key: `${tileX}-${tileY}`,
          src: `https://tile.openstreetmap.org/${normalizedZoom}/${wrappedTileX}/${tileY}.png`,
          style: {
            height: TILE_SIZE,
            left: tileX * TILE_SIZE - origin.x,
            top: tileY * TILE_SIZE - origin.y,
            width: TILE_SIZE,
          },
        });
      }
    }

    const boundary = parseBoundaryGeoJson(boundaryGeoJson);
    const rings = boundary.rings.map((ring) =>
      ring.map((point) => lngLatToMapPoint(point, normalizedZoom, origin)),
    );
    const lines = boundary.lines.map((line) =>
      line.map((point) => lngLatToMapPoint(point, normalizedZoom, origin)),
    );
    const editPoints = boundary.editPoints.map((point) =>
      lngLatToMapPoint(point, normalizedZoom, origin),
    );
    const markerPoints = markers.map((marker) => ({
      ...marker,
      point: lngLatToMapPoint(
        [marker.longitude, marker.latitude],
        normalizedZoom,
        origin,
      ),
    }));
    const siteMarkerPoints = boundary.siteMarkers.map((marker) => ({
      ...marker,
      point: lngLatToMapPoint(
        [marker.longitude, marker.latitude],
        normalizedZoom,
        origin,
      ),
    }));

    return {
      editPoints,
      lines,
      markerPoints,
      origin,
      rings,
      siteMarkerPoints,
      tiles,
    };
  }, [
    boundaryGeoJson,
    canRenderMap,
    lat,
    lng,
    mapSize.height,
    mapSize.width,
    normalizedZoom,
    markers,
  ]);

  const selectedMarker =
    selectedMarkerIndex !== null
      ? mapData?.markerPoints[selectedMarkerIndex] ?? null
      : null;
  const selectedSiteMarker =
    selectedSiteMarkerId !== null
      ? mapData?.siteMarkerPoints.find((marker) => marker.id === selectedSiteMarkerId) ?? null
      : null;

  useLayoutEffect(() => {
    if (!selectedMarker) return;

    const containerRect = mapContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const anchor = {
      x: containerRect.left + selectedMarker.point.x,
      y: containerRect.top + selectedMarker.point.y,
    };
    const popupElement = popupRef.current;
    const box = popupElement
      ? { height: popupElement.offsetHeight, width: popupElement.offsetWidth }
      : { height: 220, width: 288 };

    setPopupPlacement(clampToViewport({ anchor, box }));
  }, [selectedMarker]);

  function handleMapClick(event: MouseEvent<SVGSVGElement>) {
    if (!editable || !onBoundaryChange || !mapData) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * mapSize.width;
    const y = ((event.clientY - rect.top) / rect.height) * mapSize.height;
    const newPoint = mapPointToLngLat(
      x,
      y,
      normalizedZoom,
      mapData.origin,
    );
    const current = parseBoundaryGeoJson(boundaryRef.current);

    if (editMode === "boundary") {
      const nextBoundaryGeoJson = createBoundaryGeoJson(
        [...current.editPoints, newPoint],
        current.siteMarkers,
      );
      boundaryRef.current = nextBoundaryGeoJson;
      onBoundaryChange(nextBoundaryGeoJson);
      return;
    }

    const newMarker: SiteMarker = {
      id: createMarkerId(),
      latitude: newPoint[1],
      longitude: newPoint[0],
      rotationDegrees: 0,
      type: editMode,
    };
    const nextBoundaryGeoJson = createBoundaryGeoJson(current.editPoints, [
      ...current.siteMarkers,
      newMarker,
    ]);
    boundaryRef.current = nextBoundaryGeoJson;
    onBoundaryChange(nextBoundaryGeoJson);
    setSelectedSiteMarkerId(newMarker.id);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (!editable || event.button !== 0) return;

    const siteMarkerElement =
      event.target instanceof Element
        ? event.target.closest<Element>("[data-site-marker-id]")
        : null;
    const siteMarkerId = siteMarkerElement?.getAttribute("data-site-marker-id");

    if (siteMarkerId && onBoundaryChange) {
      setSelectedSiteMarkerId(siteMarkerId);
      const rect = event.currentTarget.getBoundingClientRect();
      markerDragRef.current = {
        markerId: siteMarkerId,
        pointerId: event.pointerId,
        rectHeight: rect.height,
        rectWidth: rect.width,
        startClientX: event.clientX,
        startClientY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (!onViewChange || lat === null || lng === null) return;
    if (
      event.target instanceof Element &&
      event.target.closest("[data-map-marker='true']")
    ) {
      return;
    }

    setSelectedMarkerIndex(null);
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      rectHeight: rect.height,
      rectWidth: rect.width,
      startCenter: lngLatToPixel(lng, lat, normalizedZoom),
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const markerDrag = markerDragRef.current;
    if (markerDrag && markerDrag.pointerId === event.pointerId) {
      const deltaX = event.clientX - markerDrag.startClientX;
      const deltaY = event.clientY - markerDrag.startClientY;

      if (Math.hypot(deltaX, deltaY) < 4) {
        return;
      }

      suppressClickRef.current = true;
      const scaledDeltaX = (deltaX / markerDrag.rectWidth) * mapSize.width;
      const scaledDeltaY = (deltaY / markerDrag.rectHeight) * mapSize.height;
      setMarkerDragOffset({
        dx: scaledDeltaX,
        dy: scaledDeltaY,
        id: markerDrag.markerId,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || !onViewChange) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (Math.hypot(deltaX, deltaY) < 4) {
      return;
    }

    suppressClickRef.current = true;
    const scaledDeltaX = (deltaX / drag.rectWidth) * mapSize.width;
    const scaledDeltaY = (deltaY / drag.rectHeight) * mapSize.height;
    const nextCenter = {
      x: drag.startCenter.x - scaledDeltaX,
      y: drag.startCenter.y - scaledDeltaY,
    };
    const nextCoordinate = pixelToLngLat(
      nextCenter.x,
      nextCenter.y,
      normalizedZoom,
    );

    onViewChange({
      latitude: nextCoordinate[1],
      longitude: nextCoordinate[0],
      zoom: normalizedZoom,
    });
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>) {
    const markerDrag = markerDragRef.current;
    if (markerDrag && markerDrag.pointerId === event.pointerId) {
      markerDragRef.current = null;

      const offset = markerDragOffset;
      setMarkerDragOffset(null);

      if (offset && offset.id === markerDrag.markerId && onBoundaryChange && mapData) {
        const current = parseBoundaryGeoJson(boundaryRef.current);
        const draggedMarker = current.siteMarkers.find((m) => m.id === markerDrag.markerId);

        if (draggedMarker) {
          const startPoint = lngLatToMapPoint(
            [draggedMarker.longitude, draggedMarker.latitude],
            normalizedZoom,
            mapData.origin,
          );
          const nextLngLat = mapPointToLngLat(
            startPoint.x + offset.dx,
            startPoint.y + offset.dy,
            normalizedZoom,
            mapData.origin,
          );
          const nextMarkers = current.siteMarkers.map((m) =>
            m.id === markerDrag.markerId
              ? { ...m, latitude: nextLngLat[1], longitude: nextLngLat[0] }
              : m,
          );
          const nextBoundaryGeoJson = createBoundaryGeoJson(current.editPoints, nextMarkers);
          boundaryRef.current = nextBoundaryGeoJson;
          onBoundaryChange(nextBoundaryGeoJson);
        }
      }
      return;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleCenterPinPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!editable || !onViewChange || event.button !== 0 || lat === null || lng === null) return;

    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    centerPinDragRef.current = {
      pointerId: event.pointerId,
      rectHeight: rect.height,
      rectWidth: rect.width,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCenterPinPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = centerPinDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;

    if (Math.hypot(deltaX, deltaY) < 4) return;

    setCenterPinOffset({ dx: deltaX, dy: deltaY });
  }

  function handleCenterPinPointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = centerPinDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    centerPinDragRef.current = null;
    const offset = centerPinOffset;
    setCenterPinOffset(null);

    if (!offset || !onViewChange || lat === null || lng === null) return;

    const scaledDeltaX = (offset.dx / drag.rectWidth) * mapSize.width;
    const scaledDeltaY = (offset.dy / drag.rectHeight) * mapSize.height;
    const center = lngLatToPixel(lng, lat, normalizedZoom);
    const nextCoordinate = pixelToLngLat(
      center.x + scaledDeltaX,
      center.y + scaledDeltaY,
      normalizedZoom,
    );

    setSelectedMarkerIndex(null);
    onViewChange({
      latitude: nextCoordinate[1],
      longitude: nextCoordinate[0],
      zoom: normalizedZoom,
    });
  }

  function changeZoom(delta: number) {
    if (!onViewChange || lat === null || lng === null) return;

    setSelectedMarkerIndex(null);
    onViewChange({
      latitude: lat,
      longitude: lng,
      zoom: clampInt(normalizedZoom + delta, 1, 19),
    });
  }

  // Feineinstellung per Klick statt nur per Ziehen - verschiebt den
  // Kartenausschnitt (und damit den Mittelpunkt-Punkt) um einen festen
  // Pixel-Schritt in eine Richtung, für präzises Ausrichten ohne
  // "Verrutschen" beim Ziehen mit der Maus/dem Finger.
  const NUDGE_STEP_PX = 40;

  function nudgeView(dx: number, dy: number) {
    if (!onViewChange || lat === null || lng === null) return;

    const center = lngLatToPixel(lng, lat, normalizedZoom);
    const nextCoordinate = pixelToLngLat(
      center.x + dx,
      center.y + dy,
      normalizedZoom,
    );

    setSelectedMarkerIndex(null);
    onViewChange({
      latitude: nextCoordinate[1],
      longitude: nextCoordinate[0],
      zoom: normalizedZoom,
    });
  }

  function removeLastPoint() {
    if (!onBoundaryChange) return;

    const current = parseBoundaryGeoJson(boundaryRef.current);
    const nextBoundaryGeoJson = createBoundaryGeoJson(
      current.editPoints.slice(0, -1),
      current.siteMarkers,
    );

    boundaryRef.current = nextBoundaryGeoJson;
    onBoundaryChange(nextBoundaryGeoJson);
  }

  function clearBoundary() {
    if (!onBoundaryChange) return;

    const current = parseBoundaryGeoJson(boundaryRef.current);
    const nextBoundaryGeoJson = createBoundaryGeoJson([], current.siteMarkers);

    boundaryRef.current = nextBoundaryGeoJson;
    onBoundaryChange(nextBoundaryGeoJson);
  }

  function updateSiteMarkerRotation(id: string, rotationDegrees: number) {
    if (!onBoundaryChange) return;

    const current = parseBoundaryGeoJson(boundaryRef.current);
    const nextMarkers = current.siteMarkers.map((marker) =>
      marker.id === id
        ? { ...marker, rotationDegrees: normalizeRotation(rotationDegrees) }
        : marker,
    );
    const nextBoundaryGeoJson = createBoundaryGeoJson(current.editPoints, nextMarkers);

    boundaryRef.current = nextBoundaryGeoJson;
    onBoundaryChange(nextBoundaryGeoJson);
  }

  function removeSiteMarker(id: string) {
    if (!onBoundaryChange) return;

    const current = parseBoundaryGeoJson(boundaryRef.current);
    const nextMarkers = current.siteMarkers.filter((marker) => marker.id !== id);
    const nextBoundaryGeoJson = createBoundaryGeoJson(current.editPoints, nextMarkers);

    boundaryRef.current = nextBoundaryGeoJson;
    onBoundaryChange(nextBoundaryGeoJson);
    setSelectedSiteMarkerId(null);
  }

  const editPointCount = parseBoundaryGeoJson(boundaryGeoJson).editPoints.length;

  if (!canRenderMap || !mapData) {
    return (
      <div className={`rounded-xl border border-dashed border-gray-300 bg-white ${className}`}>
        <div
          className={`flex ${heightClass} items-center justify-center px-4 text-center text-sm font-medium text-gray-500`}
        >
          Baustellenadresse / Koordinaten sind im Projektstamm noch nicht erfasst.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className={`relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100 ${heightClass}`}
        ref={mapContainerRef}
      >
        {mapData.tiles.map((tile) => (
          <img
            alt=""
            className="absolute max-w-none select-none"
            draggable={false}
            key={tile.key}
            src={tile.src}
            style={tile.style}
          />
        ))}

        <svg
          aria-label="Baufeld"
          className={`absolute inset-0 h-full w-full ${
            editable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          onClick={handleMapClick}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          preserveAspectRatio="none"
          viewBox={`0 0 ${mapSize.width} ${mapSize.height}`}
        >
          {editable ? (
            <rect
              fill="transparent"
              height={mapSize.height}
              pointerEvents="all"
              width={mapSize.width}
              x={0}
              y={0}
            />
          ) : null}

          {mapData.rings.map((ring, index) => (
            <polygon
              fill="rgba(249, 115, 22, 0.24)"
              key={`ring-${index}`}
              pointerEvents={editable ? "none" : "auto"}
              points={ring.map((point) => `${point.x},${point.y}`).join(" ")}
              stroke="#ea580c"
              strokeWidth={3}
            />
          ))}

          {mapData.lines.map((line, index) => (
            <polyline
              fill="none"
              key={`line-${index}`}
              pointerEvents={editable ? "none" : "auto"}
              points={line.map((point) => `${point.x},${point.y}`).join(" ")}
              stroke="#ea580c"
              strokeDasharray="8 6"
              strokeWidth={3}
            />
          ))}

          {editable
            ? mapData.editPoints.map((point, index) => (
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill="#ea580c"
                  key={`${point.x}-${point.y}-${index}`}
                  pointerEvents="none"
                  r={5}
                  stroke="white"
                  strokeWidth={2}
                />
              ))
            : null}

          {mapData.siteMarkerPoints.map((marker) => {
            const isArrow = marker.type !== "BAUSTELLENEINRICHTUNG";
            const color = SITE_MARKER_COLORS[marker.type];
            const isSelected = marker.id === selectedSiteMarkerId;
            const offset =
              markerDragOffset?.id === marker.id ? markerDragOffset : null;
            const pointX = marker.point.x + (offset?.dx ?? 0);
            const pointY = marker.point.y + (offset?.dy ?? 0);

            return (
              <g
                className={editable ? "cursor-grab active:cursor-grabbing" : ""}
                data-map-marker="true"
                data-site-marker-id={marker.id}
                key={marker.id}
                onClick={(event) => {
                  if (!editable) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedSiteMarkerId(marker.id);
                }}
                pointerEvents={editable ? "auto" : "none"}
                transform={`translate(${pointX},${pointY}) rotate(${
                  isArrow ? marker.rotationDegrees : 0
                })`}
              >
                {isSelected ? (
                  <circle
                    fill="none"
                    r={16}
                    stroke={color}
                    strokeDasharray="3 3"
                    strokeWidth={2}
                  />
                ) : null}
                {marker.type === "BAUSTELLENEINRICHTUNG" ? (
                  <rect
                    fill={color}
                    height={18}
                    rx={4}
                    stroke="white"
                    strokeWidth={2}
                    width={18}
                    x={-9}
                    y={-9}
                  />
                ) : marker.type === "ZUFAHRT_AUSFAHRT" ? (
                  <path
                    d="M 0 -14 L 8 -2 L 3 -2 L 3 2 L 8 2 L 0 14 L -8 2 L -3 2 L -3 -2 L -8 -2 Z"
                    fill={color}
                    stroke="white"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                ) : (
                  <path
                    d="M 0 -14 L 8 2 L 3 2 L 3 12 L -3 12 L -3 2 L -8 2 Z"
                    fill={color}
                    stroke="white"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}

          {mapData.markerPoints.map((marker, index) => (
            <g
              className="cursor-pointer"
              data-map-marker="true"
              key={`${marker.label}-${index}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSelectedMarkerIndex(index);
              }}
              pointerEvents="auto"
            >
              <circle
                cx={marker.point.x}
                cy={marker.point.y}
                fill="#047857"
                r={8}
                stroke="white"
                strokeWidth={3}
              />
              <text
                fill="#111827"
                fontSize={11}
                fontWeight={800}
                x={marker.point.x + 11}
                y={marker.point.y + 4}
              >
                {marker.label.slice(0, 28)}
              </text>
            </g>
          ))}
        </svg>

        {markers.length === 0 ? (
          <div
            className={`absolute left-1/2 top-1/2 h-4 w-4 rounded-full border-2 border-white bg-gray-900 shadow ${
              editable && onViewChange
                ? "cursor-grab touch-none active:cursor-grabbing"
                : "pointer-events-none"
            }`}
            onPointerCancel={handleCenterPinPointerEnd}
            onPointerDown={handleCenterPinPointerDown}
            onPointerMove={handleCenterPinPointerMove}
            onPointerUp={handleCenterPinPointerEnd}
            style={{
              transform: `translate(calc(-50% + ${centerPinOffset?.dx ?? 0}px), calc(-50% + ${centerPinOffset?.dy ?? 0}px))`,
            }}
            title={editable && onViewChange ? "Adresspunkt frei ziehen" : undefined}
          />
        ) : null}

        {editable && onViewChange ? (
          <div
            className="absolute right-3 top-3 z-10 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
            title="Kartenausschnitt ausrichten und zoomen"
          >
            <div className="grid grid-cols-3 grid-rows-3">
              <div />
              <button
                className="col-start-2 row-start-1 flex h-7 w-7 items-center justify-center border-b border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50"
                onClick={(event) => {
                  event.stopPropagation();
                  nudgeView(0, -NUDGE_STEP_PX);
                }}
                type="button"
              >
                ▲
              </button>
              <div />
              <button
                className="col-start-1 row-start-2 flex h-7 w-7 items-center justify-center border-r border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50"
                onClick={(event) => {
                  event.stopPropagation();
                  nudgeView(-NUDGE_STEP_PX, 0);
                }}
                type="button"
              >
                ◀
              </button>
              <div className="flex h-7 w-7 items-center justify-center border-b border-r border-gray-200" />
              <button
                className="col-start-3 row-start-2 flex h-7 w-7 items-center justify-center border-b border-l border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50"
                onClick={(event) => {
                  event.stopPropagation();
                  nudgeView(NUDGE_STEP_PX, 0);
                }}
                type="button"
              >
                ▶
              </button>
              <div />
              <button
                className="col-start-2 row-start-3 flex h-7 w-7 items-center justify-center border-t border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50"
                onClick={(event) => {
                  event.stopPropagation();
                  nudgeView(0, NUDGE_STEP_PX);
                }}
                type="button"
              >
                ▼
              </button>
              <div />
            </div>
            <div className="grid grid-cols-2 border-t border-gray-300">
              <button
                className="flex h-7 items-center justify-center border-r border-gray-200 text-base font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                disabled={normalizedZoom <= 1}
                onClick={(event) => {
                  event.stopPropagation();
                  changeZoom(-1);
                }}
                type="button"
              >
                −
              </button>
              <button
                className="flex h-7 items-center justify-center text-base font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                disabled={normalizedZoom >= 19}
                onClick={(event) => {
                  event.stopPropagation();
                  changeZoom(1);
                }}
                type="button"
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        {address ? (
          <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm">
            {address}
          </div>
        ) : null}

        <span
          className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-gray-600 shadow-sm"
        >
          © OpenStreetMap-Mitwirkende
        </span>
      </div>

      {selectedMarker && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[var(--z-popover)] flex w-72 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-1.5rem)] flex-col rounded-xl border border-gray-400 bg-white text-gray-950 shadow-xl"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              ref={popupRef}
              style={{
                left: popupPlacement?.left ?? -9999,
                top: popupPlacement?.top ?? -9999,
                visibility: popupPlacement ? "visible" : "hidden",
              }}
            >
              <div className="flex items-start justify-between gap-2 p-3 pb-2">
                <p className="text-sm font-black text-gray-950">
                  {selectedMarker.label}
                </p>
                <button
                  aria-label="Popup schließen"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-400 bg-white text-gray-950 hover:bg-gray-200"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedMarkerIndex(null);
                  }}
                  type="button"
                >
                  <ActionIcon name="close" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                <p className="text-xs font-black uppercase tracking-wide text-gray-950">
                  Personal heute
                </p>
                {selectedMarker.employees?.length ? (
                  <ul className="mt-2 space-y-1">
                    {selectedMarker.employees.map((employee) => (
                      <li
                        className="rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-sm font-bold text-gray-950"
                        key={employee}
                      >
                        {employee}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm font-bold text-gray-950">
                    Heute ist noch kein Personal eingeplant.
                  </p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {editable ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Modus:</span>
            {EDIT_MODE_OPTIONS.map((option) => (
              <button
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  editMode === option.mode
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
                key={option.mode}
                onClick={() => {
                  setEditMode(option.mode);
                  setSelectedSiteMarkerId(null);
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-800">
              Baufeldpunkte: {editPointCount}
            </span>
            <span className="text-gray-500">
              {editMode === "boundary"
                ? "Karte ziehen zum Verschieben, klicken zum Baufeld setzen"
                : `Karte ziehen zum Verschieben, klicken zum Setzen von „${SITE_MARKER_LABELS[editMode]}“. Gesetzte Symbole können per Ziehen verschoben werden.`}
            </span>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={editPointCount === 0}
              onClick={removeLastPoint}
              type="button"
            >
              Punkt zurück
            </button>
            <button
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={editPointCount === 0}
              onClick={clearBoundary}
              type="button"
            >
              Baufeld löschen
            </button>
          </div>

          {selectedSiteMarker ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm font-bold"
                  style={{ color: SITE_MARKER_COLORS[selectedSiteMarker.type] }}
                >
                  {SITE_MARKER_LABELS[selectedSiteMarker.type]}
                </span>
                <button
                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => removeSiteMarker(selectedSiteMarker.id)}
                  type="button"
                >
                  Löschen
                </button>
              </div>
              {selectedSiteMarker.type !== "BAUSTELLENEINRICHTUNG" ? (
                <label className="mt-2 block text-xs font-semibold text-gray-700">
                  Richtung ({Math.round(selectedSiteMarker.rotationDegrees)}°)
                  <input
                    className="mt-1 w-full"
                    max={359}
                    min={0}
                    onChange={(event) =>
                      updateSiteMarkerRotation(
                        selectedSiteMarker.id,
                        Number(event.target.value),
                      )
                    }
                    step={5}
                    type="range"
                    value={selectedSiteMarker.rotationDegrees}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toFiniteNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lngLatToPixel(lng: number, lat: number, zoom: number) {
  const sinLat = Math.sin((clampLatitude(lat) * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      scale,
  };
}

function lngLatToMapPoint(
  point: Coordinate,
  zoom: number,
  origin: { x: number; y: number },
) {
  const pixel = lngLatToPixel(point[0], point[1], zoom);

  return {
    x: pixel.x - origin.x,
    y: pixel.y - origin.y,
  };
}

function mapPointToLngLat(
  x: number,
  y: number,
  zoom: number,
  origin: { x: number; y: number },
): Coordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const globalX = origin.x + x;
  const globalY = origin.y + y;
  const lng = (globalX / scale) * 360 - 180;
  const mercatorY = Math.PI - (2 * Math.PI * globalY) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercatorY));

  return [roundCoordinate(lng), roundCoordinate(lat)];
}

function pixelToLngLat(x: number, y: number, zoom: number): Coordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const mercatorY = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(mercatorY));

  return [roundCoordinate(lng), roundCoordinate(lat)];
}

function clampLatitude(lat: number) {
  return Math.min(Math.max(lat, -85.05112878), 85.05112878);
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeRotation(value: number) {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 360) + 360) % 360;
}

function createMarkerId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `marker-${Math.random().toString(36).slice(2)}`;
}

function isSiteMarkerType(value: unknown): value is SiteMarkerType {
  return (
    value === "ZUFAHRT" ||
    value === "AUSFAHRT" ||
    value === "ZUFAHRT_AUSFAHRT" ||
    value === "BAUSTELLENEINRICHTUNG"
  );
}

function parseBoundaryGeoJson(value: string | null | undefined): {
  editPoints: Coordinate[];
  lines: Coordinate[][];
  rings: Coordinate[][];
  siteMarkers: SiteMarker[];
} {
  if (!value?.trim()) {
    return { editPoints: [], lines: [], rings: [], siteMarkers: [] };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    const features = collectFeatures(parsed);
    const rings: Coordinate[][] = [];
    const lines: Coordinate[][] = [];
    const siteMarkers: SiteMarker[] = [];

    for (const { geometry, properties } of features) {
      if (!isRecord(geometry) || typeof geometry.type !== "string") continue;

      if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
        const ring = normalizeRing(geometry.coordinates[0]);
        if (ring.length >= 3) {
          rings.push(ring);
        }
      }

      if (
        geometry.type === "MultiPolygon" &&
        Array.isArray(geometry.coordinates)
      ) {
        for (const polygon of geometry.coordinates) {
          const ring = normalizeRing(polygon?.[0]);
          if (ring.length >= 3) {
            rings.push(ring);
          }
        }
      }

      if (
        geometry.type === "LineString" &&
        Array.isArray(geometry.coordinates)
      ) {
        const line = normalizeRing(geometry.coordinates);
        if (line.length > 0) {
          lines.push(line);
        }
      }

      if (
        geometry.type === "Point" &&
        properties.kind === "site-marker" &&
        isSiteMarkerType(properties.markerType)
      ) {
        const point = normalizeCoordinate(geometry.coordinates);
        if (point) {
          siteMarkers.push({
            id: typeof properties.id === "string" ? properties.id : createMarkerId(),
            latitude: point[1],
            longitude: point[0],
            rotationDegrees: normalizeRotation(Number(properties.rotationDegrees)),
            type: properties.markerType,
          });
        }
      }
    }

    return {
      editPoints: getEditPoints(rings, lines),
      lines,
      rings,
      siteMarkers,
    };
  } catch {
    return { editPoints: [], lines: [], rings: [], siteMarkers: [] };
  }
}

function collectFeatures(
  value: unknown,
): Array<{ geometry: unknown; properties: Record<string, unknown> }> {
  if (!isRecord(value)) return [];

  if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
    return value.features.flatMap((feature) => collectFeatures(feature));
  }

  if (value.type === "Feature" && "geometry" in value) {
    const properties = isRecord(value.properties) ? value.properties : {};
    return [{ geometry: value.geometry, properties }];
  }

  if (typeof value.type === "string" && "coordinates" in value) {
    return [{ geometry: value, properties: {} }];
  }

  return [];
}

function normalizeRing(value: unknown): Coordinate[] {
  if (!Array.isArray(value)) return [];

  const points = value
    .map((item) => normalizeCoordinate(item))
    .filter((item): item is Coordinate => item !== null);

  if (points.length > 1 && coordinatesEqual(points[0], points.at(-1))) {
    return points.slice(0, -1);
  }

  return points;
}

function normalizeCoordinate(value: unknown): Coordinate | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lng = Number(value[0]);
  const lat = Number(value[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
}

function getEditPoints(rings: Coordinate[][], lines: Coordinate[][]) {
  if (rings[0]) {
    return rings[0];
  }

  if (lines[0]) {
    return lines[0];
  }

  return [];
}

function createBoundaryGeoJson(points: Coordinate[], siteMarkers: SiteMarker[] = []) {
  const features: Record<string, unknown>[] = [];

  if (points.length === 1 || points.length === 2) {
    features.push({
      type: "Feature",
      properties: {
        name: "Baufeld",
      },
      geometry: {
        type: "LineString",
        coordinates: points,
      },
    });
  } else if (points.length >= 3) {
    features.push({
      type: "Feature",
      properties: {
        name: "Baufeld",
      },
      geometry: {
        type: "Polygon",
        coordinates: [[...points, points[0]]],
      },
    });
  }

  for (const marker of siteMarkers) {
    features.push({
      type: "Feature",
      properties: {
        id: marker.id,
        kind: "site-marker",
        markerType: marker.type,
        rotationDegrees: marker.rotationDegrees,
      },
      geometry: {
        type: "Point",
        coordinates: [marker.longitude, marker.latitude],
      },
    });
  }

  if (features.length === 0) {
    return "";
  }

  return JSON.stringify({
    type: "FeatureCollection",
    features,
  });
}

function coordinatesEqual(a: Coordinate | undefined, b: Coordinate | undefined) {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
