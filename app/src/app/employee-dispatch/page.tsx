import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createEmployeeDispositionEntry,
  deleteEmployeeDispositionEntry,
} from "./actions";
import {
  employeeDispositionTypes,
  getEmployeeDispositionType,
} from "./disposition-types";

const dayWidthPx = 48;

type TimelineBar = {
  id: string;
  employeeId: string;
  source: "manual" | "crew";
  typeValue: string;
  typeLabel: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  notes: string | null;
  barClass: string;
};

function dateOnly(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function todayUtc() {
  const now = new Date();
  return dateOnly(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateOnly(date), offset);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function differenceInDays(start: Date, end: Date) {
  return Math.round(
    (dateOnly(end).getTime() - dateOnly(start).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

function buildDays(fromDate: Date, toDate: Date) {
  const days = [];
  let current = dateOnly(fromDate);

  while (current <= toDate) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
}

function clampDate(date: Date, fromDate: Date, toDate: Date) {
  if (date < fromDate) return fromDate;
  if (date > toDate) return toDate;
  return date;
}

function getBarPosition(bar: TimelineBar, fromDate: Date, toDate: Date) {
  const startIndex = differenceInDays(
    fromDate,
    clampDate(bar.startDate, fromDate, toDate),
  );
  const endIndex = differenceInDays(
    fromDate,
    clampDate(bar.endDate, fromDate, toDate),
  );

  return {
    gridColumn: `${startIndex + 1} / ${endIndex + 2}`,
  };
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function getStatusClass(statusValue: string) {
  if (statusValue === "active") {
    return "bg-green-100 text-green-900";
  }

  if (statusValue.includes("aus") || statusValue === "left") {
    return "bg-gray-200 text-gray-700";
  }

  return "bg-yellow-100 text-yellow-900";
}

function getProjectText(row: {
  projectNumber: string;
  projectName: string;
  rowTitle: string | null;
}) {
  return [row.projectNumber, row.projectName, row.rowTitle]
    .filter(Boolean)
    .join(" · ");
}

export default async function EmployeeDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const defaultFrom = startOfWeek(todayUtc());
  const fromDate = parseDateParam(params.from, defaultFrom);
  const parsedToDate = parseDateParam(params.to, addDays(fromDate, 13));
  const toDate = parsedToDate < fromDate ? addDays(fromDate, 13) : parsedToDate;
  const days = buildDays(fromDate, toDate);
  const gridTemplateColumns = `repeat(${days.length}, minmax(${dayWidthPx}px, 1fr))`;

  const [
    employees,
    manualEntries,
    crewAssignments,
  ] = await Promise.all([
    prisma.employee.findMany({
      include: {
        positions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.employeeDispositionEntry.findMany({
      where: {
        startDate: {
          lte: toDate,
        },
        endDate: {
          gte: fromDate,
        },
      },
      include: {
        employee: true,
      },
      orderBy: [{ startDate: "asc" }, { employee: { lastName: "asc" } }],
    }),

    prisma.crewPlanningAssignment.findMany({
      where: {
        startDate: {
          lte: toDate,
        },
        endDate: {
          gte: fromDate,
        },
      },
      include: {
        row: true,
        crew: {
          include: {
            members: {
              where: {
                isActive: true,
              },
              include: {
                employee: true,
              },
            },
          },
        },
        extraEmployees: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { crewName: "asc" }],
    }),
  ]);

  const barsByEmployeeId = new Map<string, TimelineBar[]>();

  for (const entry of manualEntries) {
    const type = getEmployeeDispositionType(entry.typeValue);

    const bar: TimelineBar = {
      id: `manual-${entry.id}`,
      employeeId: entry.employeeId,
      source: "manual",
      typeValue: entry.typeValue,
      typeLabel: entry.typeLabel,
      startDate: entry.startDate,
      endDate: entry.endDate,
      startTime: entry.startTime,
      endTime: entry.endTime,
      title: entry.notes
        ? `${entry.typeLabel} · ${entry.notes}`
        : entry.typeLabel,
      subtitle: `${entry.startTime} – ${entry.endTime}`,
      notes: entry.notes,
      barClass: type.barClass,
    };

    barsByEmployeeId.set(entry.employeeId, [
      ...(barsByEmployeeId.get(entry.employeeId) ?? []),
      bar,
    ]);
  }

  const operationType = getEmployeeDispositionType("betrieb");

  for (const assignment of crewAssignments) {
    const employeeIds = new Set<string>();

    for (const member of assignment.crew?.members ?? []) {
      employeeIds.add(member.employeeId);
    }

    for (const extraEmployee of assignment.extraEmployees) {
      employeeIds.add(extraEmployee.employeeId);
    }

    const projectText = getProjectText(assignment.row);
    const title = projectText
      ? `Betrieb · ${projectText}`
      : `Betrieb · ${assignment.crewName}`;

    for (const employeeId of employeeIds) {
      const bar: TimelineBar = {
        id: `crew-${assignment.id}-${employeeId}`,
        employeeId,
        source: "crew",
        typeValue: operationType.value,
        typeLabel: operationType.label,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        title,
        subtitle: assignment.crewName,
        notes: assignment.notes,
        barClass: operationType.barClass,
      };

      barsByEmployeeId.set(employeeId, [
        ...(barsByEmployeeId.get(employeeId) ?? []),
        bar,
      ]);
    }
  }

  for (const [employeeId, bars] of barsByEmployeeId) {
    barsByEmployeeId.set(
      employeeId,
      bars.sort((a, b) => {
        const byStart = a.startDate.getTime() - b.startDate.getTime();
        if (byStart !== 0) return byStart;
        return a.typeLabel.localeCompare(b.typeLabel, "de-DE");
      }),
    );
  }

  const previousFrom = addDays(fromDate, -14);
  const previousTo = addDays(toDate, -14);
  const nextFrom = addDays(fromDate, 14);
  const nextTo = addDays(toDate, 14);

  return (
    <AppShell
      title="Mitarbeiterdisposition"
      description="Mitarbeiter zeilenweise verfolgen: Betrieb aus Kolonneneinteilung plus Urlaub, Krank, Schulung, Werkstatt, Mischanlagen, Schule und Innung."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/employee-dispatch?from=${formatDateInput(
            previousFrom,
          )}&to=${formatDateInput(previousTo)}`}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Zurück
        </Link>

        <Link
          href={`/employee-dispatch?from=${formatDateInput(
            defaultFrom,
          )}&to=${formatDateInput(addDays(defaultFrom, 13))}`}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Aktuelle 14 Tage
        </Link>

        <Link
          href={`/employee-dispatch?from=${formatDateInput(
            nextFrom,
          )}&to=${formatDateInput(nextTo)}`}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Weiter
        </Link>

        <Link
          href="/crew-dispatch"
          className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          Kolonneneinteilung öffnen
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Eintrag hinzufügen
        </h2>

        <form
          action={createEmployeeDispositionEntry}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-8"
        >
          <label className="text-sm font-medium text-gray-800 xl:col-span-2">
            Mitarbeiter
            <select
              name="employeeId"
              required
              defaultValue=""
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            >
              <option value="" disabled>
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
              name="typeValue"
              required
              defaultValue="urlaub"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            >
              {employeeDispositionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-800">
            Von
            <input
              type="date"
              name="startDate"
              required
              defaultValue={formatDateInput(fromDate)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Bis
            <input
              type="date"
              name="endDate"
              required
              defaultValue={formatDateInput(fromDate)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Beginn
            <input
              type="time"
              name="startTime"
              defaultValue="06:30"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Ende
            <input
              type="time"
              name="endTime"
              defaultValue="17:00"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800 xl:col-span-2">
            Bemerkung
            <input
              name="notes"
              placeholder="z.B. Urlaub genehmigt, Berufsschule, Innung ..."
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Eintrag speichern
            </button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {employeeDispositionTypes.map((type) => (
            <span
              key={type.value}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${type.badgeClass}`}
            >
              {type.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Mitarbeiter-Zeitstrahl
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {formatGermanDate(fromDate)} – {formatGermanDate(toDate)} ·{" "}
                {employees.length} Mitarbeiter · Betrieb kommt automatisch aus
                der Kolonneneinteilung.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[300px_1fr] border-b border-gray-200 bg-white">
              <div className="sticky left-0 z-20 border-r border-gray-200 bg-white p-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Mitarbeiter
              </div>
              <div
                className="grid border-l border-gray-100"
                style={{ gridTemplateColumns }}
              >
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={
                      isWeekend(day)
                        ? "border-r border-gray-100 bg-gray-100 p-2 text-center text-[11px] font-semibold text-gray-500"
                        : "border-r border-gray-100 bg-white p-2 text-center text-[11px] font-semibold text-gray-500"
                    }
                  >
                    {formatGermanDate(day)}
                  </div>
                ))}
              </div>
            </div>

            {employees.map((employee) => {
              const bars = barsByEmployeeId.get(employee.id) ?? [];
              const positionText =
                employee.positions
                  .map((position) => position.positionLabel)
                  .join(", ") || "ohne Berufsgruppe";

              return (
                <div
                  key={employee.id}
                  className="grid grid-cols-[300px_1fr] border-b border-gray-100"
                >
                  <div className="sticky left-0 z-10 border-r border-gray-200 bg-white p-3">
                    <div className="text-sm font-bold text-gray-900">
                      {employee.lastName}, {employee.firstName}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {positionText}
                    </div>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClass(
                        employee.statusValue,
                      )}`}
                    >
                      {employee.statusLabel}
                    </span>
                  </div>

                  <div className="relative min-h-[56px]">
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns }}
                    >
                      {days.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={
                            isWeekend(day)
                              ? "border-r border-gray-100 bg-gray-50"
                              : "border-r border-gray-100 bg-white"
                          }
                        />
                      ))}
                    </div>

                    <div
                      className="relative grid gap-y-1 px-1 py-2"
                      style={{ gridTemplateColumns }}
                    >
                      {bars.length === 0 ? (
                        <div className="col-span-full py-2 text-xs font-medium text-gray-400">
                          Keine Einträge im Zeitraum
                        </div>
                      ) : (
                        bars.map((bar) => (
                          <div
                            key={bar.id}
                            title={`${bar.title}\n${bar.startTime} – ${bar.endTime}${
                              bar.subtitle ? `\n${bar.subtitle}` : ""
                            }`}
                            className={`min-h-7 truncate rounded-lg px-2 py-1 text-xs font-semibold shadow-sm ${bar.barClass}`}
                            style={getBarPosition(bar, fromDate, toDate)}
                          >
                            <span className="truncate">{bar.title}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Manuelle Einträge im Zeitraum
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="w-[88px] p-3 font-semibold">Aktion</th>
                <th className="p-3 font-semibold">Mitarbeiter</th>
                <th className="p-3 font-semibold">Art</th>
                <th className="p-3 font-semibold">Von</th>
                <th className="p-3 font-semibold">Bis</th>
                <th className="p-3 font-semibold">Zeit</th>
                <th className="p-3 font-semibold">Bemerkung</th>
              </tr>
            </thead>

            <tbody>
              {manualEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    Keine manuellen Einträge im gewählten Zeitraum.
                  </td>
                </tr>
              ) : (
                manualEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-100">
                    <td className="p-3">
                      <form action={deleteEmployeeDispositionEntry}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button
                          type="submit"
                          title="Eintrag löschen"
                          aria-label="Eintrag löschen"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                        >
                          <ActionIcon name="delete" className="h-4 w-4" />
                        </button>
                      </form>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {entry.employee.lastName}, {entry.employee.firstName}
                    </td>
                    <td className="p-3">{entry.typeLabel}</td>
                    <td className="p-3">{formatGermanDate(entry.startDate)}</td>
                    <td className="p-3">{formatGermanDate(entry.endDate)}</td>
                    <td className="p-3">
                      {entry.startTime} – {entry.endTime}
                    </td>
                    <td className="p-3 text-gray-600">{entry.notes ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
