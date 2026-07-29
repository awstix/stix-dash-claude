import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import {
  dashboardWidgets,
  defaultDashboardWidgetKeys,
} from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";
import { DashboardGrid } from "./DashboardGrid";

export default async function DashboardPage() {
  const session = await requireSession();
  const [
    activeProjectCount,
    inventoryLocationAlertCount,
    qualifications,
    widgetPreferences,
    currentUser,
  ] =
    await Promise.all([
    prisma.project.count({
      where: {
        status: "ACTIVE",
      },
    }),
    prisma.inventoryLocationAlert.count({
      where: {
        status: "OPEN",
      },
    }),
    prisma.employeeQualification.findMany({
      where: {
        employee: {
          statusValue: "active",
        },
        qualificationType: {
          isActive: true,
        },
      },
      include: {
        employee: true,
        qualificationType: true,
      },
      orderBy: [
        {
          employee: {
            lastName: "asc",
          },
        },
        {
          qualificationType: {
            sortOrder: "asc",
          },
        },
      ],
    }),
    prisma.dashboardWidgetPreference.findMany({
      orderBy: { sortOrder: "asc" },
      where: { userId: session.user.id, isVisible: true },
    }),
    prisma.user.findUnique({
      include: { featureAccesses: { where: { canView: true } } },
      where: { id: session.user.id },
    }),
  ]);
  const admin = String(currentUser?.role ?? "").split(",").includes("admin");
  const availableWidgets = admin
    ? [...dashboardWidgets]
    : dashboardWidgets.filter((widget) =>
        currentUser?.featureAccesses.some((access) => access.featureKey === widget.key),
      );
  const availableKeySet = new Set(availableWidgets.map((widget) => widget.key));
  const selectedWidgetKeys =
    widgetPreferences.length > 0
      ? widgetPreferences.map((preference) => preference.widgetKey).filter((key) => availableKeySet.has(key as never))
      : [...defaultDashboardWidgetKeys].filter((key) => availableKeySet.has(key as never));
  const selectedKeySet = new Set(selectedWidgetKeys);
  const pinnedWidgets = selectedWidgetKeys
    .map((key) => availableWidgets.find((widget) => widget.key === key))
    .filter((widget): widget is (typeof dashboardWidgets)[number] => Boolean(widget));
  const dashboardValues: Record<string, string> = {
    projects: `${activeProjectCount}`,
    inventory: `${inventoryLocationAlertCount} Meldungen`,
  };
  const dashboardTiles = pinnedWidgets.map((widget) => {
    const preference = widgetPreferences.find(
      (entry) => entry.widgetKey === widget.key,
    );
    return {
      ...widget,
      height: preference?.height ?? 2,
      value: dashboardValues[widget.key],
      width: preference?.width ?? 2,
    };
  });
  const dueQualifications = qualifications
    .map((qualification) => {
      const dueDate = qualification.lastReviewedAt
        ? addMonths(
            qualification.lastReviewedAt,
            qualification.qualificationType.reviewIntervalMonths,
          )
        : null;
      const daysUntilDue = dueDate ? differenceInDays(new Date(), dueDate) : null;

      if (daysUntilDue !== null && daysUntilDue > 30) {
        return null;
      }

      return {
        dueDate,
        employeeName: `${qualification.employee.lastName}, ${qualification.employee.firstName}`,
        qualificationName: qualification.qualificationType.name,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const overdueCount = dueQualifications.filter(
    (entry) => !entry.dueDate || entry.dueDate < startOfToday(),
  ).length;

  return (
    <AppShell
      title="Dashboard"
      description="Rollenbasierte Übersicht über Projekte, Dispositionen und offene Aufgaben."
    >
      <DashboardGrid available={availableWidgets} initial={dashboardTiles} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <InfoCard title="Aktive Projekte" value={`${activeProjectCount}`} />
        <Link
          className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm hover:bg-orange-50"
          href="/inventory/location-alerts"
        >
          <p className="text-sm text-gray-500">Inventar Standortmeldungen</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">
            {inventoryLocationAlertCount}
          </p>
        </Link>
        <InfoCard title="Asphalt morgen" value="0 t" />
        <InfoCard title="Bestellung Status" value="Entwurf" />
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Führerschein- und Berechtigungsprüfungen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Ungeprüfte, überfällige und innerhalb der nächsten 30 Tage
              fällige Berechtigungen.
            </p>
          </div>
          <Link
            className="w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            href="/admin/employee-qualifications"
          >
            Berechtigungen pflegen
          </Link>
        </div>

        {dueQualifications.length === 0 ? (
          <p className="p-6 text-sm font-medium text-emerald-700">
            Aktuell sind keine Prüfungen fällig.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 bg-gray-50 p-4 sm:grid-cols-2">
            <InfoCard
              title="Überfällig oder ungeprüft"
              value={`${overdueCount}`}
            />
            <InfoCard
              title="Insgesamt bis 30 Tage"
              value={`${dueQualifications.length}`}
            />
          </div>
        )}
      </section>
    </AppShell>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function differenceInDays(from: Date, to: Date) {
  return Math.ceil(
    (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function startOfToday() {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  return result;
}
