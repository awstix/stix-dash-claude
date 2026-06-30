"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { assignInventoryItemToContainer } from "./actions";

type ContainerItem = {
  category: { name: string } | null;
  id: string;
  inventoryNumber: string | null;
  name: string;
  objectNumber: string | null;
  photos: { url: string }[];
};

type AssignableItem = {
  id: string;
  inventoryNumber: string | null;
  name: string;
  objectNumber: string | null;
  parentItem: { name: string } | null;
  photos: { url: string }[];
};

export function InventoryContainerManager({
  assignableItems,
  childItems,
  container,
}: {
  assignableItems: AssignableItem[];
  childItems: ContainerItem[];
  container: {
    id: string;
    inventoryNumber: string | null;
    name: string;
    objectNumber: string | null;
  };
}) {
  const [search, setSearch] = useState("");

  const filteredAssignableItems = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return assignableItems;

    return assignableItems.filter((item) =>
      [
        item.objectNumber,
        item.inventoryNumber,
        item.name,
        item.parentItem?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [assignableItems, search]);

  const containerLabel = [container.objectNumber, container.inventoryNumber, container.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Container / Inhalt
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Enthaltene Objekte, z.B. Löffel am Bagger oder Werkzeuge in einer
            Kiste.
          </p>
        </div>
        <Link
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          href={`/inventory/new?containerId=${container.id}`}
        >
          + Neues Objekt in Container
        </Link>
      </div>

      <form
        action={assignInventoryItemToContainer}
        className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
      >
        <input name="containerId" type="hidden" value={container.id} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <label className="text-sm font-semibold text-gray-800">
            Suchen / Filtern
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Name, Inventarnummer, aktueller Container..."
              type="search"
              value={search}
            />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Bestehendes Objekt zuweisen
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              name="childItemId"
              required
            >
              <option value="">
                {filteredAssignableItems.length} Objekt
                {filteredAssignableItems.length === 1 ? "" : "e"} gefunden
              </option>
              {filteredAssignableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.objectNumber, item.inventoryNumber, item.name]
                    .filter(Boolean)
                    .join(" · ")}
                  {item.parentItem ? ` · aktuell in ${item.parentItem.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Zuweisen
          </button>
        </div>
      </form>

      {childItems.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          Keine Unterobjekte hinterlegt.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {childItems.map((child) => (
            <div
              className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
              key={child.id}
            >
              <InventoryObjectPhoto name={child.name} url={child.photos[0]?.url} />
              <div className="min-w-0 flex-1">
                <Link
                  className="font-semibold text-gray-900 hover:underline"
                  href={`/inventory/${child.id}`}
                >
                  {[child.objectNumber, child.inventoryNumber, child.name]
                    .filter(Boolean)
                    .join(" · ")}
                </Link>
                <div className="mt-1 text-xs text-gray-500">
                  Gehört zu {containerLabel} ·{" "}
                  {child.category?.name ?? "ohne Kategorie"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    href={`/inventory/${child.id}`}
                  >
                    Öffnen
                  </Link>
                  <Link
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    href={`/inventory/${child.id}/edit`}
                  >
                    Foto / Bearbeiten
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function InventoryObjectPhoto({
  name,
  url,
}: {
  name: string;
  url?: string;
}) {
  if (!url) {
    return (
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-xs font-semibold text-gray-400">
        Foto
      </div>
    );
  }

  return (
    <Link
      className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
      href={url}
      title={`${name} Foto öffnen`}
    >
      <Image
        alt={`Foto von ${name}`}
        className="object-cover"
        fill
        sizes="80px"
        src={url}
      />
    </Link>
  );
}
