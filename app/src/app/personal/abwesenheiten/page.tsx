import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { employeeDispositionTypes } from "@/app/employee-dispatch/disposition-types";
import { createEmployeeDispositionEntry } from "@/app/employee-dispatch/actions";
import { DispositionHoursFields } from "@/app/employee-dispatch/DispositionHoursFields";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

type PersonalAbwesenheitenSearchParams = {
  category?: string;
  from?: string;
  q?: string;
  to?: string;
};

// Kategorien, die eine Abwesenheit darstellen (nicht Arbeit an Baustelle/Werkstatt/Mischanlage/Schulung).
const absenceCategoryValues = new Set([
  "innung",
  "krank",
  "krank_ab_6_wochen",
  "krankstunden_schlechtwetter",
  "schlechtwetter",
  "schule",
  "sonderurlaub_stunden",
  "unbezahlter_urlaub",
  "urlaub",
]);

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return fallback;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function dayCount(start: Date, end: Date) {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = d.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

type AbsenceRow = {
  badgeClass: string;
  employeeName: string;
  endDate: Date;
  hours: number | null;
  id: string;
  label: string;
  startDate: Date;
  status: string;
  statusClass: string;
};

export default async function PersonalAbwesenheitenPage({
  searchParams,
}: {
  searchParams: Promise<PersonalAbwesenheitenSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const defaultTo = new Date(today);
  defaultTo.setUTCDate(defaultTo.getUTCDate() + 60);

  const fromDate = parseDateParam(params.from, defaultFrom);
  const toDate = parseDateParam(params.to, defaultTo);
  const q = (params.q ?? "").trim();
  const category = (params.category ?? "").trim();

  const [leaveRequests, dispositionEntries, employees] = await Promise.all([
    prisma.leaveRequest.findMany({
      include: { employee: true },
      orderBy: [{ startDate: "desc" }],
      where: {
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
        status: { in: ["APPROVED", "PENDING"] },
        ...(q
          ? {
              OR: [
                { employee: { firstName: { contains: q } } },
                { employee: { lastName: { contains: q } } },
              ],
            }
          : {}),
      },
    }),
    prisma.employeeDispositionEntry.findMany({
      include: { employee: true },
      orderBy: [{ startDate: "desc" }],
      where: {
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
        typeValue: { in: Array.from(absenceCategoryValues) },
        ...(q
          ? {
              OR: [
                { employee: { firstName: { contains: q } } },
                { employee: { lastName: { contains: q } } },
              ],
            }
          : {}),
      },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { firstName: true, id: true, lastName: true },
      where: { statusValue: "active" },
    }),
  ]);

  const absenceDispositionTypes = employeeDispositionTypes.filter((type) =>
    absenceCategoryValues.has(type.value),
  );

  const rows: AbsenceRow[] = [];

  for (const leave of leaveRequests) {
    const timeAccount = leave.absenceType === "TIME_ACCOUNT";
    const approved = leave.status === "APPROVED";
    rows.push({
      badgeClass: "bg-sky-100 text-sky-900",
      employeeName: `${leave.employee.lastName}, ${leave.employee.firstName}`,
      endDate: leave.endDate,
      hours: null,
      id: `leave-${leave.id}`,
      label: timeAccount ? "Zeitausgleich" : "Urlaub",
      startDate: leave.startDate,
      status: approved ? "Genehmigt" : "Beantragt",
      statusClass: approved ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900",
    });
  }

  for (const entry of dispositionEntries) {
    const type = employeeDispositionTypes.find((candidate) => candidate.value === entry.typeValue);
    rows.push({
      badgeClass: type?.badgeClass ?? "bg-gray-100 text-gray-800",
      employeeName: `${entry.employee.lastName}, ${entry.employee.firstName}`,
      endDate: entry.endDate,
      hours: entry.hours,
      id: `dispo-${entry.id}`,
      label: type?.label ?? entry.typeLabel,
      startDate: entry.startDate,
      status: "Erfasst",
      statusClass: "bg-gray-100 text-gray-700",
    });
  }

  const filteredRows = (category ? rows.filter((row) => row.label === category) : rows).sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  const categoryOptions = Array.from(new Set(rows.map((row) => row.label))).sort((a, b) =>
    a.localeCompare(b, "de-DE"),
  );

  return (
    <AppShell
      title="Abwesenheiten"
      description="Urlaub, Krankheit, Schule, Innung und sonstige Abwesenheiten aller Mitarbeiter im Überblick."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/personal"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Personal-Übersicht
        </Link>
        <Link
          href="/leave-requests"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Urlaub beantragen/freigeben
        </Link>
      </div>

      <details className="group mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          <span className="mr-1 text-gray-400 group-open:hidden">▸</span>
          <span className="mr-1 hidden text-gray-400 group-open:inline">▾</span>
          + Abwesenheit für Mitarbeiter eintragen
        </summary>

        <form
          action={createEmployeeDispositionEntry}
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6"
        >
          <label className="text-sm font-medium text-gray-800 xl:col-span-2">
            Mitarbeiter
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              defaultValue=""
              name="employeeId"
              required
            >
              <option disabled value="">
                Mitarbeiter wählen
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.lastName}, {employee.firstName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-800">
            Art
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              defaultValue="krank"
              name="typeValue"
              required
            >
              {absenceDispositionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-800">
            Von
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              defaultValue={formatDateInput(today)}
              name="startDate"
              required
              type="date"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Bis
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              defaultValue={formatDateInput(today)}
              name="endDate"
              required
              type="date"
            />
          </label>

          <DispositionHoursFields defaultEndTime="17:00" defaultStartTime="06:30" defaultWholeDay />

          <label className="text-sm font-medium text-gray-800">
            Bemerkung
            <input
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              name="notes"
              type="text"
            />
          </label>

          <div className="flex items-end xl:col-span-6">
            <button
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Speichern
            </button>
          </div>
        </form>
      </details>

      <form
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5"
        method="get"
      >
        <label className="text-xs font-semibold text-gray-700">
          Suche (Name)
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            defaultValue={q}
            name="q"
            placeholder="z.B. Mustermann"
            type="text"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Kategorie
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={category}
            name="category"
          >
            <option value="">Alle Kategorien</option>
            {categoryOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Von
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            defaultValue={formatDateInput(fromDate)}
            name="from"
            type="date"
          />
        </label>
        <label className="text-xs font-semibold text-gray-700">
          Bis
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            defaultValue={formatDateInput(toDate)}
            name="to"
            type="date"
          />
        </label>
        <button
          className="self-end rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Filtern
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Zeitraum</th>
              <th className="p-3">Umfang</th>
              <th className="p-3">Kategorie</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr className="border-b border-gray-200" key={row.id}>
                <td className="p-3 font-semibold text-gray-900">{row.employeeName}</td>
                <td className="p-3 text-gray-700">
                  {formatDate(row.startDate)}
                  {row.startDate.getTime() !== row.endDate.getTime() ? ` – ${formatDate(row.endDate)}` : ""}
                </td>
                <td className="p-3 text-gray-700">
                  {row.hours !== null
                    ? `${row.hours.toLocaleString("de-DE")} Std.`
                    : dayCount(row.startDate, row.endDate)}
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.badgeClass}`}>
                    {row.label}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.statusClass}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredRows.length ? (
          <div className="p-8 text-center text-sm font-semibold text-gray-500">
            Keine Abwesenheiten im gewählten Zeitraum gefunden.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
