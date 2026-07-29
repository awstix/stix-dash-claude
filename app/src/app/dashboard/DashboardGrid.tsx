"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { saveDashboardWidgets } from "./actions";

type Tile = {
  description: string;
  height: number;
  href: string;
  key: string;
  title: string;
  value?: string;
  width: number;
};

export function DashboardGrid({
  available,
  initial,
}: {
  available: Omit<Tile, "height" | "width">[];
  initial: Tile[];
}) {
  const [editing, setEditing] = useState(false);
  const [tiles, setTiles] = useState(initial);
  const pinned = useMemo(() => new Set(tiles.map((tile) => tile.key)), [tiles]);

  function change(index: number, patch: Partial<Tile>) {
    setTiles((current) =>
      current.map((tile, tileIndex) =>
        tileIndex === index ? { ...tile, ...patch } : tile,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setTiles((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
            <div className="flex flex-wrap gap-2">
              {available
                .filter((tile) => !pinned.has(tile.key))
                .map((tile) => (
                  <button
                    className="rounded-lg border border-gray-500 bg-white px-3 py-2 text-sm font-black text-gray-950"
                    key={tile.key}
                    onClick={() =>
                      setTiles((current) => [
                        ...current,
                        { ...tile, height: 2, width: 2 },
                      ])
                    }
                    type="button"
                  >
                    + {tile.title}
                  </button>
                ))}
            </div>
            <button className="mt-4 rounded-xl bg-green-800 px-4 py-2 font-black text-white">
              Raster dauerhaft speichern
            </button>
          </div>
        ) : null}

        <div className="grid auto-rows-[112px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-8">
          {tiles.map((tile, index) => (
            <article
              className="relative overflow-hidden rounded-2xl border border-gray-300 bg-white p-4 text-gray-950 shadow-sm"
              key={tile.key}
              style={{
                gridColumn: `span ${Math.min(8, Math.max(1, tile.width))}`,
                gridRow: `span ${Math.min(6, Math.max(1, tile.height))}`,
              }}
            >
              {editing ? (
                <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white p-2 text-xs font-black text-gray-950 shadow-lg">
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <ActionIcon className="mx-1 h-4 w-4" name="move" />
                    <button className="rounded-md bg-white px-2 py-1 shadow-sm hover:bg-gray-200" onClick={() => move(index, -1)} type="button" title="Kachel nach vorne verschieben">
                      Vor
                    </button>
                    <button className="rounded-md bg-white px-2 py-1 shadow-sm hover:bg-gray-200" onClick={() => move(index, 1)} type="button" title="Kachel nach hinten verschieben">
                      Zurück
                    </button>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <span className="px-1">Breite</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => change(index, { width: Math.max(1, tile.width - 1) })} type="button" title="Kachel schmaler">
                      −
                    </button>
                    <span className="min-w-5 text-center">{tile.width}</span>
                    <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-base shadow-sm hover:bg-gray-200" onClick={() => change(index, { width: Math.min(8, tile.width + 1) })} type="button" title="Kachel breiter">
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
              <Link className={`block h-full ${editing ? "pt-9" : ""}`} href={tile.href}>
                <div className="flex h-full flex-col">
                  <h3 className="font-black">{tile.title}</h3>
                  {tile.value ? <p className="mt-2 text-3xl font-black">{tile.value}</p> : null}
                  <p className="mt-2 text-sm font-bold text-gray-950">{tile.description}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </form>
    </section>
  );
}
