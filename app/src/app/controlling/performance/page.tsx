import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  addControllingDetailEntry,
  addControllingHourEntry,
  addControllingInvoiceItem,
  createPerformanceReport,
  deleteControllingDetailEntry,
  deleteControllingHourEntry,
  deleteControllingInvoiceItem,
  deletePerformanceReport,
  importDetailEntriesFromExcel,
  importDispositionIntoPerformanceReport,
  importItwoInvoiceItems,
  updatePerformanceReport,
} from "./actions";
import { ControllingHourForm } from "./ControllingHourForm";
import { DetailEntryForm } from "./DetailEntryForm";
import { ProjectPerformanceSidebar } from "./ProjectPerformanceSidebar";

const reportStatuses = [
  { label: "Entwurf", value: "DRAFT" },
  { label: "Laufend", value: "laufend" },
  { label: "Abrechnungsreif", value: "abrechnungsreif" },
  { label: "Fertig", value: "fertig" },
  { label: "Kritisch", value: "kritisch" },
];

type HourSelectionOption = {
  costCategory: string;
  internalRate: string;
  id: string;
  label: string;
  realRate: string;
};

type CostAnalysisRow = {
  actualCents: number;
  budgetCents: number;
  deltaCents: number;
  deltaPercent: number;
  label: string;
};

type AnalysisTone = "good" | "bad" | "warn" | "neutral";

