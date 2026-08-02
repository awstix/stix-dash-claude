import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { PersonalZeitenEditDialog } from "./PersonalZeitenEditDialog";

type PersonalZeitenSearchParams = {
  from?: string;
  projectId?: string;
  q?: string;
  to?: string;
};

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

function statusLabel(status: string) {
  if (status === "APPROVED") return "Freigegeben";
  if (status === "SUBMITTED") return "Zur Freigabe";
  return "Entwurf";
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-green-100 text-green-900";
  if (status === "SUBMITTED") return "bg-amber-100 text-amber-900";
  return "bg-gray-100 text-gray-700";
}

export default async function PersonalZeitenPage({
  searchParams,
}: {
  searchParams: Promise<PersonalZeitenSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);

  const fromDate = parseDateParam(params.from, defaultFrom);
  const toDate = parseDateParam(params.to, today);
  const q = (params.q ?? "").trim();
  const projectId = (params.projectId ?? "").trim();

  const [entries, projects] = await Promise.all([
    prisma.crewTimeEmployee.findMany({
      include: { entry: true },
      orderBy: [{ entry: { workDate: "desc" } }, { employeeName: "asc" }],
      where: {
        employeeName: q ? { contains: q } : undefined,
        entry: {
          projectId: projectId || undefined,
          workDate: { gte: fromDate, lte: toDate },
        },
      },
      take: 500,
    }),
    prisma.project.findMany({
      orderBy: { projectNumber: "asc" },
      select: { id: true, name: true, projectNumber: true },
    }),
  ]);

  return (
    <AppShell
      title="Personalzeiten"
      description="Erfasste Arbeitszeiten aus der Kolonnen-Zeiterfassung, projektübergreifend."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/personal"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Personal-Übersicht
        </Link>
      </div>

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
          Baustelle
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            defaultValue={projectId}
            name="projectId"
          >
            <option value="">Alle Baustellen</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} · {project.name}
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
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Datum</th>
              <th className="p-3">Baustelle</th>
              <th className="p-3">Kolonne</th>
              <th className="p-3">Beginn</th>
              <th className="p-3">Ende</th>
              <th className="p-3">Gesamt</th>
              <th className="p-3">Status</th>
              <th className="p-3">Erfasser</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((employee) => (
              <tr className="border-b border-gray-200" key={employee.id}>
                <td className="p-3">
                  <PersonalZeitenEditDialog
                    employeeId={employee.employeeId}
                    entryId={employee.entryId}
                    trigger={employee.employeeName}
                  />
                </td>
                <td className="p-3 text-gray-700">{formatDate(employee.entry.workDate)}</td>
                <td className="p-3 text-gray-700">
                  {employee.entry.projectNumber} · {employee.entry.projectName}
                </td>
                <td className="p-3 text-gray-700">{employee.entry.crewName}</td>
                <td className="p-3 text-gray-700">{employee.startTime}</td>
                <td className="p-3 text-gray-700">{employee.endTime}</td>
                <td className="p-3 font-semibold text-gray-900">
                  {employee.netHours.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Std.
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(employee.entry.status)}`}
                  >
                    {statusLabel(employee.entry.status)}
                  </span>
                </td>
                <td className="p-3 text-gray-700">{employee.entry.recordedByName || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!entries.length ? (
          <div className="p-8 text-center text-sm font-semibold text-gray-500">
            Keine Zeiten im gewählten Zeitraum gefunden.
          </div>
        ) : null}
        {entries.length === 500 ? (
          <div className="border-t border-gray-200 p-4 text-center text-xs font-medium text-gray-500">
            Es werden maximal 500 Einträge angezeigt — Zeitraum eingrenzen, um alle Ergebnisse zu sehen.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
