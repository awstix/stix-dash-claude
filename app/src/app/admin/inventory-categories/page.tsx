import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createInventoryCategory,
  deleteInventoryCategory,
  updateInventoryCategory,
} from "./actions";

export default async function InventoryCategoriesPage() {
  const categories = await prisma.inventoryCategory.findMany({
    include: {
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell
      title="Inventarkategorien"
      description="Kategorien für Inventarobjekte, Lagerobjekte, Maschinen, Werkzeuge und Containerobjekte."
    >
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Kategorie anlegen
        </h2>
        <InventoryCategoryForm action={createInventoryCategory} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Kategorien
        </h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Beschreibung</th>
                <th className="p-3">Sortierung</th>
                <th className="p-3">Status</th>
                <th className="p-3">Objekte</th>
                <th className="p-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={6}>
                    Noch keine Inventarkategorien angelegt.
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr className="border-t border-gray-100" key={category.id}>
                    <td className="p-3 font-semibold text-gray-900">
                      {category.name}
                    </td>
                    <td className="p-3 text-gray-600">
                      {category.description || "—"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {category.sortOrder}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          category.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {category.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">
                      {category._count.items}
                    </td>
                    <td className="p-3">
                      <details className="relative">
                        <summary className="inline-flex cursor-pointer list-none rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
                          Bearbeiten
                        </summary>
                        <div className="absolute right-0 top-10 z-20 w-[min(720px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
                          <InventoryCategoryForm
                            action={updateInventoryCategory}
                            category={category}
                          />

                          <form action={deleteInventoryCategory} className="mt-3">
                            <input
                              name="id"
                              type="hidden"
                              value={category.id}
                            />
                            <button
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              type="submit"
                            >
                              Kategorie löschen
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

function InventoryCategoryForm({
  action,
  category,
}: {
  action: (formData: FormData) => void | Promise<void>;
  category?: {
    colorClass: string | null;
    description: string | null;
    id: string;
    isActive: boolean;
    name: string;
    sortOrder: number;
  };
}) {
  return (
    <form
      action={action}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
    >
      {category ? <input name="id" type="hidden" value={category.id} /> : null}

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Name
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.name ?? ""}
          name="name"
          required
        />
      </label>

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Beschreibung
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.description ?? ""}
          name="description"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Farbe/Klasse
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.colorClass ?? ""}
          name="colorClass"
          placeholder="optional"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Sortierung
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.sortOrder ?? 0}
          name="sortOrder"
          type="number"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <input
          className="h-4 w-4 rounded border-gray-300"
          defaultChecked={category?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        Aktiv
      </label>

      <div className="flex items-end">
        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Speichern
        </button>
      </div>
    </form>
  );
}
