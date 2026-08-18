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
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("de-DE") : "-";
}

// Both rows get an explicit height so the SUMME row's sticky offset
// (top-11 = 2.75rem = the header row's own height) lines up exactly,
// with whitespace-nowrap making sure a long header label can never wrap
// onto a second line and throw that height off - reasonable here since
// the table already forces min-w-[2000px] and scrolls horizontally
// rather than wrapping column headers.
const headerCellClass =
  "sticky top-0 z-20 h-11 whitespace-nowrap bg-gray-900 p-3";
const summeCellClass =
  "sticky top-11 z-10 h-11 whitespace-nowrap bg-amber-50 p-3";

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
        {/* Sticky headers only actually stick to the viewport of whatever
            box scrolls them - wrapping in a plain overflow-x-auto div
            (no height limit) makes that div itself the vertical scroll
            container per the CSS overflow spec, so a sticky thead inside
            it never reaches the page's own scroll. Giving this box a
            max-height + overflow-y-auto as well makes it the real (and
            only) scroll container in both directions, so sticky actually
            works, at the cost of the table becoming its own scrollable
            panel instead of scrolling with the whole page. */}
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[2000px] border-collapse text-left text-xs">
            <thead className="text-white">
              <tr>
                <th className={headerCellClass}>Nr.</th>
                <th className={headerCellClass}>Auftrag</th>
                <th className={headerCellClass}>Bauleiter</th>
                <th className={headerCellClass}>Status</th>
                <th className={headerCellClass}>Auftragsumme (netto)</th>
                <th className={headerCellClass}>Nachträge (netto)</th>
                <th className={headerCellClass}>Auftragssumme inkl. Nachträge (netto)</th>
                <th className={headerCellClass}>Summe aller Abschläge (netto)</th>
                <th className={headerCellClass}>Leistungsstand (IST %)</th>
                <th className={headerCellClass}>Leistungsstand (IST €)</th>
                <th className={headerCellClass}>Abrechnungsstand (IST %)</th>
                <th className={headerCellClass}>Δ Leistungsstand vs Abrechnung (€)</th>
                <th className={headerCellClass}>Über-/Unterdeckung</th>
                <th className={headerCellClass}>Auftraggeber</th>
                <th className={headerCellClass}>Tatsächlicher Baubeginn</th>
                <th className={headerCellClass}>Tatsächliches Bauende</th>
                <th className={headerCellClass}>Vsl. Baubeginn</th>
                <th className={headerCellClass}>Vsl. Bauende</th>
                <th className={headerCellClass}>Restliche Bauzeit</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b-2 border-gray-300 font-bold text-gray-900">
                <td className={summeCellClass} colSpan={4}>
                  SUMME
                </td>
                <td className={summeCellClass}>{formatEuro(totals.contractValueNet)}</td>
                <td className={summeCellClass}>{formatEuro(totals.changeOrdersNet)}</td>
                <td className={summeCellClass}>{formatEuro(totals.totalContract)}</td>
                <td className={summeCellClass}>{formatEuro(totals.paymentsNet)}</td>
                <td className={summeCellClass}>{formatPercent(totalProgressPercent)}</td>
                <td className={summeCellClass}>{formatEuro(totals.performanceValue)}</td>
                <td className={summeCellClass}>{formatPercent(totalBillingPercent)}</td>
                <td className={`${summeCellClass} ${totals.difference >= 0 ? "text-green-800" : "text-red-700"}`}>
                  {formatEuro(totals.difference)}
                </td>
                <td className={`${summeCellClass} ${totalCoveragePercent >= 0 ? "text-green-800" : "text-red-700"}`}>
                  {formatPercent(totalCoveragePercent)}
                </td>
                <td className={summeCellClass} colSpan={6} />
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
