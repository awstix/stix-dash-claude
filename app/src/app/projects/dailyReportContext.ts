import { prisma } from "@/lib/prisma";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";
import { getNetWorkHoursForDay, type WorkTimeDaySettings } from "@/lib/work-time";

export type DailyReportCountRow = {
  count: number;
  hours: number;
  key: string;
  label: string;
};

export type DailyReportMaterialRow = {
  key: string;
  label: string;
  quantity: number;
  unit: string;
};

export type DailyReportCompositionLine = {
  detail: string;
  /** Gruppierte Maschinen-Bezeichnung (z. B. "LKW 2-Achser"), wie sie auch
   * für die aggregierte Geräte-Zeile verwendet wird - erlaubt der
   * Herkunfts-Anzeige eine exakte Zuordnung statt einer Text-Suche über den
   * (meist abweichenden) echten Fahrzeugnamen in `label`. */
  groupLabel?: string;
  /** Rohe Stundenzahl dieser Zeile (nur bei Geräte-/Sonstiges-Zeilen gesetzt)
   * - erlaubt eine exakte Neuberechnung bei Arbeitszeit-Änderungen, ohne die
   * formatierte `quantity`-Anzeige zurückparsen zu müssen. */
  hours?: number;
  label: string;
  quantity: string;
  source: string;
};

export type DailyReportComposition = {
  labor: DailyReportCompositionLine[];
  machines: DailyReportCompositionLine[];
  materials: DailyReportCompositionLine[];
  other: DailyReportCompositionLine[];
  subcontractors: DailyReportCompositionLine[];
};

export type DailyReportPhoto = {
  capturedAtLabel: string;
  dateKey: string;
  id: string;
  notes: string;
  publicUrl: string;
  selected: boolean;
};

export type DailyReportPhotoGridLayout = "1x2" | "2x2" | "2x3" | "2x4";

export type DailyReportContext = {
  approvedAt: Date | null;
  approvedByName: string;
  approvedFields: string[];
  break1From: string;
  break1To: string;
  break2From: string;
  break2To: string;
  composition: DailyReportComposition;
  createdAt: Date | null;
  createdByName: string;
  dateKey: string;
  dateLabel: string;
  id: string | null;
  laborRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  otherRows: DailyReportMaterialRow[];
  photos: DailyReportPhoto[];
  photoGridLayout: DailyReportPhotoGridLayout;
  performanceLines: string[];
  projectNoteLines: string[];
  projectName: string;
  projectNumber: string;
  reportNumber: number | null;
  sheetNumber: string;
  siteDiscussionNotes: string;
  siteDiscussionRoles: string[];
  siteDiscussionThirdPartyName: string;
  subcontractorRows: DailyReportCountRow[];
  contractorSignatureDataUrl: string;
  clientSignatureDataUrl: string;
  showRealMachineNames: boolean;
  status: string;
  suggestions: DailyReportSuggestionValues;
  tempMax: string;
  tempMin: string;
  trafficSafetyFirstCheckTime: string;
  trafficSafetySecondCheckTime: string;
  weatherLabel: string;
  weatherNotes: string;
  weekday: string;
  workEnd: string;
  workStart: string;
};

export type DailyReportSuggestionValues = {
  approvedBreak1From: string;
  approvedBreak1To: string;
  approvedBreak2From: string;
  approvedBreak2To: string;
  /** Freigegebene reale Arbeitszeit, falls für den Tag bereits eine
   * Kolonnen-Zeiterfassung freigegeben wurde (sonst leer). */
  approvedWorkEnd: string;
  approvedWorkStart: string;
  break1From: string;
  break1To: string;
  break2From: string;
  break2To: string;
  laborRows: DailyReportCountRow[];
  groupedMachineRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  otherRows: DailyReportMaterialRow[];
  realMachineRows: DailyReportCountRow[];
  subcontractorRows: DailyReportCountRow[];
  performanceLines: string[];
  /** Pausen laut Arbeitszeit-Vorlage/Jahreskalender für diesen Tag (unabhängig
   * von einer eventuell freigegebenen Zeiterfassung). */
  planBreak1From: string;
  planBreak1To: string;
  planBreak2From: string;
  planBreak2To: string;
  /** Geplante Arbeitszeit laut Arbeitszeit-Vorlage/Jahreskalender für diesen Tag. */
  planWorkEnd: string;
  planWorkStart: string;
  projectName: string;
  projectNumber: string;
  tempMax: string;
  tempMin: string;
  weatherLabel: string;
  weatherNotes: string;
  weekday: string;
  workEnd: string;
  workStart: string;
};

type CountHours = {
  count: number;
  hours: number;
};

type MachineBucket = CountHours & {
  label: string;
  section: "MACHINES" | "OTHER";
};

type DriverLaborBucket = {
  category: string;
  hours: number;
  sourceKeys: Set<string>;
};

type DailyReportInventoryItem = {
  category: {
    dailyReportMachineLabel: string | null;
    dailyReportSection: string;
    name: string;
    parentCategory: {
      dailyReportMachineLabel: string | null;
      dailyReportSection: string;
      name: string;
      useInDailyReports: boolean;
    } | null;
    useInDailyReports: boolean;
  } | null;
  manufacturer: string | null;
  model: string | null;
  inventoryNumber: string | null;
  name: string;
  objectNumber: string | null;
  stockUnit: string;
};

const laborLabels = [
  "Polier",
  "Vorarbeiter",
  "Facharbeiter",
  "Fachwerker",
  "LKW-Fahrer",
  "Baugeräteführer",
] as const;

const leftMachineLabels = [
  "Mobilbagger",
  "Kettenbagger",
  "LKW 2-Achser",
  "LKW 3-Achser",
  "LKW 4-Achser",
  "LKW Abrollkipper",
  "LKW Sattelzug",
  "Planierraupe",
  "Grader",
] as const;

const rightMachineLabels = [
  "Erdbauwalze / Walzenzug",
  "Radlader",
  "Kompressor",
] as const;

const reportStatuses = new Set(["DRAFT", "APPROVED"]);

export const dailyReportPerformanceLineLimit = 8;

export const dailyReportApprovalFieldIds = [
  "project",
  "weather",
  "workTime",
  "trafficSafety",
  "labor",
  "machines",
  "materials",
  "performance",
] as const;

