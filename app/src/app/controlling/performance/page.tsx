import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getNetWorkHoursForDay, getWorkTimeDayForDate } from "@/lib/work-time";
import {
  addControllingDetailEntry,
  addControllingHourEntry,
  addControllingInvoiceItem,
  confirmAllCrewSuggestions,
  createPerformanceReport,
  deleteControllingDetailEntry,
  deleteControllingHourEntry,
  deleteControllingInvoiceItem,
  deletePerformanceReport,
  markAllDetailEntriesActual,
  markAllHourEntriesActual,
  markControllingDetailEntryActual,
  markControllingHourEntryActual,
  updateControllingDetailEntry,
  updateControllingHourEntry,
  importDetailEntriesFromExcel,
  importDispositionIntoPerformanceReport,
  importItwoInvoiceItems,
  updatePerformanceReport,
} from "./actions";
import { ConfirmAllSuggestionsButton } from "./ConfirmAllSuggestionsButton";
import { ControllingHourForm } from "./ControllingHourForm";
import { DeleteEntryButton } from "./DeleteEntryButton";
import { DeletePerformanceReportButton } from "./DeletePerformanceReportButton";
import { DetailEntryForm } from "./DetailEntryForm";
import { EditDetailEntryButton } from "./EditDetailEntryButton";
import { EditHourEntryButton } from "./EditHourEntryButton";
import { HoursSourceToggle } from "./HoursSourceToggle";
import { MarkAllActualButton } from "./MarkAllActualButton";
import { MarkEntryActualButton } from "./MarkEntryActualButton";
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
        vehicleId: true,
        billingRateCents: true,
        stockUnit: true,
        category: {
          select: {
            name: true,
            billingRateCents: true,
            dailyReportSection: true,
            parentCategory: {
              select: { name: true },
            },
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

  function resolveItemRateCents(item: {
    billingRateCents: number | null;
    categoryId: string | null;
    id: string;
    category: { billingRateCents: number | null } | null;
  }) {
    return (
      (item.categoryId ? itemRateById.get(item.id) : null) ??
      (item.categoryId ? categoryRateById.get(item.categoryId) : null) ??
      item.billingRateCents ??
      item.category?.billingRateCents ??
      null
    );
  }

  // "h" ist die richtige Vorschlags-Einheit für Geräte/Baumaschinen
  // (Stunden übernehmen ist der Regelfall dort), Material dagegen hat
  // meist eine eigene Lagereinheit (m, to, Stk. ...) hinterlegt - dieselbe
  // MATERIAL/MACHINES-Unterscheidung, die auch beim iTWO-Import
  // (src/app/controlling/performance/actions.ts) für die Kostenart
  // verwendet wird.
  function resolveItemUnitAndCostType(item: {
    stockUnit: string;
    category: { dailyReportSection: string } | null;
  }) {
    if (item.category?.dailyReportSection === "MATERIAL") {
      return { costType: "Material", unit: item.stockUnit || "Stk." };
    }
    return { costType: "Geräte", unit: "h" };
  }

  // Für die Geräte/Material-Schnellerfassung: das komplette aktive
  // Inventar anbieten (Material hat z.B. i.d.R. keinen hinterlegten
  // Verrechnungssatz, muss aber trotzdem wählbar sein) - der Satz wird
  // nur als Vorschlag übernommen, wo einer existiert (Objekt-Satz >
  // Kategorie-Satz aus dem aktiven Satzstand > Kategorie-Standardsatz),
  // sonst bleibt EP netto € leer und wird manuell eingetragen.
  const generalEquipmentQuickEntryOptions = inventoryItemsForQuickEntry.map((item) => {
    const rateCents = resolveItemRateCents(item);
    const { costType, unit } = resolveItemUnitAndCostType(item);

    return {
      id: item.id,
      category: item.category?.name ?? "Ohne Kategorie",
      parentCategory:
        item.category?.parentCategory?.name ?? item.category?.name ?? "Ohne Kategorie",
      costType,
      unit,
      label: [item.objectNumber, item.name].filter(Boolean).join(" · "),
      unitPrice: rateCents && rateCents > 0 ? formatRawMoney(rateCents) : "",
    };
  });

  // Geräte, die einer über Teams-Verwaltung/Personaleinsatzplanung für
  // dieses Projekt eingeteilten Kolonne als Standardgerät hinterlegt sind -
  // oben in der Auswahl, deutlich mit der Kolonne beschriftet, statt sie
  // in der allgemeinen Inventarliste untergehen zu lassen.
  const crewLookupProjectId = report?.projectId ?? selectedProject?.id ?? null;
  const crewPlanningRows = crewLookupProjectId
    ? await prisma.crewPlanningRow.findMany({
        where: { projectId: crewLookupProjectId },
        select: {
          assignments: {
            select: {
              crewId: true,
              startDate: true,
              endDate: true,
              startTime: true,
              endTime: true,
            },
          },
        },
      })
    : [];
  const reportPeriodStart = report?.periodStart ?? null;
  const reportPeriodEnd = report?.periodEnd ?? null;
  const relevantAssignments = crewPlanningRows
    .flatMap((row) => row.assignments)
    .filter((assignment) => {
      if (!assignment.crewId) return false;
      if (!reportPeriodStart || !reportPeriodEnd) return true;
      return (
        assignment.startDate <= reportPeriodEnd &&
        assignment.endDate >= reportPeriodStart
      );
    });
  // Asphalt-Dispo speichert die Kolonne nur als freien Textnamen
  // (AsphaltDispatchEntry.crew), nicht als eigene CrewPlanningAssignment-
  // Zeile - läuft aber in derselben Kolonnen-Planung (crew-dispatch) als
  // zusammengeführte Kalenderansicht mit ein. Für die Vorschläge hier
  // zählt das genauso als "Kolonne war an dem Tag diesem Projekt
  // zugeteilt".
  const allActiveCrews = await prisma.crew.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  const crewIdByName = new Map(allActiveCrews.map((crew) => [crew.name, crew.id]));
  const asphaltDispatchEntries = crewLookupProjectId
    ? await prisma.asphaltDispatchEntry.findMany({
        where: {
          projectId: crewLookupProjectId,
          ...(reportPeriodStart && reportPeriodEnd
            ? { workDate: { gte: reportPeriodStart, lte: reportPeriodEnd } }
            : {}),
        },
        select: { crew: true, workDate: true },
      })
    : [];
  const asphaltDispatchDaysByCrewId = new Map<string, Set<string>>();
  for (const entry of asphaltDispatchEntries) {
    const crewId = crewIdByName.get(entry.crew);
    if (!crewId) continue;

    const dayKey = entry.workDate.toISOString().slice(0, 10);
    const days = asphaltDispatchDaysByCrewId.get(crewId) ?? new Set<string>();
    days.add(dayKey);
    asphaltDispatchDaysByCrewId.set(crewId, days);
  }

  const relevantCrewIds = Array.from(
    new Set([
      ...relevantAssignments.map((assignment) => assignment.crewId as string),
      ...asphaltDispatchDaysByCrewId.keys(),
    ]),
  );
  const assignedCrews = relevantCrewIds.length
    ? await prisma.crew.findMany({
        where: { id: { in: relevantCrewIds } },
        select: {
          id: true,
          name: true,
          defaultVehicles: {
            where: { isActive: true },
            select: { vehicleId: true, inventoryItemId: true },
          },
        },
      })
    : [];

  // Kolonnen-Stunden für die Buchungsvorschläge unten: je nach
  // report.hoursSource entweder aus der Personaleinsatzplanung (geplante
  // Schichtdauer × überlappende Tage im Berichtszeitraum) oder aus der
  // freigegebenen Zeiterfassung (echte Stunden pro Mitarbeiter für
  // Personal, Schichtspanne frühester Beginn bis spätestes Ende für die
  // Gerätelaufzeit, summiert über alle Tage im Zeitraum).
  function timeStringToMinutes(value: string) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function countDaysInclusive(start: Date, end: Date) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  }

  const plannedHoursByCrewId = new Map<string, number>();
  for (const assignment of relevantAssignments) {
    if (!assignment.crewId) continue;

    const clippedStart =
      reportPeriodStart && assignment.startDate < reportPeriodStart
        ? reportPeriodStart
        : assignment.startDate;
    const clippedEnd =
      reportPeriodEnd && assignment.endDate > reportPeriodEnd
        ? reportPeriodEnd
        : assignment.endDate;
    const days = countDaysInclusive(clippedStart, clippedEnd);
    const startMinutes = timeStringToMinutes(assignment.startTime) ?? 0;
    const endMinutes = timeStringToMinutes(assignment.endTime) ?? 0;
    const shiftHours = Math.max(0, (endMinutes - startMinutes) / 60);

    plannedHoursByCrewId.set(
      assignment.crewId,
      (plannedHoursByCrewId.get(assignment.crewId) ?? 0) + days * shiftHours,
    );
  }

  // Asphalt-Dispo-Tage zählen für die geplanten Stunden mit dazu, mit dem
  // admin-konfigurierten Standard-Arbeitstag (dieselbe Quelle, die auch
  // für andere Vorschläge ohne konkrete Personalzuordnung genutzt wird,
  // z.B. Bautagesbericht) - bewusst ohne Abgleich gegen bereits über
  // Personaleinsatzplanung gezählte Tage, ein seltener doppelter
  // Überschneidungsfall lässt sich über "Anteil %" beim Bearbeiten der
  // gebuchten Position korrigieren.
  const distinctAsphaltDispatchDates = Array.from(
    new Set(
      Array.from(asphaltDispatchDaysByCrewId.values()).flatMap((days) =>
        Array.from(days),
      ),
    ),
  );
  const workTimeByDate = new Map(
    await Promise.all(
      distinctAsphaltDispatchDates.map(
        async (dayKey) =>
          [dayKey, await getWorkTimeDayForDate(new Date(`${dayKey}T00:00:00.000Z`))] as const,
      ),
    ),
  );
  for (const [crewId, days] of asphaltDispatchDaysByCrewId.entries()) {
    let addedHours = 0;
    for (const dayKey of days) {
      const workTimeDay = workTimeByDate.get(dayKey);
      if (workTimeDay) addedHours += getNetWorkHoursForDay(workTimeDay);
    }
    plannedHoursByCrewId.set(crewId, (plannedHoursByCrewId.get(crewId) ?? 0) + addedHours);
  }

  const approvedTimeEntries =
    relevantCrewIds.length && crewLookupProjectId
      ? await prisma.crewTimeEntry.findMany({
          where: {
            projectId: crewLookupProjectId,
            crewId: { in: relevantCrewIds },
            status: "APPROVED",
            ...(reportPeriodStart && reportPeriodEnd
              ? { workDate: { gte: reportPeriodStart, lte: reportPeriodEnd } }
              : {}),
          },
          select: {
            crewId: true,
            employees: {
              select: { netHours: true, startTime: true, endTime: true },
            },
          },
        })
      : [];

  const approvedPersonnelHoursByCrewId = new Map<string, number>();
  const approvedEquipmentHoursByCrewId = new Map<string, number>();
  for (const entry of approvedTimeEntries) {
    // Die Buchung bucht nur EINE repräsentative Zeile mit employeeCount: 1
    // (Kolonnen-Satz, keine Kopfzahl) - hier darf also nicht über alle
    // Mitarbeiter aufsummiert werden (das ergäbe z.B. bei 7 Leuten à 5,75h
    // fälschlich 40,25h), sondern der längste Einzel-Wert steht für "wie
    // lange hat die Kolonne an dem Tag gearbeitet".
    const personnelHours = Math.max(0, ...entry.employees.map((employee) => employee.netHours));
    approvedPersonnelHoursByCrewId.set(
      entry.crewId,
      (approvedPersonnelHoursByCrewId.get(entry.crewId) ?? 0) + personnelHours,
    );

    const startMinutesList = entry.employees
      .map((employee) => timeStringToMinutes(employee.startTime))
      .filter((value): value is number => value !== null);
    const endMinutesList = entry.employees
      .map((employee) => timeStringToMinutes(employee.endTime))
      .filter((value): value is number => value !== null);

    if (startMinutesList.length && endMinutesList.length) {
      const spanHours = Math.max(
        0,
        (Math.max(...endMinutesList) - Math.min(...startMinutesList)) / 60,
      );
      approvedEquipmentHoursByCrewId.set(
        entry.crewId,
        (approvedEquipmentHoursByCrewId.get(entry.crewId) ?? 0) + spanHours,
      );
    }
  }

  const reportHoursSource = report?.hoursSource ?? "PLANNED";

  function getPersonnelHoursForCrew(crewId: string) {
    return reportHoursSource === "APPROVED_TIME"
      ? (approvedPersonnelHoursByCrewId.get(crewId) ?? 0)
      : (plannedHoursByCrewId.get(crewId) ?? 0);
  }

  function getEquipmentHoursForCrew(crewId: string) {
    return reportHoursSource === "APPROVED_TIME"
      ? (approvedEquipmentHoursByCrewId.get(crewId) ?? 0)
      : (plannedHoursByCrewId.get(crewId) ?? 0);
  }

  const itemByVehicleId = new Map(
    inventoryItemsForQuickEntry
      .filter((item) => item.vehicleId)
      .map((item) => [item.vehicleId as string, item]),
  );
  const itemById = new Map(inventoryItemsForQuickEntry.map((item) => [item.id, item]));

  const crewAssignedEquipmentOptions = assignedCrews.flatMap((crew) =>
    crew.defaultVehicles.flatMap((defaultVehicle) => {
      const item =
        itemByVehicleId.get(defaultVehicle.vehicleId) ??
        (defaultVehicle.inventoryItemId
          ? itemById.get(defaultVehicle.inventoryItemId)
          : null);
      if (!item) return [];

      const rateCents = resolveItemRateCents(item);
      const { costType, unit } = resolveItemUnitAndCostType(item);

      return [
        {
          id: item.id,
          category: item.category?.name ?? "Ohne Kategorie",
          parentCategory: `Zugeteilt: Kolonne ${crew.name}`,
          costType,
          unit,
          label: [item.objectNumber, item.name].filter(Boolean).join(" · "),
          unitPrice: rateCents && rateCents > 0 ? formatRawMoney(rateCents) : "",
        },
      ];
    }),
  );

  const equipmentQuickEntryOptions = [
    ...crewAssignedEquipmentOptions,
    ...generalEquipmentQuickEntryOptions,
  ];

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

  // Buchungsvorschläge für Kolonnen, die über Teams-Verwaltung/
  // Personaleinsatzplanung diesem Projekt zugeteilt sind: Personalstunden
  // (mit dem für die Kolonne ermittelten Durchschnittssatz) und je
  // Standardgerät die Gerätestunden - beides ein Klick, kein Doppelbuchen,
  // da es nur ein Vorschlag ist, keine automatische Buchung.
  const crewSuggestions = assignedCrews
    .map((crew) => {
      const personnelHours = roundToTwoDecimals(getPersonnelHoursForCrew(crew.id));
      const equipmentHours = roundToTwoDecimals(getEquipmentHoursForCrew(crew.id));
      const crewRate = crewHourOptions.find((option) => option.id === crew.id);

      const equipmentItems = crew.defaultVehicles.flatMap((defaultVehicle) => {
        const item =
          itemByVehicleId.get(defaultVehicle.vehicleId) ??
          (defaultVehicle.inventoryItemId
            ? itemById.get(defaultVehicle.inventoryItemId)
            : null);
        if (!item) return [];

        const rateCents = resolveItemRateCents(item);

        return [
          {
            itemId: item.id,
            label: [item.objectNumber, item.name].filter(Boolean).join(" · "),
            unitPrice: rateCents && rateCents > 0 ? formatRawMoney(rateCents) : "",
          },
        ];
      });

      return {
        crewId: crew.id,
        crewName: crew.name,
        equipmentHours,
        equipmentItems,
        internalRate: crewRate?.internalRate ?? "",
        personnelCostCategory: crewRate?.costCategory ?? "LOHN",
        personnelHours,
        realRate: crewRate?.realRate ?? "",
      };
    })
    .filter(
      (suggestion) => suggestion.personnelHours > 0 || suggestion.equipmentHours > 0,
    );

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
  // Skonto/Nachlass mindern den abgerechneten Umsatz, bevor daraus
  // Ergebnis/DB berechnet werden - der rohe invoiceRevenueCents bleibt
  // für "Auftrag / Abrechnung" (Rechnungsstand) unverändert sichtbar.
  // Nachlass mindert den Nettopreis direkt, Skonto wird beim
  // Zahlungseingang vom (bereits um Nachlass reduzierten) Bruttobetrag
  // abgezogen - beides nacheinander (nicht einfach addiert), sonst
  // stimmt der Endbetrag bei beiden zusammen nicht. Da die MwSt ein
  // fester Faktor ist, kürzt sie sich beim Zurückrechnen auf netto
  // wieder heraus - der Skonto-Prozentsatz wirkt in Netto-Rechnung also
  // genauso wie in Brutto-Rechnung, nur eben auf den (um Nachlass schon
  // reduzierten) Betrag.
  const skontoPercent = currentProjectForValues?.skontoPercent ?? 0;
  const nachlassPercent = currentProjectForValues?.nachlassPercent ?? 0;
  const skontoNachlassPercent = skontoPercent + nachlassPercent;
  const revenueAfterNachlassCents = invoiceRevenueCents * (1 - nachlassPercent / 100);
  const effectiveInvoiceRevenueCents = Math.round(
    revenueAfterNachlassCents * (1 - skontoPercent / 100),
  );
  const resultBaseCents = Math.max(performanceValueCents, effectiveInvoiceRevenueCents);
  const forecastCents = resultBaseCents - actualCostCents;
  const forecastPercent = resultBaseCents > 0 ? forecastCents / resultBaseCents : 0;
  const openWipCents = Math.max(0, performanceValueCents - invoiceRevenueCents);
  // Umlage-Vergleich: aus der echten Auftragssumme wird die
  // Kalkulations-Kostenbasis mit der tatsächlichen Umlage zurückgerechnet,
  // damit wird eine hypothetische Auftragssumme mit der normalen Umlage
  // berechnet - die Differenz ist der zusätzliche Gewinn durch einen
  // höheren (oder niedrigeren) Zuschlag als üblich.
  const normalUmlagePercent =
    (currentProjectForValues?.normalAgkPercent ?? 10) +
    (currentProjectForValues?.normalWugPercent ?? 6) +
    (currentProjectForValues?.normalBgkPercent ?? 6) +
    (currentProjectForValues?.normalFreierZuschlagPercent ?? 0);
  const actualUmlagePercent =
    (currentProjectForValues?.actualAgkPercent ?? 10) +
    (currentProjectForValues?.actualWugPercent ?? 6) +
    (currentProjectForValues?.actualBgkPercent ?? 6) +
    (currentProjectForValues?.actualFreierZuschlagPercent ?? 0);
  const umlageCostBasisCents =
    actualUmlagePercent > -100
      ? totalContractCents / (1 + actualUmlagePercent / 100)
      : totalContractCents;
  const normalContractCents = Math.round(
    umlageCostBasisCents * (1 + normalUmlagePercent / 100),
  );
  const umlageGewinnCents = totalContractCents - normalContractCents;
  // Ergebnis vor Umlage: dieselbe Rückrechnung wie beim Umlage-Vergleich,
  // aber auf den tatsächlich abgerechneten (um Skonto/Nachlass bereinigten)
  // Umsatz angewendet statt auf die Auftragssumme - zeigt, was vom
  // Ergebnis übrig bleibt, wenn man den Umlage-Zuschlag komplett rausrechnet.
  const umsatzVorUmlageCents =
    actualUmlagePercent > -100
      ? Math.round(effectiveInvoiceRevenueCents / (1 + actualUmlagePercent / 100))
      : effectiveInvoiceRevenueCents;
  const ergebnisVorUmlageCents = umsatzVorUmlageCents - actualCostCents;
  const dbVorUmlagePercent =
    umsatzVorUmlageCents > 0 ? ergebnisVorUmlageCents / umsatzVorUmlageCents : 0;
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
  const detailHourEntryOptions = report
    ? report.hourEntries.map((entry) => ({
        id: entry.id,
        label: `${formatDate(entry.entryDate)} · ${entry.label} · ${formatDecimal(entry.totalHours)} h`,
        totalHours: formatDecimal(entry.totalHours),
      }))
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

          {selectedProject ? (
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          ) : null}

          {report ? (
            <>
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
                <form
                  action={updatePerformanceReport}
                  className="mt-4 grid gap-3 lg:grid-cols-6"
                  id="leistungsmeldungsdaten-form"
                >
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

                  <div
                    className={`lg:col-span-6 rounded-2xl border p-4 text-sm ${
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

                  <HoursSourceToggle defaultValue={report.hoursSource} reportId={report.id} />

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
                </form>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
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

                <p className="mt-5 text-xs font-semibold text-gray-500">
                  Alle Beträge netto.
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                  <MetricCard
                    dark
                    detail={`Basis: ${
                      effectiveInvoiceRevenueCents > performanceValueCents
                        ? skontoNachlassPercent > 0
                          ? "abgerechneter Umsatz (nach Skonto/Nachlass)"
                          : "abgerechneter Umsatz"
                        : "Leistungsstand"
                    }`}
                    label="Ergebnis aktuell"
                    percent={{
                      tone: forecastCents >= 0 ? "good" : "bad",
                      value: formatPercent(forecastPercent),
                    }}
                    value={formatMoney(forecastCents)}
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
                <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <summary className="cursor-pointer font-semibold text-gray-700">
                    Wie berechnen sich die Werte?
                  </summary>
                  <ul className="mt-2 space-y-1.5 leading-5">
                    <li>
                      <span className="font-semibold text-gray-800">Ergebnis aktuell</span> = der
                      höhere Wert aus Leistungsstand (kalkulierter Auftragswert × Leistungsstand %)
                      oder bisher abgerechnetem Umsatz (bei Skonto/Nachlass &gt; 0% bereits davon
                      abgezogen), minus erfasste Istkosten (Lohn + Detailpositionen). DB darunter
                      ist dasselbe Ergebnis als Prozentsatz von dieser Basis. Der Hinweistext zeigt,
                      welche der beiden Basis gerade verwendet wird - solange Leistungsstand und
                      abgerechneter Umsatz auseinanderliegen (normal, wenn die Abrechnung der Arbeit
                      hinterherhinkt), weicht dieser Wert bewusst von &quot;Ergebnis nach
                      Istkosten&quot; weiter unten ab, das immer nur den abgerechneten Umsatz als
                      Basis nimmt - erst wenn beides übereinstimmt, zeigen beide dasselbe.
                    </li>
                    <li>
                      <span className="font-semibold text-gray-800">Leistungsstand</span> = der in
                      &quot;Leistungsmeldungsdaten&quot; eingetragene Prozentsatz, umgerechnet auf
                      den Gesamtauftrag (netto).
                    </li>
                    <li>
                      <span className="font-semibold text-gray-800">Istkosten erfasst</span> =
                      Summe aller erfassten Stunden (zu EK real) plus aller Detailpositionen
                      (Material, Geräte, Nachunternehmer, Sonstiges) dieser Leistungsmeldung.
                    </li>
                  </ul>
                </details>
                <form action={importDispositionIntoPerformanceReport} className="mt-5">
                  <input name="reportId" type="hidden" value={report.id} />
                  <input name="projectId" type="hidden" value={report.projectId} />
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                    Nur nötig, wenn du <span className="font-bold">nachträglich</span> neue
                    Dispo-Daten oder Zeiterfassungen für diesen Zeitraum ergänzt hast - beim
                    Anlegen der Meldung und beim Umschalten des Modus oben läuft der Import
                    bereits automatisch.
                  </div>
                  <button
                    className={`mt-3 inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold ${
                      activeRateSet
                        ? "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100"
                        : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                    }`}
                    disabled={!activeRateSet}
                    type="submit"
                  >
                    Neue Dispo-/Zeiterfassungsdaten nachziehen
                  </button>
                  <p className="mt-2 text-xs text-gray-500">
                    Nutzt den Modus aus &quot;Leistungsmeldungsdaten&quot; oben (aktuell:{" "}
                    {report.hoursSource === "APPROVED_TIME"
                      ? "Leistungsmeldung nach Leistung"
                      : "Leistungsmeldung nach Disposition"}
                    ). Ersetzt nur automatisch übernommene Controlling-Zeilen für diesen Zeitraum.
                    Manuelle Einträge bleiben erhalten. Material und Geräte kommen unabhängig vom
                    Modus weiterhin aus der Disposition.
                  </p>
                </form>
              </section>

              {crewSuggestions.length > 0 ? (
                <CrewSuggestionsSection
                  confirmAllAction={confirmAllCrewSuggestions}
                  crewSuggestions={crewSuggestions}
                  entryDate={formatInputDate(
                    report.periodEnd ?? report.reportDate ?? new Date(),
                  )}
                  hourAction={addControllingHourEntry}
                  hoursSource={reportHoursSource}
                  detailAction={addControllingDetailEntry}
                  projectId={report.projectId}
                  reportId={report.id}
                />
              ) : null}

              <EntrySection
                action={addControllingDetailEntry}
                equipmentOptions={equipmentQuickEntryOptions}
                hourEntryOptions={detailHourEntryOptions}
                importAction={importDetailEntriesFromExcel}
                projectId={report.projectId}
                reportId={report.id}
                showActualQuantityHint={reportHoursSource === "APPROVED_TIME"}
                title="Detailerfassung"
                updateAction={updateControllingDetailEntry}
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
                    columns={["Datum", "Art", "Beschreibung", "Menge", "Satz", "Anteil %", "Betrag", "Herkunft", "Status", "Aktion"]}
                    headerAction={
                      <MarkAllActualButton
                        action={markAllDetailEntriesActual}
                        count={report.detailEntries.filter((entry) => entry.status === "geschätzt").length}
                        projectId={report.projectId}
                        reportId={report.id}
                      />
                    }
                    rows={report.detailEntries.map((entry) => [
                      formatDate(entry.entryDate),
                      entry.costType,
                      entry.description,
                      `${formatDecimal(entry.quantity)} ${entry.unit}`,
                      formatMoney(entry.unitPriceCents),
                      `${entry.utilizationPercent}%`,
                      formatMoney(entry.amountCents),
                      getSourceLabel(entry.source, entry.notes),
                      getDetailStatusBadge(entry.status, entry.costType, reportHoursSource),
                      <div className="flex gap-2" key={`actions-${entry.id}`}>
                        <EditDetailEntryButton
                          action={addControllingDetailEntry}
                          entry={{
                            id: entry.id,
                            costType: entry.costType,
                            description: entry.description,
                            entryDate: formatInputDate(entry.entryDate),
                            notes: entry.notes ?? "",
                            quantity: formatDecimal(entry.quantity),
                            status: entry.status,
                            unit: entry.unit,
                            unitPrice: formatRawMoney(entry.unitPriceCents),
                            utilizationPercent: String(entry.utilizationPercent),
                          }}
                          equipmentOptions={equipmentQuickEntryOptions}
                          hourEntryOptions={detailHourEntryOptions}
                          projectId={report.projectId}
                          reportId={report.id}
                          updateAction={updateControllingDetailEntry}
                        />
                        {(entry.costType === "Material" || entry.costType === "Geräte") &&
                        entry.status !== "tatsächlich verbaut" ? (
                          <MarkEntryActualButton
                            action={markControllingDetailEntryActual}
                            id={entry.id}
                            projectId={report.projectId}
                            reportId={report.id}
                          />
                        ) : null}
                        <DeleteEntryButton
                          action={deleteControllingDetailEntry}
                          id={entry.id}
                          label={entry.description}
                          projectId={report.projectId}
                          reportId={report.id}
                        />
                      </div>,
                    ])}
                    title="Detail"
                  />
                  <DataTable
                    columns={["Datum", "Bezeichnung", "MA", "Std", "Satz", "Kosten", "Kostenart", "Herkunft", "Status", "Aktion"]}
                    headerAction={
                      <MarkAllActualButton
                        action={markAllHourEntriesActual}
                        count={report.hourEntries.filter((entry) => entry.status === "geschätzt").length}
                        projectId={report.projectId}
                        reportId={report.id}
                      />
                    }
                    rows={report.hourEntries.map((entry) => [
                      formatDate(entry.entryDate),
                      entry.label,
                      formatDecimal(entry.employeeCount),
                      formatDecimal(entry.totalHours),
                      formatMoney(entry.realRateCents),
                      formatMoney(entry.realCostCents),
                      entry.costCategory === "GEHALT_SONSTIGES" ? "Gehalt / Sonstiges" : "Lohn",
                      getSourceLabel(entry.source, entry.notes),
                      getHourStatusBadge(entry.status, reportHoursSource),
                      <div className="flex gap-2" key={`actions-${entry.id}`}>
                        <EditHourEntryButton
                          entry={{
                            id: entry.id,
                            breakHours: formatDecimal(entry.breakHours),
                            costCategory: entry.costCategory,
                            employeeCount: formatDecimal(entry.employeeCount),
                            endsAt: entry.endsAt ?? "",
                            entryDate: formatInputDate(entry.entryDate),
                            hoursPerEmployee: formatDecimal(entry.hoursPerEmployee),
                            internalRate: formatRawMoney(entry.internalRateCents),
                            label: entry.label,
                            notes: entry.notes ?? "",
                            realRate: formatRawMoney(entry.realRateCents),
                            startsAt: entry.startsAt ?? "",
                            status: entry.status,
                          }}
                          projectId={report.projectId}
                          reportId={report.id}
                          updateAction={updateControllingHourEntry}
                        />
                        {entry.status !== "tatsächlich verbaut" ? (
                          <MarkEntryActualButton
                            action={markControllingHourEntryActual}
                            id={entry.id}
                            projectId={report.projectId}
                            reportId={report.id}
                          />
                        ) : null}
                        <DeleteEntryButton
                          action={deleteControllingHourEntry}
                          id={entry.id}
                          label={entry.label}
                          projectId={report.projectId}
                          reportId={report.id}
                        />
                      </div>,
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
                        label={entry.shortText}
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
            <>
              <PerformanceAnalysisSection
                actualHours={actualHours}
                billedHours={billedHours}
                costAnalysisRows={costAnalysisRows}
                effectiveInvoiceRevenueCents={effectiveInvoiceRevenueCents}
                hasGehaltHours={hasGehaltHours}
                invoiceRevenueCents={invoiceRevenueCents}
                nachlassPercent={nachlassPercent}
                openWipCents={openWipCents}
                performanceValueCents={performanceValueCents}
                skontoNachlassPercent={skontoNachlassPercent}
                skontoPercent={skontoPercent}
                totalContractCents={totalContractCents}
              />

              <UmlageComparisonSection
                actualAgkPercent={currentProjectForValues?.actualAgkPercent ?? 10}
                actualBgkPercent={currentProjectForValues?.actualBgkPercent ?? 6}
                actualFreierZuschlagPercent={
                  currentProjectForValues?.actualFreierZuschlagPercent ?? 0
                }
                actualUmlagePercent={actualUmlagePercent}
                actualWugPercent={currentProjectForValues?.actualWugPercent ?? 6}
                dbVorUmlagePercent={dbVorUmlagePercent}
                ergebnisVorUmlageCents={ergebnisVorUmlageCents}
                normalAgkPercent={currentProjectForValues?.normalAgkPercent ?? 10}
                normalBgkPercent={currentProjectForValues?.normalBgkPercent ?? 6}
                normalFreierZuschlagPercent={
                  currentProjectForValues?.normalFreierZuschlagPercent ?? 0
                }
                normalUmlagePercent={normalUmlagePercent}
                normalWugPercent={currentProjectForValues?.normalWugPercent ?? 6}
                totalContractCents={totalContractCents}
                umlageGewinnCents={umlageGewinnCents}
                umsatzVorUmlageCents={umsatzVorUmlageCents}
              />

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className={primaryButtonClassName}
                    form="leistungsmeldungsdaten-form"
                    type="submit"
                  >
                    Leistungsmeldungsdaten speichern
                  </button>
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
                  <DeletePerformanceReportButton
                    action={deletePerformanceReport}
                    label={`${report.title || "Leistungsmeldung"} · ${formatDate(report.periodStart ?? report.reportDate)} – ${formatDate(report.periodEnd ?? report.reportDate)}`}
                    projectId={report.projectId}
                    reportId={report.id}
                  />
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

type CrewSuggestion = {
  crewId: string;
  crewName: string;
  equipmentHours: number;
  equipmentItems: { itemId: string; label: string; unitPrice: string }[];
  internalRate: string;
  personnelCostCategory: string;
  personnelHours: number;
  realRate: string;
};

function CrewSuggestionsSection({
  confirmAllAction,
  crewSuggestions,
  detailAction,
  entryDate,
  hourAction,
  hoursSource,
  projectId,
  reportId,
}: {
  confirmAllAction: (formData: FormData) => Promise<void>;
  crewSuggestions: CrewSuggestion[];
  detailAction: (formData: FormData) => Promise<void>;
  entryDate: string;
  hourAction: (formData: FormData) => Promise<void>;
  hoursSource: string;
  projectId: string;
  reportId: string;
}) {
  const sourceLabel =
    hoursSource === "APPROVED_TIME"
      ? "freigegebener Zeiterfassung (Leistungsmeldung nach Leistung)"
      : "geplanter Personaleinsatzplanung (Leistungsmeldung nach Disposition)";

  const allSuggestionItems = crewSuggestions.flatMap((suggestion) => [
    ...(suggestion.personnelHours > 0
      ? [
          {
            costCategory: suggestion.personnelCostCategory,
            crewName: suggestion.crewName,
            internalRate: suggestion.internalRate,
            personnelHours: suggestion.personnelHours,
            realRate: suggestion.realRate,
            type: "PERSONNEL" as const,
          },
        ]
      : []),
    ...(suggestion.equipmentHours > 0
      ? suggestion.equipmentItems.map((item) => ({
          crewName: suggestion.crewName,
          equipmentHours: suggestion.equipmentHours,
          itemId: item.itemId,
          label: item.label,
          type: "EQUIPMENT" as const,
          unitPrice: item.unitPrice,
        }))
      : []),
  ]);

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-blue-950">
          Vorschläge aus Kolonnen-Zuteilung
        </h2>
        <ConfirmAllSuggestionsButton
          action={confirmAllAction}
          entryDate={entryDate}
          items={allSuggestionItems}
          projectId={projectId}
          reportId={reportId}
        />
      </div>
      <p className="mt-1 text-sm text-blue-900">
        Aus {sourceLabel} für die diesem Projekt zugeteilten Kolonnen. Ein
        Klick bucht die Position direkt (mit Datum {entryDate}) - danach
        über &quot;Bearbeiten&quot; korrigierbar. Kein automatisches
        Doppelbuchen, nichts wird ohne Klick gespeichert. Modus oben unter
        &quot;Leistungsmeldungsdaten&quot; umstellbar.
      </p>

      <div className="mt-4 space-y-3">
        {crewSuggestions.map((suggestion) => (
          <div
            className="rounded-xl border border-blue-200 bg-white p-3"
            key={suggestion.crewId}
          >
            <div className="text-sm font-bold text-gray-950">
              Kolonne {suggestion.crewName}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {suggestion.personnelHours > 0 ? (
                <form action={hourAction}>
                  <input name="reportId" type="hidden" value={reportId} />
                  <input name="projectId" type="hidden" value={projectId} />
                  <input name="labelType" type="hidden" value="CREW" />
                  <input name="crewLabel" type="hidden" value={suggestion.crewName} />
                  <input name="employeeCount" type="hidden" value="1" />
                  <input
                    name="hoursPerEmployee"
                    type="hidden"
                    value={String(suggestion.personnelHours)}
                  />
                  <input name="entryDate" type="hidden" value={entryDate} />
                  <input name="breakHours" type="hidden" value="0" />
                  <input name="realRate" type="hidden" value={suggestion.realRate} />
                  <input
                    name="internalRate"
                    type="hidden"
                    value={suggestion.internalRate}
                  />
                  <input
                    name="costCategory"
                    type="hidden"
                    value={suggestion.personnelCostCategory}
                  />
                  <input
                    name="notes"
                    type="hidden"
                    value={`Vorschlag Kolonnen-Zuteilung (${sourceLabel})`}
                  />
                  <button
                    className="rounded-lg border border-blue-300 bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 hover:bg-blue-200"
                    type="submit"
                  >
                    Personalstunden buchen: {formatDecimal(suggestion.personnelHours)} h
                  </button>
                </form>
              ) : null}
              {suggestion.equipmentHours > 0
                ? suggestion.equipmentItems.map((item) => (
                    <form action={detailAction} key={item.itemId}>
                      <input name="reportId" type="hidden" value={reportId} />
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="entryDate" type="hidden" value={entryDate} />
                      <input name="costType" type="hidden" value="Geräte" />
                      <input name="description" type="hidden" value={item.label} />
                      <input
                        name="quantity"
                        type="hidden"
                        value={String(suggestion.equipmentHours)}
                      />
                      <input name="unit" type="hidden" value="h" />
                      <input name="unitPrice" type="hidden" value={item.unitPrice} />
                      <input name="utilizationPercent" type="hidden" value="100" />
                      <input name="status" type="hidden" value="geschätzt" />
                      <input
                        name="notes"
                        type="hidden"
                        value={`Vorschlag Kolonne ${suggestion.crewName} (${sourceLabel})`}
                      />
                      <button
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        type="submit"
                      >
                        {item.label}: {formatDecimal(suggestion.equipmentHours)} h buchen
                      </button>
                    </form>
                  ))
                : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EntrySection({
  action,
  equipmentOptions,
  hourEntryOptions,
  importAction,
  projectId,
  reportId,
  showActualQuantityHint,
  title,
  updateAction,
}: {
  action: (formData: FormData) => Promise<void>;
  equipmentOptions: {
    id: string;
    category: string;
    costType: string;
    label: string;
    parentCategory: string;
    unit: string;
    unitPrice: string;
  }[];
  hourEntryOptions: { id: string; label: string; totalHours: string }[];
  importAction: (formData: FormData) => Promise<void>;
  projectId: string;
  reportId: string;
  showActualQuantityHint?: boolean;
  title: string;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      {showActualQuantityHint ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          Material- und Gerätemengen kommen zunächst aus der Disposition. Bitte durch die
          tatsächlichen Mengen (z.B. nach Lieferschein) ersetzen oder unten in der Tabelle mit ✓
          bestätigen, wenn die Dispo-Menge bereits stimmt.
        </div>
      ) : null}
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

      <details
        className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4"
        id="detail-form"
      >
        <summary className="cursor-pointer text-sm font-bold text-gray-800">
          Manuelle Detailposition erfassen
        </summary>
        <DetailEntryForm
          action={action}
          equipmentOptions={equipmentOptions}
          hourEntryOptions={hourEntryOptions}
          projectId={projectId}
          reportId={reportId}
          updateAction={updateAction}
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
  effectiveInvoiceRevenueCents,
  hasGehaltHours,
  invoiceRevenueCents,
  nachlassPercent,
  openWipCents,
  performanceValueCents,
  skontoNachlassPercent,
  skontoPercent,
  totalContractCents,
}: {
  actualHours: number;
  billedHours: number;
  costAnalysisRows: CostAnalysisRow[];
  effectiveInvoiceRevenueCents: number;
  hasGehaltHours: boolean;
  invoiceRevenueCents: number;
  nachlassPercent: number;
  openWipCents: number;
  performanceValueCents: number;
  skontoNachlassPercent: number;
  skontoPercent: number;
  totalContractCents: number;
}) {
  const actualCostCents =
    costAnalysisRows.find((row) => row.label === "∑ Kosten")?.actualCents ?? 0;
  const resultBaseCents = Math.max(performanceValueCents, effectiveInvoiceRevenueCents);
  const forecastCents = resultBaseCents - actualCostCents;
  const billingPercent = totalContractCents > 0
    ? invoiceRevenueCents / totalContractCents
    : 0;
  const costCoverageCents = effectiveInvoiceRevenueCents - actualCostCents;
  const marginPercent = effectiveInvoiceRevenueCents > 0
    ? costCoverageCents / effectiveInvoiceRevenueCents
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
          detail={
            skontoNachlassPercent > 0
              ? `Rechnungsstand ${formatPercent(billingPercent)} · nach Skonto/Nachlass ${formatMoney(effectiveInvoiceRevenueCents)}`
              : `Rechnungsstand ${formatPercent(billingPercent)}`
          }
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

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold text-gray-700">
          Wie berechnen sich die Werte? (alle Beträge netto)
        </summary>
        <ul className="mt-2 space-y-1.5 leading-5">
          <li>
            <span className="font-semibold text-gray-800">Auftrag / Abrechnung</span> = bisher
            abgerechneter Umsatz (aus den Rechnungsmengen/iTWO-Import dieser Leistungsmeldung).
            Rechnungsstand = Anteil davon am Gesamtauftrag.
          </li>
          <li>
            <span className="font-semibold text-gray-800">Offene Leistung / WIP</span> = bereits
            erbrachte, aber noch nicht abgerechnete Leistung (Leistungswert minus abgerechneter
            Umsatz, mindestens 0).
          </li>
          <li>
            <span className="font-semibold text-gray-800">Ergebnis nach Istkosten</span> =
            abgerechneter Umsatz (bei Skonto/Nachlass &gt; 0% bereits davon abgezogen) minus
            erfasste Istkosten. <span className="font-semibold text-gray-800">DB</span>{" "}
            (Deckungsbeitrag) zeigt dasselbe Ergebnis als Prozentsatz vom abgerechneten Umsatz -
            also wie viel vom Umsatz nach Abzug aller erfassten Kosten noch übrig bleibt.
          </li>
          <li>
            <span className="font-semibold text-gray-800">Skonto/Nachlass</span> = Nachlass
            mindert zuerst den Netto-Umsatz, danach mindert Skonto den (bereits um Nachlass
            reduzierten) Betrag - nacheinander, nicht einfach addiert (Skonto wirkt in der Praxis
            auf den Bruttobetrag, was in Netto-Rechnung auf denselben Prozentsatz hinausläuft, nur
            eben auf den bereits nachlassreduzierten Betrag). Der resultierende Betrag steht ganz
            unten als eigene Zeile &bdquo;Umsatz nach Skonto/Nachlass&ldquo;.
          </li>
          <li>
            <span className="font-semibold text-gray-800">Stunden</span> = Differenz zwischen
            erfassten Ist-Stunden und den durch die Abrechnung &quot;verdienten&quot; Stunden
            (Rechnungsmenge × Std./ME je Position).
          </li>
        </ul>
      </details>

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
        {skontoNachlassPercent > 0 ? (
          <SmallAnalysisLine
            label={`Umsatz nach Skonto (${formatPercent(skontoPercent / 100)}) / Nachlass (${formatPercent(
              nachlassPercent / 100,
            )})`}
            tone="neutral"
            value={formatMoney(effectiveInvoiceRevenueCents)}
          />
        ) : null}
      </div>
    </section>
  );
}

function UmlageComparisonSection({
  actualAgkPercent,
  actualBgkPercent,
  actualFreierZuschlagPercent,
  actualUmlagePercent,
  actualWugPercent,
  dbVorUmlagePercent,
  ergebnisVorUmlageCents,
  normalAgkPercent,
  normalBgkPercent,
  normalFreierZuschlagPercent,
  normalUmlagePercent,
  normalWugPercent,
  totalContractCents,
  umlageGewinnCents,
  umsatzVorUmlageCents,
}: {
  actualAgkPercent: number;
  actualBgkPercent: number;
  actualFreierZuschlagPercent: number;
  actualUmlagePercent: number;
  actualWugPercent: number;
  dbVorUmlagePercent: number;
  ergebnisVorUmlageCents: number;
  normalAgkPercent: number;
  normalBgkPercent: number;
  normalFreierZuschlagPercent: number;
  normalUmlagePercent: number;
  normalWugPercent: number;
  totalContractCents: number;
  umlageGewinnCents: number;
  umsatzVorUmlageCents: number;
}) {
  if (totalContractCents <= 0) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
        Auswertung
      </p>
      <h2 className="mt-1 text-xl font-bold text-gray-950">Umlage-Vergleich</h2>
      <p className="mt-1 text-sm text-gray-600">
        Zusätzlicher Gewinn durch einen von der normalen Umlage abweichenden
        Kalkulationszuschlag auf die Leistungen.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <AnalysisCard
          detail={`AGK ${formatPercent(actualAgkPercent / 100)} · WuG ${formatPercent(
            actualWugPercent / 100,
          )} · BGK ${formatPercent(actualBgkPercent / 100)} · Zuschlag ${formatPercent(
            actualFreierZuschlagPercent / 100,
          )}`}
          label="Tatsächliche Umlage"
          tone="neutral"
          value={formatPercent(actualUmlagePercent / 100)}
        />
        <AnalysisCard
          detail={`AGK ${formatPercent(normalAgkPercent / 100)} · WuG ${formatPercent(
            normalWugPercent / 100,
          )} · BGK ${formatPercent(normalBgkPercent / 100)} · Zuschlag ${formatPercent(
            normalFreierZuschlagPercent / 100,
          )}`}
          label="Normale Umlage"
          tone="neutral"
          value={formatPercent(normalUmlagePercent / 100)}
        />
        <AnalysisCard
          detail="ggü. Auftragssumme mit normaler Umlage"
          label="Zusätzlicher Gewinn durch Umlage"
          tone={umlageGewinnCents >= 0 ? "good" : "bad"}
          value={formatMoney(umlageGewinnCents)}
        />
        <AnalysisCard
          detail="abgerechneter Umsatz ohne Umlage-Anteil"
          label="Umsatz vor Umlage"
          tone="neutral"
          value={formatMoney(umsatzVorUmlageCents)}
        />
        <AnalysisCard
          detail={`DB vor Umlage ${formatPercent(dbVorUmlagePercent)}`}
          label="Ergebnis vor Umlage"
          tone={ergebnisVorUmlageCents >= 0 ? "good" : "bad"}
          value={formatMoney(ergebnisVorUmlageCents)}
        />
      </div>

      <details className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <summary className="cursor-pointer font-semibold text-gray-700">
          Wie berechnet sich der Umlage-Vergleich?
        </summary>
        <p className="mt-2 leading-5">
          Aus der echten Auftragssumme wird mit der tatsächlichen Umlage die
          Kalkulations-Kostenbasis zurückgerechnet (Auftragssumme ÷ (1 + tatsächliche
          Umlage%)). Daraus wird eine hypothetische Auftragssumme mit der normalen Umlage
          berechnet. Die Differenz zur echten Auftragssumme zeigt, wie viel zusätzlichen
          (oder weniger) Gewinn der abweichende Zuschlag gegenüber dem Standard bringt.
        </p>
        <p className="mt-2 leading-5">
          <span className="font-semibold text-gray-800">Umsatz/Ergebnis vor Umlage</span> =
          dieselbe Rückrechnung, aber angewendet auf den tatsächlich abgerechneten Umsatz
          (nach Skonto/Nachlass) statt auf die Auftragssumme - zeigt, was vom Ergebnis übrig
          bleibt, wenn man den kompletten Umlage-Zuschlag herausrechnet.
        </p>
      </details>
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

function DataTable({
  columns,
  headerAction,
  rows,
  title,
}: {
  columns: string[];
  headerAction?: ReactNode;
  rows: ReactNode[][];
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-3 py-2">
        <span className="text-sm font-bold text-gray-950">{title}</span>
        {headerAction}
      </div>
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
  percent,
  value,
}: {
  dark?: boolean;
  detail?: string;
  label: string;
  percent?: { tone: "good" | "bad"; value: string };
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
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold">{value}</p>
        {percent ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              percent.tone === "good"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            DB {percent.value}
          </span>
        ) : null}
      </div>
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

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
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

/** Zeigt bei Material/Geräte in "Leistungsmeldung nach Leistung" deutlich,
 * ob die Menge schon als tatsächlich verbaut bestätigt wurde oder noch
 * die reine Dispo-Schätzung ist - in "nach Disposition" ist die Menge
 * bewusst nur die Dispo-Schätzung, daher dort kein Warnhinweis. */
function getDetailStatusBadge(status: string, costType: string, hoursSource: string) {
  if (status === "tatsächlich verbaut") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
        ✓ tatsächlich verbaut
      </span>
    );
  }

  const needsCheck =
    (costType === "Material" || costType === "Geräte") && hoursSource === "APPROVED_TIME";

  if (needsCheck) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
        ⚠ {status}
      </span>
    );
  }

  return <span className="text-xs text-gray-600">{status}</span>;
}

/** Gleiches Prinzip wie getDetailStatusBadge, für Stunden-Positionen -
 * ohne costType-Filter, da bei Stunden die Unterscheidung
 * geschätzt/tatsächlich verbaut unabhängig von einer Kostenart gilt. */
function getHourStatusBadge(status: string, hoursSource: string) {
  if (status === "tatsächlich verbaut") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">
        ✓ tatsächlich verbaut
      </span>
    );
  }

  if (hoursSource === "APPROVED_TIME") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
        ⚠ {status}
      </span>
    );
  }

  return <span className="text-xs text-gray-600">{status}</span>;
}

function getSourceLabel(source: string, notes?: string | null) {
  if (source === "DISPOSITION_IMPORT" || source === "DISPOSITION_IMPORT_EDITED") {
    const suffix = source === "DISPOSITION_IMPORT_EDITED" ? " (angepasst)" : "";
    const normalizedNotes = notes?.toLowerCase() ?? "";

    if (normalizedNotes.includes("zeiterfassung")) {
      return `Zeiterfassung${suffix}`;
    }
    if (normalizedNotes.includes("planung")) {
      return `Personaleinsatzplanung${suffix}`;
    }
    if (normalizedNotes.includes("sonderfahrzeugdisposition")) {
      return `Sonderfahrzeugdispo${suffix}`;
    }
    if (
      normalizedNotes.includes("lkw") ||
      normalizedNotes.includes("asphalt-zuteilung") ||
      normalizedNotes.includes("anspritzmittel-zuteilung")
    ) {
      return `LKW-Disposition${suffix}`;
    }
    if (normalizedNotes.includes("asphaltdisposition")) {
      return `Asphaltdispo${suffix}`;
    }
    if (normalizedNotes.includes("gerätedisposition")) {
      return `Gerätedispo${suffix}`;
    }
    if (normalizedNotes.includes("inventar-zuweisung")) {
      return `Inventar-Zuweisung${suffix}`;
    }

    return `Disposition / Inventar${suffix}`;
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
