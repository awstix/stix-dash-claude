import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CountHours = {
  count: number;
  hours: number;
};

type MachineBucket = CountHours & {
  label: string;
};

const laborRows = [
  "Polier",
  "Vorarbeiter",
  "Facharbeiter",
  "Fachwerker",
  "LKW-Fahrer",
  "Baugeräteführer",
] as const;

const leftMachineRows = [
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

const rightMachineRows = [
  "Erdbauwalze / Walzenzug",
  "Kompressor",
  "Radlader",
] as const;

const textColor = rgb(0.12, 0.12, 0.12);

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  const dateKey = request.nextUrl.searchParams.get("date") ?? "";
  const sheetNumber = request.nextUrl.searchParams.get("blattnr") ?? "1";

  if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return new Response("Projekt und Datum sind Pflichtfelder.", {
      status: 400,
    });
  }

  const reportDate = toUtcDate(dateKey);
  const nextDate = addDays(reportDate, 1);
  const project = await getReportProject(projectId, reportDate, nextDate);

  if (!project) {
    return new Response("Projekt nicht gefunden.", {
      status: 404,
    });
  }

  const templatePath = path.join(
    process.cwd(),
    "public",
    "templates",
    "stix_baubericht_vorlage.pdf",
  );
  const templateBytes = await readFile(templatePath);
  const pdfDocument = await PDFDocument.load(templateBytes);
  const page = pdfDocument.getPage(0);
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  const context = buildReportContext(project, dateKey, sheetNumber);

  drawSingleLine(page, font, context.projectName, 310, 777, 248, 9);
  drawSingleLine(page, font, context.projectNumber, 515, 750, 52, 9);
  drawSingleLine(page, font, context.weekday, 332, 727, 60, 9);
  drawSingleLine(page, font, context.dateLabel, 414, 727, 70, 9);
  drawSingleLine(page, font, context.sheetNumber, 524, 727, 42, 9);
  drawSingleLine(page, font, context.weatherLabel, 312, 701, 252, 9);
  drawSingleLine(page, font, context.tempMin, 380, 679, 54, 9);
  drawSingleLine(page, font, context.tempMax, 490, 679, 54, 9);
  drawSingleLine(page, font, context.workStart, 356, 655, 58, 9);
  drawSingleLine(page, font, context.workEnd, 466, 655, 58, 9);

  drawLaborRows(page, font, context.labor);
  drawMachineRows(page, font, context.machines);
  drawPerformanceLines(page, font, context.performanceLines);
  drawSingleLine(page, font, context.dateLabel, 43, 45, 105, 9);

  const pdfBytes = await pdfDocument.save();
  const fileName = `Baubericht_${sanitizeFileName(
    project.projectNumber,
  )}_${dateKey}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

async function getReportProject(projectId: string, reportDate: Date, nextDate: Date) {
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
          truckAssignments: true,
        },
      },
      weatherLogs: {
        where: {
          weatherDate: reportDate,
        },
        take: 1,
      },
    },
  });
}

type ReportProject = NonNullable<Awaited<ReturnType<typeof getReportProject>>>;

function buildReportContext(
  project: ReportProject,
  dateKey: string,
  sheetNumber: string,
) {
  const labor = new Map<string, CountHours>();
  const machines = new Map<string, MachineBucket>();
  const workTimes: { end: string; start: string }[] = [];
  const performanceLines: string[] = [];

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

      for (const extraVehicle of assignment.extraVehicles) {
        addMachine(machines, extraVehicle.vehicle, hours);
      }

      const assignmentNote = cleanReportNote(assignment.notes);
      if (assignmentNote) {
        performanceLines.push(
          `${assignment.crewName || "Kolonne"}: ${assignmentNote}`,
        );
      }
    }
  }

  for (const equipment of project.equipmentDispatchAssignments) {
    addMachine(machines, equipment.vehicle, 8);
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    workTimes.push({
      end: assignment.endTime,
      start: assignment.startTime,
    });
    const hours = durationHours(assignment.startTime, assignment.endTime);

    if (assignment.vehicle) {
      addMachine(machines, assignment.vehicle, hours);
    } else if (assignment.vehicleName) {
      addMachineLabel(machines, assignment.vehicleName, hours);
    }

    if (assignment.transportVehicle) {
      addMachine(machines, assignment.transportVehicle, hours);
    } else if (assignment.transportVehicleName) {
      addMachineLabel(machines, assignment.transportVehicleName, hours);
    }

    addPerformanceLine(
      performanceLines,
      [
        assignment.startTime,
        "-",
        assignment.endTime,
        assignment.taskText || "Sonderfahrzeug",
        formatQuantity(assignment.quantity, assignment.quantityUnit),
        assignment.materialName,
        cleanReportNote(assignment.notes),
      ],
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

    addMachineLabel(
      machines,
      vehicleLabel({
        category: assignment.vehicleCategory,
        number: assignment.vehicleNumber,
        type: assignment.vehicleType,
      }),
      hours,
    );

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
      addPerformanceLine(
        performanceLines,
        [
          tour.startTime,
          "-",
          tour.endTime,
          tour.itemName || tour.customPurpose || tour.purposeType,
          formatQuantity(tour.quantity, tour.quantityUnit),
          sameText(tour.material, tour.itemName || tour.customPurpose)
            ? null
            : tour.material,
          cleanReportNote(tour.notes),
        ],
      );
    }
  }

  for (const entry of project.truckLongHaulEntries) {
    addPerformanceLine(
      performanceLines,
      [
        entry.materialName || entry.materialType?.name,
        formatQuantity(entry.materialQuantity, entry.materialUnit),
        cleanReportNote(entry.notes),
      ],
    );

    for (const truck of entry.truckAssignments) {
      workTimes.push({
        end: truck.plannedEndTime,
        start: truck.plannedStartTime,
      });
      addMachineLabel(
        machines,
        vehicleLabel({
          category: truck.vehicleCategory,
          number: truck.vehicleNumber,
          type: truck.vehicleType,
        }),
        durationHours(truck.plannedStartTime, truck.plannedEndTime),
      );
    }
  }

  for (const allocation of project.asphaltLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    addMachineLabel(
      machines,
      vehicleLabel({
        category: allocation.vehicleCategory,
        number: allocation.vehicleNumber,
        type: allocation.vehicleType,
      }),
      durationHours(allocation.startTime, allocation.endTime),
    );
    addPerformanceLine(
      performanceLines,
      [
        allocation.startTime,
        "-",
        allocation.endTime,
        allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
        `${formatDecimal(allocation.totalTons)} t`,
        cleanReportNote(allocation.notes),
      ],
    );
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    workTimes.push({
      end: allocation.endTime,
      start: allocation.startTime,
    });
    addMachineLabel(
      machines,
      vehicleLabel({
        category: allocation.vehicleCategory,
        number: allocation.vehicleNumber,
        type: allocation.vehicleType,
      }),
      durationHours(allocation.startTime, allocation.endTime),
    );
    addPerformanceLine(
      performanceLines,
      [
        allocation.startTime,
        "-",
        allocation.endTime,
        allocation.materialName || "Anspritzmittel",
        `${formatDecimal(allocation.totalLiters)} ${allocation.quantityUnit}`,
        cleanReportNote(allocation.notes),
      ],
    );
  }

  for (const entry of project.asphaltDispatchEntries) {
    addPerformanceLine(
      performanceLines,
      [
        entry.asphaltMixName || entry.asphaltMixType?.name || "Asphalt",
        `${formatDecimal(entry.quantityTons)} t`,
        entry.tackCoatQuantity
          ? `${entry.tackCoatMaterialName || entry.tackCoatMaterialType?.name || "Anspritzmittel"} ${formatDecimal(
              entry.tackCoatQuantity,
            )} ${entry.tackCoatUnit || "l"}`
          : null,
        cleanReportNote(entry.notes),
      ],
    );
  }

  const dailyReport = project.dailyReports[0] ?? null;
  const weatherLog = project.weatherLogs[0] ?? null;
  const weatherLabel =
    dailyReport?.weatherCategory ||
    weatherLog?.weatherCategory ||
    weatherLog?.weatherLabel ||
    "";
  const tempMin =
    dailyReport?.weatherTempMinC ??
    weatherLog?.tempMinC ??
    weatherLog?.currentTemperatureC ??
    null;
  const tempMax =
    dailyReport?.weatherTempMaxC ??
    weatherLog?.tempMaxC ??
    weatherLog?.currentTemperatureC ??
    null;
  const workStart = earliestTime(workTimes.map((time) => time.start));
  const workEnd = latestTime(workTimes.map((time) => time.end));

  if (project.notes) {
    performanceLines.push(project.notes);
  }

  return {
    dateLabel: formatDateLabel(dateKey),
    labor,
    machines,
    performanceLines: compactUnique(performanceLines).slice(0, 6),
    projectName: project.name,
    projectNumber: project.projectNumber,
    sheetNumber,
    tempMax: formatTemperature(tempMax),
    tempMin: formatTemperature(tempMin),
    weatherLabel,
    weekday: formatWeekday(dateKey),
    workEnd,
    workStart,
  };
}

function drawLaborRows(
  page: ReturnType<PDFDocument["getPage"]>,
  font: PDFFont,
  labor: Map<string, CountHours>,
) {
  const yByLabel: Record<(typeof laborRows)[number], number> = {
    "Baugeräteführer": 476,
    Facharbeiter: 532,
    Fachwerker: 513,
    "LKW-Fahrer": 494,
    Polier: 568,
    Vorarbeiter: 550,
  };

  for (const label of laborRows) {
    const value = labor.get(label);
    if (!value) continue;
    drawSingleLine(page, font, String(value.count), 51, yByLabel[label], 22, 8);
    drawSingleLine(
      page,
      font,
      formatDecimal(value.hours),
      243,
      yByLabel[label],
      35,
      8,
    );
  }
}

function drawMachineRows(
  page: ReturnType<PDFDocument["getPage"]>,
  font: PDFFont,
  machines: Map<string, MachineBucket>,
) {
  const leftY: Record<(typeof leftMachineRows)[number], number> = {
    Grader: 236,
    Kettenbagger: 368,
    "LKW 2-Achser": 349,
    "LKW 3-Achser": 331,
    "LKW 4-Achser": 313,
    "LKW Abrollkipper": 294,
    "LKW Sattelzug": 275,
    Mobilbagger: 386,
    Planierraupe: 257,
  };
  const rightY: Record<(typeof rightMachineRows)[number], number> = {
    "Erdbauwalze / Walzenzug": 386,
    Kompressor: 368,
    Radlader: 349,
  };

  for (const label of leftMachineRows) {
    const value = machines.get(label);
    if (!value) continue;
    drawSingleLine(page, font, String(value.count), 52, leftY[label], 20, 8);
    drawSingleLine(page, font, formatDecimal(value.hours), 244, leftY[label], 35, 8);
  }

  for (const label of rightMachineRows) {
    const value = machines.get(label);
    if (!value) continue;
    drawSingleLine(page, font, String(value.count), 315, rightY[label], 20, 8);
    drawSingleLine(page, font, formatDecimal(value.hours), 517, rightY[label], 35, 8);
  }

  const known = new Set<string>([...leftMachineRows, ...rightMachineRows]);
  const overflow = Array.from(machines.values())
    .filter((value) => !known.has(value.label))
    .slice(0, 6);
  const overflowRows = [331, 313, 294, 275, 257, 236];

  overflow.forEach((value, index) => {
    const y = overflowRows[index];
    drawSingleLine(page, font, String(value.count), 315, y, 20, 8);
    drawSingleLine(page, font, value.label, 358, y, 136, 8);
    drawSingleLine(page, font, formatDecimal(value.hours), 517, y, 35, 8);
  });
}

function drawPerformanceLines(
  page: ReturnType<PDFDocument["getPage"]>,
  font: PDFFont,
  lines: string[],
) {
  const yRows = [176, 159, 142, 125, 108, 91];

  lines.slice(0, yRows.length).forEach((line, index) => {
    drawSingleLine(page, font, line, 43, yRows[index], 510, 8);
  });
}

function drawSingleLine(
  page: ReturnType<PDFDocument["getPage"]>,
  font: PDFFont,
  value: string | null | undefined,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
) {
  const text = String(value ?? "").trim();
  if (!text) return;

  page.drawText(fitText(text, font, size, maxWidth), {
    color: textColor,
    font,
    size,
    x,
    y,
  });
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) {
    return normalized;
  }

  const ellipsis = "...";
  let result = normalized;
  while (
    result.length > 0 &&
    font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth
  ) {
    result = result.slice(0, -1).trimEnd();
  }

  return `${result}${ellipsis}`;
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
  vehicle: {
    category: string;
    vehicleNumber: string;
    vehicleType: string;
  },
  hours: number,
) {
  addMachineLabel(
    map,
    vehicleLabel({
      category: vehicle.category,
      number: vehicle.vehicleNumber,
      type: vehicle.vehicleType,
    }),
    hours,
  );
}

function addMachineLabel(
  map: Map<string, MachineBucket>,
  rawLabel: string,
  hours: number,
) {
  const label = classifyMachine(rawLabel);
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

function addPerformanceLine(lines: string[], parts: Array<string | null | undefined>) {
  const line = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (line) {
    lines.push(line);
  }
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

function cleanReportNote(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const normalized = normalize(text);
  const internalWords = ["vorschlag", "kapazitaet", "zuteilung", "rest offen"];

  if (internalWords.some((word) => normalized.includes(word))) {
    return null;
  }

  return text;
}

function sameText(
  first: string | null | undefined,
  second: string | null | undefined,
) {
  const left = normalize(String(first ?? "").trim());
  const right = normalize(String(second ?? "").trim());

  return left.length > 0 && left === right;
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

function formatQuantity(
  value: number | null | undefined,
  unit: string | null | undefined,
) {
  if (value === null || value === undefined) return null;
  return `${formatDecimal(value)} ${unit ?? ""}`.trim();
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function toUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "_");
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}
