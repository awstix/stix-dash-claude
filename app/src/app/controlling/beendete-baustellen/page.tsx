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

function formatPercent(value: number) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

function formatDate(value: Date | null) {
  return value ? value.toLocaleDateString("de-DE") : "-";
}

const ohneBauleiterLabel = "Ohne Bauleiter";

export default async function ControllingBeendeteBaustellenPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ projectNumber: "desc" }],
    where: { status: "FINISHED" },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      client: true,
      constructionManager: true,
      contractValueNet: true,
      changeOrdersNet: true,
      progressPercent: true,
      paymentsNet: true,
      actualStart: true,
      actualEnd: true,
      finalInvoiceCreated: true,
      finalInvoiceNumber: true,
      finalInvoiceNet: true,
    },
  });

  const rows = projects.map((project) => {
    const performance = calculateProjectPerformance(project);
    const totalContract = performance.totalContract;
    const invoiceDifference = project.finalInvoiceCreated
      ? (project.finalInvoiceNet ?? 0) - totalContract
      : null;
    const invoiceQuotePercent =
      project.finalInvoiceCreated && totalContract > 0
        ? ((project.finalInvoiceNet ?? 0) / totalContract) * 100
        : null;
    return { ...project, performance, invoiceDifference, invoiceQuotePercent };
  });

  const perBauleiterCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.constructionManager?.trim() || ohneBauleiterLabel;
    perBauleiterCounts.set(key, (perBauleiterCounts.get(key) ?? 0) + 1);
  }
  const sortedBauleiterCounts = Array.from(perBauleiterCounts.entries()).sort((a, b) => {
    if (a[0] === ohneBauleiterLabel) return 1;
    if (b[0] === ohneBauleiterLabel) return -1;
    return a[0].localeCompare(b[0], "de-DE");
  });

  return (
    <AppShell
      title="Beendete Baustellen"
      description="Alle abgeschlossenen Baustellen mit Schlussrechnungs-Status – wie die Excel-Blätter „BaustellenBeendet“ und „Baustellen-SR-erstellt“."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/controlling/ausstehende-schlussrechnungen"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Ausstehende Schlussrechnungen
        </Link>
        <Link
          href="/controlling/auftraege"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Aufträge
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3">Bauleiter</th>
                <th className="p-3">Beendete Baustellen</th>
              </tr>
            </thead>
            <tbody>
              {sortedBauleiterCounts.map(([name, count]) => (
                <tr key={name} className="border-t border-gray-100">
                  <td className="p-3 text-gray-800">{name}</td>
                  <td className="p-3 font-semibold text-gray-900">{count}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900">
                <td className="p-3">GESAMT</td>
                <td className="p-3">{rows.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2100px] border-collapse text-left text-xs">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3">Nr.</th>
                <th className="p-3">Auftrag</th>
                <th className="p-3">Bauleiter</th>
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
                <th className="p-3">SR erstellt</th>
                <th className="p-3">SR-Nr.</th>
                <th className="p-3">SR Summe (netto)</th>
                <th className="p-3">Δ Auftragssumme vs SR (netto)</th>
                <th className="p-3">Quote Auftragssumme vs SR Summe</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={20} className="p-8 text-center text-gray-500">
                    Keine beendeten Baustellen vorhanden.
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
                    <td className="p-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.finalInvoiceCreated
                            ? "bg-green-100 text-green-900"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {row.finalInvoiceCreated ? "Ja" : "Nein"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{row.finalInvoiceNumber || "-"}</td>
                    <td className="p-3 text-gray-700">
                      {row.finalInvoiceCreated ? formatEuro(row.finalInvoiceNet ?? 0) : "-"}
                    </td>
                    <td
                      className={
                        row.invoiceDifference === null
                          ? "p-3 text-gray-700"
                          : row.invoiceDifference >= 0
                            ? "p-3 text-green-800"
                            : "p-3 text-red-700"
                      }
                    >
                      {row.invoiceDifference === null ? "-" : formatEuro(row.invoiceDifference)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {row.invoiceQuotePercent === null ? "-" : formatPercent(row.invoiceQuotePercent)}
                    </td>
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
