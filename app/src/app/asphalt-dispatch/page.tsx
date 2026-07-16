import Link from "next/link";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  getAsphaltOpenPositions,
  hasAsphaltQuantity,
} from "@/lib/asphalt-loads";
import {
  formatLiters,
  getTackCoatOpenPositionsForRange,
  getTackCoatPositionKey,
  normalizeTackCoatUnit,
} from "@/lib/tack-coat-loads";
import { TruckDemandCalculator } from "./TruckDemandCalculator";
import {
  copyAsphaltDispatchEntry,
  createAsphaltDispatchEntry,
  deleteAsphaltDispatchEntry,
  updateAsphaltDispatchEntry,
} from "./actions";

const weekdayLabels = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

const weekendLabels = ["Samstag", "Sonntag"];

type MixSummaryItem = {
  mixNumber: string;
  mixName: string;
  quantity: number;
  unit: string;
  count: number;
};

type TackCoatSummaryItem = {
  materialNumber: string;
  materialName: string;
  unit: string;
  plannedLiters: number;
  count: number;
};

type VehiclePayloadSummary = {
  category: string;
  vehicleCount: number;
  averagePayloadTons: number;
  minPayloadTons: number;
  maxPayloadTons: number;
};

type InventoryOptionItem = {
  id: string;
  name: string;
  inventoryNumber: string | null;
  objectNumber: string | null;
  stixId: string | null;
  stockUnit: string | null;
  category: {
    name: string;
    parentCategory: {
      name: string;
    } | null;
  } | null;
};

function getInventoryOptionNumber(item: InventoryOptionItem) {
  return item.inventoryNumber ?? item.objectNumber ?? item.stixId ?? "";
}

function getInventoryOptionGroup(item: InventoryOptionItem) {
  if (!item.category) return null;
  return item.category.parentCategory
    ? `${item.category.parentCategory.name} / ${item.category.name}`
    : item.category.name;
}

function mapAsphaltInventoryOption(item: InventoryOptionItem) {
  return {
    id: item.id,
    mixNumber: getInventoryOptionNumber(item),
    name: item.name,
    shortName: null,
    unit: item.stockUnit ?? "t",
    category: getInventoryOptionGroup(item),
  };
}

function mapTackCoatInventoryOption(item: InventoryOptionItem) {
  return {
    id: item.id,
    materialNumber: getInventoryOptionNumber(item),
    name: item.name,
    category: getInventoryOptionGroup(item),
    unit: item.stockUnit ?? "l",
  };
}

function startOfWeek(date: Date) {
  const result = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );

  const day = result.getUTCDay();
  const diffToMonday = (day + 6) % 7;

  result.setUTCDate(result.getUTCDate() - diffToMonday);
  result.setUTCHours(0, 0, 0, 0);

  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getNextPlanningDay(date: Date, includeWeekend: boolean) {
  let nextDate = addDays(date, 1);

  if (!includeWeekend) {
    while ([0, 6].includes(nextDate.getUTCDay())) {
      nextDate = addDays(nextDate, 1);
    }
  }

  return nextDate;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function isTackCoatCrewName(value: string | null | undefined) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalizedValue.includes("anspritz") ||
    normalizedValue.includes("spritzwagen") ||
    normalizedValue.includes("spritz")
  );
}

