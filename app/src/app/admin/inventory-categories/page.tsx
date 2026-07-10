import { AppShell } from "@/components/AppShell";
import { ActionIcon } from "@/components/ActionIcon";
import { prisma } from "@/lib/prisma";
import {
  createInventoryCategory,
  deleteInventoryCategory,
  updateInventoryCategory,
} from "./actions";
import { InventoryCategoryEditDialog } from "./InventoryCategoryEditDialog";
import { InventoryCategoryActionForm } from "./InventoryCategoryActionForm";
import { InventoryCategoryImportPanel } from "./InventoryCategoryImportPanel";
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
          asphaltDispositionUsage: true,
          dailyReportMachineLabel: true,
          id: true,
          name: true,
        },
      },
      childCategories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          asphaltDispositionUsage: true,
          dailyReportMachineLabel: true,
          id: true,
          isActive: true,
          name: true,
          nextObjectNumber: true,
          objectNumberEnd: true,
          objectNumberStart: true,
          sortOrder: true,
          useInSpecialVehicleDisposition: true,
          useInTeamManagement: true,
          useInTruckDispatchSelection: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    isActive: category.isActive,
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
          resetOnSuccess
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Kategorien
        </h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[92px]" />
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[21%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Aktionen</th>
                <th className="px-3 py-2">Kategorie</th>
                <th className="px-3 py-2">Nummernkreis</th>
                <th className="px-3 py-2">Nächste ID</th>
                <th className="px-3 py-2">Verwendung / BTB</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Obj.</th>
              </tr>
            </thead>
            <tbody>
              {rootCategories.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={7}>
                    Noch keine Inventarkategorien angelegt.
                  </td>
                </tr>
              ) : (
                rootCategories.map((category) => (
                  <tr className="border-t border-gray-100" key={category.id}>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1">
                        <InventoryCategoryEditDialog category={category}>
                          <InventoryCategoryForm
                            action={updateInventoryCategory}
                            category={category}
                            categoryOptions={categoryOptions}
                          />
                        </InventoryCategoryEditDialog>
                        <form action={deleteInventoryCategory}>
                          <input name="id" type="hidden" value={category.id} />
                          <button
                            aria-label={
                              category._count.items > 0
                                ? `${category.name} deaktivieren`
                                : `${category.name} löschen`
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            title={
                              category._count.items > 0
                                ? "Deaktivieren"
                                : "Löschen"
                            }
                            type="submit"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top font-semibold text-gray-900">
                      <div>{category.name}</div>
                      {category.description ? (
                        <div className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-gray-500">
                          {category.description}
                        </div>
                      ) : null}
                      {category.childCategories.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {category.childCategories.map((childCategory) => (
                            <div
                              className="truncate rounded-lg bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700"
                              key={childCategory.id}
                              title={`${childCategory.name} · ${formatObjectNumberRange(
                                childCategory.objectNumberStart,
                                childCategory.objectNumberEnd,
                              )}`}
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
                    <td className="px-3 py-2 align-top text-gray-600">
                      {formatObjectNumberRange(
                        category.objectNumberStart,
                        category.objectNumberEnd,
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600">
                      {formatObjectNumber(category.nextObjectNumber)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <UsageBadges category={category} />
                      <div className="mt-2 text-xs font-semibold text-gray-500">
                        BTB:{" "}
                        <span className="text-gray-700">
                          {getDailyReportSectionLabel(
                            category.dailyReportSection,
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          category.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {category.isActive ? "Aktiv" : "Inaktiv"}
                      </span>
                      <div className="mt-2 text-xs text-gray-500">
                        Sort. {category.sortOrder}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top text-gray-600">
                      {category._count.items}
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
  resetOnSuccess = false,
}: {
  action: (
    previousState: {
      error: string | null;
      errorKey: number;
      success: boolean;
      successKey: number;
    },
    formData: FormData,
  ) => Promise<{
    error: string | null;
    errorKey: number;
    success: boolean;
    successKey: number;
  }>;
  category?: {
    asphaltDispositionUsage: string;
    colorClass: string | null;
    dailyReportSection: string;
    dailyReportMachineLabel: string | null;
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
      asphaltDispositionUsage: string;
      dailyReportMachineLabel: string | null;
      id: string;
      isActive: boolean;
      name: string;
      nextObjectNumber: number | null;
      objectNumberEnd: number | null;
      objectNumberStart: number | null;
      sortOrder: number;
      useInSpecialVehicleDisposition: boolean;
      useInTeamManagement: boolean;
      useInTruckDispatchSelection: boolean;
    }[];
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInSpecialVehicleDisposition: boolean;
    useInTeamManagement: boolean;
    useInTruckDispatchSelection: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDisposition: boolean;
  };
  categoryOptions: {
    id: string;
    isActive: boolean;
    name: string;
    objectNumberEnd: number | null;
    objectNumberStart: number | null;
    parentCategoryId: string | null;
  }[];
  resetOnSuccess?: boolean;
}) {
  return (
    <InventoryCategoryActionForm
      action={action}
      className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
      resetOnSuccess={resetOnSuccess}
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
            .filter(
              (option) =>
                option.id !== category?.id &&
                !option.parentCategoryId &&
                (option.isActive ||
                  option.id === category?.parentCategoryId),
            )
            .map((option) => (
              <option key={option.id} value={option.id}>
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
          defaultValue={category ? category.sortOrder : ""}
          name="sortOrder"
          placeholder="leer = automatisch"
          type="number"
        />
      </label>

      <InventorySubcategoryRows
        initialRows={(category?.childCategories ?? []).map((childCategory) => ({
          asphaltDispositionUsage: childCategory.asphaltDispositionUsage,
          dailyReportMachineLabel: childCategory.dailyReportMachineLabel ?? "",
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
          useInSpecialVehicleDisposition:
            childCategory.useInSpecialVehicleDisposition,
          useInTeamManagement: childCategory.useInTeamManagement,
          useInTruckDispatchSelection:
            childCategory.useInTruckDispatchSelection,
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
        <div className="text-sm font-semibold text-gray-900">
          Verwendung in Disposition / BTB / Teams
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Inventar/Lager gilt automatisch. Hier wird gesteuert, wo diese
          Kategorie später in LKW-Dispo, Bautagesbericht und Teams-Verwaltung
          auftaucht.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Checkbox
            defaultChecked={category?.useInTruckDispatchMaterial ?? false}
            label="LKW-Dispo: als Material/Schüttgut auswählbar"
            name="useInTruckDispatchMaterial"
          />
          <Checkbox
            defaultChecked={category?.useInTruckDispatchObject ?? false}
            label="LKW-Dispo: als Gerät/Maschine/Transportobjekt auswählbar"
            name="useInTruckDispatchObject"
          />
          <Checkbox
            defaultChecked={category?.useInDailyReports ?? false}
            label="Im Bautagesbericht verwenden"
            name="useInDailyReports"
          />
          <Checkbox
            defaultChecked={
              category?.useInSpecialVehicleDisposition ?? false
            }
            label="In Sonderfahrzeug-Disposition verwenden"
            name="useInSpecialVehicleDisposition"
          />
          <Checkbox
            defaultChecked={category?.useInTeamManagement ?? false}
            label="In Teams-Verwaltung wählbar"
            name="useInTeamManagement"
          />
          <Checkbox
            defaultChecked={category?.useInTruckDispatchSelection ?? false}
            label="In Fahrer-Fahrzeug-Zuordnung wählbar"
            name="useInTruckDispatchSelection"
          />
        </div>
      </div>

      <div className="space-y-4 xl:col-span-2">
        <label className="block text-sm font-medium text-gray-800">
          Asphalt-Verwendung
          <select
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={category?.asphaltDispositionUsage ?? "NONE"}
            name="asphaltDispositionUsage"
          >
            <option value="NONE">Keine</option>
            <option value="ASPHALT_MIX">Asphaltsorte</option>
            <option value="TACK_COAT">Anspritzmittel</option>
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Anspritzmittel wird in Asphalt- und Sonderfahrzeug-Disposition
            verwendet.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-800">
          BTB-Bereich
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
          <span className="mt-1 block text-xs text-gray-500">
            Legt fest, ob Objekte dieser Kategorie im BTB unter Material,
            Maschinen/Geräte oder Sonstiges landen.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Zuordnung im BTB
          <select
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={category?.dailyReportMachineLabel ?? ""}
            name="dailyReportMachineLabel"
          >
            <option value="">Automatisch / Kategorie verwenden</option>
            {dailyReportMachineLabelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">
            Nur relevant für BTB-Bereich „Maschinen und Geräte“. Beispiel:
            Bagger-Mobil → Mobilbagger, Walze-Asphalt → Erdbauwalze / Walzenzug.
          </span>
        </label>
      </div>

      <div className="flex items-end gap-2">
        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Speichern
        </button>
        {!category ? <InventoryCategoryImportPanel /> : null}
      </div>
    </InventoryCategoryActionForm>
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
    asphaltDispositionUsage: string;
    dailyReportMachineLabel: string | null;
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInSpecialVehicleDisposition: boolean;
    useInTeamManagement: boolean;
    useInTruckDispatchSelection: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDisposition: boolean;
  };
}) {
  const badges: { label: string; tone: string }[] = [];

  if (category.useInTruckDispatchMaterial) {
    badges.push({ label: "LKW Material", tone: "green" });
  }

  if (category.useInTruckDispatchObject) {
    badges.push({ label: "LKW Gerät/Objekt", tone: "blue" });
  }

  if (category.useInDailyReports) {
    badges.push({ label: "BTB", tone: "amber" });
  }

  if (category.useInSpecialVehicleDisposition) {
    badges.push({ label: "Sonderfahrzeug", tone: "purple" });
  }

  if (category.useInTeamManagement) {
    badges.push({ label: "Teams", tone: "cyan" });
  }

  if (category.useInTruckDispatchSelection) {
    badges.push({ label: "Fahrer-Fahrzeug", tone: "sky" });
  }

  if (category.asphaltDispositionUsage === "ASPHALT_MIX") {
    badges.push({ label: "Asphaltsorte", tone: "slate" });
  }

  if (category.asphaltDispositionUsage === "TACK_COAT") {
    badges.push({ label: "Anspritzmittel", tone: "orange" });
  }

  if (category.dailyReportMachineLabel) {
    badges.push({ label: `BTB ${category.dailyReportMachineLabel}`, tone: "gray" });
  }

  if (badges.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${getUsageBadgeClass(
            badge.tone,
          )}`}
          key={badge.label}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function getUsageBadgeClass(tone: string) {
  if (tone === "green") return "bg-green-50 text-green-900";
  if (tone === "amber") return "bg-amber-50 text-amber-950";
  if (tone === "purple") return "bg-purple-50 text-purple-900";
  if (tone === "cyan") return "bg-cyan-50 text-cyan-900";
  if (tone === "sky") return "bg-sky-50 text-sky-900";
  if (tone === "orange") return "bg-orange-50 text-orange-900";
  if (tone === "slate") return "bg-slate-100 text-slate-900";
  if (tone === "gray") return "bg-gray-100 text-gray-800";

  return "bg-blue-50 text-blue-900";
}

const dailyReportMachineLabelOptions = [
  "Mobilbagger",
  "Kettenbagger",
  "LKW 2-Achser",
  "LKW 3-Achser",
  "LKW 4-Achser",
  "LKW Abrollkipper",
  "LKW Sattelzug",
  "Planierraupe",
  "Grader",
  "Erdbauwalze / Walzenzug",
  "Radlader",
  "Kompressor",
] as const;

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
