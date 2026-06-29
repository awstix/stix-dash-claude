import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { deleteInventoryItem, updateInventoryItem } from "./actions";
import { InventoryItemForm } from "./InventoryItemForm";

function formatMoney(cents: number | null) {
  if (cents === null) return "—";

  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatNumber(value: number | null) {
  if (value === null) return "";

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value);
}

function getResponsibleLabel(item: {
  responsibleCrew: { name: string } | null;
  responsibleEmployee: { firstName: string; lastName: string } | null;
  responsibleType: string | null;
}) {
  if (item.responsibleType === "EMPLOYEE" && item.responsibleEmployee) {
    return `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`;
  }

  if (item.responsibleType === "CREW" && item.responsibleCrew) {
    return item.responsibleCrew.name;
  }

  return "—";
}

function getInventorySearchText(item: {
  category: { name: string } | null;
  inventoryNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  name: string;
  serialNumber: string | null;
}) {
  return [
    item.name,
    item.category?.name,
    item.manufacturer,
    item.model,
    item.serialNumber,
    item.inventoryNumber,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();

  const [categories, crews, employees, items, projects, vehicles] =
    await Promise.all([
      prisma.inventoryCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.crew.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.employee.findMany({
        where: {
          statusValue: {
            not: "left",
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.inventoryItem.findMany({
        include: {
          category: true,
          currentProject: true,
          contacts: {
            orderBy: [{ role: "asc" }, { name: "asc" }],
          },
          parentItem: true,
          photos: {
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
          responsibleCrew: true,
          responsibleEmployee: true,
          vehicle: true,
          _count: {
            select: {
              childItems: true,
              photos: true,
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      }),
      prisma.project.findMany({
        orderBy: [{ projectNumber: "desc" }],
        take: 250,
      }),
      prisma.vehicle.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ vehicleNumber: "asc" }],
      }),
    ]);

  const containerOptions = items
    .filter((item) => item.isContainer)
    .sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

  const filteredItems = searchQuery
    ? items.filter((item) =>
        getInventorySearchText(item).includes(searchQuery.toLowerCase()),
      )
    : items;

  const stockManagedCount = items.filter((item) => item.isStockManaged).length;
  const containerCount = items.filter((item) => item.isContainer).length;

  return (
    <AppShell
      title="Inventarverwaltung"
      description="Erste Grundverwaltung für Geräte, Maschinen, Werkzeuge, Containerobjekte und Lagerobjekte."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Inventarobjekte" value={String(items.length)} />
        <SummaryCard label="Containerobjekte" value={String(containerCount)} />
        <SummaryCard label="Lagergeführt" value={String(stockManagedCount)} />
        <SummaryCard
          label="Kategorien"
          value={String(categories.length)}
        />
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar verwalten
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Übersicht aller Inventarobjekte. Neue Objekte werden auf einer
              eigenen Eingabeseite angelegt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              href="/inventory/new"
            >
              + Objekt anlegen
            </Link>
            <Link
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/inventory-categories"
            >
              Kategorien pflegen →
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {filteredItems.length} von {items.length} Objekten sichtbar.
            </p>
          </div>

          <form className="flex w-full gap-2 md:w-auto">
            <input
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 md:w-80"
              defaultValue={searchQuery}
              name="q"
              placeholder="Suche nach Name, Nummer, Seriennummer..."
            />
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Suchen
            </button>
          </form>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1500px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Objekt</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Inventarnr.</th>
                <th className="p-3">Seriennr.</th>
                <th className="p-3">Verantwortlich</th>
                <th className="p-3">Baustelle</th>
                <th className="p-3">Container</th>
                <th className="p-3">Lager</th>
                <th className="p-3">Satz</th>
                <th className="p-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={10}>
                    Noch keine passenden Inventarobjekte vorhanden.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr className="border-t border-gray-100" key={item.id}>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">
                        <Link className="hover:underline" href={`/inventory/${item.id}`}>
                          {item.name}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500">
                        {[item.manufacturer, item.model].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.category?.name ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.inventoryNumber ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.serialNumber ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {getResponsibleLabel(item)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.currentProject
                        ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                        : "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.isContainer
                        ? `${item._count.childItems} enthalten`
                        : item.parentItem?.name ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.isStockManaged
                        ? `${formatNumber(item.currentStock)} ${item.stockUnit}`
                        : "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatMoney(item.billingRateCents)}
                    </td>
                    <td className="p-3">
                      <details className="relative">
                        <summary className="inline-flex cursor-pointer list-none rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                          Bearbeiten
                        </summary>
                        <div className="absolute right-0 top-10 z-30 max-h-[80vh] w-[min(1100px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                          <InventoryItemForm
                            action={updateInventoryItem}
                            categories={categories}
                            containerOptions={containerOptions.filter(
                              (container) => container.id !== item.id,
                            )}
                            crews={crews}
                            employees={employees}
                            item={item}
                            projects={projects}
                            vehicles={vehicles}
                          />

                          <form action={deleteInventoryItem} className="mt-3">
                            <input name="id" type="hidden" value={item.id} />
                            <button
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              type="submit"
                            >
                              Inventarobjekt löschen
                            </button>
                          </form>
                        </div>
                      </details>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
