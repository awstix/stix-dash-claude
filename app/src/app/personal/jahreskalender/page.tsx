import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScrollPreservingForm } from "@/components/ScrollPreservingForm";
import { employeeDispositionTypes } from "@/app/employee-dispatch/disposition-types";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getEmployeeYearDetail, type EmployeeDayDetail } from "@/lib/time-accounts";

type PersonalJahreskalenderSearchParams = {
  employeeId?: string;
  year?: string;
};

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

function parseYearParam(value: string | undefined) {
  const parsed = Number((value ?? "").slice(0, 4));
  if (Number.isInteger(parsed) && parsed > 1900 && parsed < 2200) return parsed;
  return new Date().getUTCFullYear();
}

function yearHref(employeeId: string | undefined, year: number) {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);
  params.set("year", String(year));
  return `/personal/jahreskalender?${params.toString()}`;
}

function dayCellClass(day: EmployeeDayDetail) {
  if (day.category) return day.category.barClass;
  if (day.isHoliday) return "bg-gray-400 text-white";
  if (day.isWeekend) return "bg-gray-200 text-gray-500";
  if (day.istHours > 0) return "bg-green-600 text-white";
  return "bg-white text-gray-700";
}

function dayCellTitle(day: EmployeeDayDetail) {
  if (day.category) return `${day.date}: ${day.category.label}`;
  if (day.isHoliday) return `${day.date}: Feiertag`;
  if (day.isWeekend) return `${day.date}: Wochenende`;
  if (day.istHours > 0) return `${day.date}: ${day.istHours} Std. gearbeitet`;
  return day.date;
}

function formatHours(value: number) {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function weekdayLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return weekdayShort[date.getUTCDay()];
}

const workCategoryValues = new Set([
  "betrieb",
  "mischanlage_niedernberg",
  "mischanlage_roellfeld",
  "schulung",
  "werkstatt",
]);

type MonthCategoryCounts = {
  arbeit: number;
  innung: number;
  krank: number;
  schule: number;
  urlaub: number;
};

function countMonthCategories(days: EmployeeDayDetail[]): MonthCategoryCounts {
  const counts: MonthCategoryCounts = { arbeit: 0, innung: 0, krank: 0, schule: 0, urlaub: 0 };
  for (const day of days) {
    if (day.isWeekend || day.isHoliday) continue;
    const value = day.category?.value;
    if (value && workCategoryValues.has(value)) counts.arbeit += 1;
    else if (!value && day.creditedHours > 0) counts.arbeit += 1;
    else if (value === "urlaub") counts.urlaub += 1;
    else if (value === "schule") counts.schule += 1;
    else if (value === "innung") counts.innung += 1;
    else if (value === "krank") counts.krank += 1;
  }
  return counts;
}

type CategorySummary = {
  barClass: string;
  dayCount: number;
  hours: number;
  label: string;
  value: string;
};

