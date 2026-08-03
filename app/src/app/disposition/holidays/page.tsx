import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { bavariaHolidays, dateKey } from "@/lib/disposition-days-off";
import {
  createManualDayOffAction,
  deleteManualDayOff,
  setAutomaticHolidayState,
  updateManualDayOffAction,
} from "./actions";
import { DayOffActionForm } from "./DayOffActionForm";

function parseYear(value: string | undefined) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2020 && year <= 2100
    ? year
    : new Date().getFullYear();
}

function germanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function germanDateWithWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");

  return `${weekday}, ${germanDate(date)}`;
}

function checkedDate(date: Date | null) {
  return date ? germanDate(date) : "noch nicht bestätigt";
}

const kindLabels: Record<string, string> = {
  BRIDGE_DAY: "Brückentag",
  COMPANY: "Betriebsfreier Tag",
  COMPANY_HOLIDAY: "Betriebsurlaub",
  OTHER: "Sonstiger Tag",
};

export default async function HolidaysPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const year = parseYear(params.year);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const stored = await prisma.dispositionDayOff.findMany({
    where: {
      date: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });
  const automaticStored = new Map(
    stored
      .filter((item) => item.isAutomatic)
      .map((item) => [`${dateKey(item.date)}::${item.name}`, item]),
  );
  const manual = stored.filter((item) => !item.isAutomatic);

  return (
    <AppShell
      title="Feiertage & arbeitsfreie Tage"
      description="Bayerische Feiertage prüfen und freigeben sowie betriebliche Brücken- und Ruhetage verwalten."
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/disposition/holidays?year=${year - 1}`}
        >
          ← {year - 1}
        </Link>
        <form className="flex items-center gap-2">
          <input
            className="w-28 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={year}
            max="2100"
            min="2020"
            name="year"
            type="number"
          />
          <button className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white">
            Jahr öffnen
          </button>
        </form>
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/disposition/holidays?year=${year + 1}`}
        >
          {year + 1} →
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-950">
          Gesetzliche Feiertage Bayern {year}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Alle Tage bleiben als Nachweis sichtbar. Erst der Schalter
          „Arbeitsfrei“ berücksichtigt den Tag in den Dispositionen.
        </p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Arbeitsfrei</th>
                <th className="w-36 whitespace-nowrap p-3">Datum</th>
                <th className="p-3">Feiertag</th>
                <th className="p-3">Geltungsbereich</th>
                <th className="p-3">Quelle</th>
                <th className="p-3">Zuletzt geprüft</th>
              </tr>
            </thead>
            <tbody>
              {bavariaHolidays(year).map((holiday) => {
                const record = automaticStored.get(
                  `${dateKey(holiday.date)}::${holiday.name}`,
                );
                return (
                  <tr className="border-t border-gray-100" key={`${dateKey(holiday.date)}-${holiday.name}`}>
                    <td className="p-3">
                      <form action={setAutomaticHolidayState} className="flex items-center gap-2">
                        <input name="date" type="hidden" value={dateKey(holiday.date)} />
                        <input name="name" type="hidden" value={holiday.name} />
                        <input name="scopeLabel" type="hidden" value={holiday.scopeLabel} />
                        <input name="sourceLabel" type="hidden" value={holiday.sourceLabel} />
                        <input name="sourceUrl" type="hidden" value={holiday.sourceUrl} />
                        <input
                          className="h-5 w-5 accent-gray-950"
                          defaultChecked={record?.isDayOff ?? false}
                          name="isDayOff"
                          type="checkbox"
                        />
                        <button className="rounded-lg bg-gray-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800">
                          Speichern
                        </button>
                      </form>
                    </td>
                    <td className="w-36 whitespace-nowrap p-3 font-semibold text-gray-950">{germanDateWithWeekday(holiday.date)}</td>
                    <td className="p-3 font-semibold text-gray-950">{holiday.name}</td>
                    <td className="p-3 text-gray-700">{holiday.scopeLabel}</td>
                    <td className="p-3">
                      <a
                        className="font-semibold text-blue-800 hover:underline"
                        href={holiday.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {holiday.sourceLabel} ↗
                      </a>
                    </td>
                    <td className="p-3 text-gray-600">{checkedDate(record?.sourceCheckedAt ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm [&_input]:border-gray-400 [&_input]:bg-white [&_input]:text-gray-950 [&_input]:placeholder:text-gray-600 [&_label]:text-gray-950 [&_select]:border-gray-400 [&_select]:bg-white [&_select]:text-gray-950">
        <h2 className="text-xl font-bold text-gray-950">
          Brücken- und betriebsfreie Tage
        </h2>
        <DayOffActionForm
          action={createManualDayOffAction}
          className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-4"
          resetOnSuccess
        >
          <label className="text-sm font-semibold text-gray-800">
            Von
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="date" required type="date" />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Bis
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="endDate" type="date" />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Bezeichnung
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="name" placeholder="z. B. Brückentag" required />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Art
            <select className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="kind">
              {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Geltungsbereich
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" defaultValue="Gesamter Betrieb" name="scopeLabel" />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Quelle
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" defaultValue="Betriebliche Festlegung" name="sourceLabel" />
          </label>
          <label className="text-sm font-semibold text-gray-800">
            Quellenlink (optional)
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="sourceUrl" type="url" />
          </label>
          <label className="text-sm font-semibold text-gray-800 xl:col-span-2">
            Bemerkung
            <input className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" name="notes" />
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-gray-900">
            <input className="h-5 w-5 accent-gray-950" defaultChecked name="isDayOff" type="checkbox" />
            Als arbeitsfrei berücksichtigen
          </label>
          <div className="xl:col-span-3">
            <button className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white">Tag hinzufügen</button>
          </div>
        </DayOffActionForm>

        <div className="mt-5 space-y-3">
          {manual.length === 0 ? <p className="text-sm text-gray-500">Noch keine betrieblichen Tage für {year} angelegt.</p> : null}
          {manual.map((item) => (
            <details className="rounded-xl border border-gray-200 bg-white" key={item.id}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 text-gray-950">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.isDayOff ? "bg-gray-950 text-white" : "bg-amber-200 text-amber-950 ring-1 ring-amber-400"}`}>
                  {item.isDayOff ? "Arbeitsfrei" : "Nur gelistet"}
                </span>
                <strong className="text-gray-950">
                  {item.endDate && dateKey(item.endDate) !== dateKey(item.date)
                    ? `${germanDateWithWeekday(item.date)} – ${germanDateWithWeekday(item.endDate)}`
                    : germanDateWithWeekday(item.date)}{" "}
                  · {item.name}
                </strong>
                <span className="text-sm font-semibold text-gray-800">{kindLabels[item.kind] ?? item.kind} · {item.scopeLabel}</span>
              </summary>
              <div className="border-t border-gray-200 p-4">
                <DayOffActionForm action={updateManualDayOffAction} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <input name="id" type="hidden" value={item.id} />
                  <label className="text-sm font-semibold">Von<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={dateKey(item.date)} name="date" required type="date" /></label>
                  <label className="text-sm font-semibold">Bis<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={dateKey(item.endDate ?? item.date)} name="endDate" type="date" /></label>
                  <label className="text-sm font-semibold">Bezeichnung<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={item.name} name="name" required /></label>
                  <label className="text-sm font-semibold">Art<select className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2" defaultValue={item.kind} name="kind">{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="text-sm font-semibold">Geltungsbereich<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={item.scopeLabel ?? ""} name="scopeLabel" /></label>
                  <label className="text-sm font-semibold">Quelle<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={item.sourceLabel ?? ""} name="sourceLabel" /></label>
                  <label className="text-sm font-semibold">Quellenlink<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={item.sourceUrl ?? ""} name="sourceUrl" type="url" /></label>
                  <label className="text-sm font-semibold xl:col-span-2">Bemerkung<input className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" defaultValue={item.notes ?? ""} name="notes" /></label>
                  <label className="flex items-center gap-3 text-sm font-bold"><input className="h-5 w-5 accent-gray-950" defaultChecked={item.isDayOff} name="isDayOff" type="checkbox" />Als arbeitsfrei berücksichtigen</label>
                  <div className="flex gap-2 xl:col-span-3"><button className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white">Änderungen speichern</button></div>
                </DayOffActionForm>
                <form action={deleteManualDayOff} className="mt-3">
                  <input name="id" type="hidden" value={item.id} />
                  <button className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50">Löschen</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
