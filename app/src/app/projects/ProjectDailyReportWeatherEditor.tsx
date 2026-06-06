"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProjectDailyReportWeather } from "./actions";

export type ProjectDailyReportWeatherRow = {
  reportWeatherCategory: string | null;
  reportWeatherNotes: string | null;
  reportWeatherSource: string | null;
  reportWeatherTempMaxC: number | null;
  reportWeatherTempMinC: number | null;
  suggestionCategory: string | null;
  suggestionTempMaxC: number | null;
  suggestionTempMinC: number | null;
  weatherDate: string;
};

type WeatherFormState = {
  weatherCategory: string;
  weatherNotes: string;
  weatherTempMaxC: string;
  weatherTempMinC: string;
};

export function ProjectDailyReportWeatherEditor({
  projectId,
  rows,
}: {
  projectId: string;
  rows: ProjectDailyReportWeatherRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialState = useMemo(() => createInitialState(rows), [rows]);
  const [formByDate, setFormByDate] = useState(initialState);

  function updateRow(
    weatherDate: string,
    key: keyof WeatherFormState,
    value: string,
  ) {
    setFormByDate((current) => ({
      ...current,
      [weatherDate]: {
        ...current[weatherDate],
        [key]: value,
      },
    }));
  }

  function saveRow(weatherDate: string) {
    const form = formByDate[weatherDate];
    if (!form) return;

    startTransition(async () => {
      try {
        await saveProjectDailyReportWeather({
          projectId,
          reportDate: weatherDate,
          ...form,
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Wetterangabe konnte nicht gespeichert werden.",
        );
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm font-medium text-gray-500">
        Noch kein Wetterprotokoll vorhanden. Erst im Wetterkasten aktualisieren.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            <th className="p-3 font-semibold">Datum</th>
            <th className="p-3 font-semibold">Quelle</th>
            <th className="p-3 font-semibold">Temp min</th>
            <th className="p-3 font-semibold">Temp max</th>
            <th className="p-3 font-semibold">Wetterangabe</th>
            <th className="p-3 font-semibold">Bemerkung</th>
            <th className="p-3 font-semibold">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const form = formByDate[row.weatherDate];

            return (
              <tr className="border-t border-gray-100" key={row.weatherDate}>
                <td className="p-3 align-top font-semibold text-gray-900">
                  {formatDate(row.weatherDate)}
                </td>
                <td className="p-3 align-top text-gray-700">
                  <div className="font-semibold">
                    {row.suggestionCategory || "-"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTemperature(row.suggestionTempMinC)} /{" "}
                    {formatTemperature(row.suggestionTempMaxC)}
                  </div>
                </td>
                <td className="p-3 align-top">
                  <input
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) =>
                      updateRow(
                        row.weatherDate,
                        "weatherTempMinC",
                        event.target.value,
                      )
                    }
                    type="number"
                    value={form?.weatherTempMinC ?? ""}
                  />
                </td>
                <td className="p-3 align-top">
                  <input
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) =>
                      updateRow(
                        row.weatherDate,
                        "weatherTempMaxC",
                        event.target.value,
                      )
                    }
                    type="number"
                    value={form?.weatherTempMaxC ?? ""}
                  />
                </td>
                <td className="p-3 align-top">
                  <input
                    className="w-full min-w-40 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) =>
                      updateRow(
                        row.weatherDate,
                        "weatherCategory",
                        event.target.value,
                      )
                    }
                    placeholder="z. B. leichter Regen"
                    value={form?.weatherCategory ?? ""}
                  />
                </td>
                <td className="p-3 align-top">
                  <input
                    className="w-full min-w-56 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                    onChange={(event) =>
                      updateRow(
                        row.weatherDate,
                        "weatherNotes",
                        event.target.value,
                      )
                    }
                    value={form?.weatherNotes ?? ""}
                  />
                </td>
                <td className="p-3 align-top">
                  <button
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => saveRow(row.weatherDate)}
                    type="button"
                  >
                    Speichern
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function createInitialState(rows: ProjectDailyReportWeatherRow[]) {
  return rows.reduce<Record<string, WeatherFormState>>((result, row) => {
    result[row.weatherDate] = {
      weatherCategory: row.reportWeatherCategory || row.suggestionCategory || "",
      weatherNotes: row.reportWeatherNotes || "",
      weatherTempMaxC: formatNumberInput(
        row.reportWeatherTempMaxC ?? row.suggestionTempMaxC,
      ),
      weatherTempMinC: formatNumberInput(
        row.reportWeatherTempMinC ?? row.suggestionTempMinC,
      ),
    };
    return result;
  }, {});
}

function formatNumberInput(value: number | null) {
  if (value === null) return "";
  return (Math.round(value * 10) / 10).toString();
}

function formatTemperature(value: number | null) {
  if (value === null) return "-";
  return `${formatNumberInput(value)} °C`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00`));
}