function formatTons(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function sameDate(a: Date, b: Date) {
  return formatDateInput(a) === formatDateInput(b);
}

function getIsoWeekInfo(date: Date) {
  const tempDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const dayNumber = tempDate.getUTCDay() || 7;
  tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNumber);

  const weekYear = tempDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));

  const week = Math.ceil(
    ((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return {
    week,
    year: weekYear,
  };
}

function buildWeekHref(week: string, includeWeekend: boolean) {
  return `/asphalt-dispatch?week=${week}${includeWeekend ? "&weekend=1" : ""}`;
}

function buildPayloadSummaries(
  vehicles: {
    category: string;
    payloadTons: number;
  }[]
) {
  const groups = new Map<
    string,
    {
      category: string;
      payloads: number[];
    }
  >();

  for (const vehicle of vehicles) {
    if (!vehicle.category || vehicle.payloadTons <= 0) {
      continue;
    }

    const existing = groups.get(vehicle.category) ?? {
      category: vehicle.category,
      payloads: [],
    };

    existing.payloads.push(vehicle.payloadTons);
    groups.set(vehicle.category, existing);
  }

  return Array.from(groups.values())
    .map((group): VehiclePayloadSummary => {
      const total = group.payloads.reduce((sum, value) => sum + value, 0);
      const averagePayloadTons =
        group.payloads.length > 0 ? total / group.payloads.length : 0;

      return {
        category: group.category,
        vehicleCount: group.payloads.length,
        averagePayloadTons: Math.round(averagePayloadTons * 100) / 100,
        minPayloadTons: Math.min(...group.payloads),
        maxPayloadTons: Math.max(...group.payloads),
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category, "de-DE"));
}

export default async function AsphaltDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    weekend?: string;
  }>;
}) {
  const params = await searchParams;
  const includeWeekend = params.weekend === "1";

  const weekStart = params.week
    ? startOfWeek(new Date(`${params.week}T00:00:00.000Z`))
    : startOfWeek(new Date());

  const weekEnd = addDays(weekStart, 7);
  const isoWeek = getIsoWeekInfo(weekStart);

  const dayLabels = includeWeekend
    ? [...weekdayLabels, ...weekendLabels]
    : weekdayLabels;

  const days = dayLabels.map((label, index) => ({
    label,
    date: addDays(weekStart, index),
  }));

  const previousWeek = formatDateInput(addDays(weekStart, -7));
  const currentWeek = formatDateInput(startOfWeek(new Date()));
  const nextWeek = formatDateInput(addDays(weekStart, 7));

  const [
    entries,
    projects,
    asphaltTypesRaw,
    tackCoatMaterialsRaw,
    asphaltDispatchCrews,
    payloadVehicles,
    tackCoatOpenPositions,
  ] = await Promise.all([
    prisma.asphaltDispatchEntry.findMany({
      where: {
        workDate: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      orderBy: [{ workDate: "asc" }, { crew: "asc" }, { createdAt: "asc" }],
    }),

    prisma.project.findMany({
      where: {
        status: {
          in: [
            ProjectStatus.NOT_STARTED,
            ProjectStatus.ACTIVE,
            ProjectStatus.PAUSED,
          ],
        },
      },
      orderBy: [{ projectNumber: "asc" }],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "DELETED",
        },
        category: {
          OR: [
            {
              asphaltDispositionUsage: "ASPHALT_MIX",
            },
            {
              parentCategory: {
                asphaltDispositionUsage: "ASPHALT_MIX",
              },
            },
          ],
        },
      },
      include: {
        category: {
          include: {
            parentCategory: true,
          },
        },
      },
      orderBy: [{ objectNumber: "asc" }, { inventoryNumber: "asc" }, { name: "asc" }],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "DELETED",
        },
        category: {
          OR: [
            {
              asphaltDispositionUsage: "TACK_COAT",
            },
            {
              parentCategory: {
                asphaltDispositionUsage: "TACK_COAT",
              },
            },
          ],
        },
      },
      include: {
        category: {
          include: {
            parentCategory: true,
          },
        },
      },
      orderBy: [{ objectNumber: "asc" }, { inventoryNumber: "asc" }, { name: "asc" }],
    }),

    prisma.crew.findMany({
      where: {
        isActive: true,
        isAsphaltDispatchCrew: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),

    prisma.inventoryItem.findMany({
      where: {
        status: {
          not: "INACTIVE",
        },
        vehicleId: {
          not: null,
        },
        payloadKg: {
          gt: 0,
        },
        category: {
          OR: [
            {
              useInTruckDispatchSelection: true,
            },
            {
              parentCategory: {
                useInTruckDispatchSelection: true,
              },
            },
          ],
        },
      },
      select: {
        payloadKg: true,
        category: {
          select: {
            name: true,
            parentCategory: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { category: { sortOrder: "asc" } },
        { category: { name: "asc" } },
        { objectNumber: "asc" },
        { name: "asc" },
      ],
    }),

    getTackCoatOpenPositionsForRange({
      gte: weekStart,
      lt: weekEnd,
    }),
  ]);

  const asphaltTypes = asphaltTypesRaw.map(mapAsphaltInventoryOption);
  const tackCoatMaterials = tackCoatMaterialsRaw.map(mapTackCoatInventoryOption);

  const asphaltOpenPositionsByDayEntries = await Promise.all(
    days.map(async (day) => {
      const key = formatDateInput(day.date);
      const positions = await getAsphaltOpenPositions(day.date);

      return [key, positions] as const;
    })
  );

  const asphaltOpenPositionsByDay = new Map(asphaltOpenPositionsByDayEntries);

  const payloadSummaries = buildPayloadSummaries(
    payloadVehicles.map((item) => {
      const categoryName = item.category?.name ?? "Ohne Kategorie";
      const parentCategoryName = item.category?.parentCategory?.name;

      return {
        category: parentCategoryName
          ? `${parentCategoryName} / ${categoryName}`
          : categoryName,
        payloadTons: (item.payloadKg ?? 0) / 1000,
      };
    }),
  );

  const crews = asphaltDispatchCrews.map((crew) => crew.name);
  const asphaltEntries = entries.filter(hasAsphaltQuantity);

  const totalTons = asphaltEntries.reduce(
    (sum, entry) => sum + entry.quantityTons,
    0,
  );
  const totalTackCoatQuantity = entries.reduce(
    (sum, entry) => sum + (entry.tackCoatQuantity ?? 0),
    0,
  );

  const totalOpenTons = asphaltOpenPositionsByDayEntries.reduce(
    (sum, [, positions]) =>
      sum +
      positions.reduce((daySum, position) => daySum + position.openTons, 0),
    0
  );
  const totalOpenTackCoatLiters = tackCoatOpenPositions.reduce(
    (sum, position) => sum + position.openLiters,
    0,
  );

  const dayTotals = new Map(
    days.map((day) => {
      const total = asphaltEntries
        .filter((entry) => sameDate(entry.workDate, day.date))
        .reduce((sum, entry) => sum + entry.quantityTons, 0);

      return [formatDateInput(day.date), total];
    })
  );

  const dayTackCoatTotals = new Map(
    days.map((day) => {
      const total = entries
        .filter((entry) => sameDate(entry.workDate, day.date))
        .reduce((sum, entry) => sum + (entry.tackCoatQuantity ?? 0), 0);

      return [formatDateInput(day.date), total];
    })
  );

  const dayTackCoatSpecialVehicleTotals = new Map(
    days.map((day) => {
      const total = tackCoatOpenPositions
        .filter((position) => sameDate(position.workDate, day.date))
        .reduce((sum, position) => sum + position.specialVehicleLiters, 0);

      return [formatDateInput(day.date), total];
    })
  );

  const dayTackCoatShortHaulTotals = new Map(
    days.map((day) => {
      const total = tackCoatOpenPositions
        .filter((position) => sameDate(position.workDate, day.date))
        .reduce((sum, position) => sum + position.shortHaulLiters, 0);

      return [formatDateInput(day.date), total];
    })
  );

  const dayTackCoatOpenTotals = new Map(
    days.map((day) => {
      const total = tackCoatOpenPositions
        .filter((position) => sameDate(position.workDate, day.date))
        .reduce((sum, position) => sum + position.openLiters, 0);

      return [formatDateInput(day.date), total];
    })
  );

  const dayOpenTotals = new Map(
    days.map((day) => {
      const key = formatDateInput(day.date);
      const positions = asphaltOpenPositionsByDay.get(key) ?? [];
      const openTons = positions.reduce(
        (sum, position) => sum + position.openTons,
        0
      );

      return [key, openTons];
    })
  );

  const demandDays = days.map((day) => {
    const dateKey = formatDateInput(day.date);

    return {
      label: day.label,
      dateKey,
      dateLabel: formatGermanDate(day.date),
      openTons: dayOpenTotals.get(dateKey) ?? 0,
    };
  });

  const tackCoatPositionByKey = new Map(
    tackCoatOpenPositions.map((position) => [position.key, position]),
  );

  const mixSummaryMap = new Map<string, MixSummaryItem>();

  for (const entry of asphaltEntries) {
    const mixNumber = entry.asphaltMixNumber ?? "-";
    const mixName = entry.asphaltMixName ?? "Ohne Bezeichnung";
    const unit = "t";
    const quantity = entry.quantityTons;

    const key = `${mixNumber}-${mixName}-${unit}`;

    const existing = mixSummaryMap.get(key) ?? {
      mixNumber,
      mixName,
      quantity: 0,
      unit,
      count: 0,
    };

    existing.quantity += quantity;
    existing.count += 1;

    mixSummaryMap.set(key, existing);
  }

  const mixSummary = Array.from(mixSummaryMap.values()).sort((a, b) =>
    a.mixNumber.localeCompare(b.mixNumber, "de-DE")
  );

  const tackCoatSummaryMap = new Map<string, TackCoatSummaryItem>();
  const tackCoatMaterialById = new Map(
    tackCoatMaterials.map((material) => [material.id, material]),
  );
  const tackCoatMaterialByName = new Map(
    tackCoatMaterials.map((material) => [
      material.name.trim().toLowerCase(),
      material,
    ]),
  );

  for (const position of tackCoatOpenPositions) {
    const material =
      (position.tackCoatMaterialTypeId
        ? tackCoatMaterialById.get(position.tackCoatMaterialTypeId)
        : null) ??
      tackCoatMaterialByName.get(position.materialName.trim().toLowerCase());
    const materialName = material?.name ?? position.materialName ?? "Ohne Bezeichnung";
    const materialNumber = material?.materialNumber ?? "-";
    const unit = normalizeTackCoatUnit(position.quantityUnit);
    const key = `${materialNumber}-${materialName}-${unit}`;
    const existing =
      tackCoatSummaryMap.get(key) ??
      ({
        materialNumber,
        materialName,
        unit,
        plannedLiters: 0,
        count: 0,
      } satisfies TackCoatSummaryItem);

    existing.plannedLiters += position.plannedLiters;
    existing.count += 1;

    tackCoatSummaryMap.set(key, existing);
  }

  const tackCoatSummary = Array.from(tackCoatSummaryMap.values()).sort((a, b) =>
    a.materialNumber.localeCompare(b.materialNumber, "de-DE"),
  );

  const gridStyle = {
    gridTemplateColumns: `130px repeat(${days.length}, minmax(0, 1fr))`,
  };

  return (
    <AppShell
      title="Asphaltdisposition"
      description="Wochenplanung für Asphaltkolonnen, Mischgutmenge, Sorte, Bauleiter und Fremdmischgut."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            KW {isoWeek.week}/{isoWeek.year} · Woche {" "}
            {formatGermanDate(weekStart)} – {" "}
            {formatGermanDate(addDays(weekStart, includeWeekend ? 6 : 4))}
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            Gesamtmenge diese Woche: {" "}
            <span className="font-semibold text-gray-900">
              {formatTons(totalTons)} t
            </span>
            {" · "}
            offen: {" "}
            <span className="font-semibold text-orange-900">
              {formatTons(totalOpenTons)} t
            </span>
          </p>
        </div>
      </div>

      {crews.length === 0 ? (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-orange-950">
            Keine Asphaltkolonnen aktiviert
          </h2>
          <p className="mt-2 text-sm leading-6 text-orange-900">
            In der Asphaltdisposition erscheinen nur aktive Kolonnen aus Admin →
            Kolonnen mit dem Haken „In Asphaltdisposition verwenden“.
          </p>
          <Link
            href="/admin/crews"
            className="mt-4 inline-flex rounded-xl bg-orange-900 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Kolonnen verwalten →
          </Link>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryBox label="Einträge" value={String(entries.length)} hint="geplante Asphaltmaßnahmen" />
        <SummaryBox label="Kolonnen" value={String(crews.length)} hint="aktive Asphaltkolonnen aus Admin → Kolonnen" />
        <SummaryBox
          label="Asphalt zu vergeben"
          value={`${formatTons(totalOpenTons)} t`}
          hint={`${formatTons(totalTons)} t Bedarf gesamt`}
          tone="orange"
        />
        <SummaryBox
          label="Anspritzmittel zu vergeben"
          value={`${formatLiters(totalOpenTackCoatLiters)} l`}
          hint={`${formatLiters(totalTackCoatQuantity)} l Bedarf gesamt`}
          tone="purple"
        />
        <SummaryBox label="Mischgutbedarf gesamt" value={`${formatTons(totalTons)} t`} hint="Gesamtmenge im gewählten Zeitraum" />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Wochenzusammenfassung
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-6">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">
              Sortenmengen Asphalt
            </h3>

            {mixSummary.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Noch keine Asphalteinträge in dieser Woche.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[52%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="bg-gray-50 text-gray-800">
                    <tr>
                      <th className="p-3 font-semibold">Sortennummer</th>
                      <th className="p-3 font-semibold">Bezeichnung</th>
                      <th className="p-3 font-semibold">Einträge</th>
                      <th className="p-3 font-semibold">Menge</th>
                    </tr>
                  </thead>

                  <tbody>
                    {mixSummary.map((item) => (
                      <tr
                        key={`${item.mixNumber}-${item.mixName}`}
                        className="border-t border-gray-100"
                      >
                        <td className="p-3 font-semibold text-gray-900">
                          {item.mixNumber}
                        </td>
                        <td className="p-3 text-gray-700">{item.mixName}</td>
                        <td className="p-3 text-gray-700">{item.count}</td>
                        <td className="p-3 font-semibold text-gray-900">
                          {formatTons(item.quantity)} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase text-purple-700">
              Anspritzmittel-Bedarf
            </h3>

            {tackCoatSummary.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">
                Noch kein Anspritzmittel in dieser Woche.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[52%]" />
                    <col className="w-[14%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="bg-gray-50 text-gray-800">
                    <tr>
                      <th className="p-3 font-semibold">Sortennummer</th>
                      <th className="p-3 font-semibold">Bezeichnung</th>
                      <th className="p-3 font-semibold">Einträge</th>
                      <th className="p-3 font-semibold">Menge</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tackCoatSummary.map((item) => (
                      <tr
                        key={`${item.materialNumber}-${item.materialName}-${item.unit}`}
                        className="border-t border-gray-100"
                      >
                        <td className="p-3 font-semibold text-gray-900">
                          {item.materialNumber}
                        </td>
                        <td className="p-3 text-gray-700">
                          {item.materialName}
                        </td>
                        <td className="p-3 text-gray-700">{item.count}</td>
                        <td className="p-3 font-semibold text-gray-900">
                          {formatLiters(item.plannedLiters)} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            <Link
              href={buildWeekHref(currentWeek, includeWeekend)}
              scroll={false}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white"
            >
              Aktuelle Woche
            </Link>
          </div>

          <Link
            href={
              includeWeekend
                ? buildWeekHref(formatDateInput(weekStart), false)
                : buildWeekHref(formatDateInput(weekStart), true)
            }
            scroll={false}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            {includeWeekend ? "Sa/So aus" : "Sa/So anzeigen"}
          </Link>
        </div>

        <Link
          href={buildWeekHref(previousWeek, includeWeekend)}
          scroll={false}
          className="absolute top-[72px] z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-lg font-bold leading-none text-gray-800 shadow-sm hover:bg-gray-50"
          style={{ left: "114px" }}
          aria-label="Vorwoche"
          title="Vorwoche"
        >
          ‹
        </Link>
        <Link
          href={buildWeekHref(nextWeek, includeWeekend)}
          scroll={false}
          className="absolute -right-4 top-[72px] z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white/95 text-lg font-bold leading-none text-gray-800 shadow-sm hover:bg-gray-50"
          aria-label="Folgewoche"
          title="Folgewoche"
        >
          ›
        </Link>
        <div className="grid w-full" style={gridStyle}>
          <div className="flex min-h-[64px] items-center border-r border-b border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Kolonne
          </div>

          {days.map((day) => (
            <div
              key={day.label}
              className="flex min-h-[64px] min-w-0 flex-col justify-center border-r border-b border-gray-200 bg-gray-50 px-2 py-2 text-center last:border-r-0"
            >
              <div className="truncate text-xs font-bold text-gray-900">
                {day.label}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {formatGermanDate(day.date)}
              </div>
            </div>
          ))}

          <div className="flex min-h-[48px] items-center border-r border-b border-gray-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tagesmengen
          </div>

          {days.map((day) => {
            const dayKey = formatDateInput(day.date);
            const dayTotal = dayTotals.get(dayKey) ?? 0;
            const dayOpenTotal = dayOpenTotals.get(dayKey) ?? 0;
            const dayTackCoatTotal = dayTackCoatTotals.get(dayKey) ?? 0;
            const dayTackCoatSpecialVehicleTotal =
              dayTackCoatSpecialVehicleTotals.get(dayKey) ?? 0;
            const dayTackCoatShortHaulTotal =
              dayTackCoatShortHaulTotals.get(dayKey) ?? 0;
            const dayTackCoatOpenTotal = dayTackCoatOpenTotals.get(dayKey) ?? 0;

            return (
              <div
                key={`${day.label}-totals`}
                className="flex min-h-[48px] items-center border-r border-b border-gray-200 bg-white px-2 py-2 last:border-r-0"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                  <span className="rounded-full bg-gray-100 px-2 py-1 font-bold text-gray-900">
                    Asphalt {formatTons(dayTotal)} t
                  </span>
                  <span className="rounded-full bg-orange-50 px-2 py-1 font-semibold text-orange-800">
                    offen {formatTons(dayOpenTotal)} t
                  </span>
                  {dayTackCoatTotal > 0 ? (
                    <>
                      <span className="rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-800">
                        Anspritz {formatLiters(dayTackCoatTotal)} l
                      </span>
                      <span className="rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-700">
                        Spritzwagen {formatLiters(dayTackCoatSpecialVehicleTotal)} l
                      </span>
                      <span className="rounded-full bg-purple-50 px-2 py-1 font-semibold text-purple-700">
                        Kurzstrecke {formatLiters(dayTackCoatShortHaulTotal)} l
                      </span>
                      <span className="rounded-full bg-purple-100 px-2 py-1 font-semibold text-purple-950">
                        offen {formatLiters(dayTackCoatOpenTotal)} l
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}

          {crews.map((crew) => (
            <div key={crew} className="contents">
              <div className="border-r border-b border-gray-200 bg-white p-3 font-semibold text-gray-900">
                {crew}
              </div>

              {days.map((day) => {
                const dayEntries = entries.filter(
                  (entry) =>
                    entry.crew === crew && sameDate(entry.workDate, day.date)
                );

                const dayTotal = dayEntries.reduce(
                  (sum, entry) =>
                    hasAsphaltQuantity(entry) ? sum + entry.quantityTons : sum,
                  0
                );

                const dayTackCoatTotal = dayEntries.reduce(
                  (sum, entry) => sum + (entry.tackCoatQuantity ?? 0),
                  0,
                );

                const nextPlanningDay = getNextPlanningDay(
                  day.date,
                  includeWeekend
                );
                const isTackCoatCrew = isTackCoatCrewName(crew);
                const createOverlayId = `asphalt-create-overlay-${crew.replace(/[^a-zA-Z0-9_-]/g, "-")}-${formatDateInput(day.date)}`;

                return (
                  <div
                    key={`${crew}-${formatDateInput(day.date)}`}
                    className="min-h-80 border-r border-b border-gray-100 bg-white p-3 last:border-r-0"
                  >
                    <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="text-xs font-medium text-gray-500">
                        {isTackCoatCrew
                          ? "Anspritzmittel Kolonne"
                          : "Tagesmenge Kolonne"}
                      </div>
                      <div className="mt-1 text-xl font-bold text-gray-900">
                        {isTackCoatCrew
                          ? `${formatLiters(dayTackCoatTotal)} l`
                          : `${formatTons(dayTotal)} t`}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {dayEntries.length} Eintrag
                        {dayEntries.length === 1 ? "" : "e"}
                      </div>
                      {isTackCoatCrew ? (
                        <div className="mt-1 text-xs font-semibold text-purple-800">
                          keine Asphaltmenge
                        </div>
                      ) : dayTackCoatTotal > 0 ? (
                        <div className="mt-1 text-xs font-semibold text-purple-800">
                          Anspritzmittel {formatLiters(dayTackCoatTotal)} l
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      {dayEntries.map((entry) => {
                        const entryTackCoatQuantity = entry.tackCoatQuantity ?? 0;
                        const tackCoatPosition =
                          entry.tackCoatMaterialName && entryTackCoatQuantity > 0
                            ? tackCoatPositionByKey.get(
                                getTackCoatPositionKey({
                                  workDate: entry.workDate,
                                  projectId: entry.projectId,
                                  projectNumber: entry.projectNumber,
                                  materialName: entry.tackCoatMaterialName,
                                  quantityUnit: normalizeTackCoatUnit(entry.tackCoatUnit),
                                }),
                              )
                            : null;

                        const overlayId = `asphalt-entry-overlay-${entry.id}`;

                        return (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                          >
                          <input id={overlayId} type="checkbox" className="peer sr-only" />
                          <label htmlFor={overlayId} className="block cursor-pointer">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {entry.projectNumber} · {entry.projectName}
                                </div>

                                {entry.asphaltMixNumber || entry.asphaltMixName ? (
                                  <div className="mt-1 text-xs text-gray-600">
                                    {[entry.asphaltMixNumber, entry.asphaltMixName]
                                      .filter(Boolean)
                                      .join(" · ")}
                                    {entry.quantityTons > 0 ? ` · ${formatTons(entry.quantityTons)} t` : ""}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs font-semibold text-purple-800">
                                    Reiner Anspritzmittel-Eintrag
                                  </div>
                                )}
                                {(entry.tackCoatQuantity ?? 0) > 0 ? (
                                  <div className="mt-1 text-xs font-semibold text-purple-800">
                                    Anspritzmittel Bedarf: {formatLiters(entryTackCoatQuantity)} {entry.tackCoatUnit ?? "l"} {entry.tackCoatMaterialName ?? ""}
                                  </div>
                                ) : null}

                                {tackCoatPosition ? (
                                  <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-2 text-[11px] font-semibold text-purple-950">
                                    <div>Aufteilung Anspritzmittel Baustelle/Mittel</div>
                                    <div className="mt-1 grid grid-cols-2 gap-1">
                                      <span>
                                        Bedarf {formatLiters(tackCoatPosition.plannedLiters)} {tackCoatPosition.quantityUnit}
                                      </span>
                                      <span>
                                        Spritzwagen {formatLiters(tackCoatPosition.specialVehicleLiters)} {tackCoatPosition.quantityUnit}
                                      </span>
                                      <span>
                                        Kurzstrecke {formatLiters(tackCoatPosition.shortHaulLiters)} {tackCoatPosition.quantityUnit}
                                      </span>
                                      <span className="text-purple-900">
                                        offen {formatLiters(tackCoatPosition.openLiters)} {tackCoatPosition.quantityUnit}
                                      </span>
                                    </div>
                                  </div>
                                ) : null}

                                {entry.isForeignMix ? (
                                  <div className="mt-2 inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                                    Fremdmischgut
                                  </div>
                                ) : null}
                              </div>

                              <span className="text-xs text-gray-400">
                                bearbeiten
                              </span>
                            </div>
                          </label>

                          <label
                            htmlFor={overlayId}
                            aria-label="Asphalt-Eintrag schließen"
                            className="fixed inset-0 z-[210] hidden cursor-default bg-gray-950/30 backdrop-blur-sm peer-checked:block"
                          />

                          <div className="fixed left-4 right-4 top-[calc(var(--app-header-height,0px)+1rem)] z-[230] mx-auto hidden max-h-[calc(100vh-var(--app-header-height,0px)-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl peer-checked:block">
                            <div className="mb-4 flex items-start justify-between gap-4">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Asphalt-Eintrag bearbeiten
                                </div>
                                <h3 className="mt-1 text-xl font-bold text-gray-950">
                                  {entry.projectNumber} · {entry.projectName}
                                </h3>
                              </div>
                              <label
                                htmlFor={overlayId}
                                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-900 shadow-sm hover:bg-gray-50"
                                aria-label="Asphalt-Eintrag schließen"
                              >
                                ×
                              </label>
                            </div>

                          <form
                            action={updateAsphaltDispatchEntry}
                            className="mt-4 space-y-3 border-t border-gray-100 pt-3"
                          >
                            <input type="hidden" name="id" value={entry.id} />

                            <ProjectSelect
                              name="projectId"
                              projects={projects}
                              defaultValue={entry.projectId ?? ""}
                            />

                            {isTackCoatCrew ? (
                              <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-900">
                                Anspritzwagen: hier wird nur Anspritzmittel erfasst.
                                Eine Asphaltsorte ist nicht erforderlich.
                                <input type="hidden" name="asphaltMixTypeId" value="" />
                                <input type="hidden" name="quantityTons" value="0" />
                              </div>
                            ) : (
                              <>
                                <AsphaltTypeSelect
                                  name="asphaltMixTypeId"
                                  asphaltTypes={asphaltTypes}
                                  defaultValue={
                                    entry.asphaltInventoryItemId ??
                                    entry.asphaltMixTypeId ??
                                    ""
                                  }
                                />

                                <label className="block text-xs font-medium text-gray-700">
                                  Menge in Tonnen
                                  <input
                                    name="quantityTons"
                                    type="number"
                                    step="0.01"
                                    defaultValue={entry.quantityTons}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                                  />
                                </label>
                              </>
                            )}

                            <TackCoatFields
                              materials={tackCoatMaterials}
                              defaultMaterialTypeId={
                                entry.tackCoatInventoryItemId ??
                                entry.tackCoatMaterialTypeId ??
                                ""
                              }
                              defaultQuantity={entry.tackCoatQuantity ? String(entry.tackCoatQuantity) : ""}
                              defaultUnit={entry.tackCoatUnit ?? ""}
                              required={isTackCoatCrew}
                            />

                            {isTackCoatCrew ? null : (
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                <input
                                  type="checkbox"
                                  name="isForeignMix"
                                  defaultChecked={entry.isForeignMix}
                                  className="h-4 w-4"
                                />
                                Fremdmischgut
                              </label>
                            )}

                            <label className="block text-xs font-medium text-gray-700">
                              Bemerkung
                              <textarea
                                name="notes"
                                rows={3}
                                defaultValue={entry.notes ?? ""}
                                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                              />
                            </label>

                            <button
                              type="submit"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Speichern
                            </button>
                          </form>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <form action={copyAsphaltDispatchEntry}>
                              <input type="hidden" name="id" value={entry.id} />
                              <input
                                type="hidden"
                                name="targetWorkDate"
                                value={formatDateInput(nextPlanningDay)}
                              />
                              <input
                                type="hidden"
                                name="targetCrew"
                                value={crew}
                              />

                              <button
                                type="submit"
                                className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                Auf nächsten Planungstag kopieren
                              </button>
                            </form>

                            <form action={deleteAsphaltDispatchEntry}>
                              <input type="hidden" name="id" value={entry.id} />

                              <button
                                type="submit"
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Löschen
                              </button>
                            </form>
                          </div>
                          </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
                      <input id={createOverlayId} type="checkbox" className="peer sr-only" />
                      <label
                        htmlFor={createOverlayId}
                        className="block cursor-pointer text-sm font-semibold text-gray-700"
                      >
                        Maßnahme hinzufügen
                      </label>

                      <label
                        htmlFor={createOverlayId}
                        aria-label="Asphalt-Maßnahme schließen"
                        className="fixed inset-0 z-[210] hidden cursor-default bg-gray-950/30 backdrop-blur-sm peer-checked:block"
                      />

                      <div className="fixed left-4 right-4 top-[calc(var(--app-header-height,0px)+1rem)] z-[230] mx-auto hidden max-h-[calc(100vh-var(--app-header-height,0px)-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl peer-checked:block">
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Asphalt-Maßnahme hinzufügen
                            </div>
                            <h3 className="mt-1 text-xl font-bold text-gray-950">
                              {crew} · {formatGermanDate(day.date)}
                            </h3>
                          </div>
                          <label
                            htmlFor={createOverlayId}
                            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-900 shadow-sm hover:bg-gray-50"
                            aria-label="Asphalt-Maßnahme schließen"
                          >
                            ×
                          </label>
                        </div>

                      <form
                        action={createAsphaltDispatchEntry}
                        className="mt-4 space-y-3"
                      >
                        <input
                          type="hidden"
                          name="workDate"
                          value={formatDateInput(day.date)}
                        />

                        <input type="hidden" name="crew" value={crew} />

                        <ProjectSelect name="projectId" projects={projects} />

                        {isTackCoatCrew ? (
                          <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-900">
                            Anspritzwagen: hier wird nur Anspritzmittel erfasst.
                            Eine Asphaltsorte ist nicht erforderlich.
                            <input type="hidden" name="asphaltMixTypeId" value="" />
                            <input type="hidden" name="quantityTons" value="0" />
                          </div>
                        ) : (
                          <>
                            <AsphaltTypeSelect
                              name="asphaltMixTypeId"
                              asphaltTypes={asphaltTypes}
                            />

                            <label className="block text-xs font-medium text-gray-700">
                              Menge in Tonnen
                              <input
                                name="quantityTons"
                                type="number"
                                step="0.01"
                                defaultValue="0"
                                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                              />
                            </label>
                          </>
                        )}

                        <TackCoatFields
                          materials={tackCoatMaterials}
                          required={isTackCoatCrew}
                        />

                        {isTackCoatCrew ? null : (
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                            <input
                              type="checkbox"
                              name="isForeignMix"
                              className="h-4 w-4"
                            />
                            Fremdmischgut
                          </label>
                        )}

                        <label className="block text-xs font-medium text-gray-700">
                          Bemerkung
                          <textarea
                            name="notes"
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                          />
                        </label>

                        <button
                          type="submit"
                          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                        >
                          Eintrag speichern
                        </button>
                      </form>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <TruckDemandCalculator days={demandDays} payloadSummaries={payloadSummaries} />

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Excel-Export
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Exportiere die Asphaltdisposition komplett, für die aktuelle
              Ansicht oder für einen eigenen Zeitraum.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/asphalt-dispatch/export?from=${formatDateInput(
                weekStart
              )}&to=${formatDateInput(
                addDays(weekStart, includeWeekend ? 6 : 4)
              )}`}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Aktuelle Ansicht exportieren
            </a>

            <a
              href="/asphalt-dispatch/export"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Komplett exportieren
            </a>
          </div>
        </div>

        <form
          action="/asphalt-dispatch/export"
          method="get"
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-sm font-medium text-gray-800">
            Von
            <input
              name="from"
              type="date"
              defaultValue={formatDateInput(weekStart)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Bis
            <input
              name="to"
              type="date"
              defaultValue={formatDateInput(
                addDays(weekStart, includeWeekend ? 6 : 4)
              )}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 md:w-auto"
            >
              Zeitraum exportieren
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function SummaryBox({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "orange" | "purple";
}) {
  return (
    <div
      className={
        tone === "orange"
          ? "rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm"
          : tone === "purple"
            ? "rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow-sm"
          : "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      }
    >
      <p
        className={
          tone === "orange"
            ? "text-sm font-medium text-orange-700"
            : tone === "purple"
              ? "text-sm font-medium text-purple-700"
            : "text-sm font-medium text-gray-500"
        }
      >
        {label}
      </p>
      <p
        className={
          tone === "orange"
            ? "mt-3 text-3xl font-bold text-orange-950"
            : tone === "purple"
              ? "mt-3 text-3xl font-bold text-purple-950"
            : "mt-3 text-3xl font-bold text-gray-900"
        }
      >
        {value}
      </p>
      <p
        className={
          tone === "orange"
            ? "mt-1 text-xs text-orange-800"
            : tone === "purple"
              ? "mt-1 text-xs text-purple-800"
            : "mt-1 text-xs text-gray-500"
        }
      >
        {hint}
      </p>
    </div>
  );
}

function ProjectSelect({
  name,
  projects,
  defaultValue = "",
}: {
  name: string;
  projects: {
    id: string;
    projectNumber: string;
    name: string;
    constructionManager: string | null;
  }[];
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700">
      Projekt
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      >
        <option value="" disabled>
          Projekt wählen
        </option>

        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.projectNumber} · {project.name}
            {project.constructionManager
              ? ` · ${project.constructionManager}`
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function AsphaltTypeSelect({
  name,
  asphaltTypes,
  defaultValue = "",
}: {
  name: string;
  asphaltTypes: {
    id: string;
    mixNumber: string;
    name: string;
  }[];
  defaultValue?: string;
}) {
  return (
    <label className="block text-xs font-medium text-gray-700">
      Asphaltsorte
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      >
        <option value="" disabled>
          Sorte wählen
        </option>

        {asphaltTypes.map((asphaltType) => (
          <option key={asphaltType.id} value={asphaltType.id}>
            {asphaltType.mixNumber} · {asphaltType.name}
          </option>
        ))}
      </select>
    </label>
  );
}


function TackCoatFields({
  materials,
  defaultMaterialTypeId = "",
  defaultQuantity = "",
  required = false,
}: {
  materials: {
    id: string;
    materialNumber: string | null;
    name: string;
    category: string | null;
    unit: string;
  }[];
  defaultMaterialTypeId?: string;
  defaultQuantity?: string;
  defaultUnit?: string;
  required?: boolean;
}) {
  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-purple-900">
        {required ? "Anspritzmittel erforderlich" : "Anspritzmittel optional"}
      </div>

      <div className="mt-3 space-y-3">
        <label className="block text-xs font-medium text-purple-950">
          Anspritzmittel
          <select
            name="tackCoatMaterialTypeId"
            required={required}
            defaultValue={defaultMaterialTypeId}
            className="mt-1 w-full rounded-lg border border-purple-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-800"
          >
            <option value="">Kein Anspritzmittel</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {[material.materialNumber, material.name]
                  .filter(Boolean)
                  .join(" · ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-purple-950">
          Menge in l
          <div className="mt-1 flex items-center gap-2">
            <input
              name="tackCoatQuantity"
              required={required}
              type="number"
              min="0"
              step="0.01"
              defaultValue={defaultQuantity}
              placeholder="z.B. 850"
              className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-800"
            />
            <span className="shrink-0 rounded-lg border border-purple-200 bg-white px-3 py-2.5 text-sm font-semibold text-purple-950">
              l
            </span>
          </div>
          <input type="hidden" name="tackCoatUnit" value="l" />
        </label>
      </div>
    </div>
  );
}
