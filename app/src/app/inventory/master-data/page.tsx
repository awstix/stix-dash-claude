import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { syncInventoryMasterData } from "./actions";

const sources = [
  {
    categoryName: "Material",
    description: "Normale Materialliste aus Admin > Material.",
    label: "Material",
    sourceType: "MATERIAL",
  },
  {
    categoryName: "Anspritzmittel",
    description: "Haftkleber/Anspritzmittel aus Admin > Anspritzmittel.",
    label: "Anspritzmittel",
    sourceType: "TACK_COAT",
  },
  {
    categoryName: "Asphalt",
    description: "Asphaltsorten aus Admin > Sortenliste Asphalt.",
    label: "Asphalt",
    sourceType: "ASPHALT",
  },
  {
    categoryName: "Beton",
    description: "Betonsorten aus Admin > Sortenliste Beton.",
    label: "Beton",
    sourceType: "CONCRETE",
  },
  {
    categoryName: "Fahrzeuge",
    description:
      "Bestandsfahrzeuge aus Admin > Fahrzeuge, inklusive Kennzeichen und Verknüpfung zum alten Fahrzeugdatensatz.",
    label: "Fahrzeuge",
    sourceType: "VEHICLE",
  },
] as const;

const dailyReportSectionLabels = {
  MACHINES: "Maschinen/Geräte/LKW",
  MATERIAL: "Material",
  NONE: "nicht im BTB",
  OTHER: "Sonstiges",
} as const;

type DailyReportSection = keyof typeof dailyReportSectionLabels;

function formatObjectNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";

  return String(value).padStart(6, "0");
}

function formatCategoryRange(category: {
  objectNumberEnd: number | null;
  objectNumberStart: number | null;
}) {
  if (category.objectNumberStart === null || category.objectNumberEnd === null) {
    return "kein Nummernkreis";
  }

  return `${formatObjectNumber(category.objectNumberStart)} – ${formatObjectNumber(
    category.objectNumberEnd,
  )}`;
}

function formatCategoryOption(category: {
  dailyReportSection: string;
  name: string;
  objectNumberEnd: number | null;
  objectNumberStart: number | null;
}) {
  return `${category.name} · ${getDailyReportSectionLabel(category.dailyReportSection)} · ${formatCategoryRange(
    category,
  )}`;
}

function getDailyReportSectionLabel(value: string) {
  return dailyReportSectionLabels[value as DailyReportSection] ?? "nicht im BTB";
}

