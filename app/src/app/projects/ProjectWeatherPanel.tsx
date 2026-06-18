"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshProjectWeather } from "./actions";
import {
  ProjectDailyReportWeatherEditor,
  type ProjectDailyReportWeatherRow,
} from "./ProjectDailyReportWeatherEditor";

const AUTO_REFRESH_COOLDOWN_MS = 60_000;

export type ProjectWeatherEntry = {
  currentPrecipitationMm: number | null;
  currentTemperatureC: number | null;
  currentWeatherLabel: string | null;
  currentWindSpeedKmh: number | null;
  fetchedAt: string;
  observedAt: string | null;
  precipitationMm: number;
  precipitationProbabilityMax: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  weatherCategory: string | null;
  weatherDate: string;
  weatherLabel: string | null;
  windSpeedMaxKmh: number | null;
};

export function ProjectWeatherPanel({
  entries,
  hasCoordinates,
  projectId,
  reportWeatherRows,
}: {
  entries: ProjectWeatherEntry[];
  hasCoordinates: boolean;
  projectId: string;
  reportWeatherRows: ProjectDailyReportWeatherRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [forecastStartIndex, setForecastStartIndex] = useState(1);
  const current = entries[0];
  const maxForecastStartIndex = Math.max(1, entries.length - 5);
  const visibleForecastStartIndex = Math.min(
    forecastStartIndex,
    maxForecastStartIndex,
  );
  const forecastEntries = entries.slice(
    visibleForecastStartIndex,
    visibleForecastStartIndex + 5,
  );
  const forecastRangeLabel =
    forecastEntries.length > 0
      ? `${formatDate(forecastEntries[0].weatherDate)} - ${formatDate(
          forecastEntries[forecastEntries.length - 1].weatherDate,
        )}`
      : "";
  const canGoBack = visibleForecastStartIndex > 1;
  const canGoForward = visibleForecastStartIndex + 5 < entries.length;

  const refreshWeather = useCallback(
    ({ showError = true }: { showError?: boolean } = {}) => {
      startTransition(async () => {
        try {
          await refreshProjectWeather(projectId);
          router.refresh();
        } catch (error) {
          if (!showError) {
            return;
          }

          alert(
            error instanceof Error
              ? error.message
              : "Wetterdaten konnten nicht aktualisiert werden.",
          );
        }
      });
    },
    [projectId, router],
  );

  useEffect(() => {
    if (!hasCoordinates) return;

    const storageKey = `project-weather-auto-refresh:${projectId}`;
    const lastRefresh = Number(window.sessionStorage.getItem(storageKey) ?? 0);
    const now = Date.now();

    if (Number.isFinite(lastRefresh) && now - lastRefresh < AUTO_REFRESH_COOLDOWN_MS) {
      return;
    }

    window.sessionStorage.setItem(storageKey, String(now));
    refreshWeather({ showError: false });
  }, [hasCoordinates, projectId, refreshWeather]);

  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Wetter</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Aktuell und 5-Tage-Prognose
          </p>
        </div>
        <button
          className="w-fit rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          disabled={!hasCoordinates || isPending}
          onClick={() => refreshWeather()}
          type="button"
        >
          {isPending ? "Aktualisiert..." : "Wetter aktualisieren"}
        </button>
      </div>

      {!hasCoordinates ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm font-medium text-gray-500">
          Für Wetterdaten bitte zuerst im Kartenausschnitt eine Adresse suchen
          oder Koordinaten setzen.
        </p>
      ) : null}

      {hasCoordinates && !current ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-sm font-medium text-gray-500">
          Noch keine Wetterdaten protokolliert. Einmal aktualisieren, dann werden
          aktuell und die 5-Tage-Prognose gespeichert.
        </p>
      ) : null}

      {current ? (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[0.65fr_1.35fr]">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500">
                  Aktuell
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {formatTemperature(current.currentTemperatureC)}
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  {current.currentWeatherLabel || current.weatherLabel || "-"}
                </div>
              </div>
              <WeatherBadge
                value={current.currentWeatherLabel || current.weatherCategory}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <MiniWeatherMetric
                label="Regen"
                value={formatMillimeter(current.currentPrecipitationMm)}
              />
              <MiniWeatherMetric
                label="Wind"
                value={formatSpeed(current.currentWindSpeedKmh)}
              />
              <MiniWeatherMetric
                label="Temp min"
                value={formatTemperature(current.tempMinC)}
              />
              <MiniWeatherMetric
                label="Temp max"
                value={formatTemperature(current.tempMaxC)}
              />
            </div>

            <div className="mt-3 rounded-lg bg-white p-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-800">
                Bautagesbericht:
              </span>{" "}
              {current.weatherCategory || "-"} ·{" "}
              {formatTemperatureRange(current.tempMinC, current.tempMaxC)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-gray-500">
                  5-Tage-Prognose
                </div>
                {forecastRangeLabel ? (
                  <div className="mt-0.5 text-xs font-medium text-gray-500">
                    {forecastRangeLabel}
                  </div>
                ) : null}
              </div>
              <div className="flex w-fit overflow-hidden rounded-lg border border-gray-200 bg-white">
                <ForecastNavButton
                  disabled={!canGoBack}
                  label="Zurück"
                  onClick={() =>
                    setForecastStartIndex((currentIndex) =>
                      Math.max(1, currentIndex - 5),
                    )
                  }
                />
                <ForecastNavButton
                  disabled={visibleForecastStartIndex === 1}
                  label="Aktuell"
                  onClick={() => setForecastStartIndex(1)}
                />
                <ForecastNavButton
                  disabled={!canGoForward}
                  label="Vor"
                  onClick={() =>
                    setForecastStartIndex((currentIndex) =>
                      Math.min(maxForecastStartIndex, currentIndex + 5),
                    )
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {forecastEntries.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Noch keine Prognosetage vorhanden.
                </p>
              ) : (
                forecastEntries.map((entry) => (
                  <div
                    className="grid grid-cols-1 gap-1.5 rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-sm md:grid-cols-[90px_1fr_130px_120px] md:items-center"
                    key={entry.weatherDate}
                  >
                    <div className="font-semibold text-gray-900">
                      {formatDate(entry.weatherDate)}
                    </div>
                    <WeatherBadge value={entry.weatherCategory} />
                    <div className="font-semibold text-gray-800">
                      {formatTemperatureRange(entry.tempMinC, entry.tempMaxC)}
                    </div>
                    <div className="text-xs font-medium text-gray-600">
                      Regen {formatMillimeter(entry.precipitationMm)}
                      {entry.precipitationProbabilityMax !== null
                        ? ` · ${entry.precipitationProbabilityMax} %`
                        : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {current ? (
        <div className="mt-3 text-xs text-gray-500">
          Quelle: Open-Meteo/WMO · aktualisiert{" "}
          {formatDateTime(current.fetchedAt)}
        </div>
      ) : null}

      <details className="mt-3 rounded-lg border border-gray-200 bg-gray-50">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-gray-800">
          Wetterverlauf und gespeicherte BTB-Werte
        </summary>
        <div className="border-t border-gray-200 bg-white px-3 pb-3">
          <p className="mt-3 text-xs text-gray-600">
            Protokollierte Tageswerte und manuelle BTB-Anpassungen.
            Standardmäßig bleibt dieser Bereich geschlossen.
          </p>
          <ProjectDailyReportWeatherEditor
            projectId={projectId}
            rows={reportWeatherRows}
          />
        </div>
      </details>
    </section>
  );
}

function MiniWeatherMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-1 font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ForecastNavButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="border-r border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 last:border-r-0 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function WeatherBadge({ value }: { value: string | null }) {
  const label = value || "-";
  const normalized = label.toLowerCase();
  const colorMap: Record<string, string> = {
    bedeckt: "bg-yellow-100 text-yellow-800",
    frost: "bg-cyan-100 text-cyan-800",
    gewitter: "bg-purple-100 text-purple-800",
    "gewitter mit hagel": "bg-purple-100 text-purple-800",
    klar: "bg-green-100 text-green-800",
    hitze: "bg-red-100 text-red-800",
    "leichter regen": "bg-blue-100 text-blue-800",
    "leichter nieselregen": "bg-blue-100 text-blue-800",
    "leichte regenschauer": "bg-blue-100 text-blue-800",
    nebel: "bg-gray-200 text-gray-800",
    nieselregen: "bg-blue-100 text-blue-800",
    regen: "bg-blue-100 text-blue-800",
    regenschauer: "bg-blue-100 text-blue-800",
    reifnebel: "bg-cyan-100 text-cyan-800",
    schneefall: "bg-sky-100 text-sky-800",
    schneegriesel: "bg-sky-100 text-sky-800",
    "starker regen": "bg-indigo-100 text-indigo-800",
    "starker nieselregen": "bg-indigo-100 text-indigo-800",
    "starke regenschauer": "bg-indigo-100 text-indigo-800",
    "starkes gewitter mit hagel": "bg-purple-100 text-purple-800",
    "teilweise bewölkt": "bg-yellow-100 text-yellow-800",
    sturm: "bg-purple-100 text-purple-800",
    trocken: "bg-green-100 text-green-800",
    "überwiegend klar": "bg-green-100 text-green-800",
    wechselhaft: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
        colorMap[normalized] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </span>
  );
}

function formatTemperature(value: number | null) {
  if (value === null) return "-";
  return `${roundOne(value)} °C`;
}

function formatTemperatureRange(min: number | null, max: number | null) {
  return `${formatTemperature(min)} / ${formatTemperature(max)}`;
}

function formatMillimeter(value: number | null) {
  if (value === null) return "-";
  return `${roundOne(value)} mm`;
}

function formatSpeed(value: number | null) {
  if (value === null) return "-";
  return `${roundOne(value)} km/h`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
