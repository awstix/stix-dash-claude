import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createInventoryCategory,
  updateInventoryCategory,
} from "./actions";
import { InventoryCategoryEditDialog } from "./InventoryCategoryEditDialog";
import { InventorySubcategoryRows } from "./InventorySubcategoryRows";

export default async function InventoryCategoriesPage() {
  const categories = await prisma.inventoryCategory.findMany({
    include: {
      _count: {
        select: {
          childCategories: true,
          items: true,
        },
      },
      parentCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      childCategories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          isActive: true,
          name: true,
          nextObjectNumber: true,
          objectNumberEnd: true,
          objectNumberStart: true,
          sortOrder: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
    objectNumberEnd: category.objectNumberEnd,
    objectNumberStart: category.objectNumberStart,
    parentCategoryId: category.parentCategoryId,
  }));
  const rootCategories = categories.filter((category) => !category.parentCategoryId);

  return (
    <AppShell
      title="Inventarkategorien"
      description="Kategorien für Inventarobjekte, Lagerobjekte, Maschinen, Werkzeuge und Containerobjekte."
    >
      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Kategorie anlegen
        </h2>
        <InventoryCategoryForm
          action={createInventoryCategory}
          categoryOptions={categoryOptions}
        />
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
                <th className="p-3">Nummernkreis</th>
                <th className="p-3">Nächste Objekt-ID</th>
                <th className="p-3">Verwendung</th>
                <th className="p-3">BTB</th>
                <th className="p-3">Sortierung</th>
                <th className="p-3">Status</th>
                <th className="p-3">Objekte</th>
                <th className="p-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rootCategories.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={10}>
                    Noch keine Inventarkategorien angelegt.
                  </td>
                </tr>
              ) : (
                rootCategories.map((category) => (
                  <tr className="border-t border-gray-100" key={category.id}>
                    <td className="p-3 font-semibold text-gray-900">
                      <div>{category.name}</div>
                      {category.childCategories.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {category.childCategories.map((childCategory) => (
                            <div
                              className="rounded-lg bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700"
                              key={childCategory.id}
                            >
                              ↳ {childCategory.name} ·{" "}
                              {formatObjectNumberRange(
                                childCategory.objectNumberStart,
                                childCategory.objectNumberEnd,
                              )}
                              {childCategory.isActive ? "" : " · inaktiv"}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-gray-600">
                      {category.description || "—"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {formatObjectNumberRange(
                        category.objectNumberStart,
                        category.objectNumberEnd,
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {formatObjectNumber(category.nextObjectNumber)}
                    </td>
                    <td className="p-3">
                      <UsageBadges category={category} />
                    </td>
                    <td className="p-3 text-gray-600">
                      {getDailyReportSectionLabel(category.dailyReportSection)}
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
                      <InventoryCategoryEditDialog category={category}>
                        <InventoryCategoryForm
                          action={updateInventoryCategory}
                          category={category}
                          categoryOptions={categoryOptions}
                        />
                      </InventoryCategoryEditDialog>
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
  categoryOptions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  category?: {
    colorClass: string | null;
    dailyReportSection: string;
    description: string | null;
    id: string;
    isActive: boolean;
    name: string;
    nextObjectNumber: number | null;
    objectNumberEnd: number | null;
    objectNumberStart: number | null;
    parentCategoryId: string | null;
    sortOrder: number;
    childCategories?: {
      id: string;
      isActive: boolean;
      name: string;
      nextObjectNumber: number | null;
      objectNumberEnd: number | null;
      objectNumberStart: number | null;
      sortOrder: number;
    }[];
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDisposition: boolean;
  };
  categoryOptions: {
    id: string;
    name: string;
    objectNumberEnd: number | null;
    objectNumberStart: number | null;
    parentCategoryId: string | null;
  }[];
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

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        Übergeordnete Kategorie
        <select
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.parentCategoryId ?? "__none"}
          name="parentCategoryId"
        >
          <option value="__none">Keine / Hauptkategorie</option>
          {categoryOptions
            .filter((option) => option.id !== category?.id)
            .map((option) => (
              <option key={option.id} value={option.id}>
                {option.parentCategoryId ? "↳ " : ""}
                {option.name}
                {" · "}
                {formatObjectNumberRange(
                  option.objectNumberStart,
                  option.objectNumberEnd,
                )}
              </option>
            ))}
        </select>
        <span className="mt-1 block text-xs text-gray-500">
          Unterkategorien dürfen eigene Nummernkreise haben, aber nur innerhalb
          der übergeordneten Kategorie.
        </span>
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

      <div className="grid grid-cols-2 gap-3 xl:col-span-2">
        <label className="text-sm font-medium text-gray-800">
          Nummernkreis von
          <input
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            defaultValue={formatObjectNumberInput(category?.objectNumberStart)}
            inputMode="numeric"
            maxLength={6}
            name="objectNumberStart"
            placeholder="z.B. 100001"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          bis
          <input
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            defaultValue={formatObjectNumberInput(category?.objectNumberEnd)}
            inputMode="numeric"
            maxLength={6}
            name="objectNumberEnd"
            placeholder="z.B. 100499"
          />
        </label>
      </div>

      <label className="text-sm font-medium text-gray-800">
        Nächste Objekt-ID
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={formatObjectNumberInput(category?.nextObjectNumber)}
          inputMode="numeric"
          maxLength={6}
          name="nextObjectNumber"
          placeholder="leer = von"
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

      <InventorySubcategoryRows
        initialRows={(category?.childCategories ?? []).map((childCategory) => ({
          id: childCategory.id,
          isActive: childCategory.isActive,
          isExisting: true,
          name: childCategory.name,
          nextObjectNumber: formatObjectNumberInput(
            childCategory.nextObjectNumber,
          ),
          objectNumberEnd: formatObjectNumberInput(
            childCategory.objectNumberEnd,
          ),
          objectNumberStart: formatObjectNumberInput(
            childCategory.objectNumberStart,
          ),
          sortOrder: String(childCategory.sortOrder),
        }))}
      />

      <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <input
          className="h-4 w-4 rounded border-gray-300"
          defaultChecked={category?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        Aktiv
      </label>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 xl:col-span-3">
        <div className="text-sm font-semibold text-gray-900">Verwendung</div>
        <p className="mt-1 text-xs text-gray-500">
          Inventar/Lager gilt immer automatisch für alle Inventarkategorien.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Checkbox
            defaultChecked={category?.useInTruckDispatchMaterial ?? false}
            label="Als Material/Schüttgut in LKW-Dispo verwenden"
            name="useInTruckDispatchMaterial"
          />
          <Checkbox
            defaultChecked={category?.useInTruckDispatchObject ?? false}
            label="Als Gerät/Objekt per LKW transportierbar"
            name="useInTruckDispatchObject"
          />
          <Checkbox
            defaultChecked={category?.useInDailyReports ?? false}
            label="BTB"
            name="useInDailyReports"
          />
        </div>
      </div>

      <label className="text-sm font-medium text-gray-800 xl:col-span-2">
        BTB-Zuordnung
        <select
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={category?.dailyReportSection ?? "NONE"}
          name="dailyReportSection"
        >
          <option value="NONE">Nicht im BTB verwenden</option>
          <option value="MATERIAL">Material</option>
          <option value="MACHINES">Maschinen und Geräte</option>
          <option value="OTHER">Sonstiges</option>
        </select>
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

function Checkbox({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
      <input
        className="h-4 w-4 rounded border-gray-300"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function UsageBadges({
  category,
}: {
  category: {
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDisposition: boolean;
  };
}) {
  const badges = [
    category.useInTruckDispatchMaterial ? "LKW Material" : null,
    category.useInTruckDispatchObject ? "LKW Gerät" : null,
    category.useInDailyReports ? "BTB" : null,
  ].filter(Boolean);

  if (badges.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900"
          key={badge}
        >
          {badge}
        </span>
      ))}
    </div>
  );
}

function getDailyReportSectionLabel(value: string | null | undefined) {
  if (value === "MATERIAL") return "Material";
  if (value === "MACHINES") return "Maschinen und Geräte";
  if (value === "OTHER") return "Sonstiges";

  return "—";
}

function formatObjectNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";

  return String(value).padStart(6, "0");
}

function formatObjectNumberInput(value: number | null | undefined) {
  if (value === null || value === undefined) return "";

  return String(value).padStart(6, "0");
}

function formatObjectNumberRange(
  start: number | null | undefined,
  end: number | null | undefined,
) {
  if (start === null || start === undefined || end === null || end === undefined) {
    return "—";
  }

  return `${formatObjectNumber(start)} – ${formatObjectNumber(end)}`;
}