export function toDailyReportDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function addDailyReportDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export async function getDailyReportSourceProject(
  projectId: string,
  reportDate: Date,
  nextDate: Date,
) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      asphaltDispatchEntries: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          asphaltMixType: true,
          tackCoatMaterialType: true,
        },
      },
      asphaltLoadAllocations: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          driver: {
            include: {
              employee: {
                include: {
                  positions: true,
                },
              },
            },
          },
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      crewPlanningRows: {
        where: {
          projectId,
          assignments: {
            some: {
              endDate: {
                gte: reportDate,
              },
              startDate: {
                lte: reportDate,
              },
            },
          },
        },
        include: {
          assignments: {
            where: {
              endDate: {
                gte: reportDate,
              },
              startDate: {
                lte: reportDate,
              },
            },
            include: {
              crew: {
                include: {
                  defaultVehicles: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      vehicle: {
                        include: vehicleInventoryLinkInclude,
                      },
                    },
                    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
                  },
                  members: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      employee: {
                        include: {
                          positions: true,
                        },
                      },
                    },
                  },
                },
              },
              extraEmployees: {
                include: {
                  employee: {
                    include: {
                      positions: true,
                    },
                  },
                },
              },
              extraVehicles: {
                include: {
                  vehicle: {
                    include: vehicleInventoryLinkInclude,
                  },
                },
              },
            },
          },
        },
      },
      dailyReports: {
        where: {
          reportDate,
        },
        include: {
          photos: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        take: 1,
      },
      equipmentDispatchAssignments: {
        where: {
          endDate: {
            gte: reportDate,
          },
          startDate: {
            lte: reportDate,
          },
        },
        include: {
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      shortHaulAssignments: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          driver: {
            include: {
              employee: {
                include: {
                  positions: true,
                },
              },
            },
          },
          tours: true,
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      specialVehicleDispatchAssignments: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          operatorDriver: {
            include: {
              employee: {
                include: {
                  positions: true,
                },
              },
            },
          },
          transportVehicle: {
            include: vehicleInventoryLinkInclude,
          },
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      tackCoatLoadAllocations: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          driver: {
            include: {
              employee: {
                include: {
                  positions: true,
                },
              },
            },
          },
          vehicle: {
            include: vehicleInventoryLinkInclude,
          },
        },
      },
      truckLongHaulEntries: {
        where: {
          workDate: {
            gte: reportDate,
            lt: nextDate,
          },
        },
        include: {
          materialType: true,
          truckAssignments: {
            include: {
              driver: {
                include: {
                  employee: {
                    include: {
                      positions: true,
                    },
                  },
                },
              },
              vehicle: {
                include: vehicleInventoryLinkInclude,
              },
            },
          },
        },
      },
      weatherLogs: {
        where: {
          weatherDate: reportDate,
        },
        take: 1,
      },
      photos: {
        where: {
          availableForDailyReports: true,
          mimeType: {
            in: ["image/jpeg", "image/png"],
          },
        },
        orderBy: [{ capturedAt: "desc" }, { uploadedAt: "desc" }],
      },
      projectNotes: {
        where: {
          includeInDailyReport: true,
          OR: [
            {
              noteDate: reportDate,
              noteEndDate: null,
            },
            {
              noteDate: {
                lte: reportDate,
              },
              noteEndDate: {
                gte: reportDate,
              },
            },
          ],
          visibility: {
            in: ["DISPATCH", "BTB"],
          },
        },
        orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!project) {
    return null;
  }

  const inventoryItemIds = new Set<string>();
  const addInventoryItemId = (id: string | null | undefined) => {
    const cleanId = String(id ?? "").trim();
    if (cleanId) inventoryItemIds.add(cleanId);
  };

  for (const entry of project.asphaltDispatchEntries) {
    addInventoryItemId(entry.asphaltInventoryItemId);
    addInventoryItemId(entry.tackCoatInventoryItemId);
  }

  for (const allocation of project.asphaltLoadAllocations) {
    addInventoryItemId(allocation.asphaltInventoryItemId);
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    addInventoryItemId(allocation.tackCoatInventoryItemId);
  }

  for (const entry of project.truckLongHaulEntries) {
    addInventoryItemId(entry.materialInventoryItemId);
  }

  for (const assignment of project.shortHaulAssignments) {
    for (const tour of assignment.tours) {
      addInventoryItemId(tour.itemId);
    }
  }

  const dailyReportInventoryItems =
    inventoryItemIds.size > 0
      ? await prisma.inventoryItem.findMany({
          where: {
            id: {
              in: Array.from(inventoryItemIds),
            },
            status: {
              notIn: ["DELETED", "INACTIVE"],
            },
          },
          select: {
            category: {
              select: {
                dailyReportMachineLabel: true,
                dailyReportSection: true,
                name: true,
                parentCategory: {
                  select: {
                    dailyReportMachineLabel: true,
                    dailyReportSection: true,
                    name: true,
                    useInDailyReports: true,
                  },
                },
                useInDailyReports: true,
              },
            },
            id: true,
            manufacturer: true,
            model: true,
            inventoryNumber: true,
            name: true,
            objectNumber: true,
            stockUnit: true,
          },
        })
      : [];
  const asphaltDispatchCrewNames = Array.from(
    new Set(
      project.asphaltDispatchEntries
        .map((entry) => entry.crew.trim())
        .filter(Boolean),
    ),
  );
  const dailyReportAsphaltCrews =
    asphaltDispatchCrewNames.length > 0
      ? await prisma.crew.findMany({
          where: {
            name: {
              in: asphaltDispatchCrewNames,
            },
            isActive: true,
          },
          include: {
            defaultVehicles: {
              where: {
                isActive: true,
              },
              include: {
                vehicle: {
                  include: vehicleInventoryLinkInclude,
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
            members: {
              where: {
                isActive: true,
              },
              include: {
                employee: {
                  include: {
                    positions: true,
                  },
                },
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        })
      : [];
  const crewTimeEntries = await prisma.crewTimeEntry.findMany({
    include: { employees: true },
    where: {
      projectId,
      status: "APPROVED",
      workDate: {
        gte: reportDate,
        lt: nextDate,
      },
    },
  });

  return {
    ...project,
    crewTimeEntries,
    dailyReportAsphaltCrews,
    dailyReportInventoryItems,
  };
}

type ReportProject = NonNullable<
  Awaited<ReturnType<typeof getDailyReportSourceProject>>
>;

export function buildDailyReportContext(
  project: ReportProject,
  dateKey: string,
  requestedSheetNumber: string,
  reportWorkDay: WorkTimeDaySettings,
): DailyReportContext {
  const labor = new Map<string, CountHours>();
  const crewLaborEmployeeIds = new Set<string>();
  const driverLabor = new Map<string, DriverLaborBucket>();
  const materialRows = new Map<string, DailyReportMaterialRow>();
  const machines = new Map<string, MachineBucket>();
  const realMachines = new Map<string, MachineBucket>();
  const subcontractors = new Map<string, CountHours>();
  const composition: DailyReportComposition = {
    labor: [],
    machines: [],
    materials: [],
    other: [],
    subcontractors: [],
  };
  const workTimes: { end: string; start: string }[] = [];
  const performanceLines: string[] = [];
  const specialVehicleMachineKeys = new Set<string>();
  const inventoryItemsById = new Map(
    project.dailyReportInventoryItems.map((item) => [item.id, item]),
  );
  const asphaltCrewsByName = new Map(
    project.dailyReportAsphaltCrews.map((crew) => [crew.name.trim(), crew]),
  );
  const reportWorkHours =
    getNetWorkHoursForDay(reportWorkDay) ||
    durationHours(reportWorkDay.startTime, reportWorkDay.endTime);
  const capturedEmployeeIds = new Set(
    project.crewTimeEntries.flatMap((entry) =>
      entry.employees
        .filter((employee) => employee.isPresent)
        .map((employee) => employee.employeeId),
    ),
  );
  // Alle Dispo-Quellen (Kolonnenplanung, Asphalt-Dispo, Sonderfahrzeug-/LKW-
  // Fahrer) prüfen unten gegen crewLaborEmployeeIds, ob eine Person schon
  // gezählt wurde - vorbelegt mit den Zeiterfassungs-Personen, damit niemand
  // doppelt (einmal mit echten Zeiterfassungs-Stunden, einmal zusätzlich mit
  // Dispo-Sollstunden) gezählt wird.
  for (const employeeId of capturedEmployeeIds) {
    crewLaborEmployeeIds.add(employeeId);
  }
  const hasApprovedCrewTimes = project.crewTimeEntries.some(
    (entry) => entry.status === "APPROVED",
  );
  for (const entry of project.crewTimeEntries) {
    workTimes.push({
      end: entry.defaultEndTime,
      start: entry.defaultStartTime,
    });
    for (const employee of entry.employees) {
      if (!employee.isPresent) continue;
      const category = mapLaborCategory([employee.roleLabel]);
      addCountHours(labor, category, 1, employee.netHours);
      addCompositionLine(composition.labor, {
        detail: `${category} · ${employee.startTime}–${employee.endTime} Uhr`,
        label: employee.employeeName,
        quantity: `${formatDecimal(employee.netHours)} Std.`,
        source:
          entry.status === "APPROVED"
            ? `Freigegebene Zeiterfassung · ${entry.crewName}`
            : `Eingereichte Zeiterfassung · ${entry.crewName}`,
      });
    }
  }

  // Fahrzeuge, die an diesem Tag bereits über eine eigene, konkret
  // dokumentierte Disposition (Zeiten/Touren) laufen - Standardfahrzeuge
  // einer Kolonne (Kolonnenplanung/Asphalt-Dispo) werden weiter unten nur
  // ergänzt, wenn das jeweilige Objekt hier noch nicht auftaucht, damit
  // dasselbe Fahrzeug nicht zusätzlich über die pauschale Kolonnenzuordnung
  // mitgezählt wird.
  const explicitlyDispatchedVehicleIds = new Set<string>(
    [
      ...project.equipmentDispatchAssignments.map((item) => item.vehicle?.id),
      ...project.specialVehicleDispatchAssignments.flatMap((item) => [
        item.vehicle?.id,
        item.transportVehicle?.id,
      ]),
      ...project.shortHaulAssignments.map((item) => item.vehicle?.id),
      ...project.truckLongHaulEntries.flatMap((entry) =>
        entry.truckAssignments.map((truck) => truck.vehicle?.id),
      ),
      ...project.asphaltLoadAllocations.map((item) => item.vehicle?.id),
      ...project.tackCoatLoadAllocations.map((item) => item.vehicle?.id),
    ].filter((id): id is string => Boolean(id)),
  );

  for (const row of project.crewPlanningRows) {
    for (const assignment of row.assignments) {
      if (!hasApprovedCrewTimes) {
        workTimes.push({
          end: assignment.endTime,
          start: assignment.startTime,
        });
      }
      const hours = durationHours(assignment.startTime, assignment.endTime);

      for (const member of assignment.crew?.members ?? []) {
        if (capturedEmployeeIds.has(member.employeeId)) continue;
        crewLaborEmployeeIds.add(member.employeeId);
        const category = mapLaborCategory([
          member.roleText,
          ...member.employee.positions.map((position) => position.positionLabel),
          ...member.employee.positions.map((position) => position.positionValue),
        ]);
        addCountHours(labor, category, 1, hours);
        addCompositionLine(composition.labor, {
          detail: `${category} · ${assignment.startTime}–${assignment.endTime} Uhr`,
          label: employeeName(member.employee),
          quantity: `${formatDecimal(hours)} Std.`,
          source: `Kolonnenplanung · ${assignment.crew?.name ?? "Kolonne"}`,
        });
      }

      for (const extraEmployee of assignment.extraEmployees) {
        if (capturedEmployeeIds.has(extraEmployee.employeeId)) continue;
        crewLaborEmployeeIds.add(extraEmployee.employeeId);
        const category = mapLaborCategory([
          ...extraEmployee.employee.positions.map(
            (position) => position.positionLabel,
          ),
          ...extraEmployee.employee.positions.map(
            (position) => position.positionValue,
          ),
        ]);
        addCountHours(labor, category, 1, hours);
        addCompositionLine(composition.labor, {
          detail: `${category} · ${assignment.startTime}–${assignment.endTime} Uhr`,
          label: employeeName(extraEmployee.employee),
          quantity: `${formatDecimal(hours)} Std.`,
          source: "Kolonnenplanung · Zusatz-Mitarbeiter",
        });
      }

      const assignmentVehicleKeys = new Set<string>();
      for (const defaultVehicle of assignment.crew?.defaultVehicles ?? []) {
        if (explicitlyDispatchedVehicleIds.has(defaultVehicle.vehicle.id)) continue;
        addMachineOnce(
          machines,
          realMachines,
          assignmentVehicleKeys,
          defaultVehicle.vehicle,
          hours,
        );
        addVehicleCompositionLine(composition, defaultVehicle.vehicle, hours, "Kolonnenplanung");
      }

      for (const extraVehicle of assignment.extraVehicles) {
        if (explicitlyDispatchedVehicleIds.has(extraVehicle.vehicle.id)) continue;
        addMachineOnce(
          machines,
          realMachines,
          assignmentVehicleKeys,
          extraVehicle.vehicle,
          hours,
        );
        addVehicleCompositionLine(composition, extraVehicle.vehicle, hours, "Kolonnenplanung · Zusatzgerät");
      }

    }
  }

  const asphaltCrewHours = reportWorkHours;
  const countedAsphaltCrewNames = new Set<string>();
  const asphaltCrewVehicleKeys = new Set<string>();

  for (const entry of project.asphaltDispatchEntries) {
    const crewName = entry.crew.trim();
    if (!crewName || countedAsphaltCrewNames.has(crewName)) continue;

    const crew = asphaltCrewsByName.get(crewName);
    if (!crew) continue;

    countedAsphaltCrewNames.add(crewName);

    for (const member of crew.members) {
      if (crewLaborEmployeeIds.has(member.employeeId)) continue;

      crewLaborEmployeeIds.add(member.employeeId);
      const category = mapLaborCategory([
        member.roleText,
        ...member.employee.positions.map((position) => position.positionLabel),
        ...member.employee.positions.map((position) => position.positionValue),
      ]);
      addCountHours(labor, category, 1, asphaltCrewHours);
      addCompositionLine(composition.labor, {
        detail: `${category} · ${reportWorkDay.startTime}–${reportWorkDay.endTime} Uhr`,
        label: employeeName(member.employee),
        quantity: `${formatDecimal(asphaltCrewHours)} Std.`,
        source: `Asphalt-Dispo · ${crewName}`,
      });
    }

    // Standardfahrzeuge der Kolonne (z. B. eigener LKW, Walze, PKW) - bei
    // Kolonnenplanung werden diese über assignment.crew.defaultVehicles
    // erfasst, bei Asphalt-Dispo-Kolonnen sonst gar nicht, da es dort keine
    // Kolonnenplanung-Zuteilung für den Tag gibt.
    for (const defaultVehicle of crew.defaultVehicles) {
      if (explicitlyDispatchedVehicleIds.has(defaultVehicle.vehicle.id)) continue;
      addMachineOnce(
        machines,
        realMachines,
        asphaltCrewVehicleKeys,
        defaultVehicle.vehicle,
        asphaltCrewHours,
      );
      addVehicleCompositionLine(
        composition,
        defaultVehicle.vehicle,
        asphaltCrewHours,
        `Asphalt-Dispo · ${crewName}`,
      );
    }
  }

  for (const equipment of project.equipmentDispatchAssignments) {
    addMachine(machines, realMachines, equipment.vehicle, 8);
    addVehicleCompositionLine(composition, equipment.vehicle, 8, "Gerätedisposition");
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    workTimes.push({
      end: assignment.endTime,
      start: assignment.startTime,
    });
    const hours = durationHours(assignment.startTime, assignment.endTime);
    addDriverLaborHours({
      crewLaborEmployeeIds,
      driver: assignment.operatorDriver,
      driverLabor,
      driverName: assignment.operatorDriverName,
      fallbackCategory: "Baugeräteführer",
      forcedCategory: "Baugeräteführer",
      hours,
      sourceKey: `special-${assignment.id}`,
      compositionLines: composition.labor,
      sourceLabel: "Sonderfahrzeugdispo",
    });
    const timedMachineKey = getTimedMachineKey(
      assignment.vehicle,
      assignment.startTime,
      assignment.endTime,
    );

    if (assignment.vehicle && getVehicleInventoryItem(assignment.vehicle)) {
      addMachineOnce(
        machines,
        realMachines,
        specialVehicleMachineKeys,
        assignment.vehicle,
        hours,
        timedMachineKey,
      );
      addVehicleCompositionLine(composition, assignment.vehicle, hours, "Sonderfahrzeugdispo");
    } else if (!assignment.vehicleId && assignment.vehicleName) {
      addFallbackMachine(machines, realMachines, assignment.vehicleName, hours);
      addCompositionLine(composition.machines, {
        detail: `${assignment.startTime}–${assignment.endTime} Uhr`,
        groupLabel: resolveMachineGroupLabel(assignment.vehicleName, true),
        hours,
        label: assignment.vehicleName,
        quantity: `${formatDecimal(hours)} Std.`,
        source: "Sonderfahrzeugdispo",
      });
    }

    if (
      assignment.transportVehicle &&
      getVehicleInventoryItem(assignment.transportVehicle)
    ) {
      addMachine(machines, realMachines, assignment.transportVehicle, hours);
      addVehicleCompositionLine(composition, assignment.transportVehicle, hours, "Sonderfahrzeugdispo · Transportfahrzeug");
    } else if (!assignment.transportVehicleId && assignment.transportVehicleName) {
      addFallbackMachine(
        machines,
        realMachines,
        assignment.transportVehicleName,
        hours,
      );
      addCompositionLine(composition.machines, {
        detail: `${assignment.startTime}–${assignment.endTime} Uhr`,
        groupLabel: resolveMachineGroupLabel(assignment.transportVehicleName, true),
        hours,
        label: assignment.transportVehicleName,
        quantity: `${formatDecimal(hours)} Std.`,
        source: "Sonderfahrzeugdispo · Transportfahrzeug",
      });
    }

    const specialVehicleMaterialLabel = getSpecialVehicleMaterialLabel(
        assignment.materialName,
        assignment.taskText,
        assignment.quantityUnit,
        project.asphaltDispatchEntries,
        inventoryItemsById,
      );
    addMaterialRow(
      materialRows,
      assignment.quantity,
      specialVehicleMaterialLabel,
      assignment.quantityUnit,
    );
    addMaterialCompositionLine(
      composition.materials,
      specialVehicleMaterialLabel,
      assignment.quantity,
      assignment.quantityUnit,
      "Sonderfahrzeugdispo",
      `${assignment.startTime}–${assignment.endTime} Uhr`,
    );
  }

  for (const assignment of project.shortHaulAssignments) {
    const tours = assignment.tours.length > 0 ? assignment.tours : [];
    const hours =
      tours.length > 0
        ? tours.reduce(
            (sum, tour) => sum + durationHours(tour.startTime, tour.endTime),
            0,
          )
        : 8;
    addDriverLaborHours({
      crewLaborEmployeeIds,
      driver: assignment.driver,
      driverLabor,
      driverName: assignment.driverName,
      fallbackCategory: "LKW-Fahrer",
      hours,
      sourceKey: `short-${assignment.id}`,
      compositionLines: composition.labor,
      sourceLabel: "LKW-Kurzstrecke",
    });

    if (assignment.vehicle) {
      addMachine(machines, realMachines, assignment.vehicle, hours);
      addVehicleCompositionLine(composition, assignment.vehicle, hours, "LKW-Kurzstrecke");
    } else {
      addFallbackMachine(
        machines,
        realMachines,
        vehicleLabel({
          category: assignment.vehicleCategory,
          number: assignment.vehicleNumber,
          type: assignment.vehicleType,
        }),
        hours,
      );
      addCompositionLine(composition.machines, {
        detail: compactLine([assignment.vehicleCategory, assignment.vehicleType]),
        groupLabel: resolveMachineGroupLabel(
          vehicleLabel({
            category: assignment.vehicleCategory,
            number: assignment.vehicleNumber,
            type: assignment.vehicleType,
          }),
          true,
        ),
        hours,
        label: vehicleLabel({
          category: assignment.vehicleCategory,
          number: assignment.vehicleNumber,
          type: assignment.vehicleType,
        }),
        quantity: `${formatDecimal(hours)} Std.`,
        source: "LKW-Kurzstrecke",
      });
    }

    if (!tours.length && assignment.startTime) {
      workTimes.push({
        end: "17:00",
        start: assignment.startTime,
      });
    }

    for (const tour of tours) {
      workTimes.push({
        end: tour.endTime,
        start: tour.startTime,
      });
      const tourInventoryItem = tour.itemId
        ? inventoryItemsById.get(tour.itemId)
        : null;
      const tourIsMachineTransport =
        tour.purposeType === "TRANSPORT_MACHINE" ||
        isDailyReportMachineInventoryItem(tourInventoryItem);

      if (tourIsMachineTransport && tourInventoryItem) {
        addInventoryMachine(
          machines,
          realMachines,
          tourInventoryItem,
          durationHours(tour.startTime, tour.endTime),
        );
        addInventoryMachineCompositionLine(
          composition,
          tourInventoryItem,
          durationHours(tour.startTime, tour.endTime),
          "LKW-Kurzstrecke · Maschinentransport",
        );
        continue;
      }

      if (!assignment.truckLongHaulEntryId) {
        const materialLabel = getInventoryMaterialLabel(
          inventoryItemsById,
          tour.itemId,
          tour.material ||
            tour.itemName ||
            tour.customPurpose ||
            tour.purposeType,
        );
        const materialUnit = getInventoryMaterialUnit(
          inventoryItemsById,
          tour.itemId,
          tour.quantityUnit,
        );
        addMaterialRow(
          materialRows,
          tour.quantity,
          materialLabel,
          materialUnit,
        );
        addMaterialCompositionLine(
          composition.materials,
          materialLabel,
          tour.quantity,
          materialUnit,
          "LKW-Kurzstrecke",
          `${tour.startTime}–${tour.endTime} Uhr`,
        );
      }
    }
  }

  for (const entry of project.truckLongHaulEntries) {
    const entryInventoryItem = entry.materialInventoryItemId
      ? inventoryItemsById.get(entry.materialInventoryItemId)
      : null;

    if (!isDailyReportMachineInventoryItem(entryInventoryItem)) {
      const materialLabel = getInventoryMaterialLabel(
        inventoryItemsById,
        entry.materialInventoryItemId,
        entry.materialName || entry.materialType?.name,
      );
      const materialUnit = getInventoryMaterialUnit(
        inventoryItemsById,
        entry.materialInventoryItemId,
        entry.materialUnit,
      );
      addMaterialRow(
        materialRows,
        entry.materialQuantity,
        materialLabel,
        materialUnit,
      );
      addMaterialCompositionLine(
        composition.materials,
        materialLabel,
        entry.materialQuantity,
        materialUnit,
        "LKW-Fernverkehr",
        "",
      );
    }

    for (const truck of entry.truckAssignments) {
      const truckHours = durationHours(
        truck.plannedStartTime,
        truck.plannedEndTime,
      );
      workTimes.push({
        end: truck.plannedEndTime,
        start: truck.plannedStartTime,
      });
      if (truck.ownerType !== "OWN" || truck.subcontractorName?.trim()) {
        addCountHours(
          subcontractors,
          truck.subcontractorName?.trim() || "Nachunternehmer",
          1,
          truckHours,
        );
        addCompositionLine(composition.subcontractors, {
          detail: `${truck.plannedStartTime}–${truck.plannedEndTime} Uhr`,
          label: truck.subcontractorName?.trim() || "Nachunternehmer",
          quantity: `1 Fzg. · ${formatDecimal(truckHours)} Std.`,
          source: "LKW-Fernverkehr",
        });
      }
      addDriverLaborHours({
        crewLaborEmployeeIds,
        driver: truck.driver,
        driverLabor,
        driverName: truck.driverName,
        fallbackCategory: "LKW-Fahrer",
        hours: truckHours,
        sourceKey: `long-${truck.id}`,
        compositionLines: composition.labor,
        sourceLabel: "LKW-Fernverkehr",
      });
      if (truck.vehicle) {
        addMachine(machines, realMachines, truck.vehicle, truckHours);
        addVehicleCompositionLine(composition, truck.vehicle, truckHours, "LKW-Fernverkehr");
      } else {
        addFallbackMachine(
          machines,
          realMachines,
          vehicleLabel({
            category: truck.vehicleCategory,
            number: truck.vehicleNumber,
            type: truck.vehicleType,
          }),
          truckHours,
        );
        addCompositionLine(composition.machines, {
          detail: `${truck.plannedStartTime}–${truck.plannedEndTime} Uhr`,
          groupLabel: resolveMachineGroupLabel(
            vehicleLabel({
              category: truck.vehicleCategory,
              number: truck.vehicleNumber,
              type: truck.vehicleType,
            }),
            true,
          ),
          hours: truckHours,
          label: vehicleLabel({
            category: truck.vehicleCategory,
            number: truck.vehicleNumber,
            type: truck.vehicleType,
          }),
          quantity: `${formatDecimal(truckHours)} Std.`,
          source: "LKW-Fernverkehr",
        });
      }
    }
  }

  for (const allocation of project.asphaltLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    const allocationHours = durationHours(allocation.startTime, allocation.endTime);
    addDriverLaborHours({
      crewLaborEmployeeIds,
      driver: allocation.driver,
      driverLabor,
      driverName: allocation.driverName,
      fallbackCategory: "LKW-Fahrer",
      hours: allocationHours,
      sourceKey: `asphalt-${allocation.id}`,
      compositionLines: composition.labor,
      sourceLabel: "Asphalt-LKW-Verteilung",
    });
    if (allocation.ownerType !== "OWN") {
      addCountHours(
        subcontractors,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }) || "Nachunternehmer",
        1,
        allocationHours,
      );
      addCompositionLine(composition.subcontractors, {
        detail: `${allocation.startTime}–${allocation.endTime} Uhr`,
        label:
          vehicleLabel({
            category: allocation.vehicleCategory,
            number: allocation.vehicleNumber,
            type: allocation.vehicleType,
          }) || "Nachunternehmer",
        quantity: `1 Fzg. · ${formatDecimal(allocationHours)} Std.`,
        source: "Asphalt-LKW-Verteilung",
      });
    }
    if (allocation.vehicle) {
      addMachine(machines, realMachines, allocation.vehicle, allocationHours);
      addVehicleCompositionLine(composition, allocation.vehicle, allocationHours, "Asphalt-LKW-Verteilung");
    } else {
      addFallbackMachine(
        machines,
        realMachines,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        allocationHours,
      );
      addCompositionLine(composition.machines, {
        detail: `${allocation.startTime}–${allocation.endTime} Uhr`,
        groupLabel: resolveMachineGroupLabel(
          vehicleLabel({
            category: allocation.vehicleCategory,
            number: allocation.vehicleNumber,
            type: allocation.vehicleType,
          }),
          true,
        ),
        hours: allocationHours,
        label: vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        quantity: `${formatDecimal(allocationHours)} Std.`,
        source: "Asphalt-LKW-Verteilung",
      });
    }
    const asphaltMaterialLabel = getInventoryMaterialLabel(
      inventoryItemsById,
      allocation.asphaltInventoryItemId,
      allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
    );
    addMaterialRow(
      materialRows,
      allocation.totalTons,
      asphaltMaterialLabel,
      "t",
    );
    addMaterialCompositionLine(
      composition.materials,
      asphaltMaterialLabel,
      allocation.totalTons,
      "t",
      "Asphalt-LKW-Verteilung",
      `${allocation.startTime}–${allocation.endTime} Uhr`,
    );
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    const allocationHours = durationHours(allocation.startTime, allocation.endTime);
    addDriverLaborHours({
      crewLaborEmployeeIds,
      driver: allocation.driver,
      driverLabor,
      driverName: allocation.driverName,
      fallbackCategory: "LKW-Fahrer",
      hours: allocationHours,
      sourceKey: `tack-${allocation.id}`,
      compositionLines: composition.labor,
      sourceLabel: "Anspritzmittel-Verteilung",
    });
    const timedMachineKey = getTimedMachineKey(
      allocation.vehicle,
      allocation.startTime,
      allocation.endTime,
    );
    if (allocation.ownerType !== "OWN") {
      addCountHours(
        subcontractors,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }) || "Nachunternehmer",
        1,
        allocationHours,
      );
      addCompositionLine(composition.subcontractors, {
        detail: `${allocation.startTime}–${allocation.endTime} Uhr`,
        label:
          vehicleLabel({
            category: allocation.vehicleCategory,
            number: allocation.vehicleNumber,
            type: allocation.vehicleType,
          }) || "Nachunternehmer",
        quantity: `1 Fzg. · ${formatDecimal(allocationHours)} Std.`,
        source: "Anspritzmittel-Verteilung",
      });
    }
    if (allocation.vehicle) {
      addMachineOnce(
        machines,
        realMachines,
        specialVehicleMachineKeys,
        allocation.vehicle,
        allocationHours,
        timedMachineKey,
      );
      addVehicleCompositionLine(composition, allocation.vehicle, allocationHours, "Anspritzmittel-Verteilung");
    } else {
      addFallbackMachine(
        machines,
        realMachines,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        allocationHours,
      );
      addCompositionLine(composition.machines, {
        detail: `${allocation.startTime}–${allocation.endTime} Uhr`,
        groupLabel: resolveMachineGroupLabel(
          vehicleLabel({
            category: allocation.vehicleCategory,
            number: allocation.vehicleNumber,
            type: allocation.vehicleType,
          }),
          true,
        ),
        hours: allocationHours,
        label: vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        quantity: `${formatDecimal(allocationHours)} Std.`,
        source: "Anspritzmittel-Verteilung",
      });
    }
    const tackMaterialLabel = getInventoryMaterialLabel(
      inventoryItemsById,
      allocation.tackCoatInventoryItemId,
      allocation.materialName || "Anspritzmittel",
    );
    const tackMaterialUnit = getInventoryMaterialUnit(
      inventoryItemsById,
      allocation.tackCoatInventoryItemId,
      allocation.quantityUnit,
    );
    addMaterialRow(
      materialRows,
      allocation.totalLiters,
      tackMaterialLabel,
      tackMaterialUnit,
    );
    addMaterialCompositionLine(
      composition.materials,
      tackMaterialLabel,
      allocation.totalLiters,
      tackMaterialUnit,
      "Anspritzmittel-Verteilung",
      `${allocation.startTime}–${allocation.endTime} Uhr`,
    );
  }

  const projectNoteLines = project.projectNotes
    .map((note) =>
      compactLine([
        "Notiz:",
        formatProjectNoteDateRange(note),
        getProjectNoteCategoryLabel(note.category),
        note.title,
        note.content,
      ]),
    )
    .filter(Boolean);

  const dailyReport = project.dailyReports[0] ?? null;
  const weatherLog = project.weatherLogs[0] ?? null;
  const approvedTimeEntry = project.crewTimeEntries.find(
    (entry) => entry.status === "APPROVED",
  );
  // Solange keine Zeiterfassung freigegeben ist, gilt die geplante Arbeitszeit
  // (Vorlage/Jahreskalender). Sobald Stunden freigegeben sind, hat die reale
  // freigegebene Arbeitszeit Vorrang – analog zu den Pausen weiter unten.
  const suggestedWorkStart =
    approvedTimeEntry?.defaultStartTime ||
    reportWorkDay.startTime ||
    earliestTime(workTimes.map((time) => time.start));
  const suggestedWorkEnd =
    approvedTimeEntry?.defaultEndTime ||
    reportWorkDay.endTime ||
    latestTime(workTimes.map((time) => time.end));
  const workTimeWeather = getWeatherForWorkTime(
    weatherLog,
    dateKey,
    suggestedWorkStart,
    suggestedWorkEnd,
  );
  const suggestedWeatherLabel =
    workTimeWeather.label ||
    weatherLog?.weatherCategory ||
    weatherLog?.weatherLabel ||
    "";
  const suggestedTempMin =
    workTimeWeather.tempMin ??
    weatherLog?.tempMinC ??
    weatherLog?.currentTemperatureC ??
    null;
  const suggestedTempMax =
    workTimeWeather.tempMax ??
    weatherLog?.tempMaxC ??
    weatherLog?.currentTemperatureC ??
    null;
  const suggestedWeatherNotes = workTimeWeather.notes || weatherLog?.notes || "";
  addDriverLaborToLaborRows(labor, driverLabor);
  const suggestedLaborRows = buildLaborRows(labor);
  const suggestedSubcontractorRows = buildSubcontractorRows(subcontractors);
  const showRealMachineNames = dailyReport?.showRealMachineNames ?? false;
  const suggestedGroupedMachineRows = buildMachineRows(machines);
  const suggestedMaterialRows = buildMaterialRows(materialRows);
  const suggestedOtherRows = showRealMachineNames
    ? buildRealOtherRows(realMachines)
    : buildOtherRows(machines);
  const suggestedRealMachineRows = buildRealMachineRows(realMachines);
  const suggestedPerformanceLines = compactUnique(performanceLines).slice(
    0,
    dailyReportPerformanceLineLimit,
  );
  const suggestedWeekday = formatWeekday(dateKey);
  // Erst die tatsächlich erfassten Pausen aus einer freigegebenen Zeiterfassung,
  // sonst die Pausen der für diesen Tag geltenden Arbeitszeit (Vorlage oder Kalender).
  const suggestedBreak1From = approvedTimeEntry?.defaultBreak1From || reportWorkDay.breakfastStart || "";
  const suggestedBreak1To = approvedTimeEntry?.defaultBreak1To || reportWorkDay.breakfastEnd || "";
  const suggestedBreak2From = approvedTimeEntry?.defaultBreak2From || reportWorkDay.lunchStart || "";
  const suggestedBreak2To = approvedTimeEntry?.defaultBreak2To || reportWorkDay.lunchEnd || "";
  const suggestedMachineRows = showRealMachineNames
    ? suggestedRealMachineRows
    : suggestedGroupedMachineRows;

  const approvedFields = parseStringList(dailyReport?.approvedFieldsJson).filter(
    (fieldId) => dailyReportApprovalFieldIds.includes(fieldId as never),
  );
  const reportNumber = dailyReport?.reportNumber ?? null;
  const storedSheetNumber = String(dailyReport?.sheetNumber ?? "").trim();
  const sheetNumber = reportNumber
    ? String(reportNumber)
    : storedSheetNumber || requestedSheetNumber || "1";
  const storedPerformanceLines = parseStringList(dailyReport?.performanceJson, []);
  const performanceLinesForReport = dailyReport?.materialJson
    ? storedPerformanceLines
    : filterLegacyMaterialPerformanceLines(storedPerformanceLines);
  const selectedPhotoIds = new Set(
    dailyReport?.photos.map((photo) => photo.photoId) ?? [],
  );

  return {
    approvedAt: dailyReport?.approvedAt ?? null,
    approvedByName: dailyReport?.approvedByName ?? "",
    approvedFields,
    break1From: dailyReport?.break1From || suggestedBreak1From,
    break1To: dailyReport?.break1To || suggestedBreak1To,
    break2From: dailyReport?.break2From || suggestedBreak2From,
    break2To: dailyReport?.break2To || suggestedBreak2To,
    composition,
    createdAt: dailyReport?.createdAt ?? null,
    createdByName: dailyReport?.createdByName ?? "",
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    id: dailyReport?.id ?? null,
    laborRows: parseCountRows(dailyReport?.laborJson, suggestedLaborRows),
    machineRows: parseMachineRows(
      dailyReport?.machinesJson,
      suggestedMachineRows,
      showRealMachineNames,
    ),
    materialRows: parseMaterialRows(
      dailyReport?.materialJson,
      suggestedMaterialRows,
    ),
    otherRows: parseMaterialRows(dailyReport?.otherJson, suggestedOtherRows),
    photos: project.photos.map((photo) => ({
      capturedAtLabel: photo.capturedAt
        ? formatDateLabel(photo.capturedAt.toISOString().slice(0, 10))
        : "",
      dateKey: (photo.capturedAt ?? photo.uploadedAt)
        .toISOString()
        .slice(0, 10),
      id: photo.id,
      notes: photo.notes ?? "",
      publicUrl: photo.publicUrl,
      selected: selectedPhotoIds.has(photo.id),
    })),
    photoGridLayout: parsePhotoGridLayout(dailyReport?.photoGridLayout),
    performanceLines: performanceLinesForReport.slice(
      0,
      dailyReportPerformanceLineLimit,
    ),
    projectNoteLines,
    projectName: dailyReport?.reportProjectName || project.name,
    projectNumber: dailyReport?.reportProjectNumber || project.projectNumber,
    reportNumber,
    sheetNumber,
    siteDiscussionNotes: dailyReport?.siteDiscussionNotes ?? "",
    siteDiscussionRoles: parseStringList(
      dailyReport?.siteDiscussionRolesJson,
      [],
    ),
    siteDiscussionThirdPartyName:
      dailyReport?.siteDiscussionThirdPartyName ?? "",
    subcontractorRows: parseCountRows(
      dailyReport?.subcontractorJson,
      suggestedSubcontractorRows,
    ),
    contractorSignatureDataUrl: dailyReport?.contractorSignatureDataUrl ?? "",
    clientSignatureDataUrl: dailyReport?.clientSignatureDataUrl ?? "",
    showRealMachineNames,
    status: reportStatuses.has(dailyReport?.status ?? "")
      ? dailyReport?.status ?? "DRAFT"
      : "DRAFT",
    suggestions: {
      approvedBreak1From: approvedTimeEntry?.defaultBreak1From ?? "",
      approvedBreak1To: approvedTimeEntry?.defaultBreak1To ?? "",
      approvedBreak2From: approvedTimeEntry?.defaultBreak2From ?? "",
      approvedBreak2To: approvedTimeEntry?.defaultBreak2To ?? "",
      approvedWorkEnd: approvedTimeEntry?.defaultEndTime ?? "",
      approvedWorkStart: approvedTimeEntry?.defaultStartTime ?? "",
      break1From: suggestedBreak1From,
      break1To: suggestedBreak1To,
      break2From: suggestedBreak2From,
      break2To: suggestedBreak2To,
      groupedMachineRows: suggestedGroupedMachineRows,
      laborRows: suggestedLaborRows,
      materialRows: suggestedMaterialRows,
      machineRows: suggestedMachineRows,
      otherRows: suggestedOtherRows,
      performanceLines: suggestedPerformanceLines,
      planBreak1From: reportWorkDay.breakfastStart || "",
      planBreak1To: reportWorkDay.breakfastEnd || "",
      planBreak2From: reportWorkDay.lunchStart || "",
      planBreak2To: reportWorkDay.lunchEnd || "",
      planWorkEnd: reportWorkDay.endTime || "",
      planWorkStart: reportWorkDay.startTime || "",
      projectName: project.name,
      projectNumber: project.projectNumber,
      tempMax: formatTemperature(suggestedTempMax),
      tempMin: formatTemperature(suggestedTempMin),
      realMachineRows: suggestedRealMachineRows,
      subcontractorRows: suggestedSubcontractorRows,
      weatherLabel: suggestedWeatherLabel,
      weatherNotes: suggestedWeatherNotes,
      weekday: suggestedWeekday,
      workEnd: suggestedWorkEnd,
      workStart: suggestedWorkStart,
    },
    tempMax: formatTemperature(dailyReport?.weatherTempMaxC ?? suggestedTempMax),
    tempMin: formatTemperature(dailyReport?.weatherTempMinC ?? suggestedTempMin),
    trafficSafetyFirstCheckTime:
      dailyReport?.trafficSafetyFirstCheckTime ?? "",
    trafficSafetySecondCheckTime:
      dailyReport?.trafficSafetySecondCheckTime ?? "",
    weatherLabel: dailyReport?.weatherCategory || suggestedWeatherLabel,
    weatherNotes: dailyReport?.weatherNotes ?? suggestedWeatherNotes,
    weekday: dailyReport?.weekdayLabel || suggestedWeekday,
    workEnd: dailyReport?.workEnd || suggestedWorkEnd,
    workStart: dailyReport?.workStart || suggestedWorkStart,
  };
}

function parsePhotoGridLayout(
  value: string | null | undefined,
): DailyReportPhotoGridLayout {
  return value === "1x2" ||
    value === "2x2" ||
    value === "2x3" ||
    value === "2x4"
    ? value
    : "2x4";
}

function getWeatherForWorkTime(
  weatherLog: ReportProject["weatherLogs"][number] | null,
  dateKey: string,
  workStart: string,
  workEnd: string,
) {
  const fallback = {
    label: "",
    notes: "",
    tempMax: null as number | null,
    tempMin: null as number | null,
  };

  if (!weatherLog?.hourlyJson) return fallback;

  const hourly = parseHourlyWeather(weatherLog.hourlyJson);
  const startMinutes = parseTime(workStart) ?? 0;
  const endMinutes = parseTime(workEnd) ?? 24 * 60;
  const rows = hourly
    .map((entry) => ({
      ...entry,
      minutes: getDateTimeMinutes(entry.time),
    }))
    .filter(
      (entry) =>
        entry.time.startsWith(dateKey) &&
        entry.minutes !== null &&
        entry.minutes >= startMinutes &&
        entry.minutes <= endMinutes,
    );

  if (rows.length === 0) return fallback;

  const temperatures = rows
    .map((entry) => entry.temperature)
    .filter((value): value is number => value !== null);
  const codes = rows
    .map((entry) => entry.weatherCode)
    .filter((value): value is number => value !== null);
  const precipitation = rows.reduce(
    (sum, entry) => sum + (entry.precipitation ?? 0),
    0,
  );
  const label = getMostFrequentWeatherLabel(codes);
  const tempMin = temperatures.length > 0 ? Math.min(...temperatures) : null;
  const tempMax = temperatures.length > 0 ? Math.max(...temperatures) : null;
  const notes = [
    precipitation > 0 ? `Niederschlag ca. ${formatDecimal(precipitation)} mm.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    label,
    notes,
    tempMax,
    tempMin,
  };
}

function parseHourlyWeather(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object") return [];

    const raw = parsed as {
      precipitation?: unknown[];
      temperature_2m?: unknown[];
      time?: unknown[];
      weather_code?: unknown[];
    };
    const times = Array.isArray(raw.time) ? raw.time : [];

    return times
      .map((time, index) => ({
        precipitation: toNumberOrNull(raw.precipitation?.[index]),
        temperature: toNumberOrNull(raw.temperature_2m?.[index]),
        time: typeof time === "string" ? time : "",
        weatherCode: toNumberOrNull(raw.weather_code?.[index]),
      }))
      .filter((entry) => entry.time);
  } catch {
    return [];
  }
}

function getDateTimeMinutes(value: string) {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function getMostFrequentWeatherLabel(codes: number[]) {
  if (codes.length === 0) return "";

  const counts = new Map<number, number>();
  for (const code of codes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const [code] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];

  return getWeatherCodeLabel(code);
}

function getWeatherCodeLabel(code: number | null) {
  const labels: Record<number, string> = {
    0: "Sonnig",
    1: "Überwiegend sonnig",
    2: "Teilweise bewölkt",
    3: "Bewölkt",
    45: "Nebel",
    48: "Reifnebel",
    51: "Leichter Nieselregen",
    53: "Nieselregen",
    55: "Starker Nieselregen",
    61: "Leichter Regen",
    63: "Regen",
    65: "Starker Regen",
    71: "Leichter Schnee",
    73: "Schnee",
    75: "Starker Schnee",
    80: "Leichte Regenschauer",
    81: "Regenschauer",
    82: "Starke Regenschauer",
    95: "Gewitter",
  };

  return code === null ? "" : labels[code] ?? `Wettercode ${code}`;
}

function toNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildLaborRows(map: Map<string, CountHours>) {
  return laborLabels.map((label) => {
    const value = map.get(label) ?? { count: 0, hours: 0 };

    return {
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(label),
      label,
    };
  });
}

function buildSubcontractorRows(map: Map<string, CountHours>) {
  return Array.from(map.entries())
    .map(([label, value]) => ({
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(`nu_${label}`),
      label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE", { numeric: true }))
    .slice(0, 8);
}

function buildMachineRows(map: Map<string, MachineBucket>) {
  const knownLabels = [...leftMachineLabels, ...rightMachineLabels];
  return knownLabels.map((label) => {
    const value = map.get(label) ?? { count: 0, hours: 0, label, section: "MACHINES" as const };

    return {
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(label),
      label,
    };
  });
}

function buildOtherRows(map: Map<string, MachineBucket>) {
  const known = new Set<string>([...leftMachineLabels, ...rightMachineLabels]);

  return Array.from(map.values())
    .filter((value) => !known.has(value.label))
    .filter((value) => value.count > 0 || value.hours > 0)
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE", { numeric: true }))
    .slice(0, 5)
    .map((value) => ({
      key: getMaterialRowKey(value.label, "Std."),
      label: value.label,
      quantity: value.hours > 0 ? value.hours : value.count,
      unit: value.hours > 0 ? "Std." : "",
    }));
}

function buildMaterialRows(map: Map<string, DailyReportMaterialRow>) {
  return Array.from(map.values())
    .filter((row) => row.quantity > 0 && row.label)
    .sort((a, b) => {
      const unitComparison = a.unit.localeCompare(b.unit, "de-DE");
      if (unitComparison !== 0) return unitComparison;

      return a.label.localeCompare(b.label, "de-DE", { numeric: true });
    })
    .slice(0, 12);
}

function buildRealMachineRows(
  map: Map<string, MachineBucket>,
  section: "MACHINES" | "OTHER" = "MACHINES",
) {
  return Array.from(map.values())
    .filter((value) => value.section === section)
    .filter((value) => value.count > 0 || value.hours > 0)
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE", { numeric: true }))
    .slice(0, 24)
    .map((value) => ({
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(value.label),
      label: value.label,
    }));
}

function buildRealOtherRows(map: Map<string, MachineBucket>) {
  return buildRealMachineRows(map, "OTHER")
    .slice(0, 5)
    .map((value) => ({
      key: getMaterialRowKey(value.label, "Std."),
      label: value.label,
      quantity: value.hours > 0 ? value.hours : value.count,
      unit: value.hours > 0 ? "Std." : "",
    }));
}

function parseMaterialRows(
  value: string | null | undefined,
  fallbackRows: DailyReportMaterialRow[],
) {
  if (!value) return fallbackRows;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return fallbackRows;
    }

    const fallbackByKey = new Map(fallbackRows.map((row) => [row.key, row]));
    const rows = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const raw = entry as Partial<DailyReportMaterialRow>;
        const label = String(raw.label ?? "").trim();
        const unit = String(raw.unit ?? "").trim();
        const key = String(raw.key ?? getMaterialRowKey(label, unit)).trim();
        const fallback = fallbackByKey.get(key);

        if (!label && !fallback) return null;

        return {
          key: key || fallback?.key || getMaterialRowKey(label, unit),
          label: label || fallback?.label || "Material",
          quantity: cleanNumber(raw.quantity, fallback?.quantity ?? 0),
          unit: unit || fallback?.unit || "",
        };
      })
      .filter((entry): entry is DailyReportMaterialRow => Boolean(entry));

    return rows.length > 0 ? rows.slice(0, 24) : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

function parseCountRows(
  value: string | null | undefined,
  fallbackRows: DailyReportCountRow[],
) {
  if (!value) return fallbackRows;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return fallbackRows;
    }

    const fallbackByKey = new Map(fallbackRows.map((row) => [row.key, row]));
    const rows = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const raw = entry as Partial<DailyReportCountRow>;
        const label = String(raw.label ?? "").trim();
        const key = String(raw.key ?? getReportRowKey(label)).trim();
        const fallback = fallbackByKey.get(key);

        if (!label && !fallback) return null;

        return {
          count: cleanNumber(raw.count, fallback?.count ?? 0),
          hours: cleanNumber(raw.hours, fallback?.hours ?? 0),
          key: key || fallback?.key || getReportRowKey(label),
          label: label || fallback?.label || "Sonstige",
        };
      })
      .filter((entry): entry is DailyReportCountRow => Boolean(entry));

    return rows.length > 0 ? rows.slice(0, 24) : fallbackRows;
  } catch {
    return fallbackRows;
  }
}

function parseMachineRows(
  value: string | null | undefined,
  fallbackRows: DailyReportCountRow[],
  showRealMachineNames: boolean,
) {
  const rows = parseCountRows(value, fallbackRows);

  if (rows === fallbackRows) {
    return rows;
  }

  if (showRealMachineNames) {
    return orderCountRowsByFallback(rows, fallbackRows, false);
  }

  return orderCountRowsByFallback(rows, fallbackRows);
}

function orderCountRowsByFallback(
  rows: DailyReportCountRow[],
  fallbackRows: DailyReportCountRow[],
  includeExtraRows = true,
) {
  const storedByKey = new Map(rows.map((row) => [row.key, row]));
  const storedByLabel = new Map(
    rows.map((row) => [normalize(row.label), row]),
  );
  const usedKeys = new Set<string>();
  const orderedRows = fallbackRows.map((fallbackRow) => {
    const storedRow =
      storedByKey.get(fallbackRow.key) ??
      storedByLabel.get(normalize(fallbackRow.label));

    if (!storedRow) return fallbackRow;

    usedKeys.add(storedRow.key);

    return {
      ...fallbackRow,
      count: storedRow.count,
      hours: storedRow.hours,
    };
  });
  const orderedKeys = new Set(orderedRows.map((row) => row.key));
  const extraRows = rows.filter(
    (row) => !usedKeys.has(row.key) && !orderedKeys.has(row.key),
  );

  return [
    ...orderedRows,
    ...(includeExtraRows ? extraRows : []),
  ].slice(0, 24);
}

function parseStringList(
  value: string | null | undefined,
  fallback: string[] = [],
) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return fallback;
    }

    const result = parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);

    return result;
  } catch {
    return fallback;
  }
}

function filterLegacyMaterialPerformanceLines(lines: string[]) {
  return lines.filter((line) => {
    const normalized = normalize(line);
    const hasTimeRange = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(line);
    const hasMaterialUnit =
      /(^|\s)\d+([.,]\d+)?\s*(t|to|kg|l|m|m2|m3|m²|m³)\b/i.test(line);
    const looksLikeAsphaltSummary =
      normalized.includes("asphalt") || normalized.includes("anspritz");

    return !(hasTimeRange || hasMaterialUnit || looksLikeAsphaltSummary);
  });
}

function cleanNumber(value: unknown, fallback: number) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/\./g, "").replace(",", "."))
        : NaN;

  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : fallback;
}

function mapLaborCategory(values: Array<string | null | undefined>) {
  const text = normalize(values.filter(Boolean).join(" "));

  if (text.includes("polier")) return "Polier";
  if (text.includes("vorarbeiter")) return "Vorarbeiter";
  if (text.includes("lkw") || text.includes("fahrer")) return "LKW-Fahrer";
  if (
    text.includes("baugeraet") ||
    text.includes("geraetefuehrer") ||
    text.includes("maschinenfuehrer") ||
    text.includes("maschinist")
  ) {
    return "Baugeräteführer";
  }
  if (text.includes("fachwerker") || text.includes("helfer")) {
    return "Fachwerker";
  }

  return "Facharbeiter";
}

function addDriverLaborHours({
  compositionLines,
  crewLaborEmployeeIds,
  driver,
  driverLabor,
  driverName,
  fallbackCategory,
  forcedCategory,
  hours,
  sourceLabel,
  sourceKey,
}: {
  compositionLines?: DailyReportCompositionLine[];
  crewLaborEmployeeIds: Set<string>;
  driver: {
    employee?: {
      id: string;
      positions: Array<{
        positionLabel: string;
        positionValue: string;
      }>;
    } | null;
    firstName: string;
    id: string;
    lastName: string;
  } | null;
  driverLabor: Map<string, DriverLaborBucket>;
  driverName: string | null;
  fallbackCategory: string;
  forcedCategory?: string;
  hours: number;
  sourceLabel?: string;
  sourceKey: string;
}) {
  if (hours <= 0) return;

  const employeeId = driver?.employee?.id ?? null;

  if (employeeId && crewLaborEmployeeIds.has(employeeId)) {
    return;
  }

  const normalizedDriverName = normalize(driverName ?? "");
  const driverKey =
    employeeId || driver?.id || (normalizedDriverName ? `name:${normalizedDriverName}` : "");

  if (!driverKey) return;

  const category = forcedCategory
    ? forcedCategory
    : driver?.employee?.positions.length
      ? mapLaborCategory([
          ...driver.employee.positions.map((position) => position.positionLabel),
          ...driver.employee.positions.map((position) => position.positionValue),
        ])
      : fallbackCategory;

  const current = driverLabor.get(driverKey) ?? {
    category,
    hours: 0,
    sourceKeys: new Set<string>(),
  };

  if (current.sourceKeys.has(sourceKey)) return;

  current.sourceKeys.add(sourceKey);
  current.hours += hours;
  current.category = category;
  driverLabor.set(driverKey, current);

  if (compositionLines) {
    addCompositionLine(compositionLines, {
      detail: category,
      label: driverLabel(driver, driverName),
      quantity: `${formatDecimal(hours)} Std.`,
      source: sourceLabel || "Disposition",
    });
  }
}

function addDriverLaborToLaborRows(
  labor: Map<string, CountHours>,
  driverLabor: Map<string, DriverLaborBucket>,
) {
  for (const bucket of driverLabor.values()) {
    addCountHours(labor, bucket.category, 1, bucket.hours);
  }
}

function employeeName(employee: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return compactLine([employee.firstName, employee.lastName]) || "Mitarbeiter";
}

function driverLabel(
  driver: {
    firstName: string;
    lastName: string;
  } | null,
  fallback: string | null,
) {
  return compactLine([driver?.firstName, driver?.lastName]) || fallback || "Fahrer";
}

function addCompositionLine(
  lines: DailyReportCompositionLine[],
  line: DailyReportCompositionLine,
) {
  if (!line.label.trim()) return;
  lines.push(line);
}

function addCountHours(
  map: Map<string, CountHours>,
  label: string,
  count: number,
  hours: number,
) {
  const current = map.get(label) ?? { count: 0, hours: 0 };
  map.set(label, {
    count: current.count + count,
    hours: current.hours + hours,
  });
}

function addMachine(
  map: Map<string, MachineBucket>,
  realMap: Map<string, MachineBucket>,
  vehicle: {
    category: string;
    dailyReportMachineLabel?: string | null;
    id?: string;
    licensePlate?: string | null;
    vehicleNumber: string;
    vehicleType: string;
  } & VehicleWithInventoryLink,
  hours: number,
) {
  const machine = getVehicleDailyReportMachineInput(vehicle);
  addMachineLabel(map, machine.label, hours, machine.classify, machine.section);
  addMachineLabel(
    realMap,
    getVehicleRealMachineLabel(vehicle),
    hours,
    false,
    machine.section,
  );
}

function addMachineOnce(
  map: Map<string, MachineBucket>,
  realMap: Map<string, MachineBucket>,
  keys: Set<string>,
  vehicle: {
    category: string;
    dailyReportMachineLabel?: string | null;
    id?: string;
    licensePlate?: string | null;
    vehicleNumber: string;
    vehicleType: string;
  } & VehicleWithInventoryLink,
  hours: number,
  explicitKey?: string | null,
) {
  const machine = getVehicleDailyReportMachineInput(vehicle);
  const key = explicitKey || vehicle.id || machine.label;

  if (keys.has(key)) return;

  keys.add(key);
  addMachineLabel(map, machine.label, hours, machine.classify, machine.section);
  addMachineLabel(
    realMap,
    getVehicleRealMachineLabel(vehicle),
    hours,
    false,
    machine.section,
  );
}

function getTimedMachineKey(
  vehicle:
    | ({
        category: string;
        dailyReportMachineLabel?: string | null;
        id?: string;
        licensePlate?: string | null;
        vehicleNumber: string;
        vehicleType: string;
      } & VehicleWithInventoryLink)
    | null,
  start: string,
  end: string,
) {
  if (!vehicle) return null;

  const inventoryItem = getVehicleInventoryItem(vehicle);
  const machine = getVehicleDailyReportMachineInput(vehicle);
  const vehicleKey =
    inventoryItem?.id ||
    inventoryItem?.objectNumber ||
    vehicle.id ||
    vehicle.vehicleNumber ||
    machine.label;

  return `${vehicleKey}:${start}-${end}`;
}

function getVehicleDailyReportMachineInput(vehicle: {
  category: string;
  dailyReportMachineLabel?: string | null;
  vehicleNumber: string;
  vehicleType: string;
} & VehicleWithInventoryLink) {
  const inventoryItem = vehicle.inventoryItems?.[0] ?? null;
  const section = getVehicleDailyReportSection(vehicle);
  if (inventoryItem && getInventoryItemDailyReportSection(inventoryItem) === "OTHER") {
    return {
      classify: false,
      label: getInventoryItemRealMachineLabel(inventoryItem),
      section,
    };
  }

  const customLabel = getConfiguredDailyReportMachineLabel(vehicle);

  if (customLabel) {
    return {
      classify: false,
      label: customLabel,
      section,
    };
  }

  return {
    classify: true,
    label: vehicleLabel({
      category: vehicle.category,
      number: vehicle.vehicleNumber,
      type: vehicle.vehicleType,
    }),
    section,
  };
}

function getVehicleDailyReportSection(
  vehicle: VehicleWithInventoryLink,
): "MACHINES" | "OTHER" {
  const inventoryItem = vehicle.inventoryItems?.[0] ?? null;
  return getInventoryItemDailyReportSection(inventoryItem) === "OTHER"
    ? "OTHER"
    : "MACHINES";
}

function getVehicleRealMachineLabel(vehicle: {
  category: string;
  dailyReportMachineLabel?: string | null;
  licensePlate?: string | null;
  vehicleNumber: string;
  vehicleType: string;
} & VehicleWithInventoryLink) {
  const inventoryItem = vehicle.inventoryItems?.[0] ?? null;
  return (
    (inventoryItem
      ? getInventoryItemRealMachineLabel(inventoryItem)
      : [
          vehicle.vehicleType,
          vehicle.vehicleNumber,
        ]
          .filter(Boolean)
          .join(" ")) || "Sonstige Maschine"
  );
}

function getConfiguredDailyReportMachineLabel(
  vehicle: {
    dailyReportMachineLabel?: string | null;
  } & VehicleWithInventoryLink,
) {
  const inventoryCategoryLabel = String(
    vehicle.inventoryItems?.[0]?.category?.dailyReportMachineLabel ?? "",
  ).trim();

  if (inventoryCategoryLabel) {
    return inventoryCategoryLabel;
  }

  return String(vehicle.dailyReportMachineLabel ?? "").trim();
}

function addFallbackMachine(
  map: Map<string, MachineBucket>,
  realMap: Map<string, MachineBucket>,
  rawLabel: string,
  hours: number,
) {
  addMachineLabel(map, rawLabel, hours);
  addMachineLabel(realMap, rawLabel, hours, false);
}

function addInventoryMachine(
  map: Map<string, MachineBucket>,
  realMap: Map<string, MachineBucket>,
  item: DailyReportInventoryItem,
  hours: number,
) {
  const configuredLabel = getInventoryItemDailyReportMachineLabel(item);
  const section =
    getInventoryItemDailyReportSection(item) === "OTHER" ? "OTHER" : "MACHINES";
  const groupedLabel =
    configuredLabel ||
    getInventoryItemCategoryLabel(item) ||
    getInventoryItemRealMachineLabel(item);

  addMachineLabel(map, groupedLabel, hours, !configuredLabel, section);
  addMachineLabel(
    realMap,
    getInventoryItemRealMachineLabel(item),
    hours,
    false,
    section,
  );
}

function addVehicleCompositionLine(
  composition: DailyReportComposition,
  vehicle: ({
    category: string;
    dailyReportMachineLabel?: string | null;
    licensePlate?: string | null;
    vehicleNumber: string;
    vehicleType: string;
  } & VehicleWithInventoryLink) | null,
  hours: number,
  source: string,
) {
  if (!vehicle || hours <= 0) return;

  const machine = getVehicleDailyReportMachineInput(vehicle);
  const target =
    machine.section === "OTHER" ? composition.other : composition.machines;
  addCompositionLine(target, {
    detail: compactLine([vehicle.category, vehicle.vehicleType, vehicle.licensePlate]),
    groupLabel: resolveMachineGroupLabel(machine.label, machine.classify),
    hours,
    label: getVehicleRealMachineLabel(vehicle),
    quantity: `${formatDecimal(hours)} Std.`,
    source,
  });
}

function addInventoryMachineCompositionLine(
  composition: DailyReportComposition,
  item: DailyReportInventoryItem,
  hours: number,
  source: string,
) {
  const target =
    getInventoryItemDailyReportSection(item) === "OTHER"
      ? composition.other
      : composition.machines;
  const configuredLabel = getInventoryItemDailyReportMachineLabel(item);
  const groupedLabel =
    configuredLabel ||
    getInventoryItemCategoryLabel(item) ||
    getInventoryItemRealMachineLabel(item);

  addCompositionLine(target, {
    detail: compactLine([
      item.category?.parentCategory?.name ?? item.category?.name,
      item.manufacturer,
      item.model,
    ]),
    groupLabel: resolveMachineGroupLabel(groupedLabel, !configuredLabel),
    hours,
    label: getInventoryItemRealMachineLabel(item),
    quantity: `${formatDecimal(hours)} Std.`,
    source,
  });
}

/** Gruppierte Bezeichnung, unter der eine Maschine in der aggregierten
 * Geräte-Zeile landet - dieselbe Berechnung wird auch für `groupLabel` an
 * den Herkunfts-Zeilen verwendet, damit beide exakt zueinander passen. */
function resolveMachineGroupLabel(rawLabel: string, classify: boolean) {
  return classify ? classifyMachine(rawLabel) : rawLabel || "Sonstige Maschine";
}

function addMachineLabel(
  map: Map<string, MachineBucket>,
  rawLabel: string,
  hours: number,
  classify = true,
  section: "MACHINES" | "OTHER" = "MACHINES",
) {
  const label = resolveMachineGroupLabel(rawLabel, classify);
  const current = map.get(label) ?? { count: 0, hours: 0, label, section };
  map.set(label, {
    count: current.count + 1,
    hours: current.hours + hours,
    label,
    section,
  });
}

function classifyMachine(label: string) {
  const text = normalize(label);

  if (text.includes("mobilbagger")) return "Mobilbagger";
  if (text.includes("kettenbagger")) return "Kettenbagger";
  if (text.includes("abroll")) return "LKW Abrollkipper";
  if (text.includes("sattel")) return "LKW Sattelzug";
  if (text.includes("4-ach") || text.includes("4 ach") || text.includes("vierach")) {
    return "LKW 4-Achser";
  }
  if (text.includes("3-ach") || text.includes("3 ach") || text.includes("dreiach")) {
    return "LKW 3-Achser";
  }
  if (text.includes("2-ach") || text.includes("2 ach") || text.includes("zweiach")) {
    return "LKW 2-Achser";
  }
  if (text.includes("lkw")) return "LKW 3-Achser";
  if (text.includes("planierraupe") || text.includes("raupe")) return "Planierraupe";
  if (text.includes("grader")) return "Grader";
  if (text.includes("walze") || text.includes("walzenzug")) {
    return "Erdbauwalze / Walzenzug";
  }
  if (text.includes("kompressor")) return "Kompressor";
  if (text.includes("radlader")) return "Radlader";

  return label || "Sonstige Maschine";
}

function getInventoryItemDailyReportSection(
  item:
    | {
        category?: {
          dailyReportSection?: string | null;
          parentCategory?: {
            dailyReportSection?: string | null;
            useInDailyReports?: boolean | null;
          } | null;
          useInDailyReports?: boolean | null;
        } | null;
      }
    | null
    | undefined,
) {
  if (!item?.category) return "NONE";
  const categorySection = item.category.dailyReportSection ?? "NONE";

  if (item.category.useInDailyReports && categorySection !== "NONE") {
    return categorySection;
  }

  const parentCategory = item.category.parentCategory;
  const parentSection = parentCategory?.dailyReportSection ?? "NONE";

  if (
    parentCategory?.useInDailyReports &&
    parentSection !== "NONE"
  ) {
    return parentSection;
  }

  return categorySection !== "NONE" ? categorySection : parentSection;
}

function getInventoryItemDailyReportMachineLabel(
  item: DailyReportInventoryItem | null | undefined,
) {
  return (
    String(item?.category?.dailyReportMachineLabel ?? "").trim() ||
    String(item?.category?.parentCategory?.dailyReportMachineLabel ?? "").trim()
  );
}

function getInventoryItemCategoryLabel(
  item: DailyReportInventoryItem | null | undefined,
) {
  if (!item?.category) return "";

  return item.category.parentCategory
    ? `${item.category.parentCategory.name} ${item.category.name}`
    : item.category.name;
}

function getInventoryItemRealMachineLabel(item: {
  manufacturer?: string | null;
  model?: string | null;
  name: string;
}) {
  return String(item.name ?? "").trim() || "Sonstige Maschine";
}

function isDailyReportMachineInventoryItem(
  item: DailyReportInventoryItem | null | undefined,
) {
  return getInventoryItemDailyReportSection(item) === "MACHINES";
}

function vehicleLabel({
  category,
  number,
  type,
}: {
  category?: string | null;
  number?: string | null;
  type?: string | null;
}) {
  return [number, type, category].filter(Boolean).join(" ");
}

function getSpecialVehicleMaterialLabel(
  materialName: string | null | undefined,
  taskText: string | null | undefined,
  quantityUnit: string | null | undefined,
  asphaltDispatchEntries: {
    tackCoatInventoryItemId: string | null;
    tackCoatMaterialName: string | null;
    tackCoatMaterialType: { name: string } | null;
    tackCoatQuantity: number | null;
  }[],
  inventoryItemsById: Map<
    string,
    {
      inventoryNumber: string | null;
      name: string;
      objectNumber: string | null;
    }
  >,
) {
  const cleanedMaterialName = String(materialName ?? "").trim();

  if (cleanedMaterialName) {
    return cleanedMaterialName;
  }

  const cleanedTaskText = String(taskText ?? "").trim();
  const cleanedUnit = String(quantityUnit ?? "").trim().toLowerCase();
  const looksLikeTackCoat =
    cleanedTaskText.toLowerCase().includes("anspritz") ||
    cleanedUnit === "l" ||
    cleanedUnit === "liter";

  if (!looksLikeTackCoat) {
    return cleanedTaskText;
  }

  const tackCoatEntry = asphaltDispatchEntries.find(
    (entry) => (entry.tackCoatQuantity ?? 0) > 0,
  );

  return (
    getInventoryMaterialLabel(
      inventoryItemsById,
      tackCoatEntry?.tackCoatInventoryItemId,
      tackCoatEntry?.tackCoatMaterialName ||
        tackCoatEntry?.tackCoatMaterialType?.name ||
        "Anspritzmittel",
    ) || "Anspritzmittel"
  );
}

function addMaterialRow(
  rows: Map<string, DailyReportMaterialRow>,
  quantity: number | null | undefined,
  rawLabel: string | null | undefined,
  rawUnit: string | null | undefined,
) {
  const label = String(rawLabel ?? "").replace(/\s+/g, " ").trim();
  const unit = String(rawUnit ?? "").replace(/\s+/g, " ").trim();
  const quantityValue = Number(quantity ?? 0);

  if (!label || !Number.isFinite(quantityValue) || quantityValue <= 0) {
    return;
  }

  const key = getMaterialRowKey(label, unit);
  const current = rows.get(key);

  rows.set(key, {
    key,
    label,
    quantity: Math.round(((current?.quantity ?? 0) + quantityValue) * 10) / 10,
    unit,
  });
}

function addMaterialCompositionLine(
  lines: DailyReportCompositionLine[],
  label: string | null | undefined,
  quantity: number | null | undefined,
  unit: string | null | undefined,
  source: string,
  detail: string,
) {
  const quantityValue = Number(quantity ?? 0);
  const cleanLabel = String(label ?? "").trim();

  if (!cleanLabel || !Number.isFinite(quantityValue) || quantityValue <= 0) return;

  addCompositionLine(lines, {
    detail,
    label: cleanLabel,
    quantity: `${formatDecimal(quantityValue)} ${String(unit ?? "").trim()}`.trim(),
    source,
  });
}

function getInventoryMaterialLabel(
  itemsById: Map<
    string,
    {
      inventoryNumber: string | null;
      name: string;
      objectNumber: string | null;
    }
  >,
  inventoryItemId: string | null | undefined,
  fallback: string | null | undefined,
) {
  const item = inventoryItemId ? itemsById.get(inventoryItemId) : null;

  if (!item) {
    return fallback;
  }

  return (
    String(item.name ?? "").trim() ||
    fallback
  );
}

function getInventoryMaterialUnit(
  itemsById: Map<
    string,
    {
      stockUnit: string;
    }
  >,
  inventoryItemId: string | null | undefined,
  fallback: string | null | undefined,
) {
  const item = inventoryItemId ? itemsById.get(inventoryItemId) : null;
  return item?.stockUnit || fallback;
}

function compactUnique(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const text = value.replace(/\s+/g, " ").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }

  return result;
}

function compactLine(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function getProjectNoteCategoryLabel(value: string) {
  switch (value) {
    case "OBSTRUCTION":
      return "Behinderung";
    case "INCIDENT":
      return "Vorkommnis";
    case "CLIENT":
      return "Auftraggeber / Bauleiter";
    case "INTERNAL":
      return "Intern";
    default:
      return "Allgemein";
  }
}

function formatProjectNoteDateRange(note: {
  noteDate: Date;
  noteEndDate: Date | null;
}) {
  if (!note.noteEndDate) return formatDateLabel(note.noteDate.toISOString().slice(0, 10));

  return `${formatDateLabel(note.noteDate.toISOString().slice(0, 10))}–${formatDateLabel(
    note.noteEndDate.toISOString().slice(0, 10),
  )}`;
}

function durationHours(start: string, end: string) {
  const startMinutes = parseTime(start);
  const endMinutes = parseTime(end);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 8;
  }

  return Math.round(((endMinutes - startMinutes) / 60) * 10) / 10;
}

function parseTime(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function earliestTime(values: string[]) {
  return values
    .filter((value) => parseTime(value) !== null)
    .sort((a, b) => (parseTime(a) ?? 0) - (parseTime(b) ?? 0))[0] ?? "";
}

function latestTime(values: string[]) {
  return values
    .filter((value) => parseTime(value) !== null)
    .sort((a, b) => (parseTime(b) ?? 0) - (parseTime(a) ?? 0))[0] ?? "";
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatWeekday(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
  }).format(date);
}

function formatTemperature(value: number | null) {
  if (value === null) return "";
  return formatDecimal(value);
}

export function formatDailyReportDecimal(value: number) {
  return formatDecimal(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function getReportRowKey(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "sonstige"
  );
}

function getMaterialRowKey(label: string, unit: string) {
  return getReportRowKey([label, unit].filter(Boolean).join(" "));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}
