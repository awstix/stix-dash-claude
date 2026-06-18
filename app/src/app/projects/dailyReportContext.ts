import { prisma } from "@/lib/prisma";

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

export type DailyReportPhoto = {
  capturedAtLabel: string;
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
  dateKey: string;
  dateLabel: string;
  id: string | null;
  laborRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  photos: DailyReportPhoto[];
  photoGridLayout: DailyReportPhotoGridLayout;
  performanceLines: string[];
  projectName: string;
  projectNumber: string;
  reportNumber: number | null;
  sheetNumber: string;
  siteDiscussionNotes: string;
  siteDiscussionRoles: string[];
  siteDiscussionThirdPartyName: string;
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
  laborRows: DailyReportCountRow[];
  groupedMachineRows: DailyReportCountRow[];
  machineRows: DailyReportCountRow[];
  materialRows: DailyReportMaterialRow[];
  realMachineRows: DailyReportCountRow[];
  performanceLines: string[];
  projectName: string;
  projectNumber: string;
  tempMax: string;
  tempMin: string;
  weatherLabel: string;
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
  "Kompressor",
  "Radlader",
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
  return prisma.project.findUnique({
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
          vehicle: true,
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
                      vehicle: true,
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
                  vehicle: true,
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
          vehicle: true,
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
          tours: true,
          vehicle: true,
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
          transportVehicle: true,
          vehicle: true,
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
          vehicle: true,
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
              vehicle: true,
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
    },
  });
}

type ReportProject = NonNullable<
  Awaited<ReturnType<typeof getDailyReportSourceProject>>
>;

