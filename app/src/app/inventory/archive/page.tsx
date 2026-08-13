import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { LiveSearchInput } from "@/components/LiveSearchInput";
import {
  getInventoryCategoryLabel,
  getInventoryCategoryOptionLabel,
  sortInventoryCategoriesForSelect,
} from "@/lib/inventory-categories";
import { prisma } from "@/lib/prisma";
import { type Prisma } from "@prisma/client";
import {
  deleteInventoryItemPermanently,
  restoreInventoryItem,
} from "../actions";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}

function getInventoryStatusLabel(status: string | null) {
  if (status === "DELETED") return "Gelöscht";
  return "Archiviert";
}

export default async function InventoryArchivePage({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    q?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const categoryFilter = String(params.category ?? "").trim();
  const where: Prisma.InventoryItemWhereInput = {
    status: {
      in: ["INACTIVE", "DELETED"],
    },
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { manufacturer: { contains: searchQuery, mode: "insensitive" } },
            { model: { contains: searchQuery, mode: "insensitive" } },
            { objectNumber: { contains: searchQuery, mode: "insensitive" } },
            { stixId: { contains: searchQuery, mode: "insensitive" } },
            { licensePlate: { contains: searchQuery, mode: "insensitive" } },
            { serialNumber: { contains: searchQuery, mode: "insensitive" } },
            { inventoryNumber: { contains: searchQuery, mode: "insensitive" } },
            { category: { name: { contains: searchQuery, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [categories, items, totalArchivedItems] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        isActive: true,
      },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryItem.findMany({
      where,
      include: {
        category: {
          include: {
            parentCategory: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        responsibleCrew: true,
        responsibleEmployee: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.inventoryItem.count({
      where: {
        status: {
          in: ["INACTIVE", "DELETED"],
        },
      },
    }),
  ]);
  const sortedCategories = sortInventoryCategoriesForSelect(categories);

  return (
    <AppShell
      title="Inventararchiv"
      description="Archivierte Inventarobjekte sind für normale Nutzer ausgeblendet. Hier können sie reaktiviert oder endgültig gelöscht werden."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Archiv
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">
              {totalArchivedItems} archivierte Objekte
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Archivieren setzt ein Objekt auf inaktiv. Die Objekt-ID bleibt
              blockiert, bis das Objekt hier endgültig gelöscht wird.
            </p>
          </div>

          <Link
            className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory"
          >
            ← Zur Inventarverwaltung
          </Link>
        </div>

        <form className="mt-6 grid gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_280px_auto]">
          <input name="q" type="hidden" value={searchQuery} />
          <LiveSearchInput
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            placeholder="Suche nach Objekt-ID, Name, Kennzeichen..."
          />
          <select
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={categoryFilter}
            name="category"
          >
            <option value="">Alle Kategorien</option>
            {sortedCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {getInventoryCategoryOptionLabel(category)}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Filtern
          </button>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-32 p-3">Aktionen</th>
                <th className="p-3">Objekt</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Status</th>
                <th className="p-3">Zuletzt geändert</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={5}>
                    Keine archivierten Inventarobjekte gefunden.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr className="border-t border-gray-100" key={item.id}>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Link
                          aria-label={`${item.name} öffnen`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          href={`/inventory/${item.id}`}
                          title="Öffnen"
                        >
                          <ActionIcon name="open" className="h-4 w-4" />
                        </Link>
                        <form action={restoreInventoryItem}>
                          <input name="id" type="hidden" value={item.id} />
                          <button
                            aria-label={`${item.name} reaktivieren`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-200 bg-white text-green-700 hover:bg-green-50"
                            title="Reaktivieren"
                            type="submit"
                          >
                            ↺
                          </button>
                        </form>
                        <form action={deleteInventoryItemPermanently}>
                          <input name="id" type="hidden" value={item.id} />
                          <button
                            aria-label={`${item.name} endgültig löschen`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            title="Endgültig löschen und Objekt-ID freigeben"
                            type="submit"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-950">
                        {item.objectNumber ? `${item.objectNumber} · ` : ""}
                        {item.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {[item.manufacturer, item.model, item.licensePlate]
                          .filter(Boolean)
                          .join(" · ") || "Keine weiteren Stammdaten"}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.category
                        ? getInventoryCategoryLabel(item.category)
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 ring-1 ring-gray-200">
                        {getInventoryStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">
                      {formatDateTime(item.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
