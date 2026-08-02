import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { calculateProjectPerformance } from "@/app/projects/project-performance";

type ProjectStatus = "NOT_STARTED" | "ACTIVE" | "PAUSED" | "FINISHED" | "CANCELLED";

const statusLabels: Record<ProjectStatus, string> = {
  NOT_STARTED: "noch nicht begonnen",
  ACTIVE: "aktiv",
  PAUSED: "ruht",
  FINISHED: "beendet",
  CANCELLED: "storniert",
};

const statusColors: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  FINISHED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("de-DE") : "-";
}

export default async function ControllingAuftraegePage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ projectNumber: "desc" }],
    select: {
      id: true,
      projectNumber: true,
      name: true,
      client: true,
      constructionManager: true,
      status: true,
      contractValueNet: true,
      changeOrdersNet: true,
      progressPercent: true,
      paymentsNet: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      remainingConstructionTime: true,
    },
  });

  const rows = projects.map((project) => ({
    ...project,
    performance: calculateProjectPerformance(project),
  }));

  const totals = rows.reduce(
    (sum, row) => ({
      contractValueNet: sum.contractValueNet + row.contractValueNet,
      changeOrdersNet: sum.changeOrdersNet + row.changeOrdersNet,
      totalContract: sum.totalContract + row.performance.totalContract,
      paymentsNet: sum.paymentsNet + row.paymentsNet,
      performanceValue: sum.performanceValue + row.performance.performanceValue,
      difference: sum.difference + row.performance.difference,
      progressPercentSum: sum.progressPercentSum + row.progressPercent,
      billingPercentSum: sum.billingPercentSum + row.performance.billingPercent,
    }),
    {
      contractValueNet: 0,
      changeOrdersNet: 0,
      totalContract: 0,
      paymentsNet: 0,
      performanceValue: 0,
      difference: 0,
      progressPercentSum: 0,
      billingPercentSum: 0,
    },
  );

  const rowCount = rows.length || 1;
  const totalProgressPercent = totals.progressPercentSum / rowCount;
  const totalBillingPercent = totals.billingPercentSum / rowCount;
  const totalCoveragePercent =
    totals.performanceValue > 0 ? (totals.difference / totals.performanceValue) * 100 : 0;

  return (
    <AppShell
      title="Aufträge"
      description="Gesamtliste aller Baustellen über alle Bauleiter – wie das Excel-Blatt „AUFTRÄGE“, als flache Controlling-Tabelle mit Summenzeile."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/controlling/bauleiterliste"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Bauleiterliste
        </Link>
        <Link
          href="/projects/performance"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projekte · Leistung
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2000px] border-collapse text-left text-xs">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3">Nr.</th>
                <th className="p-3">Auftrag</th>
                <th className="p-3">Bauleiter</th>
                <th className="p-3">Status</th>
                <th className="p-3">Auftragsumme (netto)</th>
                <th className="p-3">Nachträge (netto)</th>
                <th className="p-3">Auftragssumme inkl. Nachträge (netto)</th>
                <th className="p-3">Summe aller Abschläge (netto)</th>
                <th className="p-3">Leistungsstand (IST %)</th>
                <th className="p-3">Leistungsstand (IST €)</th>
                <th className="p-3">Abrechnungsstand (IST %)</th>
                <th className="p-3">Δ Leistungsstand vs Abrechnung (€)</th>
                <th className="p-3">Über-/Unterdeckung</th>
                <th className="p-3">Auftraggeber</th>
                <th className="p-3">Tatsächlicher Baubeginn</th>
                <th className="p-3">Tatsächliches Bauende</th>
                <th className="p-3">Vsl. Baubeginn</th>
                <th className="p-3">Vsl. Bauende</th>
                <th className="p-3">Restliche Bauzeit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-gray-300 bg-amber-50 font-bold text-gray-900">
                <td className="p-3" colSpan={4}>
                  SUMME
                </td>
                <td className="p-3">{formatEuro(totals.contractValueNet)}</td>
                <td className="p-3">{formatEuro(totals.changeOrdersNet)}</td>
                <td className="p-3">{formatEuro(totals.totalContract)}</td>
                <td className="p-3">{formatEuro(totals.paymentsNet)}</td>
                <td className="p-3">{formatPercent(totalProgressPercent)}</td>
                <td className="p-3">{formatEuro(totals.performanceValue)}</td>
                <td className="p-3">{formatPercent(totalBillingPercent)}</td>
                <td className={totals.difference >= 0 ? "p-3 text-green-800" : "p-3 text-red-700"}>
                  {formatEuro(totals.difference)}
                </td>
                <td className={totalCoveragePercent >= 0 ? "p-3 text-green-800" : "p-3 text-red-700"}>
                  {formatPercent(totalCoveragePercent)}
                </td>
                <td className="p-3" colSpan={6} />
              </tr>

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="p-8 text-center text-gray-500">
                    Noch keine Projekte vorhanden.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="p-3 font-semibold text-gray-900">{row.projectNumber}</td>
                    <td className="max-w-64 p-3 text-gray-800">
                      <Link href={`/projects/${row.id}`} className="hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="p-3 text-gray-700">{row.constructionManager || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColors[row.status]}`}
                      >
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{formatEuro(row.contractValueNet)}</td>
                    <td className="p-3 text-gray-700">{formatEuro(row.changeOrdersNet)}</td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatEuro(row.performance.totalContract)}
                    </td>
                    <td className="p-3 text-gray-700">{formatEuro(row.paymentsNet)}</td>
                    <td className="p-3 text-gray-700">{formatPercent(row.progressPercent)}</td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatEuro(row.performance.performanceValue)}
                    </td>
                    <td className="p-3 text-gray-700">{formatPercent(row.performance.billingPercent)}</td>
                    <td className={row.performance.difference >= 0 ? "p-3 text-green-800" : "p-3 text-red-700"}>
                      {formatEuro(row.performance.difference)}
                    </td>
                    <td
                      className={
                        row.performance.coveragePercent >= 0
                          ? "p-3 font-semibold text-green-800"
                          : "p-3 font-semibold text-red-700"
                      }
                    >
                      {formatPercent(row.performance.coveragePercent)}
                    </td>
                    <td className="max-w-48 truncate p-3 text-gray-700" title={row.client || undefined}>
                      {row.client || "-"}
                    </td>
                    <td className="p-3 text-gray-700">{formatDate(row.actualStart)}</td>
                    <td className="p-3 text-gray-700">{formatDate(row.actualEnd)}</td>
                    <td className="p-3 text-gray-700">{formatDate(row.plannedStart)}</td>
                    <td className="p-3 text-gray-700">{formatDate(row.plannedEnd)}</td>
                    <td className="p-3 text-gray-700">{row.remainingConstructionTime || "-"}</td>
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
