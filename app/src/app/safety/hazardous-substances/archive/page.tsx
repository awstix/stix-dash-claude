import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { restoreHazardousSubstance } from "../../actions";
import { PermanentHazardDeleteDialog } from "../PermanentHazardDeleteDialog";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export const dynamic = "force-dynamic";

export default async function HazardousSubstanceArchivePage() {
  const substances = await prisma.safetyHazardousSubstance.findMany({
    orderBy: [{ updatedAt: "desc" }],
    where: { isActive: false },
  });

  return (
    <AppShell
      description="Archivierte Gefahrstoffe bleiben mit ihrer laufenden Nummer erhalten und können wiederhergestellt oder administrativ endgültig gelöscht werden."
      title="Gefahrstoffarchiv"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
          href="/safety/hazardous-substances"
        >
          ← Zum Gefahrstoffkataster
        </Link>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-bold text-gray-800">
          {substances.length} archiviert
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-amber-50 p-4 text-sm leading-6 text-black">
          Archivierte Einträge sind im aktiven Kataster ausgeblendet. Ihre
          laufende Nummer bleibt gesperrt. Nur das endgültige Löschen im
          Admin-Archiv gibt die Nummer wieder frei.
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm text-black">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-400 px-3 py-2">Aktionen</th>
                <th className="border border-gray-400 px-3 py-2">Lfd. Nummer</th>
                <th className="border border-gray-400 px-3 py-2">Produkt</th>
                <th className="border border-gray-400 px-3 py-2">Hersteller</th>
                <th className="border border-gray-400 px-3 py-2">Reiter</th>
                <th className="border border-gray-400 px-3 py-2">Archiviert/geändert</th>
              </tr>
            </thead>
            <tbody>
              {substances.length ? (
                substances.map((substance) => (
                  <tr key={substance.id}>
                    <td className="border border-gray-400 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <form action={restoreHazardousSubstance}>
                          <input name="id" type="hidden" value={substance.id} />
                          <button
                            aria-label={`${substance.name} wiederherstellen`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-green-300 bg-white text-lg font-bold text-green-700 hover:bg-green-50"
                            title="Wiederherstellen"
                            type="submit"
                          >
                            ↺
                          </button>
                        </form>
                        <PermanentHazardDeleteDialog
                          id={substance.id}
                          name={substance.name}
                          sequentialNumber={substance.sequentialNumber}
                        />
                      </div>
                    </td>
                    <td className="border border-gray-400 px-3 py-2 font-bold">
                      {substance.sequentialNumber ?? "—"}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 font-semibold">
                      {substance.name}
                    </td>
                    <td className="border border-gray-400 px-3 py-2">
                      {substance.manufacturer ?? "—"}
                    </td>
                    <td className="border border-gray-400 px-3 py-2">
                      {substance.registerSection === "WITHOUT_BA"
                        ? "Gefahrstoffe ohne BA"
                        : "Gefährliche Gefahrstoffe"}
                    </td>
                    <td className="border border-gray-400 px-3 py-2">
                      {formatDate(substance.updatedAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="border border-gray-400 p-8 text-center text-gray-600"
                    colSpan={6}
                  >
                    Keine archivierten Gefahrstoffe vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
