import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { parseConstructionManagersJson } from "@/lib/construction-managers";
import { parseRecipientsJson, parseWeekdaysJson } from "@/lib/time-tracking-reminder";
import { ProjectNavigation } from "../ProjectNavigation";
import { ProjectManager } from "../ProjectManager";
import { denyRoleUnlessAdmin } from "@/lib/auth-access";

export default async function ProjectPerformancePage() {
  await denyRoleUnlessAdmin("foreman");
  const [projects, constructionManagerEmployees] = await Promise.all([
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
    prisma.employee.findMany({
      include: {
        positions: {
          orderBy: [{ sortOrder: "asc" }, { positionLabel: "asc" }],
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      where: {
        statusValue: "active",
      },
    }),
  ]);
  const constructionManagerOptions = constructionManagerEmployees
    .flatMap((employee) => {
      const positionsLabel = employee.positions
        .map((position) => position.positionLabel)
        .join(", ");
      const searchablePositionText = employee.positions
        .map((position) => `${position.positionLabel} ${position.positionValue}`)
        .join(" ")
        .toLowerCase();
      const isConstructionManager =
        searchablePositionText.includes("bauleit");

      if (!isConstructionManager) {
        return [];
      }

      return [{
        employeeId: employee.id,
        label: `${employee.firstName} ${employee.lastName}`,
        positionsLabel,
        value: `${employee.firstName} ${employee.lastName}`,
      }];
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));

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

    return {
      id: project.id,
      projectNumber: project.projectNumber,
      name: project.name,
      constructionManagerDisplay: project.constructionManager ?? "",
      constructionManagers: parseConstructionManagersJson(project.constructionManagersJson),
      plannedStart: project.plannedStart?.toISOString().slice(0, 10) ?? "",
      plannedEnd: project.plannedEnd?.toISOString().slice(0, 10) ?? "",
      actualStart: project.actualStart?.toISOString().slice(0, 10) ?? "",
      actualEnd: project.actualEnd?.toISOString().slice(0, 10) ?? "",
      status: project.status,
      contractValueNet: project.contractValueNet,
      changeOrdersNet: project.changeOrdersNet,
      progressPercent: project.progressPercent,
      paymentsNet: project.paymentsNet,
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

  return (
    <AppShell
      title="Projekte · Leistung"
      description="Schneller Bauleiter-Stand für Sitzungen. Das belastbare Ergebnis bleibt in Controlling > Leistungsmeldung."
    >
      <ProjectNavigation active="performance" />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/projects"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projektübersicht
        </Link>
      </div>

      <ProjectManager
        constructionManagerOptions={constructionManagerOptions}
        projects={mappedProjects}
      />
    </AppShell>
  );
}