export default async function ControllingPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{
    notice?: string;
    noticeType?: string;
    projectId?: string;
    reportId?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const requestedReport = params.reportId
    ? await prisma.controllingPerformanceReport.findUnique({
        where: {
          id: params.reportId,
        },
        select: {
          id: true,
          projectId: true,
        },
      })
    : null;

  const projects = await prisma.project.findMany({
    orderBy: [
      {
        projectNumber: "desc",
      },
    ],
    include: {
      performanceReports: {
        orderBy: {
          periodEnd: "desc",
        },
      },
    },
  });

  // projects ist absteigend nach projectNumber (String) sortiert - "9xxxxx"
  // (Sonstige/Rest-Projekte) sortieren dadurch lexikografisch vor jedem
  // echten Jahres-Projekt. Ohne explizite Auswahl soll trotzdem das
  // neueste echte Projekt vorausgewählt sein, nicht das erstbeste
  // Rest-Projekt.
  const defaultProject =
    projects.find((project) => !project.projectNumber.startsWith("9")) ??
    projects[0] ??
    null;
  const selectedProjectId =
    requestedReport?.projectId ?? params.projectId ?? defaultProject?.id ?? null;
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? defaultProject;
  const nextPeriodStart = getNextPeriodStart(selectedProject?.performanceReports ?? []);
  const nextPeriodEnd = getNextPeriodEnd(nextPeriodStart);
  const rateSets = await prisma.controllingRateSet.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      year: "desc",
    },
  });
  const suggestedNewRateYear = nextPeriodEnd.getFullYear();
  const suggestedNewRateSet = rateSets.find((rateSet) => rateSet.year === suggestedNewRateYear);
  const selectedReportId =
    requestedReport?.id ?? selectedProject?.performanceReports[0]?.id ?? null;

  const report = selectedReportId
    ? await prisma.controllingPerformanceReport.findUnique({
        where: {
          id: selectedReportId,
        },
        include: {
          detailEntries: {
            orderBy: {
              entryDate: "desc",
            },
          },
          hourEntries: {
            orderBy: {
              entryDate: "desc",
            },
          },
          invoiceItems: {
            orderBy: {
              createdAt: "desc",
            },
          },
          project: true,
        },
      })
    : null;
  const suggestedRateYear =
    (report?.periodEnd ?? report?.reportDate ?? nextPeriodEnd).getFullYear();
  const suggestedRateSet = rateSets.find((rateSet) => rateSet.year === suggestedRateYear);
  const activeRateSet =
    (report?.rateSetId
      ? rateSets.find((rateSet) => rateSet.id === report.rateSetId)
      : null) ??
    suggestedRateSet ??
    null;
  const activeRateYear = activeRateSet?.year ?? suggestedRateYear;

  const employeeGroupRates = await prisma.controllingEmployeeGroupRate.findMany({
    where: activeRateSet
      ? {
          rateSetId: activeRateSet.id,
        }
      : {
          id: "__missing-rate-set__",
        },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
    take: 20,
  });
  const [
    inventoryItemRatesForQuickEntry,
    inventoryCategoryRatesForQuickEntry,
    inventoryItemsForQuickEntry,
  ] = await Promise.all([
    activeRateSet
      ? prisma.controllingInventoryItemRate.findMany({
          where: { rateSetId: activeRateSet.id },
          select: { itemId: true, billingRateCents: true },
        })
      : Promise.resolve([]),
    activeRateSet
      ? prisma.controllingInventoryCategoryRate.findMany({
          where: { rateSetId: activeRateSet.id },
          select: { categoryId: true, billingRateCents: true },
        })
      : Promise.resolve([]),
    prisma.inventoryItem.findMany({
      where: {
        status: { not: "INACTIVE" },
      },
      select: {
        id: true,
        name: true,
        objectNumber: true,
        categoryId: true,
        category: {
          select: {
            name: true,
            billingRateCents: true,
          },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const itemRateById = new Map(
    inventoryItemRatesForQuickEntry.map((rate) => [rate.itemId, rate.billingRateCents]),
  );
  const categoryRateById = new Map(
    inventoryCategoryRatesForQuickEntry.map((rate) => [rate.categoryId, rate.billingRateCents]),
  );

  // Für die Geräte/Material-Schnellerfassung: das komplette aktive
  // Inventar anbieten (Material hat z.B. i.d.R. keinen hinterlegten
  // Verrechnungssatz, muss aber trotzdem wählbar sein) - der Satz wird
  // nur als Vorschlag übernommen, wo einer existiert (Objekt-Satz >
  // Kategorie-Satz aus dem aktiven Satzstand > Kategorie-Standardsatz),
  // sonst bleibt EP netto € leer und wird manuell eingetragen.
  const equipmentQuickEntryOptions = inventoryItemsForQuickEntry.map((item) => {
    const rateCents =
      (item.categoryId ? itemRateById.get(item.id) : null) ??
      (item.categoryId ? categoryRateById.get(item.categoryId) : null) ??
      item.category?.billingRateCents ??
      null;

    return {
      id: item.id,
      category: item.category?.name ?? "Ohne Kategorie",
      label: [item.objectNumber, item.name].filter(Boolean).join(" · "),
      unitPrice: rateCents && rateCents > 0 ? formatRawMoney(rateCents) : "",
    };
  });

  const [crewsForHours, employeesForHours] = await Promise.all([
    prisma.crew.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
      select: {
        members: {
          where: {
            isActive: true,
          },
          select: {
            employee: {
              select: {
                isLeadership: true,
                positions: {
                  select: {
                    positionLabel: true,
                  },
                },
              },
            },
          },
        },
        id: true,
        name: true,
        typeLabel: true,
      },
    }),
    prisma.employee.findMany({
      where: {
        statusValue: {
          not: "ausgeschieden",
        },
      },
      orderBy: [
        {
          lastName: "asc",
        },
        {
          firstName: "asc",
        },
      ],
      select: {
        firstName: true,
        id: true,
        isLeadership: true,
        lastName: true,
        positions: {
          select: {
            positionLabel: true,
          },
        },
      },
    }),
  ]);
  const employeeRateByGroup = new Map(
    employeeGroupRates.map((rate) => [rate.name, rate]),
  );
  const crewHourOptions = crewsForHours.map((crew) => {
    const memberRates = crew.members
      .map((member) => getEmployeeHourRate(member.employee, employeeRateByGroup))
      .filter((rate) => rate.realRateCents > 0 || rate.internalRateCents > 0);
    const realRateCents = averageRate(memberRates.map((rate) => rate.realRateCents));
    const internalRateCents = averageRate(memberRates.map((rate) => rate.internalRateCents));

    return {
      costCategory: majorityCostCategory(memberRates.map((rate) => rate.costCategory)),
      id: crew.id,
      internalRate: formatRawMoney(internalRateCents),
      label: crew.typeLabel ? `${crew.name} · ${crew.typeLabel}` : crew.name,
      realRate: formatRawMoney(realRateCents),
    };
  });
  const employeeHourOptions = employeesForHours.map((employee) => {
    const rate = getEmployeeHourRate(employee, employeeRateByGroup);

    return {
      costCategory: rate.costCategory,
      id: employee.id,
      internalRate: formatRawMoney(rate.internalRateCents),
      label: `${employee.lastName}, ${employee.firstName}`,
      realRate: formatRawMoney(rate.realRateCents),
    };
  });

  const activeProjectId = report?.projectId ?? selectedProject?.id ?? null;
  const detailCostCents =
    report?.detailEntries.reduce((sum, entry) => sum + entry.amountCents, 0) ?? 0;
  const hourRealCostCents =
    report?.hourEntries.reduce((sum, entry) => sum + entry.realCostCents, 0) ?? 0;
  const hourInternalCostCents =
    report?.hourEntries.reduce((sum, entry) => sum + entry.internalCostCents, 0) ?? 0;
  const invoiceRevenueCents =
    report?.invoiceItems.reduce((sum, entry) => sum + entry.revenueCents, 0) ?? 0;
  const invoiceCostCents =
    report?.invoiceItems.reduce((sum, entry) => sum + entry.costCents, 0) ?? 0;
  const currentProjectForValues = report?.project ?? selectedProject;
  // Math.round guards against binary floating-point drift now that these
  // are real Float euro values (e.g. 6765.91), not whole-euro ints.
  const contractValueNetCents = Math.round(
    (currentProjectForValues?.contractValueNet ?? 0) * 100,
  );
  const changeOrdersNetCents = Math.round(
    (currentProjectForValues?.changeOrdersNet ?? 0) * 100,
  );
  const paymentsNetCents = Math.round((currentProjectForValues?.paymentsNet ?? 0) * 100);
  const totalContractCents =
    contractValueNetCents + changeOrdersNetCents;
  const performanceValueCents = Math.round(
    totalContractCents * ((report?.progressPercent ?? selectedProject?.progressPercent ?? 0) / 100),
  );
  const actualCostCents = detailCostCents + hourRealCostCents;
  const resultBaseCents = Math.max(performanceValueCents, invoiceRevenueCents);
  const forecastCents = resultBaseCents - actualCostCents;
  const openWipCents = Math.max(0, performanceValueCents - invoiceRevenueCents);
  // Gehalt/Sonstiges-Stunden fließen bewusst nicht in die Stunden-Bilanz
  // ein - die sind bereits über die Kosten in der Zeile "Sonstiges"
  // verrechnet, würden hier also doppelt gezählt.
  const actualHours = report?.hourEntries.reduce(
    (sum, entry) =>
      entry.costCategory === "GEHALT_SONSTIGES" ? sum : sum + entry.totalHours,
    0,
  ) ?? 0;
  const hasGehaltHours =
    report?.hourEntries.some((entry) => entry.costCategory === "GEHALT_SONSTIGES") ??
    false;
  const billedHours = report?.invoiceItems.reduce(
    (sum, entry) => sum + entry.billedHours,
    0,
  ) ?? 0;
  const costAnalysisRows = report
    ? buildCostAnalysisRows({
        detailEntries: report.detailEntries,
        hourEntries: report.hourEntries,
        invoiceItems: report.invoiceItems,
      })
    : [];

  return (
    <AppShell
      description="Projektbezogene Leistungsmeldungen, Schnellcheck, Detailerfassung, Stunden und Rechnungsmengen."
      title="Controlling · Leistungsmeldung"
    >
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ProjectPerformanceSidebar
            activeProjectId={activeProjectId}
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              performanceReportCount: project.performanceReports.length,
              projectNumber: project.projectNumber,
            }))}
          />

          {selectedProject ? (
            <>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-950">Neue Leistungsmeldung</h2>
              <form action={createPerformanceReport} className="mt-4 space-y-3">
                  <input name="projectId" type="hidden" value={selectedProject.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Zeitraum von
                    <input
                      className={inputClassName}
                      defaultValue={formatInputDate(nextPeriodStart)}
                      name="periodStart"
                      type="date"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-gray-700">
                    Zeitraum bis
                    <input
                      className={inputClassName}
                      defaultValue={formatInputDate(nextPeriodEnd)}
                      name="periodEnd"
                      type="date"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-gray-700">
                  Verrechnungssatz-Satzstand
                  <select
                    className={inputClassName}
                    defaultValue={suggestedNewRateSet?.id ?? ""}
                    name="rateSetId"
                  >
                    <option value="">
                      Vorschlag nach Zeitraum ({suggestedNewRateYear}) verwenden
                    </option>
                    {rateSets.map((rateSet) => (
                      <option key={rateSet.id} value={rateSet.id}>
                        {rateSet.name} ({rateSet.year})
                        {rateSet.id === suggestedNewRateSet?.id ? " · vorgeschlagen" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-gray-700">
                  Titel / Thema
                  <input
                    className={inputClassName}
                    name="title"
                    placeholder="z. B. Juli Abschlag / Asphalt"
                    type="text"
                  />
                </label>
                <button className={primaryButtonClassName} type="submit">
                  Leistungsmeldung anlegen
                </button>
              </form>
            </section>
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-950">
                Leistungsmeldungen verwalten
              </h2>
              <div className="mt-4 space-y-2">
                {selectedProject.performanceReports.length ? (
                  selectedProject.performanceReports.map((performanceReport) => {
                    const active = performanceReport.id === report?.id;

                    return (
                      <Link
                        className={`block rounded-xl border px-3 py-3 text-sm ${
                          active
                            ? "border-blue-300 bg-blue-50 text-blue-950"
                            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                        }`}
                        href={`/controlling/performance?projectId=${selectedProject.id}&reportId=${performanceReport.id}`}
                        key={performanceReport.id}
                        scroll={false}
                      >
                        <span className="block font-semibold">
                          {performanceReport.title || "Leistungsmeldung"}
                        </span>
                        <span className="text-gray-500">
                          {formatDate(performanceReport.periodStart ?? performanceReport.reportDate)} –{" "}
                          {formatDate(performanceReport.periodEnd ?? performanceReport.reportDate)} ·{" "}
                          {getReportStatusLabel(performanceReport.status)}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">Noch keine Leistungsmeldung angelegt.</p>
                )}
              </div>
            </section>
            </>
          ) : null}
        </aside>

        <div className="space-y-6">
          {params.notice ? (
            <section
              className={`rounded-2xl border p-4 text-sm font-semibold shadow-sm ${
                params.noticeType === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-green-200 bg-green-50 text-green-800"
              }`}
            >
              {params.notice}
            </section>
          ) : null}

          {!selectedProject ? (
            <EmptyState text="Noch kein Projekt vorhanden. Sobald Projekte angelegt sind, können hier Leistungsmeldungen erstellt werden." />
          ) : null}

          {selectedProject && !report ? (
            <EmptyState text="Für dieses Projekt gibt es noch keine Leistungsmeldung. Lege links die erste Meldung mit Zeitraum von/bis an." />
          ) : null}

          {report ? (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
                      Schnellcheck
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-gray-950">
                      {report.project.projectNumber} · {report.project.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Zeitraum {formatDate(report.periodStart ?? report.reportDate)} –{" "}
                      {formatDate(report.periodEnd ?? report.reportDate)} · Status{" "}
                      {getReportStatusLabel(report.status)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      href={`/controlling/performance/export?reportId=${report.id}&format=xlsx`}
                    >
                      Excel exportieren
                    </Link>
                    <Link
                      className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                      href={`/controlling/performance/export?reportId=${report.id}&format=pdf`}
                    >
                      PDF exportieren
                    </Link>
                    <form action={deletePerformanceReport}>
                      <input name="reportId" type="hidden" value={report.id} />
                      <input name="projectId" type="hidden" value={report.projectId} />
                      <button
                        className="inline-flex rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                        type="submit"
                      >
                        Löschen
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  <MetricCard
                    dark
                    label="Ergebnis aktuell"
                    value={formatMoney(forecastCents)}
                    detail={
                      invoiceRevenueCents > performanceValueCents
                        ? "Basis: abgerechneter Umsatz"
                        : "Basis: Leistungsstand"
                    }
                  />
                  <MetricCard label="Gesamtauftrag" value={formatMoney(totalContractCents)} />
                  <MetricCard
                    label="Leistungsstand"
                    value={`${formatDecimal(report.progressPercent, 1)} %`}
                    detail={formatMoney(performanceValueCents)}
                  />
                  <MetricCard
                    label="Bisher abgerechnet"
                    value={formatMoney(invoiceRevenueCents)}
                    detail={`WIP offen ${formatMoney(openWipCents)}`}
                  />
                  <MetricCard
                    label="Istkosten erfasst"
                    value={formatMoney(actualCostCents)}
                    detail={`Lohn ${formatMoney(hourRealCostCents)} · Details ${formatMoney(detailCostCents)}`}
                  />
                  <MetricCard
                    label="iTWO Budget/Kalkulation"
                    value={formatMoney(invoiceCostCents)}
                    detail="aus Rechnungsmengen, nicht als Istkosten gezählt"
                  />
                </div>
                <div
                  className={`mt-5 rounded-2xl border p-4 text-sm ${
                    activeRateSet
                      ? "border-blue-100 bg-blue-50 text-blue-950"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {activeRateSet ? (
                    <>
                      <span className="font-bold">Verwendeter Satzstand:</span>{" "}
                      {activeRateSet.name} ({activeRateSet.year})
                      {suggestedRateSet && suggestedRateSet.id !== activeRateSet.id
                        ? ` · manuell gewählt, Vorschlag wäre ${suggestedRateSet.name} (${suggestedRateSet.year})`
                        : " · Vorschlag nach Zeitraum"}
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Satzstand fehlt:</span> Für{" "}
                      {activeRateYear} ist noch kein Satzstand angelegt. Bitte unter{" "}
                      <Link className="underline" href="/controlling/rates">
                        Controlling &gt; Verrechnungssätze
                      </Link>{" "}
                      zuerst den passenden Satzstand erstellen.
                    </>
                  )}
                </div>
                <form action={importDispositionIntoPerformanceReport} className="mt-5">
                  <input name="reportId" type="hidden" value={report.id} />
                  <input name="projectId" type="hidden" value={report.projectId} />
                  <fieldset className="flex flex-wrap gap-4 text-xs font-semibold text-gray-700">
                    <legend className="mb-1.5 w-full text-xs font-bold text-gray-900">
                      Personalstunden aus:
                    </legend>
                    <label className="flex items-center gap-1.5">
                      <input defaultChecked name="hourSource" type="radio" value="planned" />
                      Geplante Dispo-Stunden (Personaleinsatzplanung)
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input name="hourSource" type="radio" value="actual" />
                      Tatsächlich gebuchte Stunden (freigegebene Zeiterfassung)
                    </label>
                  </fieldset>
                  <button
                    className={`mt-3 inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold ${
                      activeRateSet
                        ? "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                        : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                    }`}
                    disabled={!activeRateSet}
                    type="submit"
                  >
                    Stunden, Material und Geräte aus Planung/Disposition übernehmen
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    Ersetzt nur automatisch übernommene Controlling-Zeilen für diesen Zeitraum.
                    Manuelle Einträge bleiben erhalten. Material und Geräte kommen unabhängig von der
                    Auswahl oben weiterhin aus der Disposition.
                  </p>
                </form>
              </section>

              <section
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                key={`report-data-${report.id}`}
              >
                <h2 className="text-lg font-semibold text-gray-950">
                  Leistungsmeldungsdaten
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Zeitraum, Status und Basiswerte dieser Leistungsmeldung. Die Projektstammdaten
                  bleiben unverändert.
                </p>
                <form action={updatePerformanceReport} className="mt-4 grid gap-3 lg:grid-cols-6">
                  <input name="reportId" type="hidden" value={report.id} />
                  <input name="projectId" type="hidden" value={report.projectId} />
                  <Field label="Zeitraum von">
                    <input
                      className={inputClassName}
                      defaultValue={formatInputDate(report.periodStart ?? report.reportDate)}
                      name="periodStart"
                      type="date"
                    />
                  </Field>
                  <Field label="Zeitraum bis">
                    <input
                      className={inputClassName}
                      defaultValue={formatInputDate(report.periodEnd ?? report.reportDate)}
                      name="periodEnd"
                      type="date"
                    />
                  </Field>
                  <Field className="lg:col-span-2" label="Titel / Thema">
                    <input
                      className={inputClassName}
                      defaultValue={report.title ?? ""}
                      name="title"
                    />
                  </Field>
                  <Field label="Status">
                    <select className={inputClassName} defaultValue={report.status} name="status">
                      {reportStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field className="lg:col-span-2" label="Verrechnungssatz-Satzstand">
                    <select
                      className={inputClassName}
                      defaultValue={activeRateSet?.id ?? ""}
                      name="rateSetId"
                    >
                      <option value="">
                        Vorschlag nach Zeitraum ({suggestedRateYear}) verwenden
                      </option>
                      {rateSets.map((rateSet) => (
                        <option key={rateSet.id} value={rateSet.id}>
                          {rateSet.name} ({rateSet.year})
                          {rateSet.id === suggestedRateSet?.id ? " · vorgeschlagen" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Hauptauftrag netto">
                    <input
                      className={inputClassName}
                      defaultValue={formatRawMoney(contractValueNetCents)}
                      name="contractValueNet"
                    />
                  </Field>
                  <Field label="Nachträge netto">
                    <input
                      className={inputClassName}
                      defaultValue={formatRawMoney(changeOrdersNetCents)}
                      name="changeOrdersNet"
                    />
                  </Field>
                  <Field label="Leistungsstand %">
                    <input
                      className={inputClassName}
                      defaultValue={report.progressPercent}
                      name="progressPercent"
                    />
                  </Field>
                  <Field label="Zahlungen netto">
                    <input
                      className={inputClassName}
                      defaultValue={formatRawMoney(paymentsNetCents)}
                      name="paymentsNet"
                    />
                  </Field>
                  <Field className="lg:col-span-4" label="Kurznotiz">
                    <input className={inputClassName} defaultValue={report.note ?? ""} name="note" />
                  </Field>
                  <div className="lg:col-span-6">
                    <button className={primaryButtonClassName} type="submit">
                      Leistungsmeldungsdaten speichern
                    </button>
                  </div>
                </form>
              </section>

              <EntrySection
                action={addControllingDetailEntry}
                equipmentOptions={equipmentQuickEntryOptions}
                hourEntryOptions={report.hourEntries.map((entry) => ({
                  id: entry.id,
                  label: `${formatDate(entry.entryDate)} · ${entry.label} · ${formatDecimal(entry.totalHours)} h`,
                  totalHours: formatDecimal(entry.totalHours),
                }))}
                importAction={importDetailEntriesFromExcel}
                projectId={report.projectId}
                reportId={report.id}
                title="Detailerfassung"
              />
              <HourSection
                action={addControllingHourEntry}
                crewOptions={crewHourOptions}
                employeeOptions={employeeHourOptions}
                projectId={report.projectId}
                reportId={report.id}
              />

              <InvoiceSection
                action={addControllingInvoiceItem}
                importAction={importItwoInvoiceItems}
                projectId={report.projectId}
                reportId={report.id}
              />

              <details className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-950">
                        Erfasste Positionen
                      </h2>
                      <p className="mt-1 text-sm text-gray-600">
                        Detailpositionen, Stunden und Rechnungsmengen dieser Leistungsmeldung.
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-950 transition-transform group-open:rotate-180"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                </summary>
                <div className="mt-4 space-y-4">
                  <DataTable
                    columns={["Datum", "Art", "Beschreibung", "Menge", "Satz", "Betrag", "Herkunft", "Aktion"]}
                    rows={report.detailEntries.map((entry) => [
                      formatDate(entry.entryDate),
                      entry.costType,
                      entry.description,
                      `${formatDecimal(entry.quantity)} ${entry.unit}`,
                      formatMoney(entry.unitPriceCents),
                      formatMoney(entry.amountCents),
                      getSourceLabel(entry.source, entry.notes),
                      <DeleteEntryButton
                        action={deleteControllingDetailEntry}
                        id={entry.id}
                        key={`delete-${entry.id}`}
                        projectId={report.projectId}
                        reportId={report.id}
                      />,
                    ])}
                    title="Detail"
                  />
                  <DataTable
                    columns={["Datum", "Bezeichnung", "MA", "Std", "Satz", "Kosten", "Kostenart", "Herkunft", "Aktion"]}
                    rows={report.hourEntries.map((entry) => [
                      formatDate(entry.entryDate),
                      entry.label,
                      formatDecimal(entry.employeeCount),
                      formatDecimal(entry.totalHours),
                      formatMoney(entry.realRateCents),
                      formatMoney(entry.realCostCents),
                      entry.costCategory === "GEHALT_SONSTIGES" ? "Gehalt / Sonstiges" : "Lohn",
                      getSourceLabel(entry.source, entry.notes),
                      <DeleteEntryButton
                        action={deleteControllingHourEntry}
                        id={entry.id}
                        key={`delete-${entry.id}`}
                        projectId={report.projectId}
                        reportId={report.id}
                      />,
                    ])}
                    title="Stunden"
                  />
                  <DataTable
                    columns={[
                      "OZ",
                      "Kurztext",
                      "Menge",
                      "EP",
                      "Kosten/ME",
                      "Lohn",
                      "Geräte",
                      "Material",
                      "NU",
                      "Sonstiges",
                      "Kosten",
                      "Zuschlag",
                      "Umsatz",
                      "Herkunft",
                      "Aktion",
                    ]}
                    rows={report.invoiceItems.map((entry) => [
                      entry.positionCode ?? "—",
                      entry.shortText,
                      `${formatDecimal(entry.billedQuantity)} ${entry.unit ?? ""}`,
                      formatMoney(entry.unitPriceCents),
                      formatMoney(entry.costPerUnitCents),
                      formatMoney(entry.laborCostCents),
                      formatMoney(entry.equipmentCostCents),
                      formatMoney(entry.materialCostCents),
                      formatMoney(entry.subcontractorCostCents),
                      formatMoney(entry.otherCostCents),
                      formatMoney(entry.costCents),
                      formatMarkup(entry.unitPriceCents, entry.costPerUnitCents),
                      formatMoney(entry.revenueCents),
                      getSourceLabel(entry.source, entry.notes),
                      <DeleteEntryButton
                        action={deleteControllingInvoiceItem}
                        id={entry.id}
                        key={`delete-${entry.id}`}
                        projectId={report.projectId}
                        reportId={report.id}
                      />,
                    ])}
                    title="Rechnungsmengen / iTWO"
                  />
                </div>
              </details>
            </>
          ) : null}

          {report ? (
            <PerformanceAnalysisSection
              actualHours={actualHours}
              billedHours={billedHours}
              costAnalysisRows={costAnalysisRows}
              hasGehaltHours={hasGehaltHours}
              invoiceRevenueCents={invoiceRevenueCents}
              openWipCents={openWipCents}
              performanceValueCents={performanceValueCents}
              totalContractCents={totalContractCents}
            />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function EntrySection({
  action,
  equipmentOptions,
  hourEntryOptions,
  importAction,
  projectId,
  reportId,
  title,
}: {
  action: (formData: FormData) => Promise<void>;
  equipmentOptions: { id: string; category: string; label: string; unitPrice: string }[];
  hourEntryOptions: { id: string; label: string; totalHours: string }[];
  importAction: (formData: FormData) => Promise<void>;
  projectId: string;
  reportId: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <form
        action={importAction}
        className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"
      >
        <input name="reportId" type="hidden" value={reportId} />
        <input name="projectId" type="hidden" value={projectId} />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <Field label="Detailerfassung Excel-Datei">
            <input
              accept=".xlsx,.xls,.xlsm,.csv"
              className="mt-1 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-950 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-100"
              name="detailFile"
              type="file"
            />
          </Field>
          <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800">
            <input defaultChecked name="replaceDetailImport" type="checkbox" />
            bisherigen Detail-Import ersetzen
          </label>
          <button className={primaryButtonClassName} type="submit">
            Excel importieren
          </button>
        </div>
      </form>

      <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-gray-800">
          Manuelle Detailposition erfassen
        </summary>
        <DetailEntryForm
          action={action}
          equipmentOptions={equipmentOptions}
          hourEntryOptions={hourEntryOptions}
          projectId={projectId}
          reportId={reportId}
        />
      </details>
    </section>
  );
}

function HourSection({
  action,
  crewOptions,
  employeeOptions,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  crewOptions: HourSelectionOption[];
  employeeOptions: HourSelectionOption[];
  projectId: string;
  reportId: string;
}) {
  return (
    <details className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Stundenerfassung
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Manuelle Stunden für Kolonnen, Mitarbeiter oder Nachträge ergänzen.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-950 transition-transform group-open:rotate-180"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </summary>
      <ControllingHourForm
        action={action}
        crewOptions={crewOptions}
        defaultDate={formatInputDate(new Date())}
        employeeOptions={employeeOptions}
        projectId={projectId}
        reportId={reportId}
      />
    </details>
  );
}

function InvoiceSection({
  action,
  importAction,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  importAction: (formData: FormData) => Promise<void>;
  projectId: string;
  reportId: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">iTWO / Rechnungsmengen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Excel-Export hochladen. Aus RE-Menge, Einheitspreis, Kosten/ME und Std/ME werden
            Umsatz, Kosten und Stunden berechnet.
          </p>
        </div>

        <a
          href="/controlling/performance/itwo-template"
          className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Vorlage herunterladen
        </a>
      </div>

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Wie komme ich an die Daten? (Export aus iTWO)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-600">
          <li>Kalkulation in iTWO öffnen, oben im Menü &bdquo;Ansicht&ldquo; wählen.</li>
          <li>Die Vorlage &bdquo;Standard_Artur_Controlling&ldquo; auswählen.</li>
          <li>Die gesamte Tabelle markieren, kopieren und in Excel einfügen.</li>
          <li>Diese Excel-Datei unten direkt hochladen.</li>
        </ol>
        <p className="mt-2 text-sm text-gray-600">
          Falls die Ansicht &bdquo;Standard_Artur_Controlling&ldquo; nicht verfügbar
          ist: selbst eine Ansicht erstellen und die benötigten Spalten gemäß der
          Importvorlage auswählen. Wichtig: Die Spaltenreihenfolge muss dabei genau
          der Importvorlage entsprechen!
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Die Spalten müssen dafür nicht umbenannt werden - der Import erkennt die
          gängigen iTWO-Bezeichnungen automatisch (OZ, Kurztext, ME, RE-Menge,
          LV-Menge, Einheitspreis, Std/ME, Kosten/ME, ...). Alle Details dazu stehen
          auch im Hinweise-Blatt der Vorlage.
        </p>
      </details>

      <form
        action={importAction}
        className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"
      >
        <input name="reportId" type="hidden" value={reportId} />
        <input name="projectId" type="hidden" value={projectId} />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <Field label="iTWO Excel-Datei">
            <input
              accept=".xlsx,.xls,.xlsm,.csv"
              className="mt-1 block w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-gray-950 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-100"
              name="itwoFile"
              type="file"
            />
          </Field>
          <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800">
            <input defaultChecked name="replaceItwoItems" type="checkbox" />
            bisherigen iTWO-Import ersetzen
          </label>
          <button className={primaryButtonClassName} type="submit">
            Excel importieren
          </button>
        </div>
      </form>

      <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <summary className="cursor-pointer text-sm font-bold text-gray-800">
          Manuelle Position erfassen
        </summary>
        <form action={action} className="mt-4 grid gap-3 lg:grid-cols-6">
        <input name="reportId" type="hidden" value={reportId} />
        <input name="projectId" type="hidden" value={projectId} />
        <Field label="OZ">
          <input className={inputClassName} name="positionCode" />
        </Field>
        <Field className="lg:col-span-2" label="Kurztext">
          <input className={inputClassName} name="shortText" />
        </Field>
        <Field label="ME">
          <input className={inputClassName} name="unit" />
        </Field>
        <Field label="LV-Menge">
          <input className={inputClassName} name="contractQuantity" />
        </Field>
        <Field label="RE-Menge">
          <input className={inputClassName} name="billedQuantity" />
        </Field>
        <Field label="Std/ME">
          <input className={inputClassName} name="hoursPerUnit" />
        </Field>
        <Field label="EP netto €">
          <input className={inputClassName} name="unitPrice" />
        </Field>
        <Field label="Kosten/ME €">
          <input className={inputClassName} name="costPerUnit" />
        </Field>
        <Field className="lg:col-span-3" label="Bemerkung">
          <input className={inputClassName} name="notes" />
        </Field>
        <div className="flex items-end">
          <button className={primaryButtonClassName} type="submit">
            Rechnungsmengen hinzufügen
          </button>
        </div>
        </form>
      </details>
    </section>
  );
}

function PerformanceAnalysisSection({
  actualHours,
  billedHours,
  costAnalysisRows,
  hasGehaltHours,
  invoiceRevenueCents,
  openWipCents,
  performanceValueCents,
  totalContractCents,
}: {
  actualHours: number;
  billedHours: number;
  costAnalysisRows: CostAnalysisRow[];
  hasGehaltHours: boolean;
  invoiceRevenueCents: number;
  openWipCents: number;
  performanceValueCents: number;
  totalContractCents: number;
}) {
  const actualCostCents =
    costAnalysisRows.find((row) => row.label === "∑ Kosten")?.actualCents ?? 0;
  const resultBaseCents = Math.max(performanceValueCents, invoiceRevenueCents);
  const forecastCents = resultBaseCents - actualCostCents;
  const billingPercent = totalContractCents > 0
    ? invoiceRevenueCents / totalContractCents
    : 0;
  const costCoverageCents = invoiceRevenueCents - actualCostCents;
  const marginPercent = invoiceRevenueCents > 0
    ? costCoverageCents / invoiceRevenueCents
    : 0;
  const hoursDelta = actualHours - billedHours;
  const overallTone =
    costCoverageCents >= 0
      ? "good"
      : costCoverageCents < 0
        ? "bad"
        : "warn";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
            Auswertung
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">
            Schnellcheck aus der Leistungsmeldung
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Bewertung aus erfassten Stunden, Detailpositionen und iTWO-/Rechnungsmengen.
          </p>
        </div>
        <StatusPill tone={overallTone}>
          {overallTone === "good"
            ? "Gut"
            : overallTone === "bad"
              ? "Schlecht"
              : "Prüfen"}
        </StatusPill>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AnalysisCard
          detail={`Rechnungsstand ${formatPercent(billingPercent)}`}
          label="Auftrag / Abrechnung"
          tone={invoiceRevenueCents >= performanceValueCents ? "good" : "warn"}
          value={formatMoney(invoiceRevenueCents)}
        />
        <AnalysisCard
          detail={`Leistungswert ${formatMoney(performanceValueCents)}`}
          label="Offene Leistung / WIP"
          tone={openWipCents <= 0 ? "good" : "warn"}
          value={formatMoney(openWipCents)}
        />
        <AnalysisCard
          detail={`DB ${formatPercent(marginPercent)}`}
          label="Ergebnis nach Istkosten"
          tone={costCoverageCents >= 0 ? "good" : "bad"}
          value={formatMoney(costCoverageCents)}
        />
        <AnalysisCard
          detail={`Ist ${formatDecimal(actualHours)} h · verdient ${formatDecimal(billedHours)} h`}
          label="Stunden"
          tone={hoursDelta <= 0 ? "good" : "bad"}
          value={`${hoursDelta > 0 ? "+" : ""}${formatDecimal(hoursDelta)} h`}
        />
      </div>

      {hasGehaltHours ? (
        <p className="mt-2 text-xs text-gray-500">
          Hinweis: Gehalt-Stunden nicht berücksichtigt, da mit Position
          Sonstiges abgerechnet.
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Kostenart</th>
              <th className="px-3 py-2 text-right">Kalkuliert / Budget</th>
              <th className="px-3 py-2 text-right">Ist gesamt</th>
              <th className="px-3 py-2 text-right">Abweichung</th>
              <th className="px-3 py-2 text-right">Abweichung %</th>
              <th className="px-3 py-2">Bewertung</th>
            </tr>
          </thead>
          <tbody>
            {costAnalysisRows.map((row) => {
              const tone = row.deltaCents >= 0 ? "good" : "bad";

              return (
                <tr className="border-t border-gray-100" key={row.label}>
                  <td className="px-3 py-2 font-semibold text-gray-950">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {formatMoney(row.budgetCents)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {formatMoney(row.actualCents)}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${tone === "good" ? "text-green-700" : "text-red-700"}`}>
                    {formatMoney(row.deltaCents)}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${tone === "good" ? "text-green-700" : "text-red-700"}`}>
                    {formatPercent(row.deltaPercent)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill tone={tone}>
                      {tone === "good" ? "Gut" : "Schlecht"}
                    </StatusPill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SmallAnalysisLine
          label="Ergebnis aktuell"
          tone={forecastCents >= 0 ? "good" : "bad"}
          value={formatMoney(forecastCents)}
        />
        <SmallAnalysisLine
          label="Istkosten"
          tone="neutral"
          value={formatMoney(actualCostCents)}
        />
        <SmallAnalysisLine
          label="Gesamtauftrag"
          tone="neutral"
          value={formatMoney(totalContractCents)}
        />
      </div>
    </section>
  );
}

function AnalysisCard({
  detail,
  label,
  tone,
  value,
}: {
  detail: string;
  label: string;
  tone: AnalysisTone;
  value: string;
}) {
  const toneClass = getAnalysisToneClass(tone);

  return (
    <div className={`rounded-2xl border p-4 ${toneClass.card}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-semibold opacity-80">{detail}</div>
    </div>
  );
}

function SmallAnalysisLine({
  label,
  tone,
  value,
}: {
  label: string;
  tone: AnalysisTone;
  value: string;
}) {
  const toneClass = getAnalysisToneClass(tone);

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass.card}`}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: AnalysisTone;
}) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${getAnalysisToneClass(tone).pill}`}>
      {children}
    </span>
  );
}

function DeleteEntryButton({
  action,
  id,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  projectId: string;
  reportId: string;
}) {
  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />
      <button
        className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
        type="submit"
      >
        Löschen
      </button>
    </form>
  );
}

function DataTable({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: ReactNode[][];
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="bg-gray-50 px-3 py-2 text-sm font-bold text-gray-950">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              {columns.map((column) => (
                <th className="px-3 py-2" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr className="border-t border-gray-100" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-3 py-2 align-top text-gray-800" key={cellIndex}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={columns.length}>
                  Noch keine Einträge.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({
  dark = false,
  detail,
  label,
  value,
}: {
  dark?: boolean;
  detail?: string;
  label: string;
  value: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        dark
          ? "border-gray-950 bg-gray-950 text-white"
          : "border-gray-200 bg-gray-50 text-gray-950"
      }`}
    >
      <p
        className={`text-[11px] font-bold uppercase tracking-[0.16em] ${
          dark ? "text-gray-300" : "text-gray-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {detail ? (
        <p className={`mt-1 text-xs ${dark ? "text-gray-300" : "text-gray-600"}`}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-gray-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
      {text}
    </div>
  );
}

function getEmployeeHourRate(
  employee: {
    isLeadership: boolean;
    positions: Array<{
      positionLabel: string;
    }>;
  },
  ratesByGroup: Map<
    string,
    {
      costCategory: string;
      internalRateCents: number;
      realRateCents: number;
    }
  >,
) {
  for (const position of employee.positions) {
    const rate = ratesByGroup.get(position.positionLabel);
    if (rate) {
      return rate;
    }
  }

  if (employee.isLeadership) {
    const leadershipRate = ratesByGroup.get("Führung / Bauleitung / Polier");
    if (leadershipRate) {
      return leadershipRate;
    }
  }

  return {
    costCategory: "LOHN",
    internalRateCents: 0,
    realRateCents: 0,
  };
}

function majorityCostCategory(categories: string[]) {
  if (categories.length === 0) return "LOHN";

  const counts = new Map<string, number>();
  for (const category of categories) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  let best = "LOHN";
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }

  return best;
}

function averageRate(values: number[]) {
  const filledValues = values.filter((value) => value > 0);

  if (filledValues.length === 0) {
    return 0;
  }

  return Math.round(
    filledValues.reduce((sum, value) => sum + value, 0) / filledValues.length,
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatRawMoney(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function normalizeProjectCopiedMoneyCents(valueCents: number, projectEuroValue: number) {
  if (projectEuroValue > 0 && valueCents === projectEuroValue) {
    return valueCents * 100;
  }

  return valueCents;
}

function formatDecimal(value: number, digits = 2) {
  return value.toLocaleString("de-DE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function formatMarkup(revenueUnitCents: number, costUnitCents: number) {
  if (costUnitCents <= 0) {
    return "—";
  }

  const markup = ((revenueUnitCents - costUnitCents) / costUnitCents) * 100;

  return `${formatDecimal(markup, 1)} %`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getReportStatusLabel(value: string) {
  return (
    reportStatuses.find((status) => status.value === value)?.label ??
    value
  );
}

function buildCostAnalysisRows({
  detailEntries,
  hourEntries,
  invoiceItems,
}: {
  detailEntries: Array<{
    amountCents: number;
    costType: string;
  }>;
  hourEntries: Array<{
    costCategory: string;
    realCostCents: number;
  }>;
  invoiceItems: Array<{
    equipmentCostCents: number;
    laborCostCents: number;
    materialCostCents: number;
    otherCostCents: number;
    subcontractorCostCents: number;
  }>;
}) {
  const budgetByType = new Map<string, number>([
    ["Lohn", 0],
    ["Material", 0],
    ["Geräte", 0],
    ["Nachunternehmer", 0],
    ["Sonstiges", 0],
  ]);
  const actualByType = new Map<string, number>([
    ["Lohn", 0],
    ["Material", 0],
    ["Geräte", 0],
    ["Nachunternehmer", 0],
    ["Sonstiges", 0],
  ]);

  // Mitarbeiterstunden fließen je nach Kostenart der zugrunde liegenden
  // Mitarbeitergruppe entweder in "Lohn" oder in "Sonstiges" (= Gehalt/
  // Sonstiges) ein, statt pauschal alles als Lohn zu werten.
  for (const entry of hourEntries) {
    const key = entry.costCategory === "GEHALT_SONSTIGES" ? "Sonstiges" : "Lohn";
    actualByType.set(key, (actualByType.get(key) ?? 0) + entry.realCostCents);
  }

  for (const item of invoiceItems) {
    budgetByType.set("Lohn", (budgetByType.get("Lohn") ?? 0) + item.laborCostCents);
    budgetByType.set(
      "Material",
      (budgetByType.get("Material") ?? 0) + item.materialCostCents,
    );
    budgetByType.set(
      "Geräte",
      (budgetByType.get("Geräte") ?? 0) + item.equipmentCostCents,
    );
    budgetByType.set(
      "Nachunternehmer",
      (budgetByType.get("Nachunternehmer") ?? 0) + item.subcontractorCostCents,
    );
    budgetByType.set(
      "Sonstiges",
      (budgetByType.get("Sonstiges") ?? 0) + item.otherCostCents,
    );
  }

  for (const entry of detailEntries) {
    const key = normalizeCostType(entry.costType);
    actualByType.set(key, (actualByType.get(key) ?? 0) + entry.amountCents);
  }

  const rows = ["Lohn", "Material", "Geräte", "Nachunternehmer", "Sonstiges"].map(
    (label) => {
      const budgetCents = budgetByType.get(label) ?? 0;
      const actualCents = actualByType.get(label) ?? 0;
      const deltaCents = budgetCents - actualCents;

      return {
        actualCents,
        budgetCents,
        deltaCents,
        deltaPercent: budgetCents > 0 ? deltaCents / budgetCents : 0,
        label,
      };
    },
  );

  const totalBudget = rows.reduce((sum, row) => sum + row.budgetCents, 0);
  const totalActual = rows.reduce((sum, row) => sum + row.actualCents, 0);
  const totalDelta = totalBudget - totalActual;

  return [
    ...rows,
    {
      actualCents: totalActual,
      budgetCents: totalBudget,
      deltaCents: totalDelta,
      deltaPercent: totalBudget > 0 ? totalDelta / totalBudget : 0,
      label: "∑ Kosten",
    },
  ];
}

function normalizeCostType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes("lohn") || normalized.includes("personal")) return "Lohn";
  if (normalized.includes("material")) return "Material";
  if (normalized.includes("gerät") || normalized.includes("maschine")) return "Geräte";
  if (
    normalized.includes("nachunternehmer") ||
    normalized === "nu" ||
    normalized.includes("sub")
  ) {
    return "Nachunternehmer";
  }

  return "Sonstiges";
}

function getAnalysisToneClass(tone: AnalysisTone) {
  if (tone === "good") {
    return {
      card: "border-green-200 bg-green-50 text-green-950",
      pill: "bg-green-100 text-green-800",
    };
  }

  if (tone === "bad") {
    return {
      card: "border-red-200 bg-red-50 text-red-950",
      pill: "bg-red-100 text-red-800",
    };
  }

  if (tone === "warn") {
    return {
      card: "border-amber-200 bg-amber-50 text-amber-950",
      pill: "bg-amber-100 text-amber-800",
    };
  }

  return {
    card: "border-gray-200 bg-gray-50 text-gray-950",
    pill: "bg-gray-100 text-gray-800",
  };
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

function getNextPeriodStart(
  reports: Array<{
    periodEnd: Date | null;
    reportDate: Date;
  }>,
) {
  const latestEnd = reports.reduce<Date | null>((latest, report) => {
    const end = report.periodEnd ?? report.reportDate;

    if (!latest || end > latest) {
      return end;
    }

    return latest;
  }, null);

  if (!latestEnd) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const next = new Date(latestEnd);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getNextPeriodEnd(periodStart: Date) {
  const end = new Date(periodStart);
  end.setDate(end.getDate() + 13);
  end.setHours(0, 0, 0, 0);
  return end;
}

function getSourceLabel(source: string, notes?: string | null) {
  if (source === "DISPOSITION_IMPORT") {
    const normalizedNotes = notes?.toLowerCase() ?? "";

    if (normalizedNotes.includes("sonderfahrzeugdisposition")) {
      return "Sonderfahrzeugdispo";
    }
    if (
      normalizedNotes.includes("lkw") ||
      normalizedNotes.includes("asphalt-zuteilung") ||
      normalizedNotes.includes("anspritzmittel-zuteilung")
    ) {
      return "LKW-Disposition";
    }
    if (normalizedNotes.includes("asphaltdisposition")) {
      return "Asphaltdispo";
    }
    if (normalizedNotes.includes("gerätedisposition")) {
      return "Gerätedispo";
    }
    if (normalizedNotes.includes("inventar-zuweisung")) {
      return "Inventar-Zuweisung";
    }

    return "Disposition / Inventar";
  }
  if (source === "DETAIL_EXCEL_IMPORT") return "Detail-Excel";
  if (source === "ITWO_IMPORT") return "iTWO-Import";
  if (source === "MANUAL") return "manuell";
  return source;
}

const inputClassName =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-900";

const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800";