export default async function InventoryMasterDataPage() {
  const [
    materialCount,
    tackCoatCount,
    asphaltCount,
    concreteCount,
    vehicleCount,
    vehicleGroups,
    mirroredCounts,
    defaultCategories,
    allCategories,
  ] = await Promise.all([
    prisma.materialType.count({
      where: {
        OR: [{ category: null }, { category: { not: "Anspritzmittel" } }],
      },
    }),
    prisma.materialType.count({
      where: {
        category: "Anspritzmittel",
      },
    }),
    prisma.asphaltMixType.count(),
    prisma.concreteType.count(),
    prisma.vehicle.count(),
    prisma.vehicle.groupBy({
      by: ["category", "vehicleType"],
      _count: {
        _all: true,
      },
      orderBy: [{ category: "asc" }, { vehicleType: "asc" }],
    }),
    prisma.inventoryItem.groupBy({
      by: ["sourceType"],
      where: {
        sourceType: {
          in: sources.map((source) => source.sourceType),
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.inventoryCategory.findMany({
      where: {
        name: {
          in: sources.map((source) => source.categoryName),
        },
      },
      select: {
        id: true,
        name: true,
        nextObjectNumber: true,
        objectNumberEnd: true,
        objectNumberStart: true,
      },
    }),
    prisma.inventoryCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        dailyReportSection: true,
        id: true,
        name: true,
        nextObjectNumber: true,
        objectNumberEnd: true,
        objectNumberStart: true,
        useInTruckDispatchMaterial: true,
        useInTruckDispatchObject: true,
      },
    }),
  ]);

  const sourceCounts: Record<(typeof sources)[number]["sourceType"], number> = {
    ASPHALT: asphaltCount,
    CONCRETE: concreteCount,
    MATERIAL: materialCount,
    TACK_COAT: tackCoatCount,
    VEHICLE: vehicleCount,
  };
  const mirroredCountBySource = new Map(
    mirroredCounts.map((entry) => [
      entry.sourceType,
      entry._count._all,
    ]),
  );
  const categoryByName = new Map(
    defaultCategories.map((category) => [category.name, category]),
  );
  const usableCategoryCount = allCategories.filter(
    (category) =>
      category.objectNumberStart !== null && category.objectNumberEnd !== null,
  ).length;

  return (
    <AppShell
      title="Inventar-Stammdaten übernehmen"
      description="Bestehende Admin-Listen als Inventar-/Lagerobjekte spiegeln, ohne Disposition oder BTB-Verknüpfungen umzubauen."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory"
        >
          ← Inventarverwaltung
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/admin/inventory-categories"
        >
          Kategorien / Nummernkreise pflegen →
        </Link>
      </div>

      <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="text-lg font-semibold text-blue-950">
          Sicherer Übergang
        </h2>
        <p className="mt-2 text-sm leading-6 text-blue-900">
          Diese Funktion kopiert Stammdaten als Inventarobjekte und merkt sich die
          technische Quelle. Die alten Listen bleiben bestehen und werden weiter
          von Dispo, BTB und bestehenden Einträgen verwendet.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-white/80 p-3">
            <div className="text-sm font-bold text-blue-950">
              Fahrzeuge / Maschinen / Anhänger
            </div>
            <p className="mt-1 text-xs leading-5 text-blue-900">
              Werden als normale Inventarobjekte angelegt, nicht als Lagerobjekte.
              Kennzeichen, Fahrer, Achsen und Nutzlast werden soweit vorhanden übernommen.
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-white/80 p-3">
            <div className="text-sm font-bold text-blue-950">
              Material / Schüttgut / Asphalt / Beton
            </div>
            <p className="mt-1 text-xs leading-5 text-blue-900">
              Werden lagergeführt angelegt. Die Einheit kommt aus der alten Liste
              und kann danach im Inventar weiter gepflegt werden.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Stammdaten spiegeln
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Voraussetzung: Für jede Zielkategorie muss ein Nummernkreis
              hinterlegt sein.
            </p>
          </div>
          <form
            action={syncInventoryMasterData}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-4 md:max-w-2xl"
          >
            <input name="sourceType" type="hidden" value="ALL" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {sources.map((source) => {
                const defaultCategory = categoryByName.get(source.categoryName);

                if (source.sourceType === "VEHICLE") {
                  return (
                    <div className="sm:col-span-2" key={source.sourceType}>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Fahrzeuge
                      </p>
                      <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {vehicleGroups.map((group) => (
                          <VehicleCategorySelect
                            allCategories={allCategories}
                            group={group}
                            key={`${group.category}-${group.vehicleType}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <label
                    className="text-xs font-bold uppercase tracking-wide text-gray-500"
                    key={source.sourceType}
                  >
                    {source.label}
                    <select
                      className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-900"
                      defaultValue={defaultCategory?.id ?? "__none"}
                      name={`targetCategoryId_${source.sourceType}`}
                    >
                      <option value="__none">Kategorie wählen</option>
                      {allCategories.map((category) => (
                        <option
                          disabled={
                            category.objectNumberStart === null ||
                            category.objectNumberEnd === null
                          }
                          key={category.id}
                          value={category.id}
                        >
                          {formatCategoryOption(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
            <button
              className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              disabled={usableCategoryCount === 0}
              type="submit"
            >
              Alle übernehmen / aktualisieren
            </button>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Quellen ohne ausgewählte Zielkategorie werden bei „Alle“ übersprungen.
            </p>
          </form>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {sources.map((source) => {
            const defaultCategory = categoryByName.get(source.categoryName);
            const defaultHasRange = Boolean(
              defaultCategory?.objectNumberStart !== null &&
                defaultCategory?.objectNumberStart !== undefined &&
                defaultCategory?.objectNumberEnd !== null &&
                defaultCategory?.objectNumberEnd !== undefined,
            );

            return (
              <div
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                key={source.sourceType}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {source.label}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {source.description}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      defaultHasRange
                        ? "bg-green-100 text-green-900"
                        : "bg-orange-100 text-orange-950"
                    }`}
                  >
                    {defaultHasRange
                      ? "Standard bereit"
                      : "Kategorie auswählen"}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Quelle" value={String(sourceCounts[source.sourceType])} />
                  <Info
                    label="gespiegelt"
                    value={String(mirroredCountBySource.get(source.sourceType) ?? 0)}
                  />
                  <Info
                    label="Standard"
                    value={defaultCategory?.name ?? "frei wählen"}
                  />
                  <Info
                    label="Standard-Kreis"
                    value={
                      defaultCategory
                        ? formatCategoryRange(defaultCategory)
                        : "—"
                    }
                  />
                  <Info
                    label="Standard nächste ID"
                    value={formatObjectNumber(defaultCategory?.nextObjectNumber)}
                  />
                </dl>

                <form action={syncInventoryMasterData} className="mt-4 space-y-3">
                  <input name="sourceType" type="hidden" value={source.sourceType} />
                  {source.sourceType === "VEHICLE" ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Fahrzeuggruppen zuordnen
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {vehicleGroups.map((group) => (
                          <VehicleCategorySelect
                            allCategories={allCategories}
                            group={group}
                            key={`${group.category}-${group.vehicleType}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                      Zielkategorie
                      <select
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-900"
                        defaultValue={defaultCategory?.id ?? "__none"}
                        name="targetCategoryId"
                      >
                        <option value="__none">Kategorie wählen</option>
                        {allCategories.map((category) => (
                          <option
                            disabled={
                              category.objectNumberStart === null ||
                              category.objectNumberEnd === null
                            }
                            key={category.id}
                            value={category.id}
                          >
                            {formatCategoryOption(category)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    disabled={usableCategoryCount === 0}
                    type="submit"
                  >
                    {source.label} übernehmen / aktualisieren
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function VehicleCategorySelect({
  allCategories,
  group,
}: {
  allCategories: Array<{
    dailyReportSection: string;
    id: string;
    name: string;
    objectNumberEnd: number | null;
    objectNumberStart: number | null;
  }>;
  group: {
    _count: {
      _all: number;
    };
    category: string;
    vehicleType: string;
  };
}) {
  const defaultCategory = findSuggestedVehicleCategory(allCategories, group);

  return (
    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
      {group.category} · {group.vehicleType} · {group._count._all}x
      <select
        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-gray-900"
        defaultValue={defaultCategory?.id ?? "__none"}
        name={`vehicleCategoryId_${getVehicleCategoryFormKey(
          group.category,
          group.vehicleType,
        )}`}
      >
        <option value="__none">Nicht übernehmen</option>
        {allCategories.map((category) => (
          <option
            disabled={
              category.objectNumberStart === null ||
              category.objectNumberEnd === null
            }
            key={category.id}
            value={category.id}
          >
            {formatCategoryOption(category)}
          </option>
        ))}
      </select>
    </label>
  );
}

function getVehicleCategoryFormKey(category: string, vehicleType: string) {
  return `${category}__${vehicleType}`;
}

function findSuggestedVehicleCategory(
  allCategories: Array<{
    id: string;
    name: string;
    objectNumberEnd: number | null;
    objectNumberStart: number | null;
  }>,
  group: {
    category: string;
    vehicleType: string;
  },
) {
  const candidates = [
    `${group.vehicleType} ${group.category}`,
    `${group.category} ${group.vehicleType}`,
    group.category,
    group.vehicleType,
    group.category === "2-Achser" ? "LKW 2-Achser" : null,
    group.category === "3-Achser" ? "LKW 3-Achser" : null,
    group.category === "4-Achser" ? "LKW 4-Achser" : null,
    group.category === "Sattel" ? "LKW Rest" : null,
    group.category === "Tankwagen" ? "LKW Rest" : null,
    group.category === "Kranwagen" ? "LKW Rest" : null,
    group.category.includes("Anhänger") ? "LKW Anhänger" : null,
    group.category.includes("PKW") ? "PKW" : null,
    group.category === "Sprinter" ? "PKW" : null,
    group.category === "Bagger" ? "Bagger" : null,
    group.category === "Radlader" ? "Radlader" : null,
    group.category === "Traktor" ? "Sondergeräte/Sonderfahrzeuge" : null,
    group.vehicleType === "Traktor" ? "Sondergeräte/Sonderfahrzeuge" : null,
  ].filter((value): value is string => Boolean(value));

  return allCategories.find(
    (category) =>
      candidates.includes(category.name) &&
      category.objectNumberStart !== null &&
      category.objectNumberEnd !== null,
  );
}
