"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type VehiclePayloadSummary = {
  category: string;
  vehicleCount: number;
  averagePayloadTons: number;
  minPayloadTons: number;
  maxPayloadTons: number;
};

type DemandDay = {
  label: string;
  dateKey: string;
  dateLabel: string;
  openTons: number;
};

type OverrideMap = Record<string, string>;
type DaySettingsMap = Record<string, string>;

type PlanRow = {
  countKey: string;
  roundsKey: string;
  summary: VehiclePayloadSummary;
  truckCount: number;
  roundsPerTruck: number;
  capacityTons: number;
  transportTons: number;
  overCapacityTons: number;
  totalLoads: number;
  isPrimary: boolean;
  isCountManual: boolean;
  isRoundsManual: boolean;
  isAutoFallback: boolean;
};

const DEFAULT_MAX_ROUNDS_PER_TRUCK = 4;
const STORAGE_KEY_DEFAULT_MAX_ROUNDS =
  "asphalt-dispatch:truck-demand:default-max-rounds";

function formatTons(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function roundTons(value: number) {
  return Math.round(value * 100) / 100;
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 0) return 0;

  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") return fallback;

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function getCountKey(dayKey: string, category: string) {
  return `${dayKey}__${category}__count`;
}

function getRoundsKey(dayKey: string, category: string) {
  return `${dayKey}__${category}__rounds`;
}

function getMaxRoundsKey(dayKey: string) {
  return `${dayKey}__maxRounds`;
}

function isFourAxleCategory(category: string) {
  const normalized = category
    .toLowerCase()
    .replaceAll(" ", "")
    .replaceAll("-", "")
    .replaceAll("_", "");

  return (
    normalized.includes("4achser") ||
    normalized.includes("4achs") ||
    normalized.includes("vierachser") ||
    normalized.includes("vierachs")
  );
}

function getPrimaryCategory(summaries: VehiclePayloadSummary[]) {
  const fourAxle = summaries.find((summary) =>
    isFourAxleCategory(summary.category),
  );

  if (fourAxle) {
    return fourAxle.category;
  }

  const biggestPayload = [...summaries].sort((a, b) => {
    if (a.averagePayloadTons !== b.averagePayloadTons) {
      return b.averagePayloadTons - a.averagePayloadTons;
    }

    return a.category.localeCompare(b.category, "de-DE");
  })[0];

  return biggestPayload?.category ?? "";
}

function sortPayloadSummaries({
  payloadSummaries,
  primaryCategory,
}: {
  payloadSummaries: VehiclePayloadSummary[];
  primaryCategory: string;
}) {
  return [...payloadSummaries].sort((a, b) => {
    if (a.category === primaryCategory) return -1;
    if (b.category === primaryCategory) return 1;

    if (a.averagePayloadTons !== b.averagePayloadTons) {
      return b.averagePayloadTons - a.averagePayloadTons;
    }

    return a.category.localeCompare(b.category, "de-DE");
  });
}

function createPlanRow({
  day,
  summary,
  truckCount,
  roundsPerTruck,
  isPrimary,
  isCountManual,
  isRoundsManual,
  isAutoFallback,
}: {
  day: DemandDay;
  summary: VehiclePayloadSummary;
  truckCount: number;
  roundsPerTruck: number;
  isPrimary: boolean;
  isCountManual: boolean;
  isRoundsManual: boolean;
  isAutoFallback: boolean;
}): PlanRow {
  const countKey = getCountKey(day.dateKey, summary.category);
  const roundsKey = getRoundsKey(day.dateKey, summary.category);
  const capacityTons = roundTons(
    truckCount * roundsPerTruck * summary.averagePayloadTons,
  );

  return {
    countKey,
    roundsKey,
    summary,
    truckCount,
    roundsPerTruck,
    capacityTons,
    transportTons: capacityTons,
    overCapacityTons: 0,
    totalLoads: truckCount * roundsPerTruck,
    isPrimary,
    isCountManual,
    isRoundsManual,
    isAutoFallback,
  };
}

function buildAutoRowForRemaining({
  day,
  summary,
  remainingTons,
  maxRoundsPerTruck,
  isPrimary,
  isCountManual,
  isRoundsManual,
  isAutoFallback,
  truckCountOverride,
  roundsOverride,
}: {
  day: DemandDay;
  summary: VehiclePayloadSummary;
  remainingTons: number;
  maxRoundsPerTruck: number;
  isPrimary: boolean;
  isCountManual: boolean;
  isRoundsManual: boolean;
  isAutoFallback: boolean;
  truckCountOverride: string | undefined;
  roundsOverride: string | undefined;
}) {
  const roundsForAutoTruckCount = parsePositiveInt(
    roundsOverride,
    maxRoundsPerTruck,
  );

  const autoTruckCount =
    remainingTons > 0 &&
    summary.averagePayloadTons > 0 &&
    roundsForAutoTruckCount > 0
      ? Math.ceil(
          remainingTons / (summary.averagePayloadTons * roundsForAutoTruckCount),
        )
      : 0;

  const truckCount = parseNonNegativeInt(truckCountOverride, autoTruckCount);

  const roundsPerTruck =
    truckCount > 0
      ? parseNonNegativeInt(roundsOverride, maxRoundsPerTruck)
      : parseNonNegativeInt(roundsOverride, 0);

  return createPlanRow({
    day,
    summary,
    truckCount,
    roundsPerTruck,
    isPrimary,
    isCountManual,
    isRoundsManual,
    isAutoFallback,
  });
}

function buildDayPlan({
  day,
  sortedPayloadSummaries,
  primaryCategory,
  truckCountOverrides,
  roundOverrides,
  maxRoundsPerTruck,
}: {
  day: DemandDay;
  sortedPayloadSummaries: VehiclePayloadSummary[];
  primaryCategory: string;
  truckCountOverrides: OverrideMap;
  roundOverrides: OverrideMap;
  maxRoundsPerTruck: number;
}) {
  const primarySummary =
    sortedPayloadSummaries.find(
      (summary) => summary.category === primaryCategory,
    ) ?? sortedPayloadSummaries[0];

  const rowsByCategory = new Map<string, PlanRow>();
  let remainingTons = roundTons(day.openTons);

  const secondarySummaries = sortedPayloadSummaries.filter(
    (summary) => summary.category !== primarySummary?.category,
  );

  for (const summary of secondarySummaries) {
    const countKey = getCountKey(day.dateKey, summary.category);
    const roundsKey = getRoundsKey(day.dateKey, summary.category);
    const isCountManual = truckCountOverrides[countKey] !== undefined;
    const isRoundsManual = roundOverrides[roundsKey] !== undefined;

    if (!isCountManual && !isRoundsManual) {
      continue;
    }

    const truckCount = parseNonNegativeInt(truckCountOverrides[countKey], 0);
    const roundsPerTruck =
      truckCount > 0
        ? parseNonNegativeInt(roundOverrides[roundsKey], maxRoundsPerTruck)
        : parseNonNegativeInt(roundOverrides[roundsKey], 0);

    const row = createPlanRow({
      day,
      summary,
      truckCount,
      roundsPerTruck,
      isPrimary: false,
      isCountManual,
      isRoundsManual,
      isAutoFallback: false,
    });

    rowsByCategory.set(summary.category, row);
    remainingTons = roundTons(Math.max(0, remainingTons - row.transportTons));
  }

  if (primarySummary) {
    const countKey = getCountKey(day.dateKey, primarySummary.category);
    const roundsKey = getRoundsKey(day.dateKey, primarySummary.category);
    const isCountManual = truckCountOverrides[countKey] !== undefined;
    const isRoundsManual = roundOverrides[roundsKey] !== undefined;

    const primaryRow = buildAutoRowForRemaining({
      day,
      summary: primarySummary,
      remainingTons,
      maxRoundsPerTruck,
      isPrimary: true,
      isCountManual,
      isRoundsManual,
      isAutoFallback: false,
      truckCountOverride: truckCountOverrides[countKey],
      roundsOverride: roundOverrides[roundsKey],
    });

    rowsByCategory.set(primarySummary.category, primaryRow);
    remainingTons = roundTons(
      Math.max(0, remainingTons - primaryRow.transportTons),
    );
  }

  if (remainingTons > 0) {
    for (const summary of secondarySummaries) {
      if (remainingTons <= 0) {
        break;
      }

      const countKey = getCountKey(day.dateKey, summary.category);
      const roundsKey = getRoundsKey(day.dateKey, summary.category);
      const isCountManual = truckCountOverrides[countKey] !== undefined;
      const isRoundsManual = roundOverrides[roundsKey] !== undefined;

      if (rowsByCategory.has(summary.category) || isCountManual || isRoundsManual) {
        continue;
      }

      const fallbackRow = buildAutoRowForRemaining({
        day,
        summary,
        remainingTons,
        maxRoundsPerTruck,
        isPrimary: false,
        isCountManual: false,
        isRoundsManual: false,
        isAutoFallback: true,
        truckCountOverride: undefined,
        roundsOverride: undefined,
      });

      rowsByCategory.set(summary.category, fallbackRow);
      remainingTons = roundTons(
        Math.max(0, remainingTons - fallbackRow.transportTons),
      );
    }
  }

  const displayRows = sortedPayloadSummaries.map((summary) => {
    const found = rowsByCategory.get(summary.category);

    if (found) return found;

    return createPlanRow({
      day,
      summary,
      truckCount: 0,
      roundsPerTruck: 0,
      isPrimary: false,
      isCountManual: false,
      isRoundsManual: false,
      isAutoFallback: false,
    });
  });

  const transportTotalTons = roundTons(
    displayRows.reduce((sum, row) => sum + row.transportTons, 0),
  );

  const overCapacityTotalTons = roundTons(
    Math.max(0, transportTotalTons - day.openTons),
  );

  const underCapacityTotalTons = roundTons(
    Math.max(0, day.openTons - transportTotalTons),
  );

  const calculatedRows = displayRows.map((row) => {
    const rowOverCapacityShare =
      transportTotalTons > day.openTons && row.transportTons > 0
        ? roundTons(
            (row.transportTons / transportTotalTons) * overCapacityTotalTons,
          )
        : 0;

    return {
      ...row,
      overCapacityTons: rowOverCapacityShare,
    };
  });

  const totalLoads = calculatedRows.reduce((sum, row) => sum + row.totalLoads, 0);
  const totalTrucks = calculatedRows.reduce((sum, row) => sum + row.truckCount, 0);

  return {
    ...day,
    rows: calculatedRows,
    transportTotalTons,
    capacityTotalTons: transportTotalTons,
    overCapacityTotalTons,
    underCapacityTotalTons,
    totalLoads,
    totalTrucks,
    remainingTotalTons: underCapacityTotalTons,
    primaryCategory: primarySummary?.category ?? "",
  };
}
export function TruckDemandCalculator({
  days,
  payloadSummaries,
}: {
  days: DemandDay[];
  payloadSummaries: VehiclePayloadSummary[];
}) {
  const [defaultMaxRounds, setDefaultMaxRounds] = useState(() => {
    if (typeof window === "undefined") {
      return String(DEFAULT_MAX_ROUNDS_PER_TRUCK);
    }

    return (
      window.localStorage.getItem(STORAGE_KEY_DEFAULT_MAX_ROUNDS) ??
      String(DEFAULT_MAX_ROUNDS_PER_TRUCK)
    );
  });
  const [truckCountOverrides, setTruckCountOverrides] = useState<OverrideMap>({});
  const [roundOverrides, setRoundOverrides] = useState<OverrideMap>({});
  const [maxRoundsOverrides, setMaxRoundsOverrides] = useState<DaySettingsMap>(
    {},
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY_DEFAULT_MAX_ROUNDS,
      defaultMaxRounds,
    );
  }, [defaultMaxRounds]);

  const parsedDefaultMaxRounds = parsePositiveInt(
    defaultMaxRounds,
    DEFAULT_MAX_ROUNDS_PER_TRUCK,
  );

  const hasOpenTons = days.some((day) => day.openTons > 0);

  const primaryCategory = useMemo(
    () => getPrimaryCategory(payloadSummaries),
    [payloadSummaries],
  );

  const sortedPayloadSummaries = useMemo(
    () =>
      sortPayloadSummaries({
        payloadSummaries,
        primaryCategory,
      }),
    [payloadSummaries, primaryCategory],
  );

  const dayPlans = useMemo(
    () =>
      days.map((day) => {
        const maxRoundsPerTruck = parsePositiveInt(
          maxRoundsOverrides[getMaxRoundsKey(day.dateKey)],
          parsedDefaultMaxRounds,
        );

        return buildDayPlan({
          day,
          sortedPayloadSummaries,
          primaryCategory,
          truckCountOverrides,
          roundOverrides,
          maxRoundsPerTruck,
        });
      }),
    [
      days,
      sortedPayloadSummaries,
      primaryCategory,
      truckCountOverrides,
      roundOverrides,
      maxRoundsOverrides,
      parsedDefaultMaxRounds,
    ],
  );

  function resetDay(dayKey: string) {
    setTruckCountOverrides((current) => {
      const next = { ...current };

      for (const key of Object.keys(next)) {
        if (key.startsWith(`${dayKey}__`)) {
          delete next[key];
        }
      }

      return next;
    });

    setRoundOverrides((current) => {
      const next = { ...current };

      for (const key of Object.keys(next)) {
        if (key.startsWith(`${dayKey}__`)) {
          delete next[key];
        }
      }

      return next;
    });

    setMaxRoundsOverrides((current) => {
      const next = { ...current };
      delete next[getMaxRoundsKey(dayKey)];
      return next;
    });
  }

  function resetAll() {
    setTruckCountOverrides({});
    setRoundOverrides({});
    setMaxRoundsOverrides({});
    setDefaultMaxRounds(String(DEFAULT_MAX_ROUNDS_PER_TRUCK));
    window.localStorage.setItem(
      STORAGE_KEY_DEFAULT_MAX_ROUNDS,
      String(DEFAULT_MAX_ROUNDS_PER_TRUCK),
    );
  }

  function clearTruckCountOverride(key: string) {
    setTruckCountOverrides((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-orange-950">LKW-Bedarf</h2>
          <p className="mt-1 text-xs leading-5 text-orange-900">
            Standardmäßig wird der Bedarf zuerst mit{" "}
            <strong>{primaryCategory || "dem größten LKW-Typ"}</strong>{" "}
            abgefangen. Andere LKW-Typen reduzieren den Standardbedarf, sobald
            du sie einträgst. Wenn der Standard-LKW zu klein gesetzt wird, wird
            der Rest automatisch auf weitere Typen verteilt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-950">
            Voreinstellung Uml./LKW
            <input
              type="number"
              min="1"
              value={defaultMaxRounds}
              onChange={(event) => setDefaultMaxRounds(event.target.value)}
              className="w-14 rounded border border-orange-200 px-2 py-1 text-center text-xs font-bold text-gray-900 outline-none"
            />
          </label>

          <Link
            href="/inventory"
            className="inline-flex rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-950 hover:bg-orange-100"
          >
            Nutzlasten pflegen →
          </Link>

          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-950 hover:bg-orange-100"
          >
            alles zurücksetzen
          </button>
        </div>
      </div>

      {payloadSummaries.length === 0 ? (
        <div className="mt-4 rounded-xl border border-orange-300 bg-white p-3 text-sm font-semibold text-orange-900">
          Noch keine Nutzlasten bei aktiven Fahrzeugen hinterlegt. Bitte im
          Inventar die Nutzlast in Tonnen eintragen.
        </div>
      ) : !hasOpenTons ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
          Keine offene Asphaltmenge im gewählten Zeitraum. Kein zusätzlicher
          LKW-Bedarf.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {dayPlans.map((day) => {
            const maxRoundsKey = getMaxRoundsKey(day.dateKey);
            const dayHasOwnMaxRounds =
              maxRoundsOverrides[maxRoundsKey] !== undefined;

            return (
              <div
                key={day.dateKey}
                className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm"
              >
                <div className="border-b border-orange-100 bg-orange-50/70 p-3">
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {day.label} · {day.dateLabel}
                      </div>

                      <div className="mt-1 text-xs leading-5 text-gray-600 tabular-nums">
                        Offen <strong>{formatTons(day.openTons)} t</strong> ·
                        Vorschlag <strong>{day.totalTrucks}</strong> LKW ·{" "}
                        <strong>{day.totalLoads}</strong> Ladungen · zugeteilt{" "}
                        <strong>{formatTons(day.transportTotalTons)} t</strong>{" "}
                        {day.underCapacityTotalTons > 0 ? (
                          <>
                            {" "}
                            · Unterdeckung{" "}
                            <strong>
                              -{formatTons(day.underCapacityTotalTons)} t
                            </strong>
                          </>
                        ) : (
                          <>
                            {" "}
                            · Überdeckung{" "}
                            <strong>
                              +{formatTons(day.overCapacityTotalTons)} t
                            </strong>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1 rounded-full border border-orange-200 bg-white px-2 py-1 text-xs font-semibold text-orange-950">
                        max. Uml./LKW
                        <input
                          type="number"
                          min="1"
                          value={maxRoundsOverrides[maxRoundsKey] ?? ""}
                          placeholder={String(parsedDefaultMaxRounds)}
                          onChange={(event) =>
                            setMaxRoundsOverrides((current) => ({
                              ...current,
                              [maxRoundsKey]: event.target.value,
                            }))
                          }
                          className="w-12 rounded border border-orange-200 px-1 py-0.5 text-center text-xs font-bold text-gray-900 outline-none placeholder:text-gray-400"
                        />
                      </label>

                      {dayHasOwnMaxRounds ? (
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-800">
                          Tageswert
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600">
                          Standard {parsedDefaultMaxRounds}
                        </span>
                      )}

                      <span
                        className={
                          day.remainingTotalTons > 0
                            ? "rounded-full bg-orange-100 px-2 py-1 text-xs font-bold text-orange-950"
                            : "rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800"
                        }
                      >
                        Rest {formatTons(day.remainingTotalTons)} t
                      </span>

                      <button
                        type="button"
                        onClick={() => resetDay(day.dateKey)}
                        className="rounded-full border border-orange-300 bg-white px-2 py-1 text-xs font-semibold text-orange-950 hover:bg-orange-100"
                      >
                        Tag zurücksetzen
                      </button>
                    </div>
                  </div>

                  <DispositionSuggestion rows={day.rows} />
                </div>

                {day.openTons <= 0 ? (
                  <div className="p-3 text-sm font-semibold text-green-800">
                    Keine offene Menge. Kein zusätzlicher LKW-Bedarf.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed text-left text-xs">
                      <colgroup>
                        <col className="w-[38%]" />
                        <col className="w-[14%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                        <col className="w-[16%]" />
                      </colgroup>

                      <thead className="bg-gray-50 text-gray-700">
                        <tr>
                          <th className="p-2 font-semibold">Kategorie</th>
                          <th className="p-2 text-center font-semibold">LKW</th>
                          <th className="p-2 text-center font-semibold">
                            Uml./LKW
                          </th>
                          <th className="p-2 text-right font-semibold">
                            Kapazität
                          </th>
                          <th className="p-2 text-right font-semibold">
                            Zuteilung
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {day.rows.map((row) => {
                          const isOverAvailable =
                            row.truckCount > row.summary.vehicleCount;
                          const isActiveRow =
                            row.truckCount > 0 || row.transportTons > 0;

                          return (
                            <tr
                              key={row.countKey}
                              className={
                                isActiveRow
                                  ? "h-[78px] border-t border-gray-100"
                                  : "h-[78px] border-t border-gray-100 text-gray-400"
                              }
                            >
                              <td className="p-2 align-top">
                                <div className="font-semibold text-gray-900">
                                  {row.summary.category}
                                  {row.isPrimary ? (
                                    <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-900">
                                      Standard
                                    </span>
                                  ) : null}
                                  {row.isAutoFallback ? (
                                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                      Rest
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-0.5 min-h-[16px] truncate whitespace-nowrap text-[11px] text-gray-500">
                                  Ø {formatTons(row.summary.averagePayloadTons)}{" "}
                                  t · {row.summary.vehicleCount} LKW ·{" "}
                                  {formatTons(row.summary.minPayloadTons)}–
                                  {formatTons(row.summary.maxPayloadTons)} t
                                </div>

                                <div className="mt-1 min-h-[18px]">
                                  {isOverAvailable ? (
                                    <span className="text-[11px] font-semibold text-yellow-800">
                                      mehr als Inventarwert
                                    </span>
                                  ) : row.isPrimary && row.isCountManual ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        clearTruckCountOverride(row.countKey)
                                      }
                                      className="rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-900 hover:bg-orange-100"
                                    >
                                      LKW wieder automatisch
                                    </button>
                                  ) : row.isAutoFallback ? (
                                    <span className="text-[11px] font-semibold text-blue-800">
                                      Rest automatisch verteilt
                                    </span>
                                  ) : row.isCountManual || row.isRoundsManual ? (
                                    <span className="text-[11px] font-semibold text-blue-800">
                                      manuell angepasst
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-transparent">
                                      .
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.truckCount}
                                  onChange={(event) =>
                                    setTruckCountOverrides((current) => ({
                                      ...current,
                                      [row.countKey]: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-xs font-bold text-gray-900 outline-none focus:border-gray-900"
                                />
                              </td>

                              <td className="p-2 align-top">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.roundsPerTruck}
                                  onChange={(event) =>
                                    setRoundOverrides((current) => ({
                                      ...current,
                                      [row.roundsKey]: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-center text-xs font-bold text-gray-900 outline-none focus:border-gray-900"
                                />
                              </td>

                              <td className="whitespace-nowrap p-2 text-right align-top text-gray-700 tabular-nums">
                                <div className="font-semibold">
                                  {formatTons(row.capacityTons)} t
                                </div>
                                <div className="text-[11px] text-gray-500">
                                  {row.totalLoads} Lad.
                                </div>
                              </td>

                              <td className="whitespace-nowrap p-2 text-right align-top font-bold text-orange-950 tabular-nums">
                                <div>{formatTons(row.transportTons)} t</div>
                                <div className="min-h-[15px] text-[11px] font-medium text-blue-800">
                                  +{formatTons(row.overCapacityTons)} t
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DispositionSuggestion({ rows }: { rows: PlanRow[] }) {
  const activeRows = rows.filter((row) => row.transportTons > 0);

  if (activeRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 grid grid-cols-1 gap-1.5">
      {activeRows.map((row) => (
        <span
          key={`suggestion-${row.countKey}`}
          className={
            row.isPrimary
              ? "rounded-full bg-orange-100 px-2 py-1 text-center text-[11px] font-semibold text-orange-950 tabular-nums"
              : "rounded-full bg-white px-2 py-1 text-center text-[11px] font-semibold text-gray-700 tabular-nums"
          }
        >
          {row.summary.category}: {row.truckCount} LKW ×{" "}
          {row.roundsPerTruck} Uml. = {row.totalLoads} Lad. /{" "}
          {formatTons(row.transportTons)} t
        </span>
      ))}
    </div>
  );
}
