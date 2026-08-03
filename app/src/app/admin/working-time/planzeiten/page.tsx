import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getNetWorkHoursForDay } from "@/lib/work-time";
import { workTimeDayTypeColorOptions } from "@/lib/work-time-day-type-colors";
import {
  createWorkTimeDayType,
  deleteWorkTimeDayType,
  updateWorkTimeDayType,
} from "./actions";

type WorkTimeDayTypeRow = {
  breakfastEnd: string | null;
  breakfastStart: string | null;
  colorKey: string;
  endTime: string | null;
  id: string;
  lunchEnd: string | null;
  lunchStart: string | null;
  number: number;
  startTime: string | null;
};

function dayTypeHours(dayType: WorkTimeDayTypeRow) {
  return getNetWorkHoursForDay({
    breakfastEnd: dayType.breakfastEnd ?? "",
    breakfastStart: dayType.breakfastStart ?? "",
    endTime: dayType.endTime ?? "",
    lunchEnd: dayType.lunchEnd ?? "",
    lunchStart: dayType.lunchStart ?? "",
    startTime: dayType.startTime ?? "",
  });
}

export default async function WorkTimeDayTypesPage() {
  const dayTypes = await prisma.workTimeDayType.findMany({
    orderBy: [{ number: "asc" }],
  });

  return (
    <AppShell
      title="Planzeiten"
      description="Benannte, farbige Tages-Bausteine (Beginn/Pausen/Ende) für den Jahreskalender – frei jedem Tag zuweisbar statt fest an einen Wochentag gebunden."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/working-time"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Arbeitszeit-Übersicht
        </Link>
        <Link
          href="/admin/working-time/kalender"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Jahreskalender
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3">Nr.</th>
                <th className="p-3">Farbe</th>
                <th className="p-3">Beginn</th>
                <th className="p-3">Pause 1 von</th>
                <th className="p-3">Pause 1 bis</th>
                <th className="p-3">Pause 2 von</th>
                <th className="p-3">Pause 2 bis</th>
                <th className="p-3">Ende</th>
                <th className="p-3">Std.</th>
                <th className="p-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {dayTypes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    Noch keine Planzeiten angelegt.
                  </td>
                </tr>
              ) : (
                dayTypes.map((dayType) => {
                  const formId = `day-type-${dayType.id}`;
                  const color = workTimeDayTypeColorOptions.find(
                    (option) => option.key === dayType.colorKey,
                  );
                  return (
                    <tr key={dayType.id} className="border-b border-gray-100 align-top">
                      <td className="p-3">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${color?.barClass ?? ""}`}
                        >
                          {dayType.number}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.colorKey}
                          form={formId}
                          name="colorKey"
                        >
                          {workTimeDayTypeColorOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.startTime ?? ""}
                          form={formId}
                          name="startTime"
                          type="time"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.breakfastStart ?? ""}
                          form={formId}
                          name="breakfastStart"
                          type="time"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.breakfastEnd ?? ""}
                          form={formId}
                          name="breakfastEnd"
                          type="time"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.lunchStart ?? ""}
                          form={formId}
                          name="lunchStart"
                          type="time"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.lunchEnd ?? ""}
                          form={formId}
                          name="lunchEnd"
                          type="time"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
                          defaultValue={dayType.endTime ?? ""}
                          form={formId}
                          name="endTime"
                          type="time"
                        />
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {dayTypeHours(dayType).toLocaleString("de-DE")}
                      </td>
                      <td className="p-3">
                        <form action={updateWorkTimeDayType} className="inline" id={formId}>
                          <input name="id" type="hidden" value={dayType.id} />
                        </form>
                        <div className="flex gap-2">
                          <button
                            aria-label="Planzeit speichern"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            form={formId}
                            title="Speichern"
                            type="submit"
                          >
                            <ActionIcon name="save" className="h-4 w-4" />
                          </button>
                          <form action={deleteWorkTimeDayType}>
                            <input name="id" type="hidden" value={dayType.id} />
                            <button
                              aria-label="Planzeit löschen"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                              title="Löschen"
                              type="submit"
                            >
                              <ActionIcon name="delete" className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-gray-900">
          Planzeit hinzufügen
        </summary>

        <form action={createWorkTimeDayType} className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          <label className="text-xs font-semibold text-gray-700">
            Farbe
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
              defaultValue="gray"
              name="colorKey"
            >
              {workTimeDayTypeColorOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Beginn
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="startTime"
              type="time"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Pause 1 von
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="breakfastStart"
              type="time"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Pause 1 bis
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="breakfastEnd"
              type="time"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Pause 2 von
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="lunchStart"
              type="time"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Pause 2 bis
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="lunchEnd"
              type="time"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Ende
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="endTime"
              type="time"
            />
          </label>
          <div className="flex items-end">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Hinzufügen
            </button>
          </div>
        </form>
      </details>
    </AppShell>
  );
}
