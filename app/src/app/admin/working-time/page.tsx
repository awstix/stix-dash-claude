import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { ScrollPreservingForm } from "@/components/ScrollPreservingForm";
import { prisma } from "@/lib/prisma";
import { getHolidayDateSet } from "@/lib/time-accounts";
import {
  createWeeklySchedule,
  ensureDefaultWorkTimePresets,
  getNetWorkHoursForDay,
  getWorkTimeForDate,
  parseWeeklySchedule,
  selectWorkTimePresetForDate,
  workTimeDayKeys,
  type WorkTimeDaySettings,
  type WorkTimeSettings,
} from "@/lib/work-time";
import {
  createWorkTimePresetAction,
  deleteWorkTimePreset,
  setDefaultWorkTimePreset,
  updateWorkTimeCalendarEffectiveFrom,
  updateWorkTimePresetAction,
} from "./actions";
import { WorkTimeDayRow } from "./WorkTimeDayRow";
import { WorkTimeModalButton } from "./WorkTimeModalButton";
import { WorkTimePresetForm } from "./WorkTimePresetForm";

function parseMonthParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return { month, year };
  }
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

function calculateMonthHours(settings: WorkTimeSettings, year: number, month: number, holidaySet: Set<string>) {
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0));
  let total = 0;
  for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (holidaySet.has(iso)) continue;
    total += getNetWorkHoursForDay(getWorkTimeForDate(settings, d));
  }
  return Math.round(total * 100) / 100;
}

function calculateWeeklyHours(schedule: Record<string, WorkTimeDaySettings>) {
  return (
    Math.round(
      workTimeDayKeys.reduce((sum, dayKey) => sum + getNetWorkHoursForDay(schedule[dayKey]), 0) * 100,
    ) / 100
  );
}

