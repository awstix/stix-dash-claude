import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { calculateProjectPerformance } from "@/app/projects/project-performance";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("de-DE") : "-";
}

function daysSince(value: Date | null) {
  if (!value) return null;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const start = new Date(value.toISOString().slice(0, 10) + "T00:00:00.000Z");
  return Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

const ohneBauleiterLabel = "Ohne Bauleiter";

export default async function ControllingAusstehendeSchlussrechnungenPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ projectNumber: "desc" }],
    where: { status: "FINISHED", finalInvoiceCreated: false },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      constructionManager: true,
      contractValueNet: true,
      changeOrdersNet: true,
      progressPercent: true,
      paymentsNet: true,
      actualEnd: true,
    },
  });

  const rows = projects.map((project) => ({
    ...project,
    days: daysSince(project.actualEnd),
    performance: calculateProjectPerformance(project),
  }));

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.constructionManager?.trim() || ohneBauleiterLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const sortedGroupNames = Array.from(groups.keys()).sort((a, b) => {
    if (a === ohneBauleiterLabel) return 1;
    if (b === ohneBauleiterLabel) return -1;
    return a.localeCompare(b, "de-DE");
  });

  return (
    <AppShell
      title="Ausstehende Schlussrechnungen"
      description="Beendete Baustellen ohne erstellte Schlussrechnung, je Bauleiter – fasst die Excel-Blätter „Außenstände“, „Außenstände_SR“, „Außenstände_SR_“ und „Außenstände_SR_GESAMT“ zusammen."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/controlling/beendete-baustellen"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Beendete Baustellen
        </Link>
        <Link
          href="/controlling/bauleiterliste"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Bauleiterliste
        </Link>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-950">
        GESAMT: {rows.length} ausstehende Schlussrechnung{rows.length === 1 ? "" : "en"}
      </div>

      {sortedGroupNames.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-sm">
          Keine ausstehenden Schlussrechnungen.
        </div>
      ) : (
        <div className="space-y-8">
          {sortedGroupNames.map((groupName) => {
            const groupRows = groups.get(groupName) ?? [];
            return (
              <section key={groupName}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="text-lg font-bold text-gray-900">{groupName}</h2>
                  <span className="text-sm font-semibold text-gray-500">
                    {groupRows.length} Baustelle{groupRows.length === 1 ? "" : "n"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                      <thead className="bg-gray-900 text-white">
                        <tr>
                          <th className="p-3">Auftrag Nr.</th>
                          <th className="p-3">Bezeichnung</th>
                          <th className="p-3">Letzter Arbeitstag</th>
                          <th className="p-3">Tage</th>
                          <th className="p-3">Auftragssumme inkl. Nachträge (netto)</th>
                          <th className="p-3">Δ Leistungsstand vs Abrechnung (€)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupRows.map((row) => (
                          <tr key={row.id} className="border-b border-gray-100">
                            <td className="p-3 font-semibold text-gray-900">{row.projectNumber}</td>
                            <td className="max-w-96 p-3 text-gray-800">
                              <Link href={`/projects/${row.id}`} className="hover:underline">
                                {row.name}
                              </Link>
                            </td>
                            <td className="p-3 text-gray-700">{formatDate(row.actualEnd)}</td>
                            <td className="p-3 text-gray-700">{row.days === null ? "FEHLT" : row.days}</td>
                            <td className="p-3 font-semibold text-gray-900">
                              {formatEuro(row.performance.totalContract)}
                            </td>
                            <td
                              className={
                                row.performance.difference >= 0 ? "p-3 text-green-800" : "p-3 text-red-700"
                              }
                            >
                              {formatEuro(row.performance.difference)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
