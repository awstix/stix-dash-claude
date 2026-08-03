import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createWorkTimeCalendar } from "./actions";

export default async function WorkTimeCalendarsPage() {
  const calendars = await prisma.workTimeCalendar.findMany({
    include: {
      _count: {
        select: { assignments: true, days: true },
      },
    },
    orderBy: [{ year: "desc" }, { name: "asc" }],
  });
  const currentYear = new Date().getUTCFullYear();

  return (
    <AppShell
      title="Jahreskalender"
      description="Stammkalender pro Jahr – jedem Tag eine Planzeit zuweisen und an Mitarbeiter zuweisen."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/working-time"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Arbeitszeit-Übersicht
        </Link>
        <Link
          href="/admin/working-time/planzeiten"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Planzeiten
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3">Jahr</th>
              <th className="p-3">Name</th>
              <th className="p-3">Tage befüllt</th>
              <th className="p-3">Zugewiesene Mitarbeiter</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {calendars.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Noch kein Jahreskalender angelegt.
                </td>
              </tr>
            ) : (
              calendars.map((calendar) => (
                <tr key={calendar.id} className="border-b border-gray-100">
                  <td className="p-3 font-semibold text-gray-900">{calendar.year}</td>
                  <td className="p-3 text-gray-800">{calendar.name}</td>
                  <td className="p-3 text-gray-700">{calendar._count.days}</td>
                  <td className="p-3 text-gray-700">{calendar._count.assignments}</td>
                  <td className="p-3 text-right">
                    <Link
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                      href={`/admin/working-time/kalender/${calendar.id}`}
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Neuen Jahreskalender anlegen</h2>
        <form action={createWorkTimeCalendar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_auto]">
          <label className="text-xs font-semibold text-gray-700">
            Jahr
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={currentYear}
              min={1900}
              max={2200}
              name="year"
              required
              type="number"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              name="name"
              placeholder="z.B. Arbeitszeit neu"
              required
            />
          </label>
          <div className="flex items-end">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Anlegen
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