export default async function WorkingTimePage({
  searchParams,
}: {
  searchParams: Promise<{ previewMonth?: string }>;
}) {
  await ensureDefaultWorkTimePresets();

  const params = await searchParams;
  const { month: previewMonth, year: previewYear } = parseMonthParam(params.previewMonth);
  const previewMonthValue = `${previewYear}-${String(previewMonth).padStart(2, "0")}`;

  const [presets, holidaySet, timeTrackingSettings] = await Promise.all([
    prisma.workTimePreset.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    getHolidayDateSet(),
    prisma.timeTrackingSettings.findUnique({
      select: { workTimeCalendarEffectiveFrom: true },
      where: { id: "default" },
    }),
  ]);
  const effectiveFromValue = timeTrackingSettings?.workTimeCalendarEffectiveFrom
    ?.toISOString()
    .slice(0, 10);

  const todayIso = new Date().toISOString().slice(0, 10);
  const isCalendarActive = Boolean(effectiveFromValue && effectiveFromValue <= todayIso);
  const activePresetToday = selectWorkTimePresetForDate(presets, new Date());
  const maxSortOrder = presets.reduce((max, preset) => Math.max(max, preset.sortOrder), 0);
  const nextSortOrder = Math.floor(maxSortOrder / 10) * 10 + 10;

  return (
    <AppShell
      title="Arbeitszeit"
      description="Arbeitszeit-Vorlagen für Zeitstrahlen in LKW-Einteilung und Kurzstrecke verwalten."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <label
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                isCalendarActive ? "border-gray-200 text-gray-400" : "border-green-500 text-green-700"
              }`}
            >
              <input
                checked={!isCalendarActive}
                className="h-4 w-4 accent-green-600 disabled:opacity-100"
                disabled
                readOnly
                type="checkbox"
              />
              Vorlagen {!isCalendarActive ? "aktiv" : "inaktiv"}
              {!isCalendarActive ? (
                <span className="font-normal">
                  · {activePresetToday?.name ?? "Standard"} ({activePresetToday?.startTime ?? "06:30"}–
                  {activePresetToday?.endTime ?? "17:00"})
                </span>
              ) : null}
            </label>

            <label
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                isCalendarActive ? "border-green-500 text-green-700" : "border-gray-200 text-gray-400"
              }`}
            >
              <input
                checked={isCalendarActive}
                className="h-4 w-4 accent-green-600 disabled:opacity-100"
                disabled
                readOnly
                type="checkbox"
              />
              Kalender {isCalendarActive ? "aktiv" : "inaktiv"}
            </label>
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
          <WorkTimeModalButton label="Arbeitszeit nach Vorlagen" title="Arbeitszeit nach Vorlagen">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-600">
                Feste Sommer-/Winterzeit-Vorlage je Wochentag, für alle Mitarbeiter gleich.
              </p>
              <ScrollPreservingForm action="/admin/working-time" className="flex items-end gap-2">
                <label className="text-xs font-semibold text-gray-700">
                  Monatsvorschau
                  <input
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
                    defaultValue={`${previewMonthValue}-01`}
                    name="previewMonth"
                    type="date"
                  />
                </label>
                <button
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  type="submit"
                >
                  Anzeigen
                </button>
              </ScrollPreservingForm>
            </div>
            <div className="divide-y divide-gray-100">
              {presets.map((preset) => {
            const formId = `work-time-${preset.id}`;
            const schedule = parseWeeklySchedule(
              preset.weeklyScheduleJson,
              preset.startTime,
              preset.endTime,
            );
            const weeklyHours = calculateWeeklyHours(schedule);
            const calculatedMonthlyHours = calculateMonthHours(
              { endTime: preset.endTime, name: preset.name, startTime: preset.startTime, weeklySchedule: schedule },
              previewYear,
              previewMonth,
              holidaySet,
            );

            const isActiveToday = activePresetToday?.id === preset.id;

            return (
              <div key={preset.id} className="p-5">
                {isActiveToday ? (
                  <span className="mb-3 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                    Heute aktiv
                  </span>
                ) : null}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_130px_130px_100px_100px] lg:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <WorkTimePresetForm action={updateWorkTimePresetAction} formId={formId}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        title="Arbeitszeit speichern"
                        aria-label="Arbeitszeit speichern"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                      >
                        <ActionIcon name="save" className="h-4 w-4" />
                      </button>
                    </WorkTimePresetForm>

                    <form action={setDefaultWorkTimePreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        title="Wird verwendet, wenn kein Saison-Zeitraum passt"
                        className={
                          preset.isDefault
                            ? "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                            : "rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                        }
                      >
                        {preset.isDefault ? "Fallback" : "Als Fallback"}
                      </button>
                    </form>

                    <form action={deleteWorkTimePreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        title="Arbeitszeit löschen"
                        aria-label="Arbeitszeit löschen"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      >
                        <ActionIcon name="delete" className="h-4 w-4" />
                      </button>
                    </form>
                  </div>

                  <label className="text-sm font-medium text-gray-800">
                    Name
                    <input
                      form={formId}
                      name="name"
                      defaultValue={preset.name}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Beginn
                    <input
                      form={formId}
                      name="startTime"
                      type="time"
                      defaultValue={preset.startTime}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Ende
                    <input
                      form={formId}
                      name="endTime"
                      type="time"
                      defaultValue={preset.endTime}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Position
                    <input
                      form={formId}
                      name="sortOrder"
                      type="number"
                      defaultValue={preset.sortOrder}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                    <input
                      form={formId}
                      name="isActive"
                      type="checkbox"
                      defaultChecked={preset.isActive}
                      className="h-4 w-4"
                    />
                    aktiv
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <label className="text-sm font-medium text-gray-800">
                    Saison gültig von
                    <input
                      className="mt-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      defaultValue={preset.validFrom ? `2001-${preset.validFrom}` : ""}
                      form={formId}
                      name="validFrom"
                      type="date"
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-800">
                    Saison gültig bis
                    <input
                      className="mt-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      defaultValue={preset.validTo ? `2001-${preset.validTo}` : ""}
                      form={formId}
                      name="validTo"
                      type="date"
                    />
                  </label>
                  <p className="text-xs text-gray-500">
                    Wiederkehrender Zeitraum (Jahr im Feld wird ignoriert), z. B. 01.10.–31.03. für Winterzeit.
                    Ohne Zeitraum gilt die Vorlage nur als Fallback. Bei Überschneidung entscheidet die Position.
                  </p>
                </div>
                <WorkTimeScheduleFields
                  calculatedMonthlyHours={calculatedMonthlyHours}
                  defaultManualMonthlyHours={preset.manualMonthlyHours}
                  formId={formId}
                  previewMonthLabel={previewMonthValue}
                  schedule={schedule}
                  weeklyHours={weeklyHours}
                />
              </div>
            );
          })}
            </div>
          </WorkTimeModalButton>

          <WorkTimeModalButton
            buttonClassName="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            label="Arbeitszeit hinzufügen"
            title="Neue Arbeitszeit-Vorlage hinzufügen"
          >
        <WorkTimePresetForm action={createWorkTimePresetAction} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px_140px_120px_auto]">
            <label className="text-sm font-medium text-gray-800">
              Name
              <input
                name="name"
                placeholder="z. B. Sommer kurz"
                required
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Standard Beginn
              <input
                name="startTime"
                type="time"
                defaultValue="06:30"
                required
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Standard Ende
              <input
                name="endTime"
                type="time"
                defaultValue="17:00"
                required
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Position
              <input
                name="sortOrder"
                type="number"
                defaultValue={nextSortOrder}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Hinzufügen
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="text-sm font-medium text-gray-800">
              Saison gültig von
              <input
                className="mt-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                name="validFrom"
                type="date"
              />
            </label>
            <label className="text-sm font-medium text-gray-800">
              Saison gültig bis
              <input
                className="mt-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                name="validTo"
                type="date"
              />
            </label>
            <p className="text-xs text-gray-500">
              Optional, wiederkehrend (Jahr im Feld wird ignoriert), z. B. 01.04.–30.09. für Sommerzeit. Leer
              lassen, wenn diese Vorlage nur als Fallback dienen soll.
            </p>
          </div>

          <WorkTimeScheduleFields
            schedule={createWeeklySchedule("06:30", "17:00")}
          />
        </WorkTimePresetForm>
          </WorkTimeModalButton>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-600">
          Umschalten: Standardmäßig gilt „Vorlagen&rdquo;. Trage unten bei „Arbeitszeit nach Kalender&rdquo; einen
          Umstellungs-Stichtag ein und speichere ihn – ab diesem Datum springt die Anzeige automatisch auf
          „Kalender&rdquo; um. Um zurück auf „Vorlagen&rdquo; zu wechseln, das Stichtag-Feld leeren und erneut
          speichern.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Arbeitszeit nach Kalender</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isCalendarActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                }`}
              >
                {isCalendarActive ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Jahreskalender mit frei bemalbaren Planzeiten je Tag, pro Mitarbeiter zugewiesen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/admin/working-time/planzeiten"
            >
              Planzeiten verwalten
            </Link>
            <Link
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              href="/admin/working-time/kalender"
            >
              Jahreskalender
            </Link>
          </div>
        </div>

        <form
          action={updateWorkTimeCalendarEffectiveFrom}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-gray-200 pt-4"
        >
          <label className="text-xs font-semibold text-gray-700">
            Umstellungs-Stichtag (Datum setzen + Speichern → ab diesem Tag „Kalender&rdquo; aktiv)
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={effectiveFromValue ?? ""}
              name="workTimeCalendarEffectiveFrom"
              type="date"
            />
          </label>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Speichern
          </button>
          <p className="w-full text-xs text-gray-600">
            {effectiveFromValue
              ? `Ab ${new Date(`${effectiveFromValue}T00:00:00.000Z`).toLocaleDateString("de-DE")} gilt für Mitarbeiter mit zugewiesenem Kalender dessen Soll. Ohne Zuweisung oder vor dem Stichtag bleibt es bei Sommer-/Winterzeit. Zum Zurückschalten auf „Vorlagen&rdquo; dieses Feld leeren und erneut speichern.`
              : "Noch kein Stichtag gesetzt – es gilt für alle weiterhin Sommer-/Winterzeit, unabhängig von Kalender-Zuweisungen."}
          </p>
        </form>
      </div>
    </AppShell>
  );
}

function WorkTimeScheduleFields({
  calculatedMonthlyHours,
  defaultManualMonthlyHours,
  formId,
  previewMonthLabel,
  schedule,
  weeklyHours,
}: {
  calculatedMonthlyHours?: number;
  defaultManualMonthlyHours?: number | null;
  formId?: string;
  previewMonthLabel?: string;
  schedule: Record<string, WorkTimeDaySettings>;
  weeklyHours?: number;
}) {
  const hasManualOverride = defaultManualMonthlyHours != null;

  return (
    <details className="group mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-950">
              Wochen-Arbeitszeiten bearbeiten
              {weeklyHours !== undefined ? (
                <span className="ml-2 font-normal text-gray-600">
                  ({weeklyHours.toLocaleString("de-DE")} Std./Woche
                  {calculatedMonthlyHours !== undefined
                    ? ` · ${calculatedMonthlyHours.toLocaleString("de-DE")} Std. in ${previewMonthLabel}`
                    : ""}
                  )
                </span>
              ) : null}
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              Mo–So mit Beginn, Ende, Frühstücks- und Mittagspause.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-800 transition-transform group-open:rotate-180"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </summary>

      {weeklyHours !== undefined ? (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs font-semibold text-gray-700">
            Monatsstunden: {calculatedMonthlyHours?.toLocaleString("de-DE")} Std. errechnet (Basis:{" "}
            {previewMonthLabel}, ohne Feiertage)
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-gray-800">
            <input
              className="h-4 w-4"
              defaultChecked={hasManualOverride}
              form={formId}
              name="useManualMonthlyHours"
              type="checkbox"
            />
            Stattdessen feste Monatsstunden verwenden (unabhängig vom Monat)
          </label>
          <input
            className="mt-2 w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            defaultValue={defaultManualMonthlyHours ?? ""}
            form={formId}
            name="manualMonthlyHours"
            placeholder="z.B. 173,33"
            type="text"
          />
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-white text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Tag</th>
              <th className="px-3 py-2 font-semibold">Kein Arbeitstag</th>
              <th className="px-3 py-2 font-semibold">Beginn</th>
              <th className="px-3 py-2 font-semibold">Ende</th>
              <th className="px-3 py-2 font-semibold">Frühstück von</th>
              <th className="px-3 py-2 font-semibold">Frühstück bis</th>
              <th className="px-3 py-2 font-semibold">Mittag von</th>
              <th className="px-3 py-2 font-semibold">Mittag bis</th>
              <th className="px-3 py-2 font-semibold">Tagesstunden</th>
            </tr>
          </thead>
          <tbody>
            {workTimeDayKeys.map((dayKey) => (
              <WorkTimeDayRow
                day={schedule[dayKey]}
                dayHours={getNetWorkHoursForDay(schedule[dayKey])}
                dayKey={dayKey}
                formId={formId}
                key={dayKey}
              />
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

