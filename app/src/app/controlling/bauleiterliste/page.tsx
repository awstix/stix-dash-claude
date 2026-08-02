import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { calculateProjectPerformance } from "@/app/projects/project-performance";

type ProjectStatus = "NOT_STARTED" | "ACTIVE" | "PAUSED" | "FINISHED" | "CANCELLED";

const statusColors: Record<ProjectStatus, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  FINISHED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabels: Record<ProjectStatus, string> = {
  NOT_STARTED: "noch nicht begonnen",
  ACTIVE: "aktiv",
  PAUSED: "ruht",
  FINISHED: "beendet",
  CANCELLED: "storniert",
};

const ohneBauleiterLabel = "Ohne Bauleiter";

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

export default async function ControllingBauleiterlistePage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ projectNumber: "desc" }],
    select: {
      id: true,
      projectNumber: true,
      name: true,
      constructionManager: true,
      status: true,
      contractValueNet: true,
      changeOrdersNet: true,
      progressPercent: true,
      paymentsNet: true,
      dvgw: true,
      guetezeichenKanalbau: true,
      lieferscheine: true,
    },
  });

  const groups = new Map<string, typeof projects>();
  for (const project of projects) {
    const key = project.constructionManager?.trim() || ohneBauleiterLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.push(project);
    } else {
      groups.set(key, [project]);
    }
  }

  const sortedGroupNames = Array.from(groups.keys()).sort((a, b) => {
    if (a === ohneBauleiterLabel) return 1;
    if (b === ohneBauleiterLabel) return -1;
    return a.localeCompare(b, "de-DE");
  });

  return (
    <AppShell
      title="Bauleiterliste"
      description="Projektleistungen je Bauleiter im Überblick – dieselben Schnellstand-Kennzahlen wie unter Projekte › Leistung, nur nach Bauleiter gruppiert."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/projects/performance"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projekte · Leistung
        </Link>
      </div>

      {sortedGroupNames.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-sm">
          Noch keine Projekte vorhanden.
        </div>
      ) : (
        <div className="space-y-10">
          {sortedGroupNames.map((groupName) => {
            const groupProjects = groups.get(groupName) ?? [];
            return (
              <section key={groupName}>
                <div className="mb-4 flex items-baseline gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{groupName}</h2>
                  <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Projektleistungen
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {groupProjects.map((project) => {
                    const performance = calculateProjectPerformance(project);
                    return (
                      <div
                        key={project.id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-semibold text-gray-500">
                              {project.projectNumber}
                            </div>
                            <Link
                              href={`/projects/${project.id}`}
                              className="text-base font-bold text-gray-900 hover:underline"
                            >
                              {project.name}
                            </Link>
                          </div>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColors[project.status]}`}
                          >
                            {statusLabels[project.status]}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <RequirementBadge label="Lieferscheine" value={project.lieferscheine} />
                          <RequirementBadge label="Gütezeichen Kanalbau" value={project.guetezeichenKanalbau} />
                          <RequirementBadge label="DVGW" value={project.dvgw} />
                        </div>

                        <dl className="mt-4 space-y-1.5 text-sm">
                          <MetricRow label="Auftragssumme (netto)" value={formatEuro(project.contractValueNet)} />
                          <MetricRow label="Nachträge beauftragt (netto)" value={formatEuro(project.changeOrdersNet)} />
                          <MetricRow
                            bold
                            label="Auftragssumme inkl. Nachträge (netto)"
                            value={formatEuro(performance.totalContract)}
                          />
                          <MetricRow label="Leistungsstand (IST %)" value={formatPercent(project.progressPercent)} />
                          <MetricRow
                            bold
                            label="Leistungsstand (IST in €)"
                            value={formatEuro(performance.performanceValue)}
                          />
                          <MetricRow label="Summe aller Abschläge (netto)" value={formatEuro(project.paymentsNet)} />
                          <MetricRow label="Abrechnungsstand (IST %)" value={formatPercent(performance.billingPercent)} />
                          <MetricRow
                            label="Delta Leistungsstand vs. Abrechnungsstand"
                            tone={performance.difference >= 0 ? "positive" : "negative"}
                            value={formatEuro(performance.difference)}
                          />
                          <MetricRow
                            bold
                            label="Über-/Unterdeckung"
                            tone={performance.coveragePercent >= 0 ? "positive" : "negative"}
                            value={formatPercent(performance.coveragePercent)}
                          />
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function MetricRow({
  bold,
  label,
  tone,
  value,
}: {
  bold?: boolean;
  label: string;
  tone?: "negative" | "positive";
  value: string;
}) {
  const toneClass =
    tone === "positive" ? "text-green-700" : tone === "negative" ? "text-red-700" : "text-gray-900";

  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-600">{label}</dt>
      <dd className={`${bold ? "font-bold" : "font-medium"} ${toneClass}`}>{value}</dd>
    </div>
  );
}

function RequirementBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        value ? "bg-green-100 text-green-900" : "bg-gray-100 text-gray-500"
      }`}
    >
      {label}: {value ? "Ja" : "Nein"}
    </span>
  );
}
