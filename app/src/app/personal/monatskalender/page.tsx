import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScrollPreservingForm } from "@/components/ScrollPreservingForm";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import {
  calculateFlexTimeBalances,
  calculateVacationBalances,
  getEmployeeMonthDetail,
} from "@/lib/time-accounts";

type PersonalMonatskalenderSearchParams = {
  employeeId?: string;
  month?: string;
};

function parseMonthParam(value: string | undefined) {
  if (value && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return { month, year };
  }
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function monthHref(employeeId: string | undefined, year: number, month: number) {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);
  params.set("month", `${year}-${String(month).padStart(2, "0")}`);
  return `/personal/monatskalender?${params.toString()}`;
}

const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function weekdayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return weekdayShort[date.getUTCDay()];
}

function dayNumber(iso: string) {
  return Number(iso.slice(8, 10));
}

function formatHours(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default async function PersonalMonatskalenderPage({
  searchParams,
}: {
  searchParams: Promise<PersonalMonatskalenderSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;
  const { month, year } = parseMonthParam(params.month);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { firstName: true, id: true, lastName: true },
    where: { statusValue: "active" },
  });

  const employeeId = params.employeeId && employees.some((employee) => employee.id === params.employeeId)
    ? params.employeeId
    : employees[0]?.id;

  const monthDetail = employeeId
    ? await getEmployeeMonthDetail({ employeeId, month, year })
    : null;
  const [flexBalances, vacationBalances] = employeeId
    ? await Promise.all([
        calculateFlexTimeBalances({
          employeeIds: [employeeId],
          fromDate: new Date(Date.UTC(year, month - 1, 1)),
          toDate: new Date(Date.UTC(year, month, 0)),
        }),
        calculateVacationBalances({ employeeIds: [employeeId], year }),
      ])
    : [new Map(), new Map()];

  const flex = employeeId ? flexBalances.get(employeeId) : undefined;
  const vacation = employeeId ? vacationBalances.get(employeeId) : undefined;

  const previousMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);

  const totals = monthDetail?.days.reduce(
    (sum, day) => ({
      breakHours: sum.breakHours + day.breakHours,
      istHours: sum.istHours + day.istHours,
      sollHours: sum.sollHours + day.sollHours,
    }),
    { breakHours: 0, istHours: 0, sollHours: 0 },
  );

  const balanceHours = flex?.balanceHours ?? 0;
  const goodHours = Math.max(0, balanceHours);
  const minusHours = Math.min(0, balanceHours);
  const vacationTakenThisMonth =
    monthDetail?.days.reduce((sum, day) => {
      if (!day.absenceLabel?.startsWith("Urlaub")) return sum;
      return sum + (day.absenceLabel.includes("halb") ? 0.5 : 1);
    }, 0) ?? 0;

  return (
    <AppShell
      title="Monatskalender"
      description="Soll-/Ist-Zeit, Pausen und Abwesenheiten je Mitarbeiter und Tag."
    >
      <div className="mb-4">
        <Link
          href="/personal"
          className="inline-block rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Personal-Übersicht
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Link
          aria-label="Vorheriger Monat"
          href={monthHref(employeeId, previousMonth.year, previousMonth.month)}
          scroll={false}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-800 hover:bg-gray-50"
        >
          ‹
        </Link>
        <div className="min-w-48 text-center text-2xl font-bold text-gray-900">
          {monthNames[month - 1]} {year}
        </div>
        <Link
          aria-label="Nächster Monat"
          href={monthHref(employeeId, nextMonth.year, nextMonth.month)}
          scroll={false}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-800 hover:bg-gray-50"
        >
          ›
        </Link>

        <ScrollPreservingForm action="/personal/monatskalender" className="ml-auto flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-gray-700">
            Mitarbeiter
            <select
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={employeeId}
              name="employeeId"
            >
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.lastName}, {employee.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Monat &amp; Jahr wählen
            <input
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={`${monthValue}-01`}
              name="month"
              type="date"
            />
          </label>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Anzeigen
          </button>
        </ScrollPreservingForm>
      </div>

      {!employees.length ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-500">
          Keine aktiven Mitarbeiter gefunden.
        </div>
      ) : null}

      {monthDetail ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="text-left text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="sticky left-0 z-10 bg-gray-900 p-3">&nbsp;</th>
                  {monthDetail.days.map((day) => (
                    <th
                      className={`min-w-14 p-2 text-center ${day.isWeekend || day.isHoliday ? "bg-gray-700" : ""}`}
                      key={day.date}
                    >
                      <div>{weekdayLabel(day.date)}</div>
                      <div>{dayNumber(day.date)}</div>
                    </th>
                  ))}
                  <th className="min-w-16 p-2 text-center">Σ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white p-3 font-semibold text-gray-900">Soll-Zeit</td>
                  {monthDetail.days.map((day) => (
                    <td
                      className={`p-2 text-center text-gray-700 ${day.isWeekend || day.isHoliday ? "bg-gray-50" : ""}`}
                      key={day.date}
                    >
                      {day.sollHours ? formatHours(day.sollHours) : ""}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold text-gray-900">
                    {formatHours(totals?.sollHours ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white p-3 font-semibold text-gray-900">Ist-Zeit</td>
                  {monthDetail.days.map((day) => (
                    <td
                      className={`p-2 text-center text-gray-700 ${day.isWeekend || day.isHoliday ? "bg-gray-50" : ""}`}
                      key={day.date}
                    >
                      {day.istHours ? formatHours(day.istHours) : ""}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold text-gray-900">
                    {formatHours(totals?.istHours ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white p-3 font-semibold text-gray-900">Pause</td>
                  {monthDetail.days.map((day) => (
                    <td
                      className={`p-2 text-center text-gray-700 ${day.isWeekend || day.isHoliday ? "bg-gray-50" : ""}`}
                      key={day.date}
                    >
                      {day.breakHours ? formatHours(day.breakHours) : ""}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold text-gray-900">
                    {formatHours(totals?.breakHours ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white p-3 font-semibold text-gray-900">Kategorie</td>
                  {monthDetail.days.map((day) => (
                    <td
                      className={`whitespace-nowrap p-2 text-center ${day.isWeekend || day.isHoliday ? "bg-gray-50" : ""}`}
                      key={day.date}
                    >
                      {day.category ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${day.category.badgeClass}`}>
                          {day.category.label}
                        </span>
                      ) : day.isHoliday ? (
                        <span className="text-xs text-gray-500">Feiertag</span>
                      ) : null}
                    </td>
                  ))}
                  <td className="p-2" />
                </tr>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 p-3 font-semibold text-gray-900">
                    Auswertung Monat
                  </td>
                  <td className="p-2 text-xs text-gray-500" colSpan={monthDetail.days.length}>
                    Stundensumme (Ist) · Gutstunden/Minusstunden (Saldo) · genommener Urlaub
                  </td>
                  <td className="p-2" />
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 p-3 font-semibold text-gray-900">Stundensumme</td>
                  <td className="bg-gray-50 p-2" colSpan={monthDetail.days.length} />
                  <td className="p-2 text-center font-semibold text-gray-900">
                    {formatHours(totals?.istHours ?? 0)}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 p-3 font-semibold text-gray-900">Gutstunden</td>
                  <td className="bg-gray-50 p-2" colSpan={monthDetail.days.length} />
                  <td className="p-2 text-center font-semibold text-green-800">{formatHours(goodHours)}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 p-3 font-semibold text-gray-900">Minusstunden</td>
                  <td className="bg-gray-50 p-2" colSpan={monthDetail.days.length} />
                  <td className="p-2 text-center font-semibold text-red-700">{formatHours(minusHours)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 p-3 font-semibold text-gray-900">Urlaub genommen</td>
                  <td className="bg-gray-50 p-2" colSpan={monthDetail.days.length} />
                  <td className="p-2 text-center font-semibold text-gray-900">
                    {vacationTakenThisMonth.toLocaleString("de-DE")} Tage
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Urlaubskonto {year}
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Anspruch: {vacation?.entitlementDays ?? "-"} Tage
              </div>
              <div className="text-sm text-gray-700">Genommen: {vacation?.takenDays ?? 0} Tage</div>
              <div className="text-sm font-semibold text-gray-900">
                Rest: {vacation?.remainingDays ?? "-"} Tage
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Zeitkonto {monthValue}
              </div>
              <div className="mt-2 text-sm text-gray-700">Soll: {formatHours(flex?.sollHours ?? 0)} Std.</div>
              <div className="text-sm text-gray-700">Ist: {formatHours(flex?.istHours ?? 0)} Std.</div>
              <div
                className={`text-sm font-semibold ${(flex?.balanceHours ?? 0) < 0 ? "text-red-700" : "text-green-800"}`}
              >
                Saldo: {formatHours(flex?.balanceHours ?? 0)} Std.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