export function buildDailyReportContext(
  project: ReportProject,
  dateKey: string,
  requestedSheetNumber: string,
): DailyReportContext {
  const labor = new Map<string, CountHours>();
  const materialRows = new Map<string, DailyReportMaterialRow>();
  const machines = new Map<string, MachineBucket>();
  const realMachines = new Map<string, MachineBucket>();
  const workTimes: { end: string; start: string }[] = [];
  const performanceLines: string[] = [];
  const asphaltDispatchMaterialKeys = new Set<string>();

  for (const entry of project.asphaltDispatchEntries) {
    if (entry.quantityTons > 0) {
      addMaterialReference(
        asphaltDispatchMaterialKeys,
        entry.asphaltMixName || entry.asphaltMixType?.name || "Asphalt",
        "t",
      );
    }
    if ((entry.tackCoatQuantity ?? 0) > 0) {
      addMaterialReference(
        asphaltDispatchMaterialKeys,
        entry.tackCoatMaterialName ||
          entry.tackCoatMaterialType?.name ||
          "Anspritzmittel",
        entry.tackCoatUnit || "l",
      );
    }
  }

  for (const row of project.crewPlanningRows) {
    for (const assignment of row.assignments) {
      workTimes.push({
        end: assignment.endTime,
        start: assignment.startTime,
      });
      const hours = durationHours(assignment.startTime, assignment.endTime);

      for (const member of assignment.crew?.members ?? []) {
        const category = mapLaborCategory([
          member.roleText,
          ...member.employee.positions.map((position) => position.positionLabel),
          ...member.employee.positions.map((position) => position.positionValue),
        ]);
        addCountHours(labor, category, 1, hours);
      }

      for (const extraEmployee of assignment.extraEmployees) {
        const category = mapLaborCategory([
          ...extraEmployee.employee.positions.map(
            (position) => position.positionLabel,
          ),
          ...extraEmployee.employee.positions.map(
            (position) => position.positionValue,
          ),
        ]);
        addCountHours(labor, category, 1, hours);
      }

      const assignmentVehicleKeys = new Set<string>();
      for (const defaultVehicle of assignment.crew?.defaultVehicles ?? []) {
        addMachineOnce(
          machines,
          realMachines,
          assignmentVehicleKeys,
          defaultVehicle.vehicle,
          hours,
        );
      }

      for (const extraVehicle of assignment.extraVehicles) {
        addMachineOnce(
          machines,
          realMachines,
          assignmentVehicleKeys,
          extraVehicle.vehicle,
          hours,
        );
      }

    }
  }

  for (const equipment of project.equipmentDispatchAssignments) {
    addMachine(machines, realMachines, equipment.vehicle, 8);
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    workTimes.push({
      end: assignment.endTime,
      start: assignment.startTime,
    });
    const hours = durationHours(assignment.startTime, assignment.endTime);

    if (assignment.vehicle) {
      addMachine(machines, realMachines, assignment.vehicle, hours);
    } else if (assignment.vehicleName) {
      addFallbackMachine(machines, realMachines, assignment.vehicleName, hours);
    }

    if (assignment.transportVehicle) {
      addMachine(machines, realMachines, assignment.transportVehicle, hours);
    } else if (assignment.transportVehicleName) {
      addFallbackMachine(
        machines,
        realMachines,
        assignment.transportVehicleName,
        hours,
      );
    }

    if (
      !hasMaterialReference(
        asphaltDispatchMaterialKeys,
        assignment.materialName,
        assignment.quantityUnit,
      )
    ) {
      addMaterialRow(
        materialRows,
        assignment.quantity,
        assignment.materialName || assignment.taskText,
        assignment.quantityUnit,
      );
    }
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

    if (assignment.vehicle) {
      addMachine(machines, realMachines, assignment.vehicle, hours);
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
      if (
        !assignment.truckLongHaulEntryId &&
        !hasMaterialReference(
          asphaltDispatchMaterialKeys,
          tour.material || tour.itemName,
          tour.quantityUnit,
        )
      ) {
        addMaterialRow(
          materialRows,
          tour.quantity,
          tour.material ||
            tour.itemName ||
            tour.customPurpose ||
            tour.purposeType,
          tour.quantityUnit,
        );
      }
    }
  }

  for (const entry of project.truckLongHaulEntries) {
    if (
      !entry.asphaltDispatchEntryId &&
      !hasMaterialReference(
        asphaltDispatchMaterialKeys,
        entry.materialName || entry.materialType?.name,
        entry.materialUnit,
      )
    ) {
      addMaterialRow(
        materialRows,
        entry.materialQuantity,
        entry.materialName || entry.materialType?.name,
        entry.materialUnit,
      );
    }

    for (const truck of entry.truckAssignments) {
      workTimes.push({
        end: truck.plannedEndTime,
        start: truck.plannedStartTime,
      });
      if (truck.vehicle) {
        addMachine(
          machines,
          realMachines,
          truck.vehicle,
          durationHours(truck.plannedStartTime, truck.plannedEndTime),
        );
      } else {
        addFallbackMachine(
          machines,
          realMachines,
          vehicleLabel({
            category: truck.vehicleCategory,
            number: truck.vehicleNumber,
            type: truck.vehicleType,
          }),
          durationHours(truck.plannedStartTime, truck.plannedEndTime),
        );
      }
    }
  }

  for (const allocation of project.asphaltLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    if (allocation.vehicle) {
      addMachine(
        machines,
        realMachines,
        allocation.vehicle,
        durationHours(allocation.startTime, allocation.endTime),
      );
    } else {
      addFallbackMachine(
        machines,
        realMachines,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        durationHours(allocation.startTime, allocation.endTime),
      );
    }
    if (project.asphaltDispatchEntries.length === 0) {
      addMaterialRow(
        materialRows,
        allocation.totalTons,
        allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
        "t",
      );
    }
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    if (allocation.vehicle) {
      addMachine(
        machines,
        realMachines,
        allocation.vehicle,
        durationHours(allocation.startTime, allocation.endTime),
      );
    } else {
      addFallbackMachine(
        machines,
        realMachines,
        vehicleLabel({
          category: allocation.vehicleCategory,
          number: allocation.vehicleNumber,
          type: allocation.vehicleType,
        }),
        durationHours(allocation.startTime, allocation.endTime),
      );
    }
    if (!allocation.asphaltDispatchEntryId) {
      addMaterialRow(
        materialRows,
        allocation.totalLiters,
        allocation.materialName || "Anspritzmittel",
        allocation.quantityUnit,
      );
    }
  }

  for (const entry of project.asphaltDispatchEntries) {
    addMaterialRow(
      materialRows,
      entry.quantityTons,
      entry.asphaltMixName || entry.asphaltMixType?.name || "Asphalt",
      "t",
    );
    addMaterialRow(
      materialRows,
      entry.tackCoatQuantity,
      entry.tackCoatMaterialName ||
        entry.tackCoatMaterialType?.name ||
        "Anspritzmittel",
      entry.tackCoatUnit || "l",
    );
  }

  const dailyReport = project.dailyReports[0] ?? null;
  const weatherLog = project.weatherLogs[0] ?? null;
  const suggestedWeatherLabel =
    weatherLog?.weatherCategory || weatherLog?.weatherLabel || "";
  const suggestedTempMin =
    weatherLog?.tempMinC ?? weatherLog?.currentTemperatureC ?? null;
  const suggestedTempMax =
    weatherLog?.tempMaxC ?? weatherLog?.currentTemperatureC ?? null;
  const suggestedWorkStart = earliestTime(workTimes.map((time) => time.start));
  const suggestedWorkEnd = latestTime(workTimes.map((time) => time.end));
  const suggestedLaborRows = buildLaborRows(labor);
  const suggestedGroupedMachineRows = buildMachineRows(machines);
  const suggestedMaterialRows = buildMaterialRows(materialRows);
  const suggestedRealMachineRows = buildRealMachineRows(realMachines);
  const suggestedPerformanceLines = compactUnique(performanceLines).slice(
    0,
    dailyReportPerformanceLineLimit,
  );
  const suggestedWeekday = formatWeekday(dateKey);
  const showRealMachineNames = dailyReport?.showRealMachineNames ?? false;
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
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    id: dailyReport?.id ?? null,
    laborRows: parseCountRows(dailyReport?.laborJson, suggestedLaborRows),
    machineRows: parseCountRows(dailyReport?.machinesJson, suggestedMachineRows),
    materialRows: parseMaterialRows(
      dailyReport?.materialJson,
      suggestedMaterialRows,
    ),
    photos: project.photos.map((photo) => ({
      capturedAtLabel: photo.capturedAt
        ? formatDateLabel(photo.capturedAt.toISOString().slice(0, 10))
        : "",
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
    contractorSignatureDataUrl: dailyReport?.contractorSignatureDataUrl ?? "",
    clientSignatureDataUrl: dailyReport?.clientSignatureDataUrl ?? "",
    showRealMachineNames,
    status: reportStatuses.has(dailyReport?.status ?? "")
      ? dailyReport?.status ?? "DRAFT"
      : "DRAFT",
    suggestions: {
      groupedMachineRows: suggestedGroupedMachineRows,
      laborRows: suggestedLaborRows,
      materialRows: suggestedMaterialRows,
      machineRows: suggestedMachineRows,
      performanceLines: suggestedPerformanceLines,
      projectName: project.name,
      projectNumber: project.projectNumber,
      tempMax: formatTemperature(suggestedTempMax),
      tempMin: formatTemperature(suggestedTempMin),
      realMachineRows: suggestedRealMachineRows,
      weatherLabel: suggestedWeatherLabel,
      weekday: suggestedWeekday,
      workEnd: suggestedWorkEnd,
      workStart: suggestedWorkStart,
    },
    tempMax: formatTemperature(dailyReport?.weatherTempMaxC ?? suggestedTempMax),
    tempMin: formatTemperature(dailyReport?.weatherTempMinC ?? suggestedTempMin),
    trafficSafetyFirstCheckTime:
      dailyReport?.trafficSafetyFirstCheckTime ?? suggestedWorkStart,
    trafficSafetySecondCheckTime:
      dailyReport?.trafficSafetySecondCheckTime ?? suggestedWorkEnd,
    weatherLabel: dailyReport?.weatherCategory || suggestedWeatherLabel,
    weatherNotes: dailyReport?.weatherNotes ?? "",
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

function buildMachineRows(map: Map<string, MachineBucket>) {
  const knownLabels = [...leftMachineLabels, ...rightMachineLabels];
  const known = new Set<string>(knownLabels);
  const rows = knownLabels.map((label) => {
    const value = map.get(label) ?? { count: 0, hours: 0, label };

    return {
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(label),
      label,
    };
  });
  const overflow = Array.from(map.values())
    .filter((value) => !known.has(value.label))
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"))
    .slice(0, 6)
    .map((value) => ({
      count: value.count,
      hours: value.hours,
      key: getReportRowKey(value.label),
      label: value.label,
    }));

  return [...rows, ...overflow];
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

function buildRealMachineRows(map: Map<string, MachineBucket>) {
  return Array.from(map.values())
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
        ? Number(value.replace(",", "."))
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
  },
  hours: number,
) {
  const machine = getVehicleDailyReportMachineInput(vehicle);
  addMachineLabel(map, machine.label, hours, machine.classify);
  addMachineLabel(realMap, getVehicleRealMachineLabel(vehicle), hours, false);
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
  },
  hours: number,
) {
  const machine = getVehicleDailyReportMachineInput(vehicle);
  const key = vehicle.id || machine.label;

  if (keys.has(key)) return;

  keys.add(key);
  addMachineLabel(map, machine.label, hours, machine.classify);
  addMachineLabel(realMap, getVehicleRealMachineLabel(vehicle), hours, false);
}

function getVehicleDailyReportMachineInput(vehicle: {
  category: string;
  dailyReportMachineLabel?: string | null;
  vehicleNumber: string;
  vehicleType: string;
}) {
  const customLabel = String(vehicle.dailyReportMachineLabel ?? "").trim();

  if (customLabel) {
    return {
      classify: false,
      label: customLabel,
    };
  }

  return {
    classify: true,
    label: vehicleLabel({
      category: vehicle.category,
      number: vehicle.vehicleNumber,
      type: vehicle.vehicleType,
    }),
  };
}

function getVehicleRealMachineLabel(vehicle: {
  category: string;
  dailyReportMachineLabel?: string | null;
  licensePlate?: string | null;
  vehicleNumber: string;
  vehicleType: string;
}) {
  const categoryLabel = getVehicleRealMachineCategoryLabel(vehicle);
  const realLabel =
    [
      vehicle.vehicleNumber,
      vehicle.licensePlate,
      vehicle.vehicleType,
      vehicle.category,
    ]
      .filter(Boolean)
      .join(" · ") || "Sonstige Maschine";

  if (!categoryLabel || normalize(realLabel) === normalize(categoryLabel)) {
    return realLabel;
  }

  return `${categoryLabel} · ${realLabel}`;
}

function getVehicleRealMachineCategoryLabel(vehicle: {
  category: string;
  dailyReportMachineLabel?: string | null;
  vehicleNumber: string;
  vehicleType: string;
}) {
  const customLabel = String(vehicle.dailyReportMachineLabel ?? "").trim();

  if (customLabel) {
    return customLabel;
  }

  const rawLabel = vehicleLabel({
    category: vehicle.category,
    number: vehicle.vehicleNumber,
    type: vehicle.vehicleType,
  });
  const classifiedLabel = classifyMachine(rawLabel);

  if (classifiedLabel !== rawLabel) {
    return classifiedLabel;
  }

  return vehicle.category || vehicle.vehicleType || "Sonstige Maschine";
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

function addMachineLabel(
  map: Map<string, MachineBucket>,
  rawLabel: string,
  hours: number,
  classify = true,
) {
  const label = classify
    ? classifyMachine(rawLabel)
    : rawLabel || "Sonstige Maschine";
  const current = map.get(label) ?? { count: 0, hours: 0, label };
  map.set(label, {
    count: current.count + 1,
    hours: current.hours + hours,
    label,
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

function addMaterialReference(
  references: Set<string>,
  label: string | null | undefined,
  unit: string | null | undefined,
) {
  const materialKey = getMaterialReferenceKey(label, unit);

  if (materialKey) {
    references.add(materialKey);
  }
}

function hasMaterialReference(
  references: Set<string>,
  label: string | null | undefined,
  unit: string | null | undefined,
) {
  const materialKey = getMaterialReferenceKey(label, unit);

  return Boolean(materialKey && references.has(materialKey));
}

function getMaterialReferenceKey(
  label: string | null | undefined,
  unit: string | null | undefined,
) {
  const cleanedLabel = String(label ?? "").replace(/\s+/g, " ").trim();
  const cleanedUnit = String(unit ?? "").replace(/\s+/g, " ").trim();

  if (!cleanedLabel) return "";

  return getMaterialRowKey(cleanedLabel, cleanedUnit);
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
