import { AppShell } from "@/components/AppShell";
import { employeeDispositionTypes } from "@/app/employee-dispatch/disposition-types";
import { prisma } from "@/lib/prisma";
import { getGlobalTimeTrackingSettings, parseWeekdaysJson } from "@/lib/time-tracking-reminder";
import { workTimeDayKeys, workTimeDayLabels } from "@/lib/work-time";
import { updateDispositionCategoryCredits, updateTimeTrackingSettings } from "./actions";
import { ReminderCheckButton } from "./ReminderCheckButton";

export default async function TimeTrackingSettingsPage() {
  const [settings, categoryCredits] = await Promise.all([
    getGlobalTimeTrackingSettings(),
    prisma.dispositionCategoryCredit.findMany(),
  ]);
  const activeWeekdays = new Set(parseWeekdaysJson(settings.reminderWeekdaysJson));
  const creditedHoursByTypeValue = new Map(
    categoryCredits.map((credit) => [credit.typeValue, credit.creditedHours]),
  );

  return (
    <AppShell
      title="Zeiterfassung"
      description="Standard-Einstellungen für Freigabe und Erinnerungsmails der Kolonnen-Zeiterfassung. Einzelne Baustellen können dies in der Projektanlage überschreiben."
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Automatische Freigabe</h2>
          <p className="mt-1 text-sm text-gray-600">
            Der Standard je Kolonne wird direkt bei der jeweiligen Kolonne unter{" "}
            <span className="font-semibold">Admin → Kolonnen</span> eingestellt. Einzelne
            Baustellen können das bei der Projektanlage überschreiben.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Info-Mail an die Bauleitung</h2>
          <p className="mt-1 text-sm text-gray-600">
            Solange für eine Baustelle keine automatische Freigabe aktiv ist, kann an bestimmten
            Wochentagen eine Erinnerungsmail über offene Stundenfreigaben verschickt werden. Sie geht
            automatisch an die E-Mail-Adresse des in der Baustelle hinterlegten Bauleiters (aus der
            Personalakte). Zusätzliche externe Empfänger je Baustelle (z.B. Auftraggeber-Vertreter)
            werden direkt bei der jeweiligen Baustelle eingetragen, nicht hier zentral. Hier wird nur
            der Standard-Zeitplan (Wochentage, Wiederholung) für alle Baustellen festgelegt.
          </p>

          <form action={updateTimeTrackingSettings} className="mt-5 space-y-5">
            <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800">
              <input
                className="h-4 w-4"
                defaultChecked={settings.reminderEnabled}
                name="reminderEnabled"
                type="checkbox"
              />
              Erinnerungsmails als Standard aktivieren (Baustellen können dies einzeln überschreiben)
            </label>

            <div>
              <div className="text-sm font-semibold text-gray-800">Wochentage</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {workTimeDayKeys.map((day) => (
                  <label
                    key={day}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                  >
                    <input
                      className="h-4 w-4"
                      defaultChecked={activeWeekdays.has(day)}
                      name={`weekday_${day}`}
                      type="checkbox"
                    />
                    {workTimeDayLabels[day]}
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-800">
              Wiederholung
              <select
                className="mt-2 w-full max-w-xs rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                defaultValue={String(settings.reminderIntervalWeeks)}
                name="intervalWeeks"
              >
                <option value="1">Jede Woche</option>
                <option value="2">Alle 2 Wochen</option>
                <option value="3">Alle 3 Wochen</option>
                <option value="4">Alle 4 Wochen</option>
              </select>
            </label>

            <button
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Speichern
            </button>
          </form>

          {settings.lastReminderRunAt ? (
            <p className="mt-4 text-xs font-medium text-gray-500">
              Zuletzt geprüft:{" "}
              {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
                settings.lastReminderRunAt,
              )}
            </p>
          ) : null}

          <div className="mt-6 border-t border-gray-200 pt-5">
            <ReminderCheckButton />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Anrechnung Dispo-Kategorien</h2>
          <p className="mt-1 text-sm text-gray-600">
            Legt fest, wie viele Stunden pro Tag Krank/Schule/Innung/Schulung/Werkstatt/Mischanlage/
            Baustelle-Einträge aus der Mitarbeiterdisposition für die Zeitkonten-Berechnung (Monats-/
            Jahreskalender, Zeitkonten) zählen, sofern an dem Tag keine echten Ist-Stunden erfasst
            wurden. Leer lassen = zählt als volle Tages-Soll-Zeit (verändert den Saldo nicht).
          </p>

          <form action={updateDispositionCategoryCredits} className="mt-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employeeDispositionTypes.map((type) => (
                <label
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800"
                  key={type.value}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded ${type.barClass}`} />
                    {type.label}
                  </span>
                  <input
                    className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
                    defaultValue={creditedHoursByTypeValue.get(type.value) ?? ""}
                    inputMode="decimal"
                    name={`credit_${type.value}`}
                    placeholder="Std./Tag"
                    type="text"
                  />
                </label>
              ))}
            </div>

            <button
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Speichern
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
