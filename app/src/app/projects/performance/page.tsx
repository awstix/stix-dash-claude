import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { DismissibleDetails } from "../../crew-dispatch/DismissibleDetails";
import { prisma } from "@/lib/prisma";
import { parseConstructionManagersJson } from "@/lib/construction-managers";
import { getConstructionManagerOptions } from "@/lib/construction-manager-options";
import {
  getPercentOperator,
  getPercentValue,
  getTriStateFilter,
  normalizeProjectSearchText,
} from "@/lib/project-filters";
import { parseRecipientsJson, parseWeekdaysJson } from "@/lib/time-tracking-reminder";
import { ProjectNavigation } from "../ProjectNavigation";
import { ProjectManager } from "../ProjectManager";
import { requireSession } from "@/lib/auth-access";

export default async function ProjectPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{
    billingOperator?: string;
    billingValue?: string;
    constructionManager?: string;
    dvgw?: string;
    guetezeichenKanalbau?: string;
    lieferscheine?: string;
    progressOperator?: string;
    progressValue?: string;
    q?: string;
  }>;
}) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const constructionManagerFilter = String(params.constructionManager ?? "").trim();
  const dvgwFilter = getTriStateFilter(params.dvgw);
  const guetezeichenKanalbauFilter = getTriStateFilter(params.guetezeichenKanalbau);
  const lieferscheineFilter = getTriStateFilter(params.lieferscheine);
  const progressOperator = getPercentOperator(params.progressOperator);
  const progressValue = getPercentValue(params.progressValue);
  const billingOperator = getPercentOperator(params.billingOperator);
  const billingValue = getPercentValue(params.billingValue);

  const [projects, constructionManagerOptions] = await Promise.all([
    prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        performanceReports: {
          orderBy: [
            {
              periodEnd: "desc",
            },
            {
              reportDate: "desc",
            },
          ],
          take: 1,
          include: {
            detailEntries: true,
            hourEntries: true,
            invoiceItems: true,
          },
        },
      },
    }),
    getConstructionManagerOptions(),
  ]);

  const mappedProjects = projects.map((project) => {
    const latestReport = project.performanceReports[0] ?? null;
    const detailCostCents =
      latestReport?.detailEntries.reduce(
        (sum, entry) => sum + entry.amountCents,
        0
      ) ?? 0;
    const hourCostCents =
      latestReport?.hourEntries.reduce(
        (sum, entry) => sum + entry.realCostCents,
        0
      ) ?? 0;
    const invoiceRevenueCents =
      latestReport?.invoiceItems.reduce(
        (sum, item) => sum + item.revenueCents,
        0
      ) ?? 0;
    const reportContractCents =
      (latestReport?.contractValueNetCents ?? 0) +
      (latestReport?.changeOrdersNetCents ?? 0);
    const performanceValueCents = Math.round(
      reportContractCents * ((latestReport?.progressPercent ?? 0) / 100)
    );
    const actualCostsCents = detailCostCents + hourCostCents;
    const resultBaseCents = Math.max(performanceValueCents, invoiceRevenueCents);
    const resultCents = resultBaseCents - actualCostsCents;

    const totalContract = project.contractValueNet + project.changeOrdersNet;
    const billingPercent =
      totalContract > 0 ? (project.paymentsNet / totalContract) * 100 : 0;
    const constructionManagers = parseConstructionManagersJson(
      project.constructionManagersJson,
    );

    return {
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      client: project.client ?? "",
      constructionManagerDisplay: project.constructionManager ?? "",
      constructionManagers,
      billingPercent,
      plannedStart: project.plannedStart?.toISOString().slice(0, 10) ?? "",
      plannedEnd: project.plannedEnd?.toISOString().slice(0, 10) ?? "",
      actualStart: project.actualStart?.toISOString().slice(0, 10) ?? "",
      actualEnd: project.actualEnd?.toISOString().slice(0, 10) ?? "",
      remainingConstructionTime: project.remainingConstructionTime ?? "",
      status: project.status,
      dvgw: project.dvgw,
      guetezeichenKanalbau: project.guetezeichenKanalbau,
      lieferscheine: project.lieferscheine,
      contractValueNet: project.contractValueNet,
      changeOrdersNet: project.changeOrdersNet,
      progressPercent: project.progressPercent,
      paymentsNet: project.paymentsNet,
      finalInvoiceCreated: project.finalInvoiceCreated,
      finalInvoiceNumber: project.finalInvoiceNumber ?? "",
      finalInvoiceNet: project.finalInvoiceNet ?? 0,
      notes: project.notes ?? "",
      autoApproveTimeEntriesOverride: (project.autoApproveTimeEntriesOverride === true
        ? "on"
        : project.autoApproveTimeEntriesOverride === false
          ? "off"
          : "inherit") as "inherit" | "on" | "off",
      timeReminderExtraRecipients: parseRecipientsJson(project.timeReminderExtraRecipientsJson).join(", "),
      timeReminderIntervalWeeks: project.timeReminderIntervalWeeks ?? 1,
      timeReminderMode: (project.timeReminderEnabledOverride === true
        ? "custom"
        : project.timeReminderEnabledOverride === false
          ? "off"
          : "inherit") as "inherit" | "custom" | "off",
      timeReminderWeekdays: parseWeekdaysJson(project.timeReminderWeekdaysJson),
      controllingSummary: latestReport
        ? {
            actualCostsNet: actualCostsCents / 100,
            detailCostsNet: detailCostCents / 100,
            hourCostsNet: hourCostCents / 100,
            invoiceRevenueNet: invoiceRevenueCents / 100,
            periodEnd:
              latestReport.periodEnd?.toISOString().slice(0, 10) ??
              latestReport.reportDate.toISOString().slice(0, 10),
            periodStart:
              latestReport.periodStart?.toISOString().slice(0, 10) ??
              latestReport.reportDate.toISOString().slice(0, 10),
            performanceValueNet: performanceValueCents / 100,
            progressPercent: latestReport.progressPercent,
            reportId: latestReport.id,
            resultNet: resultCents / 100,
            resultPercent:
              resultBaseCents > 0 ? (resultCents / resultBaseCents) * 100 : 0,
            status: latestReport.status,
            title: latestReport.title ?? "Leistungsmeldung",
          }
        : null,
    };
  });

  const normalizedSearchQuery = normalizeProjectSearchText(searchQuery);
  const filteredProjects = mappedProjects
    .filter((project) => {
      if (!normalizedSearchQuery) return true;
      return normalizeProjectSearchText(
        `${project.projectNumber} ${project.name}`,
      ).includes(normalizedSearchQuery);
    })
    .filter((project) => {
      if (!constructionManagerFilter) return true;
      return project.constructionManagers.some(
        (manager) => manager.name === constructionManagerFilter,
      );
    })
    .filter((project) => {
      if (!dvgwFilter) return true;
      return project.dvgw === (dvgwFilter === "ja");
    })
    .filter((project) => {
      if (!guetezeichenKanalbauFilter) return true;
      return project.guetezeichenKanalbau === (guetezeichenKanalbauFilter === "ja");
    })
    .filter((project) => {
      if (!lieferscheineFilter) return true;
      return project.lieferscheine === (lieferscheineFilter === "ja");
    })
    .filter((project) => {
      if (!progressOperator || progressValue === null) return true;
      return progressOperator === "gt"
        ? project.progressPercent > progressValue
        : project.progressPercent < progressValue;
    })
    .filter((project) => {
      if (!billingOperator || billingValue === null) return true;
      return billingOperator === "gt"
        ? project.billingPercent > billingValue
        : project.billingPercent < billingValue;
    });

  const activeFilterCount =
    Number(Boolean(searchQuery)) +
    Number(Boolean(constructionManagerFilter)) +
    Number(Boolean(dvgwFilter)) +
    Number(Boolean(guetezeichenKanalbauFilter)) +
    Number(Boolean(lieferscheineFilter)) +
    Number(Boolean(progressOperator) && progressValue !== null) +
    Number(Boolean(billingOperator) && billingValue !== null);

  return (
    <AppShell
      title="Projekte · Leistung"
      description="Schneller Bauleiter-Stand für Sitzungen. Das belastbare Ergebnis bleibt in Controlling > Leistungsmeldung."
    >
      <ProjectNavigation active="performance" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/projects"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projektübersicht
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-gray-700">
            {filteredProjects.length}/{mappedProjects.length} Projekte sichtbar
          </div>

          <DismissibleDetails className="relative inline-block">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
              🔎 Filter
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>

            <div className="absolute right-0 top-full z-[var(--z-modal)] mt-2 max-h-[70vh] w-[92vw] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
              <div className="text-sm font-bold text-gray-900">
                Projekte filtern
              </div>

              <form action="/projects/performance" className="mt-4 grid gap-3">
                <label className="grid gap-1 text-xs font-semibold text-gray-800">
                  Suche
                  <input
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Projektnummer oder Name"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                  />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-gray-800">
                  Bauleiter
                  <select
                    name="constructionManager"
                    defaultValue={constructionManagerFilter}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                  >
                    <option value="">Alle</option>
                    {constructionManagerOptions.map((option) => (
                      <option key={option.employeeId} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    DVGW
                    <select
                      name="dvgw"
                      defaultValue={dvgwFilter}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="">Alle</option>
                      <option value="ja">Ja</option>
                      <option value="nein">Nein</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Gütezeichen
                    <select
                      name="guetezeichenKanalbau"
                      defaultValue={guetezeichenKanalbauFilter}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="">Alle</option>
                      <option value="ja">Ja</option>
                      <option value="nein">Nein</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Lieferscheine
                    <select
                      name="lieferscheine"
                      defaultValue={lieferscheineFilter}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="">Alle</option>
                      <option value="ja">Ja</option>
                      <option value="nein">Nein</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-end gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Leistungsstand
                    <select
                      name="progressOperator"
                      defaultValue={progressOperator}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="">Alle</option>
                      <option value="gt">größer als</option>
                      <option value="lt">kleiner als</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    %
                    <input
                      name="progressValue"
                      defaultValue={params.progressValue ?? ""}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="z. B. 50"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-[auto_1fr] items-end gap-2">
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    Abrechnungsstand
                    <select
                      name="billingOperator"
                      defaultValue={billingOperator}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    >
                      <option value="">Alle</option>
                      <option value="gt">größer als</option>
                      <option value="lt">kleiner als</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-gray-800">
                    %
                    <input
                      name="billingValue"
                      defaultValue={params.billingValue ?? ""}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="z. B. 50"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Filter anwenden
                  </button>

                  <Link
                    href="/projects/performance"
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Zurücksetzen
                  </Link>
                </div>
              </form>
            </div>
          </DismissibleDetails>

          {activeFilterCount > 0 ? (
            <Link
              href="/projects/performance"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Zurücksetzen
            </Link>
          ) : null}
        </div>
      </div>

      <ProjectManager
        constructionManagerOptions={constructionManagerOptions}
        projects={filteredProjects}
      />
    </AppShell>
  );
}