export default async function PersonalJahreskalenderPage({
  searchParams,
}: {
  searchParams: Promise<PersonalJahreskalenderSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;
  const year = parseYearParam(params.year);

  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { firstName: true, id: true, lastName: true },
    where: { statusValue: "active" },
  });
  const employeeId = params.employeeId && employees.some((employee) => employee.id === params.employeeId)
    ? params.employeeId
    : employees[0]?.id;

  const yearDetail = employeeId ? await getEmployeeYearDetail({ employeeId, year }) : null;
  const maxDays = 31;

  const monthlyHours = yearDetail?.months.map((monthOverview) =>
    monthOverview.days.reduce((sum, day) => sum + day.creditedHours, 0),
  );
  const yearHoursTotal = monthlyHours?.reduce((sum, hours) => sum + hours, 0) ?? 0;
  const monthCategoryCounts = yearDetail?.months.map((monthOverview) =>
    countMonthCategories(monthOverview.days),
  );
  const yearCategoryTotals = monthCategoryCounts?.reduce(
    (sum, counts) => ({
      arbeit: sum.arbeit + counts.arbeit,
      innung: sum.innung + counts.innung,
      krank: sum.krank + counts.krank,
      schule: sum.schule + counts.schule,
      urlaub: sum.urlaub + counts.urlaub,
    }),
    { arbeit: 0, innung: 0, krank: 0, schule: 0, urlaub: 0 },
  ) ?? { arbeit: 0, innung: 0, krank: 0, schule: 0, urlaub: 0 };

  const categorySummaries: CategorySummary[] = [];
  if (yearDetail) {
    const summaryByValue = new Map<string, CategorySummary>();
    for (const monthOverview of yearDetail.months) {
      for (const day of monthOverview.days) {
        if (day.isWeekend || day.isHoliday) continue;
        const key = day.category?.value ?? (day.creditedHours > 0 ? "gearbeitet_ohne_dispo" : null);
        if (!key) continue;
        const existing = summaryByValue.get(key);
        if (existing) {
          existing.dayCount += 1;
          existing.hours += day.creditedHours;
        } else {
          summaryByValue.set(key, {
            barClass: day.category?.barClass ?? "bg-green-600 text-white",
            dayCount: 1,
            hours: day.creditedHours,
            label: day.category?.label ?? "Gearbeitet (ohne Dispo-Eintrag)",
            value: key,
          });
        }
      }
    }
    categorySummaries.push(...summaryByValue.values());
    categorySummaries.sort((a, b) => b.dayCount - a.dayCount);
  }

  return (
    <AppShell
      title="Jahreskalender"
      description="Jahresübersicht über Anwesenheit, Abwesenheit und Feiertage je Mitarbeiter."
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
          aria-label="Vorheriges Jahr"
          href={yearHref(employeeId, year - 1)}
          scroll={false}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-800 hover:bg-gray-50"
        >
          ‹
        </Link>
        <div className="min-w-24 text-center text-2xl font-bold text-gray-900">{year}</div>
        <Link
          aria-label="Nächstes Jahr"
          href={yearHref(employeeId, year + 1)}
          scroll={false}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-lg font-bold text-gray-800 hover:bg-gray-50"
        >
          ›
        </Link>

        <ScrollPreservingForm action="/personal/jahreskalender" className="ml-auto flex flex-wrap items-end gap-3">
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
            Jahr wählen
            <input
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={`${year}-01-01`}
              name="year"
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

      <div className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-gray-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-green-600" /> Gearbeitet (ohne Dispo-Eintrag)
        </span>
        {employeeDispositionTypes.map((type) => (
          <span className="inline-flex items-center gap-1.5" key={type.value}>
            <span className={`h-3 w-3 rounded ${type.barClass}`} /> {type.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border-2 border-dashed border-sky-700 bg-sky-100" /> Urlaub beantragt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gray-400" /> Feiertag
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gray-200" /> Wochenende
        </span>
      </div>

      {!employees.length ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-500">
          Keine aktiven Mitarbeiter gefunden.
        </div>
      ) : null}

      {yearDetail ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col style={{ width: "64px" }} />
              {Array.from({ length: maxDays }, (_, index) => (
                <col key={index} />
              ))}
              <col style={{ width: "48px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "44px" }} />
              <col style={{ width: "44px" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="sticky left-0 z-10 bg-gray-900 p-1">Monat</th>
                {Array.from({ length: maxDays }, (_, index) => (
                  <th className="p-0.5 text-center font-medium" key={index}>
                    {index + 1}
                  </th>
                ))}
                <th className="p-1 text-right font-medium">Std.</th>
                <th className="p-1 text-right font-medium">Arb.</th>
                <th className="p-1 text-right font-medium">Url.</th>
                <th className="p-1 text-right font-medium">Sch.</th>
                <th className="p-1 text-right font-medium">Inn.</th>
                <th className="p-1 text-right font-medium">Kr.</th>
              </tr>
            </thead>
            <tbody>
              {yearDetail.months.map((monthOverview, monthIndex) => {
                const counts = monthCategoryCounts?.[monthIndex];
                return (
                  <tr className="border-b border-gray-100" key={monthOverview.month}>
                    <td className="sticky left-0 z-10 bg-white p-1 font-semibold text-gray-900">
                      {monthNames[monthOverview.month - 1].slice(0, 3)}
                    </td>
                    {Array.from({ length: maxDays }, (_, index) => {
                      const day = monthOverview.days[index];
                      if (!day) return <td className="p-0.5" key={index} />;
                      return (
                        <td className="p-0.5 text-center" key={index}>
                          <div className="text-[8px] leading-none font-medium text-gray-400">
                            {weekdayLabel(day.date)}
                          </div>
                          <div
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded text-[10px] ${dayCellClass(day)}`}
                            title={dayCellTitle(day)}
                          >
                            {index + 1}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-1 text-right font-semibold text-gray-900">
                      {formatHours(monthlyHours?.[monthIndex] ?? 0)}
                    </td>
                    <td className="p-1 text-right text-gray-700">{counts?.arbeit ?? 0}</td>
                    <td className="p-1 text-right text-gray-700">{counts?.urlaub ?? 0}</td>
                    <td className="p-1 text-right text-gray-700">{counts?.schule ?? 0}</td>
                    <td className="p-1 text-right text-gray-700">{counts?.innung ?? 0}</td>
                    <td className="p-1 text-right text-gray-700">{counts?.krank ?? 0}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50">
                <td className="sticky left-0 z-10 bg-gray-50 p-2 font-bold text-gray-900" colSpan={maxDays + 1}>
                  Summe {year}
                </td>
                <td className="p-2 text-right font-bold text-gray-900">{formatHours(yearHoursTotal)}</td>
                <td className="p-2 text-right font-bold text-gray-900">{yearCategoryTotals.arbeit}</td>
                <td className="p-2 text-right font-bold text-gray-900">{yearCategoryTotals.urlaub}</td>
                <td className="p-2 text-right font-bold text-gray-900">{yearCategoryTotals.schule}</td>
                <td className="p-2 text-right font-bold text-gray-900">{yearCategoryTotals.innung}</td>
                <td className="p-2 text-right font-bold text-gray-900">{yearCategoryTotals.krank}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {categorySummaries.length ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3">Kategorie</th>
                <th className="p-3 text-right">Tage</th>
                <th className="p-3 text-right">Std.</th>
              </tr>
            </thead>
            <tbody>
              {categorySummaries.map((summary) => (
                <tr className="border-b border-gray-200" key={summary.value}>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${summary.barClass}`}>
                      {summary.label}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-900">{summary.dayCount}</td>
                  <td className="p-3 text-right text-gray-700">{formatHours(summary.hours)} Std.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  );
}
