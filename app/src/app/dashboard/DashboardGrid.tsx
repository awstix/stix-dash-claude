"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { ProjectMap } from "@/app/projects/ProjectMap";
import {
  DashboardPhotoWidget,
  type DashboardPhoto,
} from "./DashboardPhotoWidget";
import { saveDashboardWidgets } from "./actions";

type Tile = {
  category: string;
  description: string;
  height: number;
  href: string;
  key: string;
  title: string;
  subcategory: string;
  value?: string;
  items?: string[];
  photos?: DashboardPhoto[];
  map?: {
    latitude: number;
    longitude: number;
    zoom: number;
    markers: Array<{
      employees?: string[];
      label: string;
      latitude: number;
      longitude: number;
    }>;
  };
  width: number;
  gridX: number;
  gridY: number;
};

export function DashboardGrid({
  available,
  initial,
}: {
  available: Omit<Tile, "height" | "width" | "gridX" | "gridY">[];
  initial: Tile[];
}) {
  const [editing, setEditing] = useState(false);
  const [tiles, setTiles] = useState(initial);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    columnStepPx: number;
    rowStepPx: number;
    startClientX: number;
    startClientY: number;
    startGridX: number;
    startGridY: number;
  } | null>(null);
  const pinned = useMemo(() => new Set(tiles.map((tile) => tile.key)), [tiles]);
  const groupedAvailable = useMemo(() => {
    const groups = new Map<string, Map<string, Omit<Tile, "height" | "width" | "gridX" | "gridY">[]>>();
    for (const tile of available.filter((item) => !pinned.has(item.key))) {
      const category = groups.get(tile.category) ?? new Map();
      const subcategory = category.get(tile.subcategory) ?? [];
      subcategory.push(tile);
      category.set(tile.subcategory, subcategory);
      groups.set(tile.category, category);
    }
    return groups;
  }, [available, pinned]);

  function change(index: number, patch: Partial<Tile>) {
    setTiles((current) =>
      current.map((tile, tileIndex) =>
        tileIndex === index ? { ...tile, ...patch } : tile,
      ),
    );
  }

  function moveOnGrid(index: number, deltaX: number, deltaY: number) {
    setTiles((current) => {
      const next = [...current];
      const tile = current[index];
      const moved = {
        ...tile,
        gridX: Math.min(8 - tile.width, Math.max(0, tile.gridX + deltaX)),
        gridY: Math.max(0, tile.gridY + deltaY),
      };
      if (moved.gridX === tile.gridX && moved.gridY === tile.gridY) return current;

      const collisionIndex = current.findIndex((other, otherIndex) => {
        if (otherIndex === index) return false;
        return (
          moved.gridX < other.gridX + other.width &&
          moved.gridX + moved.width > other.gridX &&
          moved.gridY < other.gridY + other.height &&
          moved.gridY + moved.height > other.gridY
        );
      });

      next[index] = moved;
      if (collisionIndex >= 0) {
        const collided = current[collisionIndex];
        next[collisionIndex] = {
          ...collided,
          gridX: Math.min(8 - collided.width, tile.gridX),
          gridY: tile.gridY,
        };
      }
      return next;
    });
  }

  // Free-drag repositioning (in addition to the arrow buttons, which stay
  // as a precise fallback). Grid column width is fractional/responsive,
  // so the column step is measured from the grid container's own
  // rendered width at drag-start rather than assumed - row height is
  // fixed (112px + 16px gap) via `auto-rows-[112px] gap-4`.
  function handleTilePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    index: number,
  ) {
    const containerRect = gridContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const tile = tiles[index];
    dragRef.current = {
      columnStepPx: (containerRect.width + 16) / 8,
      rowStepPx: 112 + 16,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGridX: tile.gridX,
      startGridY: tile.gridY,
    };
    setDraggingIndex(index);
  }

  function handleTilePointerMove(
    event: React.PointerEvent<HTMLDivElement>,
    index: number,
  ) {
    const drag = dragRef.current;
    if (!drag) return;
    event.stopPropagation();

    const tile = tiles[index];
    const deltaCols = Math.round(
      (event.clientX - drag.startClientX) / drag.columnStepPx,
    );
    const deltaRows = Math.round(
      (event.clientY - drag.startClientY) / drag.rowStepPx,
    );
    const nextGridX = Math.min(
      8 - tile.width,
      Math.max(0, drag.startGridX + deltaCols),
    );
    const nextGridY = Math.max(0, drag.startGridY + deltaRows);
    if (nextGridX === tile.gridX && nextGridY === tile.gridY) return;

    change(index, { gridX: nextGridX, gridY: nextGridY });
  }

  // On drop: a single overlapping tile swaps places (mirrors the arrow
  // buttons' existing collision behaviour exactly); overlapping more than
  // one tile has no clean single-swap answer, so the dragged tile just
  // snaps back to where it started instead of guessing a reflow.
  function handleTilePointerUp(
    event: React.PointerEvent<HTMLDivElement>,
    index: number,
  ) {
    const drag = dragRef.current;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDraggingIndex(null);
    if (!drag) return;

    setTiles((current) => {
      const tile = current[index];
      const collisions = current.filter(
        (other, otherIndex) =>
          otherIndex !== index &&
          tile.gridX < other.gridX + other.width &&
          tile.gridX + tile.width > other.gridX &&
          tile.gridY < other.gridY + other.height &&
          tile.gridY + tile.height > other.gridY,
      );

      if (collisions.length === 0) return current;

      const next = [...current];
      if (collisions.length === 1) {
        const collidedIndex = current.indexOf(collisions[0]);
        next[collidedIndex] = {
          ...collisions[0],
          gridX: Math.min(8 - collisions[0].width, drag.startGridX),
          gridY: drag.startGridY,
        };
        return next;
      }

      next[index] = { ...tile, gridX: drag.startGridX, gridY: drag.startGridY };
      return next;
    });
  }

  function defaultSize(tile: Omit<Tile, "height" | "width" | "gridX" | "gridY">) {
    if (tile.key === "project-map") return { height: 4, width: 4 };
    if (tile.key === "project-photos") return { height: 4, width: 4 };
    if (tile.items?.length) return { height: 3, width: 3 };
    return { height: 2, width: 2 };
  }

  return (
    <section className="mb-6 text-gray-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Mein Dashboard</h2>
          <p className="mt-1 text-sm font-bold text-gray-950">
            Persönliches 8-Spalten-Raster – auf allen Geräten gespeichert.
          </p>
        </div>
        <button
          className="rounded-xl bg-gray-950 px-4 py-2 font-black text-white"
          onClick={() => setEditing((value) => !value)}
          type="button"
        >
          {editing ? "Bearbeitung schließen" : "Dashboard anpassen"}
        </button>
      </div>

      <form action={saveDashboardWidgets}>
        <input name="widgetLayout" type="hidden" value={JSON.stringify(tiles)} />
        {editing ? (
          <div className="mb-4 rounded-2xl border border-gray-400 bg-white p-4 shadow-sm">
            <div className="space-y-3">
              {[...groupedAvailable].map(([category, subcategories]) => (
                <details className="rounded-xl border border-gray-400 bg-gray-50" key={category}>
                  <summary className="cursor-pointer list-none px-4 py-3 text-base font-black text-gray-950">
                    {category}
                  </summary>
                  <div className="space-y-3 border-t border-gray-300 p-3">
                    {[...subcategories].map(([subcategory, entries]) => (
                      <div key={subcategory}>
                        <h3 className="mb-2 text-sm font-black text-gray-950">{subcategory}</h3>
                        <div className="flex flex-wrap gap-2">
                          {entries.map((tile) => (
                            <button
                              className="rounded-lg border border-gray-500 bg-white px-3 py-2 text-sm font-black text-gray-950 hover:bg-gray-200"
                              key={tile.key}
                              onClick={() =>
                                setTiles((current) => {
                                  const size = defaultSize(tile);
                                  const gridY = current.reduce(
                                    (lowest, entry) => Math.max(lowest, entry.gridY + entry.height),
                                    0,
                                  );
                                  return [
                                    ...current,
                                    { ...tile, ...size, gridX: 0, gridY },
                                  ];
                                })
                              }
                              type="button"
                            >
                              + {tile.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <button className="mt-4 rounded-xl bg-green-800 px-4 py-2 font-black text-white">
              Raster dauerhaft speichern
            </button>
          </div>
        ) : null}

        <div
          className="grid auto-flow-row-dense auto-rows-[112px] grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-8"
          ref={gridContainerRef}
        >
          {tiles.map((tile, index) => (
            <article
              className={`dashboard-grid-tile relative overflow-hidden rounded-2xl border bg-white p-4 text-gray-950 shadow-sm ${
                draggingIndex === index
                  ? "z-20 border-gray-900 shadow-xl"
                  : "border-gray-300"
              }`}
              key={tile.key}
              style={{
                "--dashboard-column": tile.gridX + 1,
                "--dashboard-row": tile.gridY + 1,
                "--dashboard-width": Math.min(8, Math.max(1, tile.width)),
                "--dashboard-height": Math.min(6, Math.max(1, tile.height)),
              } as CSSProperties}
            >
              {editing ? (
                <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-2 text-xs font-black text-gray-950 shadow-lg">
                  <div className="w-full truncate border-b border-gray-300 px-1 pb-2 text-sm font-black text-gray-950" title={tile.title}>
                    {tile.title}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <div
                      className="touch-none cursor-grab rounded-md p-1 active:cursor-grabbing"
                      onPointerDown={(event) => handleTilePointerDown(event, index)}
                      onPointerMove={(event) => handleTilePointerMove(event, index)}
                      onPointerUp={(event) => handleTilePointerUp(event, index)}
                      title="Ziehen, um die Kachel frei zu platzieren"
                    >
                      <ActionIcon className="mx-1 h-4 w-4" name="move" />
                    </div>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => moveOnGrid(index, -1, 0)} type="button" title="Kachel nach links">
                      ←
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => moveOnGrid(index, 1, 0)} type="button" title="Kachel nach rechts">
                      →
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => moveOnGrid(index, 0, -1)} type="button" title="Kachel nach oben">
                      ↑
                    </button>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => moveOnGrid(index, 0, 1)} type="button" title="Kachel nach unten">
                      ↓
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <span className="px-1">Breite</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => change(index, { width: Math.max(1, tile.width - 1) })} type="button" title="Kachel schmaler">
                      −
                    </button>
                    <span className="min-w-5 text-center">{tile.width}</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => {
                      const width = Math.min(8, tile.width + 1);
                      change(index, { gridX: Math.min(tile.gridX, 8 - width), width });
                    }} type="button" title="Kachel breiter">
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <span className="px-1">Höhe</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => change(index, { height: Math.max(1, tile.height - 1) })} type="button" title="Kachel niedriger">
                      −
                    </button>
                    <span className="min-w-5 text-center">{tile.height}</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => change(index, { height: Math.min(6, tile.height + 1) })} type="button" title="Kachel höher">
                      +
                    </button>
                  </div>
                  <button className="ml-auto inline-flex items-center gap-1 rounded-lg bg-red-800 px-2 py-2 font-black text-white hover:bg-red-700" onClick={() => setTiles((current) => current.filter((_, i) => i !== index))} type="button" title="Kachel entfernen">
                    <ActionIcon className="h-4 w-4" name="delete" />
                    Entfernen
                  </button>
                </div>
              ) : null}
              {tile.photos ? (
                <DashboardPhotoWidget
                  description={tile.description}
                  editing={editing}
                  photos={tile.photos}
                  title={tile.title}
                />
              ) : tile.map ? (
                <div className={`flex h-full min-h-0 flex-col ${editing ? "pt-28" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{tile.title}</h3>
                      <p className="mt-1 text-sm font-bold text-gray-950">
                        {tile.description}
                      </p>
                    </div>
                    {tile.value ? (
                      <span className="shrink-0 rounded-lg bg-gray-950 px-2 py-1 text-xs font-black text-white">
                        {tile.value}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="mt-3 min-h-0 flex-1 overflow-hidden rounded-xl"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <DashboardProjectMap map={tile.map} />
                  </div>
                </div>
              ) : (
              <Link className={`block h-full min-h-0 ${editing ? "pt-28" : ""}`} href={tile.href}>
                <div className="flex h-full min-h-0 flex-col">
                  <h3 className="font-black">{tile.title}</h3>
                  {tile.value ? <p className="mt-2 text-3xl font-black">{tile.value}</p> : null}
                  <p className="mt-2 text-sm font-bold text-gray-950">{tile.description}</p>
                  {tile.items?.length ? (
                    <div
                      className="dashboard-widget-scroll mt-3 min-h-0 flex-1 touch-pan-y space-y-1 overflow-y-auto overscroll-contain pr-1"
                      onClick={(event) => event.preventDefault()}
                      onWheel={(event) => event.stopPropagation()}
                    >
                      {tile.items.map((item, itemIndex) => (
                        <div className="truncate rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-sm font-bold" key={`${item}-${itemIndex}`}>
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Link>
              )}
            </article>
          ))}
        </div>
        <style>{`
          .dashboard-grid-tile {
            grid-column: span var(--dashboard-width);
            grid-row: span var(--dashboard-height);
          }
          @media (min-width: 1280px) {
            .dashboard-grid-tile {
              grid-column: var(--dashboard-column) / span var(--dashboard-width);
              grid-row: var(--dashboard-row) / span var(--dashboard-height);
            }
          }
          .dashboard-widget-scroll {
            scrollbar-color: #374151 #e5e7eb;
            scrollbar-width: thin;
          }
          .dashboard-widget-scroll::-webkit-scrollbar {
            width: 8px;
          }
          .dashboard-widget-scroll::-webkit-scrollbar-track {
            background: #e5e7eb;
            border-radius: 999px;
          }
          .dashboard-widget-scroll::-webkit-scrollbar-thumb {
            background: #374151;
            border-radius: 999px;
          }
        `}</style>
      </form>
    </section>
  );
}

function DashboardProjectMap({
  map,
}: {
  map: NonNullable<Tile["map"]>;
}) {
  const [view, setView] = useState({
    latitude: map.latitude,
    longitude: map.longitude,
    zoom: map.zoom,
  });

  return (
    <ProjectMap
      className="h-full"
      editable
      heightClass="h-full min-h-0"
      latitude={view.latitude}
      longitude={view.longitude}
      markers={map.markers}
      onViewChange={setView}
      zoom={view.zoom}
    />
  );
}
