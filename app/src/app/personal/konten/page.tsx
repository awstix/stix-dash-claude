import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScrollPreservingForm } from "@/components/ScrollPreservingForm";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { calculateFlexTimeBalances, calculateVacationBalances } from "@/lib/time-accounts";

type PersonalKontenSearchParams = {
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

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

function monthHref(year: number, month: number) {
  return `/personal/konten?month=${year}-${String(month).padStart(2, "0")}`;
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

function monthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}.${year}`;
}

function formatHours(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.`;
}

export default async function PersonalKontenPage({
  searchParams,
}: {
  searchParams: Promise<PersonalKontenSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;
  const { month, year } = parseMonthParam(params.month);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0));

  const employees = await prisma.employee.findMany({
    include: {
      positions: { orderBy: [{ sortOrder: "asc" }] },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    where: { statusValue: "active" },
  });
  const employeeIds = employees.map((employee) => employee.id);

  const [flexBalances, vacationBalances] = await Promise.all([
    calculateFlexTimeBalances({ employeeIds, fromDate, toDate }),
    calculateVacationBalances({ employeeIds, year }),
  ]);

  const previousMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);

  return (
    <AppShell
      title="Zeitkonten"
      description="Arbeitszeit- und Urlaubskonto-Salden je Mitarbeiter. Basiert auf der zentralen Standard-Arbeitszeit, individuelle Teilzeitverträge werden noch nicht berücksichtigt."
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
          href={monthHref(previousMonth.year, previousMonth.month)}
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
          href={monthHref(nextMonth.year, nextMonth.month)}
          scroll={false}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-800 hover:bg-gray-50"
        >
          ›
        </Link>

        <ScrollPreservingForm action="/personal/konten" className="ml-auto flex items-end gap-3">
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

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Personaltyp</th>
              <th className="p-3">Ist {monthLabel(year, month)}</th>
              <th className="p-3">Soll {monthLabel(year, month)}</th>
              <th className="p-3">Zeitkonto-Saldo</th>
              <th className="p-3">Urlaubsanspruch {year}</th>
              <th className="p-3">Urlaub genommen</th>
              <th className="p-3">Urlaub Rest</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const flex = flexBalances.get(employee.id);
              const vacation = vacationBalances.get(employee.id);
              const positionLabel = employee.positions[0]?.positionLabel ?? "-";
              return (
                <tr className="border-b border-gray-200" key={employee.id}>
                  <td className="p-3 font-semibold text-gray-900">
                    {employee.lastName}, {employee.firstName}
                  </td>
                  <td className="p-3 text-gray-700">{positionLabel}</td>
                  <td className="p-3 text-gray-700">
                    {(flex?.istHours ?? 0).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.
                  </td>
                  <td className="p-3 text-gray-700">
                    {(flex?.sollHours ?? 0).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.
                  </td>
                  <td
                    className={`p-3 font-semibold ${
                      (flex?.balanceHours ?? 0) < 0 ? "text-red-700" : "text-green-800"
                    }`}
                  >
                    {formatHours(flex?.balanceHours ?? 0)}
                  </td>
                  <td className="p-3 text-gray-700">{vacation?.entitlementDays ?? "-"} Tage</td>
                  <td className="p-3 text-gray-700">{vacation?.takenDays ?? 0} Tage</td>
                  <td
                    className={`p-3 font-semibold ${
                      (vacation?.remainingDays ?? 0) < 0 ? "text-red-700" : "text-gray-900"
                    }`}
                  >
                    {vacation?.remainingDays ?? "-"} Tage
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!employees.length ? (
          <div className="p-8 text-center text-sm font-semibold text-gray-500">
            Keine aktiven Mitarbeiter gefunden.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
