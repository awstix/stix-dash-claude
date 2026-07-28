import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { EmployeeQualificationBadges } from "@/components/EmployeeQualificationBadges";
import {
  getVehicleInventoryItem,
  vehicleInventoryLinkInclude,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";
import { prisma } from "@/lib/prisma";
import {
  CloseDetailsButton,
  DismissibleDetails,
} from "../../crew-dispatch/DismissibleDetails";
import { ProjectDocumentManager } from "../ProjectDocumentManager";
import { ProjectDailyReportOverview } from "../ProjectDailyReportOverview";
import {
  ProjectFormManager,
  type ProjectDailyReportFormPrefill,
} from "../ProjectFormManager";
import { ProjectPhotoGallery } from "../ProjectPhotoGallery";
import { ProjectInlinePhotoUpload } from "../ProjectInlinePhotoUpload";
import { ProjectMapEditor } from "../ProjectMapEditor";
import { ProjectWeatherPanel } from "../ProjectWeatherPanel";
import {
  parseProjectFormFields,
  parseFormEmailRecipients,
  parseProjectFormSnapshotFields,
  parseProjectFormSnapshotSettings,
  parseProjectFormValues,
} from "../projectFormTypes";

const projectTabs = [
  { label: "Übersicht", href: "#uebersicht" },
  { label: "Leistung", href: "#leistung" },
  { label: "Personal", href: "#personal" },
  { label: "Geräte/Fahrzeuge", href: "#geraete" },
  { label: "Material", href: "#material" },
  { label: "Arbeitssicherheit", href: "#arbeitssicherheit" },
  { label: "Unfallmeldungen", href: "#unfallmeldungen" },
  { label: "Fotos", href: "#fotos" },
  { label: "Dokumente", href: "#dokumente" },
  { label: "Formulare", href: "#formulare" },
  { label: "Notizen", href: "#notizen" },
  { label: "Bautagesberichte", href: "#bautagesberichte" },
];

type ProjectActorListItem = {
  detail?: string | null;
  label: string;
  photoAlt?: string | null;
  photoUrl?: string | null;
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      asphaltDispatchEntries: {
        orderBy: [{ workDate: "desc" }],
      },
      crewPlanningRows: {
        include: {
          assignments: {
            include: {
              crew: {
                include: {
                  defaultVehicles: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      vehicle: {
                        include: {
                          ...vehicleInventoryLinkInclude,
                          driverAssignments: {
                            where: {
                              isActive: true,
                            },
                            include: {
                              driver: {
                                include: {
                                  employee: true,
                                },
                              },
                            },
                            orderBy: [
                              { isPrimary: "desc" },
                              { createdAt: "desc" },
                            ],
                            take: 1,
                          },
                        },
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
                          driver: true,
                          qualifications: {
                            include: {
                              qualificationType: true,
                            },
                            orderBy: {
                              qualificationType: {
                                sortOrder: "asc",
                              },
                            },
                          },
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
                      driver: true,
                      qualifications: {
                        include: {
                          qualificationType: true,
                        },
                        orderBy: {
                          qualificationType: {
                            sortOrder: "asc",
                          },
                        },
                      },
                    },
                  },
                },
              },
              extraVehicles: {
                include: {
                  vehicle: {
                    include: {
                      ...vehicleInventoryLinkInclude,
                      driverAssignments: {
                        where: {
                          isActive: true,
                        },
                        include: {
                          driver: {
                            include: {
                              employee: true,
                            },
                          },
                        },
                        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
            orderBy: [{ startDate: "desc" }],
          },
        },
      },
      equipmentDispatchAssignments: {
        include: {
          crew: true,
          vehicle: {
            include: {
              ...vehicleInventoryLinkInclude,
              driverAssignments: {
                where: {
                  isActive: true,
                },
                include: {
                  driver: {
                    include: {
                      employee: true,
                    },
                  },
                },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ startDate: "desc" }],
      },
      asphaltLoadAllocations: {
        include: {
          driver: {
            include: {
              employee: true,
            },
          },
        },
        orderBy: [{ workDate: "desc" }, { startTime: "asc" }],
      },
      shortHaulAssignments: {
        include: {
          driver: {
            include: {
              employee: true,
            },
          },
        },
        orderBy: [{ workDate: "desc" }],
      },
      shortHaulTours: {
        include: {
          assignment: {
            include: {
              driver: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
        orderBy: [{ startTime: "asc" }],
      },
      specialVehicleDispatchAssignments: {
        include: {
          operatorDriver: {
            include: {
              employee: true,
            },
          },
          transportVehicle: {
            include: {
              ...vehicleInventoryLinkInclude,
              driverAssignments: {
                where: {
                  isActive: true,
                },
                include: {
                  driver: {
                    include: {
                      employee: true,
                    },
                  },
                },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                take: 1,
              },
            },
          },
          vehicle: {
            include: {
              ...vehicleInventoryLinkInclude,
              driverAssignments: {
                where: {
                  isActive: true,
                },
                include: {
                  driver: {
                    include: {
                      employee: true,
                    },
                  },
                },
                orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ workDate: "desc" }, { startTime: "asc" }],
      },
      truckLongHaulEntries: {
        include: {
          truckAssignments: {
            include: {
              driver: {
                include: {
                  employee: true,
                },
              },
            },
          },
        },
        orderBy: [{ workDate: "desc" }],
      },
      tackCoatLoadAllocations: {
        include: {
          driver: {
            include: {
              employee: true,
            },
          },
        },
        orderBy: [{ workDate: "desc" }, { startTime: "asc" }],
      },
      weatherLogs: {
        where: {
          weatherDate: {
            gte: today,
          },
        },
        orderBy: [{ weatherDate: "asc" }],
        take: 16,
      },
      dailyReports: {
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      },
      documentFolders: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      documents: {
        include: {
          folder: true,
        },
        orderBy: [{ uploadedAt: "desc" }],
      },
      formSubmissions: {
        include: {
          template: true,
        },
        orderBy: [{ createdAt: "desc" }],
      },
      photos: {
        orderBy: [{ uploadedAt: "desc" }],
      },
      projectNotes: {
        orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
      },
      projectStartChecklists: {
        include: {
          participants: {
            select: {
              signatureDataUrl: true,
            },
          },
        },
        orderBy: [{ checklistDate: "desc" }, { createdAt: "desc" }],
      },
      generalRiskAssessments: {
        include: {
          participants: {
            select: {
              signatureDataUrl: true,
            },
          },
        },
        orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
      },
      safetyInstructionRecords: {
        include: {
          signatures: {
            select: { signatureDataUrl: true },
          },
          template: {
            select: { title: true, type: true },
          },
        },
        orderBy: [{ instructionDate: "desc" }, { createdAt: "desc" }],
      },
      safetyAccidentReports: {
        include: {
          _count: {
            select: {
              photos: true,
            },
          },
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ accidentDate: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!project) {
    notFound();
  }

  const prefillFromDate = addDays(today, -60);
  const prefillToDate = addDays(today, 60);
  const [
    photoMoveProjects,
    documentMoveFolders,
    formTemplates,
    companyInfo,
    dailyReportPrefillWeatherLogs,
    dailyReportPrefillReports,
  ] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ projectNumber: "asc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.projectDocumentFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.projectFormTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.companyInfo.findUnique({
      where: { id: "default" },
    }),
    prisma.projectWeatherLog.findMany({
      where: {
        projectId: project.id,
        weatherDate: {
          gte: prefillFromDate,
          lte: prefillToDate,
        },
      },
      orderBy: [{ weatherDate: "asc" }],
    }),
    prisma.projectDailyReport.findMany({
      where: {
        projectId: project.id,
        reportDate: {
          gte: prefillFromDate,
          lte: prefillToDate,
        },
      },
      orderBy: [{ reportDate: "asc" }],
    }),
  ]);

  const totalContract = project.contractValueNet + project.changeOrdersNet;
  const performanceValue = totalContract * (project.progressPercent / 100);
  const performanceValueWithoutChangeOrders =
    project.contractValueNet * (project.progressPercent / 100);
  const billingPercent =
    totalContract > 0 ? (project.paymentsNet / totalContract) * 100 : 0;
  const difference = project.paymentsNet - performanceValue;
  const differenceWithoutChangeOrders =
    project.paymentsNet - performanceValueWithoutChangeOrders;
  const coverage =
    performanceValue > 0 ? (difference / performanceValue) * 100 : 0;

  const people = new Map<
    string,
    {
      name: string;
      photoUrl: string | null;
      qualifications: {
        category: string;
        lastReviewedAt: Date | null;
        name: string;
        reviewIntervalMonths: number;
      }[];
    }
  >();
  const equipment = new Map<string, ProjectActorListItem>();
  const trucks = new Map<string, ProjectActorListItem>();
  const materials = new Map<string, ProjectActorListItem>();
  const crewRows: {
    crew: string;
    date: string;
    people: string;
  }[] = [];

  for (const row of project.crewPlanningRows) {
    for (const assignment of row.assignments) {
      const assignmentPeople = new Set<string>();

      for (const member of assignment.crew?.members ?? []) {
        const name = `${member.employee.lastName}, ${member.employee.firstName}`;
        people.set(member.employee.id, {
          name,
          photoUrl: member.employee.photoUrl,
          qualifications: member.employee.qualifications.map(
            (qualification) => ({
              category: qualification.qualificationType.category,
              lastReviewedAt: qualification.lastReviewedAt,
              name: qualification.qualificationType.name,
              reviewIntervalMonths:
                qualification.qualificationType.reviewIntervalMonths,
            }),
          ),
        });
        assignmentPeople.add(name);
      }

      for (const extraEmployee of assignment.extraEmployees) {
        const name = `${extraEmployee.employee.lastName}, ${extraEmployee.employee.firstName}`;
        people.set(extraEmployee.employee.id, {
          name,
          photoUrl: extraEmployee.employee.photoUrl,
          qualifications: extraEmployee.employee.qualifications.map(
            (qualification) => ({
              category: qualification.qualificationType.category,
              lastReviewedAt: qualification.lastReviewedAt,
              name: qualification.qualificationType.name,
              reviewIntervalMonths:
                qualification.qualificationType.reviewIntervalMonths,
            }),
          ),
        });
        assignmentPeople.add(name);
      }

      for (const defaultVehicle of assignment.crew?.defaultVehicles ?? []) {
        setActorListItem(equipment, defaultVehicle.vehicle.id, {
          detail: getVehicleDetail(defaultVehicle.vehicle),
          label: getVehicleLabel(defaultVehicle.vehicle),
          photoUrl: getVehicleDriverPhotoUrl(defaultVehicle.vehicle),
          photoAlt: getVehicleDriverName(defaultVehicle.vehicle),
        });
      }

      for (const extraVehicle of assignment.extraVehicles) {
        setActorListItem(equipment, extraVehicle.vehicle.id, {
          detail: getVehicleDetail(extraVehicle.vehicle),
          label: getVehicleLabel(extraVehicle.vehicle),
          photoUrl: getVehicleDriverPhotoUrl(extraVehicle.vehicle),
          photoAlt: getVehicleDriverName(extraVehicle.vehicle),
        });
      }

      crewRows.push({
        crew: assignment.crewName || assignment.crew?.name || "Kolonne",
        date: `${formatDate(assignment.startDate)} – ${formatDate(
          assignment.endDate,
        )}`,
        people: Array.from(assignmentPeople)
          .sort((a, b) => a.localeCompare(b, "de-DE"))
          .join(", "),
      });
    }
  }

  for (const assignment of project.equipmentDispatchAssignments) {
    setActorListItem(equipment, assignment.vehicle.id, {
      detail: getVehicleDetail(assignment.vehicle),
      label: getVehicleLabel(assignment.vehicle),
      photoUrl: getVehicleDriverPhotoUrl(assignment.vehicle),
      photoAlt: getVehicleDriverName(assignment.vehicle),
    });
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    if (assignment.vehicle) {
      setActorListItem(equipment, assignment.vehicle.id, {
        detail: getVehicleDetail(assignment.vehicle),
        label: getVehicleLabel(assignment.vehicle),
        photoUrl:
          assignment.operatorDriver?.employee?.photoUrl ??
          getVehicleDriverPhotoUrl(assignment.vehicle),
        photoAlt:
          getDriverName(assignment.operatorDriver) ??
          getVehicleDriverName(assignment.vehicle),
      });
    } else if (assignment.vehicleName) {
      setActorListItem(equipment, `special-${assignment.id}`, {
        label: assignment.vehicleName,
        photoUrl: assignment.operatorDriver?.employee?.photoUrl ?? null,
        photoAlt: getDriverName(assignment.operatorDriver),
      });
    }

    if (assignment.transportVehicle) {
      setActorListItem(equipment, assignment.transportVehicle.id, {
        detail: getVehicleDetail(assignment.transportVehicle),
        label: getVehicleLabel(assignment.transportVehicle),
        photoUrl: getVehicleDriverPhotoUrl(assignment.transportVehicle),
        photoAlt: getVehicleDriverName(assignment.transportVehicle),
      });
    } else if (assignment.transportVehicleName) {
      setActorListItem(equipment, `transport-${assignment.id}`, {
        label: assignment.transportVehicleName,
        photoUrl: null,
        photoAlt: null,
      });
    }
  }

  for (const assignment of project.shortHaulAssignments) {
    addTruck(
      trucks,
      assignment.vehicleId ?? assignment.vehicleNumber ?? assignment.id,
      getTruckLabel({
        driverName: assignment.driverName,
        licensePlate: assignment.licensePlate,
        ownerType: "OWN",
        subcontractorName: null,
        vehicleNumber: assignment.vehicleNumber,
        vehicleType: assignment.vehicleType,
      }),
      assignment.driver?.employee?.photoUrl ?? null,
      getDriverName(assignment.driver) ?? assignment.driverName,
      "LKW / Transport · Kurzstrecke",
    );
    addMaterialItem(materials, assignment.material, {
      detail: compactLine([
        "Kurzstrecke",
        formatDate(assignment.workDate),
        assignment.notes,
      ]),
    });
  }

  for (const tour of project.shortHaulTours) {
    const assignment = tour.assignment;
    addTruck(
      trucks,
      assignment.vehicleId ?? assignment.vehicleNumber ?? assignment.id,
      getTruckLabel({
        driverName: assignment.driverName,
        licensePlate: assignment.licensePlate,
        ownerType: "OWN",
        subcontractorName: null,
        vehicleNumber: assignment.vehicleNumber,
        vehicleType: assignment.vehicleType,
      }),
      assignment.driver?.employee?.photoUrl ?? null,
      getDriverName(assignment.driver) ?? assignment.driverName,
      "LKW / Transport · Kurzstrecke",
    );
    addMaterialItem(materials, tour.itemName || tour.customPurpose || tour.material, {
      detail: compactLine([
        tour.purposeType === "FREE" ? "Freier Zweck" : "Kurzstrecke",
        formatDate(assignment.workDate),
        formatQuantity(tour.quantity, tour.quantityUnit),
      ]),
    });
  }

  for (const entry of project.truckLongHaulEntries) {
    for (const assignment of entry.truckAssignments) {
      addTruck(
        trucks,
        assignment.vehicleId ??
          assignment.vehicleNumber ??
          assignment.subcontractorName ??
          assignment.id,
        getTruckLabel({
          driverName: assignment.driverName,
          licensePlate: assignment.licensePlate,
          ownerType: assignment.ownerType,
          subcontractorName: assignment.subcontractorName,
          vehicleNumber: assignment.vehicleNumber,
          vehicleType: assignment.vehicleType,
        }),
        assignment.driver?.employee?.photoUrl ?? null,
        getDriverName(assignment.driver) ?? assignment.driverName,
        compactLine([
          assignment.ownerType === "SUBCONTRACTOR"
            ? "Fremd-LKW / Transport"
            : "LKW / Transport",
          formatDate(entry.workDate),
        ]),
      );
    }
    addMaterialItem(materials, entry.materialName, {
      detail: compactLine([
        "Langstrecke",
        formatDate(entry.workDate),
        formatQuantity(entry.materialQuantity, entry.materialUnit),
      ]),
    });
  }

  for (const allocation of project.asphaltLoadAllocations) {
    addTruck(
      trucks,
      allocation.vehicleId ??
        allocation.vehicleNumber ??
        allocation.subcontractorName ??
        allocation.id,
      getTruckLabel({
        driverName: allocation.driverName,
        licensePlate: allocation.licensePlate,
        ownerType: allocation.ownerType,
        subcontractorName: allocation.subcontractorName,
        vehicleNumber: allocation.vehicleNumber,
        vehicleType: allocation.vehicleType,
      }),
      allocation.driver?.employee?.photoUrl ?? null,
      getDriverName(allocation.driver) ?? allocation.driverName,
      compactLine(["LKW / Asphalt", formatDate(allocation.workDate)]),
    );
    addMaterialItem(
      materials,
      allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
      {
        detail: compactLine([
          "Asphalt-Transport",
          formatDate(allocation.workDate),
          formatQuantity(allocation.totalTons, "t"),
        ]),
      },
    );
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    addTruck(
      trucks,
      allocation.vehicleId ?? allocation.vehicleNumber ?? allocation.id,
      getTruckLabel({
        driverName: allocation.driverName,
        licensePlate: allocation.licensePlate,
        ownerType: allocation.ownerType,
        subcontractorName: null,
        vehicleNumber: allocation.vehicleNumber,
        vehicleType: allocation.vehicleType,
      }),
      allocation.driver?.employee?.photoUrl ?? null,
      getDriverName(allocation.driver) ?? allocation.driverName,
      compactLine(["LKW / Anspritzmittel", formatDate(allocation.workDate)]),
    );
    addMaterialItem(materials, allocation.materialName || "Anspritzmittel", {
      detail: compactLine([
        "Anspritzmittel-Transport",
        formatDate(allocation.workDate),
        formatQuantity(allocation.totalLiters, allocation.quantityUnit || "l"),
      ]),
    });
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    addMaterialItem(materials, assignment.materialName, {
      detail: compactLine([
        "Sonderfahrzeug",
        formatDate(assignment.workDate),
        formatQuantity(assignment.quantity, assignment.quantityUnit),
      ]),
    });
  }

  for (const entry of project.asphaltDispatchEntries) {
    addMaterialItem(
      materials,
      entry.asphaltMixName || entry.asphaltMixNumber || "Asphalt",
      {
        detail: compactLine([
          "Asphaltdispo",
          formatDate(entry.workDate),
          formatQuantity(entry.quantityTons, "t"),
        ]),
      },
    );
    addMaterialItem(materials, entry.tackCoatMaterialName, {
      detail: compactLine([
        "Asphaltdispo",
        formatDate(entry.workDate),
        formatQuantity(entry.tackCoatQuantity, entry.tackCoatUnit),
      ]),
    });
  }

  const peopleList = Array.from(people.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de-DE"),
  );
  const equipmentList = Array.from(equipment.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "de-DE"),
  );
  const truckList = Array.from(trucks.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "de-DE"),
  );
  const vehicleList = [...equipmentList, ...truckList].sort((a, b) =>
    a.label.localeCompare(b.label, "de-DE"),
  );
  const materialList = Array.from(materials.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "de-DE"),
  );
  const weatherEntries = project.weatherLogs.map((entry) => ({
    currentPrecipitationMm: entry.currentPrecipitationMm,
    currentTemperatureC: entry.currentTemperatureC,
    currentWeatherLabel: entry.currentWeatherLabel,
    currentWindSpeedKmh: entry.currentWindSpeedKmh,
    fetchedAt: entry.fetchedAt.toISOString(),
    observedAt: entry.observedAt?.toISOString() ?? null,
    precipitationMm: entry.precipitationMm,
    precipitationProbabilityMax: entry.precipitationProbabilityMax,
    tempMaxC: entry.tempMaxC,
    tempMinC: entry.tempMinC,
    weatherCategory: entry.weatherCategory,
    weatherDate: entry.weatherDate.toISOString(),
    weatherLabel: entry.weatherLabel,
    windSpeedMaxKmh: entry.windSpeedMaxKmh,
  }));
  const dailyReportByDate = new Map(
    project.dailyReports.map((report) => [
      toDateKey(report.reportDate),
      report,
    ]),
  );
  const dailyReportWeatherRows = project.weatherLogs.map((entry) => {
    const dateKey = toDateKey(entry.weatherDate);
    const report = dailyReportByDate.get(dateKey);

    return {
      reportWeatherCategory: report?.weatherCategory ?? null,
      reportWeatherNotes: report?.weatherNotes ?? null,
      reportWeatherSource: report?.weatherSource ?? null,
      reportWeatherTempMaxC: report?.weatherTempMaxC ?? null,
      reportWeatherTempMinC: report?.weatherTempMinC ?? null,
      suggestionCategory: entry.weatherCategory,
      suggestionTempMaxC: entry.tempMaxC,
      suggestionTempMinC: entry.tempMinC,
      weatherDate: dateKey,
    };
  });
  const defaultDailyReportDate = getNextAvailableDailyReportDate(
    today,
    project.dailyReports,
  );
  const nextDailyReportSheetNumber = getNextDailyReportSheetNumber(
    project.dailyReports,
  );
  const dailyReportOverviewItems = project.dailyReports.map((report) => {
    const dateKey = toDateKey(report.reportDate);
    const sheetNumber =
      report.reportNumber?.toString() || report.sheetNumber || "1";
    const searchParams = new URLSearchParams({
      blattnr: sheetNumber,
      date: dateKey,
      projectId: project.id,
    });

    return {
      dateLabel: formatDate(report.reportDate),
      downloadHref: `/projects/bautagesberichte/export?${searchParams.toString()}`,
      editHref: `/projects/bautagesberichte?${searchParams.toString()}`,
      id: report.id,
      numberLabel: report.reportNumber
        ? `Nr. ${report.reportNumber}`
        : report.sheetNumber
          ? `Blatt ${report.sheetNumber}`
          : "-",
      status: report.status,
      weatherSummary: formatDailyReportWeather({
        category: report.weatherCategory,
        max: report.weatherTempMaxC,
        min: report.weatherTempMinC,
      }),
    };
  });
  const dailyReportFormPrefills = buildDailyReportFormPrefills({
    dailyReports: dailyReportPrefillReports,
    fromDate: prefillFromDate,
    project,
    toDate: prefillToDate,
    weatherLogs: dailyReportPrefillWeatherLogs,
  });

  return (
    <AppShell
      title={`${project.projectNumber} · ${project.name}`}
      description="Projektakte mit Übersicht, Leistung, Dispo-Bezug und vorbereiteten Bereichen für Fotos, Dokumente, Formulare, Notizen und Bautagesberichte."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/projects"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projektübersicht
        </Link>
        <Link
          href="/projects/performance"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Projekte Leistung
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {projectTabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            {tab.label}
          </a>
        ))}
      </div>

      <section
        id="uebersicht"
        className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Übersicht
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {project.constructionManager || "Bauleiter offen"} ·{" "}
                  {formatDate(project.plannedStart)} –{" "}
                  {formatDate(project.plannedEnd)}
                </p>
              </div>
              <StatusBadge status={project.status} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric label="Personal" value={`${peopleList.length}`} />
              <MiniMetric
                label="Geräte/Fahrzeuge"
                value={`${vehicleList.length}`}
              />
              <MiniMetric label="Material" value={`${materialList.length}`} />
              <MiniMetric
                label="Dispo-Einträge"
                value={`${
                  project.crewPlanningRows.length +
                  project.equipmentDispatchAssignments.length +
                  project.shortHaulAssignments.length +
                  project.shortHaulTours.length +
                  project.truckLongHaulEntries.length +
                  project.asphaltLoadAllocations.length +
                  project.tackCoatLoadAllocations.length +
                  project.specialVehicleDispatchAssignments.length
                }`}
              />
            </div>

            {project.projectNotes.length === 0 && project.notes ? (
              <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                {project.notes}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <ProjectMapEditor
              mapLatitude={project.mapLatitude}
              mapLongitude={project.mapLongitude}
              mapZoom={project.mapZoom}
              projectId={project.id}
              siteAddress={project.siteAddress}
              siteBoundaryGeoJson={project.siteBoundaryGeoJson}
            />
          </div>
        </div>

        <ProjectWeatherPanel
          entries={weatherEntries}
          hasCoordinates={
            project.mapLatitude !== null && project.mapLongitude !== null
          }
          projectId={project.id}
          reportWeatherRows={dailyReportWeatherRows}
        />
      </section>

      <section
        id="leistung"
        className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Leistung
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Diese Werte kommen aus Projekte Leistung und greifen in die Projektakte.
            </p>
          </div>
          <Link
            href="/projects/performance"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Leistung bearbeiten
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Auftragssumme inkl. Nachträge"
            value={formatEuro(totalContract)}
          />
          <SummaryCard
            label="Leistungsstand IST"
            value={formatEuro(performanceValue)}
            detail={`${formatPercent(project.progressPercent)} Leistung`}
          />
          <SummaryCard
            label="Abrechnungsstand"
            value={formatPercent(billingPercent)}
            detail={formatEuro(project.paymentsNet)}
          />
          <SummaryCard
            label="Über-/Unterdeckung"
            value={formatPercent(coverage)}
            detail={`ohne Nachträge ${formatEuro(
              differenceWithoutChangeOrders,
            )} · mit Nachträgen ${formatEuro(difference)}`}
            tone={coverage >= 0 ? "positive" : "negative"}
          />
        </div>
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section
          id="personal"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-gray-900">Personal</h2>
          <p className="mt-1 text-sm text-gray-600">
            Aktuell aus Kolonneneinteilung und Zusatzpersonal abgeleitet.
          </p>
          <EmployeeQualificationList
            emptyText="Noch kein Personal über Disposition zugeordnet."
            people={peopleList}
          />
        </section>

        <section
          id="geraete"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-gray-900">
            Geräte / Fahrzeuge
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Baumaschinen, LKW und Sonderfahrzeuge aus Planung und Disposition.
          </p>
          <ListBlock
            emptyText="Noch keine Geräte oder Fahrzeuge über Disposition zugeordnet."
            items={vehicleList}
          />
        </section>

        <section
          id="material"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-gray-900">Material</h2>
          <p className="mt-1 text-sm text-gray-600">
            Aus Asphaltplanung, LKW-Disposition, Sonderfahrzeugen und BTB-Bezug.
          </p>
          <ListBlock
            emptyText="Noch kein Material über Disposition oder Planung erfasst."
            items={materialList}
          />
        </section>
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Kolonnen- und Tagesbezug
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3 font-semibold">Zeitraum</th>
                <th className="p-3 font-semibold">Kolonne</th>
                <th className="p-3 font-semibold">Personal</th>
              </tr>
            </thead>
            <tbody>
              {crewRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-5 text-center text-gray-500">
                    Noch keine Kolonnenplanung für dieses Projekt vorhanden.
                  </td>
                </tr>
              ) : (
                crewRows.slice(0, 12).map((row, index) => (
                  <tr key={`${row.crew}-${row.date}-${index}`} className="border-t border-gray-100">
                    <td className="p-3 text-gray-700">{row.date}</td>
                    <td className="p-3 font-semibold text-gray-900">{row.crew}</td>
                    <td className="p-3 text-gray-700">{row.people || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProjectPhotoPreviewSection
          moveProjects={photoMoveProjects.map((moveProject) => ({
            id: moveProject.id,
            label: `${moveProject.projectNumber} · ${moveProject.name}`,
          }))}
          photos={project.photos.map((photo) => ({
            availableForDailyReports: photo.availableForDailyReports,
            cameraMake: photo.cameraMake,
            cameraModel: photo.cameraModel,
            gpsAddressLabel: photo.gpsAddressLabel,
            gpsCity: photo.gpsCity,
            gpsCountry: photo.gpsCountry,
            gpsHouseNumber: photo.gpsHouseNumber,
            gpsLatitude: photo.gpsLatitude,
            gpsLongitude: photo.gpsLongitude,
            gpsPostcode: photo.gpsPostcode,
            gpsReverseGeocodedAt:
              photo.gpsReverseGeocodedAt?.toISOString() ?? null,
            gpsStreet: photo.gpsStreet,
            id: photo.id,
            fileSizeBytes: photo.fileSizeBytes,
            imageHeight: photo.imageHeight,
            imageWidth: photo.imageWidth,
            metadataTaken: photo.metadataTaken,
            notes: photo.notes,
            originalFileName: photo.originalFileName,
            publicUrl: photo.publicUrl,
            uploadedByName: photo.uploadedByName,
            uploadedByUserId: photo.uploadedByUserId,
            capturedAt: photo.capturedAt?.toISOString() ?? null,
            uploadedAt: photo.uploadedAt.toISOString(),
          }))}
          projectId={project.id}
          projectLabel={`${project.projectNumber} · ${project.name}`}
        />
        <ProjectDocumentPreviewSection
          documents={project.documents.map((document) => ({
            displayName: document.displayName,
            fileSizeBytes: document.fileSizeBytes,
            folderId: document.folderId,
            folderName: document.folder?.name ?? null,
            id: document.id,
            mimeType: document.mimeType,
            originalFileName: document.originalFileName,
            projectId: project.id,
            projectName: project.name,
            projectNumber: project.projectNumber,
            publicUrl: document.publicUrl,
            uploadedAt: document.uploadedAt.toISOString(),
            uploadedByName: document.uploadedByName,
            uploadedByUserId: document.uploadedByUserId,
          }))}
          folders={documentMoveFolders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            projectId: folder.projectId,
            sortOrder: folder.sortOrder,
          }))}
          projectId={project.id}
          projects={photoMoveProjects.map((moveProject) => ({
            id: moveProject.id,
            label: `${moveProject.projectNumber} · ${moveProject.name}`,
          }))}
        />
        <div id="formulare" className="lg:col-span-2">
          <ProjectFormManager
            companyInfo={getCompanyInfo(companyInfo)}
            dailyReportPrefills={dailyReportFormPrefills}
            embedded
            lockedProjectId={project.id}
            projects={photoMoveProjects.map((moveProject) => ({
              id: moveProject.id,
              label: `${moveProject.projectNumber} · ${moveProject.name}`,
            }))}
            submissions={project.formSubmissions.map((submission) => {
              const fallbackFields = parseProjectFormFields(
                submission.template?.fieldsJson,
              );
              const snapshotSettings = parseProjectFormSnapshotSettings(
                submission.templateSnapshotJson,
                submission.template,
              );

              return {
                createdAt: submission.createdAt.toISOString(),
                createdByName: submission.createdByName,
                fields: parseProjectFormSnapshotFields(
                  submission.templateSnapshotJson,
                  fallbackFields,
                ),
                formDate: submission.formDate?.toISOString() ?? null,
                id: submission.id,
                paperOrientation: snapshotSettings.paperOrientation,
                paperSize: snapshotSettings.paperSize,
                projectId: submission.projectId,
                projectLabel: `${project.projectNumber} · ${project.name}`,
                templateId: submission.templateId,
                templateName:
                  submission.template?.name ??
                  getSnapshotTemplateName(submission.templateSnapshotJson),
                title: submission.title,
                values: parseProjectFormValues(submission.valuesJson),
              };
            })}
            templates={formTemplates.map((template) => ({
              category: template.category,
              description: template.description,
              emailRecipients: parseFormEmailRecipients(template.emailRecipientsJson),
              fields: parseProjectFormFields(template.fieldsJson),
              id: template.id,
              isActive: template.isActive,
              name: template.name,
              paperOrientation:
                template.paperOrientation === "LANDSCAPE"
                  ? "LANDSCAPE"
                  : "PORTRAIT",
              paperSize: template.paperSize === "A5" ? "A5" : "A4",
              sortOrder: template.sortOrder,
            }))}
          />
        </div>
        <ProjectNotesPreviewSection
          notes={project.projectNotes.map((note) => ({
            category: note.category,
            content: note.content,
            createdByName: note.createdByName,
            id: note.id,
            includeInDailyReport: note.includeInDailyReport,
            noteDate: note.noteDate,
            title: note.title,
            visibility: note.visibility,
          }))}
          projectId={project.id}
        />
        <ProjectSafetySection
          assessments={project.generalRiskAssessments.map((assessment) => ({
            assessmentDate: assessment.assessmentDate,
            id: assessment.id,
            participantCount: assessment.participants.length,
            signedParticipantCount: assessment.participants.filter(
              (participant) => Boolean(participant.signatureDataUrl),
            ).length,
            status: assessment.status,
            templateCode: assessment.templateCode,
            templateRevision: assessment.templateRevision,
            templateTitle: assessment.templateTitle,
          }))}
          checklists={project.projectStartChecklists.map((checklist) => ({
            checklistDate: checklist.checklistDate,
            id: checklist.id,
            participantCount: checklist.participants.length,
            signedParticipantCount: checklist.participants.filter(
              (participant) => Boolean(participant.signatureDataUrl),
            ).length,
            status: checklist.status,
            templateCode: checklist.templateCode,
            templateRevision: checklist.templateRevision,
          }))}
          operatingInstructions={project.safetyInstructionRecords
            .filter(
              (record) =>
                record.template.type === "OPERATING_INSTRUCTION" ||
                record.template.type === "COMMISSION",
            )
            .map((record) => ({
              id: record.id,
              instructionDate: record.instructionDate,
              participantCount: record.signatures.length,
              signedParticipantCount: record.signatures.filter(
                (signature) => Boolean(signature.signatureDataUrl),
              ).length,
              status: record.status,
              title: record.template.title,
            }))}
          projectId={project.id}
        />
        <ProjectAccidentReportsSection
          reports={project.safetyAccidentReports.map((report) => ({
            accidentDate: report.accidentDate,
            accidentTime: report.accidentTime,
            employeeName: report.employee
              ? `${report.employee.lastName}, ${report.employee.firstName}`
              : report.employeeSnapshot,
            id: report.id,
            location: report.location,
            photoCount: report._count.photos,
            status: report.status,
          }))}
          projectId={project.id}
        />
        <ProjectDailyReportOverview
          defaultDate={defaultDailyReportDate}
          nextSheetNumber={nextDailyReportSheetNumber}
          projectId={project.id}
          reports={dailyReportOverviewItems}
        />
      </div>
    </AppShell>
  );
}

function ProjectSafetySection({
  assessments,
  checklists,
  operatingInstructions,
  projectId,
}: {
  assessments: {
    assessmentDate: Date;
    id: string;
    participantCount: number;
    signedParticipantCount: number;
    status: string;
    templateCode: string;
    templateRevision: string;
    templateTitle: string;
  }[];
  checklists: {
    checklistDate: Date;
    id: string;
    participantCount: number;
    signedParticipantCount: number;
    status: string;
    templateCode: string;
    templateRevision: string;
  }[];
  operatingInstructions: {
    id: string;
    instructionDate: Date;
    participantCount: number;
    signedParticipantCount: number;
    status: string;
    title: string;
  }[];
  projectId: string;
}) {
  return (
    <section
      id="arbeitssicherheit"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Arbeitssicherheit
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Projektbezogene Gefährdungsbeurteilungen, Unterweisungen und
            Unterschriften.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
            href={`/safety/risk-assessments/project-start/new?projectId=${projectId}`}
          >
            Projektstart anlegen
          </Link>
          <Link
            className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
            href={`/safety/risk-assessments/general?projectId=${projectId}`}
          >
            Weitere GBU
          </Link>
          <Link
            className="w-fit rounded-xl bg-yellow-400 px-4 py-2 text-xs font-semibold text-gray-950 hover:bg-yellow-300"
            href="/safety/operating-instructions"
          >
            Betriebsanweisung
          </Link>
        </div>
      </div>

      {checklists.length === 0 &&
      assessments.length === 0 &&
      operatingInstructions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
          Für dieses Projekt ist noch keine Projektstart-Checkliste hinterlegt.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {operatingInstructions.map((instruction) => (
            <article
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              key={instruction.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Betriebsanweisung · {instruction.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Unterwiesen am {formatDate(instruction.instructionDate)}
                  </p>
                </div>
                <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800">
                  {instruction.signedParticipantCount}/
                  {instruction.participantCount} Unterschriften
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900"
                  href={`/safety/instruction-records/${instruction.id}`}
                >
                  Öffnen / Teilnehmer nachtragen
                </Link>
                <a
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900"
                  href={`/safety/instruction-records/${instruction.id}/pdf`}
                  target="_blank"
                >
                  PDF
                </a>
              </div>
            </article>
          ))}
          {assessments.map((assessment) => (
            <article
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              key={assessment.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {assessment.templateTitle}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {assessment.templateCode} · Rev.{" "}
                    {assessment.templateRevision} ·{" "}
                    {formatDate(assessment.assessmentDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      assessment.status === "COMPLETED"
                        ? "bg-green-100 text-green-900"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {assessment.status === "COMPLETED"
                      ? "Abgeschlossen"
                      : "Entwurf"}
                  </span>
                  <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {assessment.signedParticipantCount}/
                    {assessment.participantCount} Unterschriften
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/risk-assessments/general/${assessment.id}`}
                >
                  Öffnen / Teilnehmer nachtragen
                </Link>
                <a
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/risk-assessments/general/${assessment.id}/pdf`}
                  target="_blank"
                >
                  PDF
                </a>
              </div>
            </article>
          ))}
          {checklists.map((checklist) => (
            <article
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              key={checklist.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Projektstart Tiefbau / Asphaltbau
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {checklist.templateCode} · Rev.{" "}
                    {checklist.templateRevision} ·{" "}
                    {formatDate(checklist.checklistDate)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      checklist.status === "COMPLETED"
                        ? "bg-green-100 text-green-900"
                        : "bg-amber-100 text-amber-950"
                    }`}
                  >
                    {checklist.status === "COMPLETED"
                      ? "Abgeschlossen"
                      : "Entwurf"}
                  </span>
                  <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {checklist.signedParticipantCount}/
                    {checklist.participantCount} Unterschriften
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/risk-assessments/project-start/${checklist.id}`}
                >
                  Öffnen / Teilnehmer nachtragen
                </Link>
                <a
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/risk-assessments/project-start/${checklist.id}/pdf`}
                  target="_blank"
                >
                  PDF
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectAccidentReportsSection({
  projectId,
  reports,
}: {
  projectId: string;
  reports: {
    accidentDate: Date;
    accidentTime: string | null;
    employeeName: string | null;
    id: string;
    location: string | null;
    photoCount: number;
    status: string;
  }[];
}) {
  const visibleReports = reports.slice(0, 6);

  return (
    <section
      id="unfallmeldungen"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Unfallmeldungen
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Projektbezogene Unfallsofortmeldungen mit PDF, Status und Fotos.
          </p>
        </div>
        <Link
          className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
          href={`/safety/accidents?projectId=${projectId}#unfallmeldung`}
        >
          Neue Unfallmeldung
        </Link>
      </div>

      {visibleReports.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
          Für dieses Projekt sind noch keine Unfallmeldungen hinterlegt.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleReports.map((report) => (
            <article
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              key={report.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatDate(report.accidentDate)}
                    {report.accidentTime ? ` · ${report.accidentTime} Uhr` : ""}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">
                    {report.employeeName || "Ohne Mitarbeiter"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {report.location || "Ohne Unfallort"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-950">
                    {getSafetyAccidentStatusLabel(report.status)}
                  </span>
                  <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {report.photoCount} Foto{report.photoCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/accidents/${report.id}`}
                >
                  Öffnen
                </Link>
                <a
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/accidents/${report.id}/pdf`}
                  target="_blank"
                >
                  PDF
                </a>
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                  href={`/safety/accidents?edit=${report.id}#unfallmeldung`}
                >
                  Bearbeiten
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {reports.length > visibleReports.length ? (
        <Link
          className="mt-4 inline-flex text-xs font-semibold text-gray-700 underline-offset-4 hover:underline"
          href={`/safety/accidents?projectId=${projectId}`}
        >
          Alle {reports.length} Unfallmeldungen öffnen
        </Link>
      ) : null}
    </section>
  );
}

function getSafetyAccidentStatusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "Offen";
    case "DONE":
    case "CLOSED":
      return "Erledigt";
    default:
      return status || "Offen";
  }
}

function getCompanyInfo(
  company: Awaited<ReturnType<typeof prisma.companyInfo.findUnique>>,
) {
  return {
    city: company?.city ?? "Niedernberg",
    companyName: company?.companyName ?? "Josef Stix GmbH & Co. KG",
    country: company?.country ?? "Deutschland",
    email: company?.email ?? "info@stix-bau.de",
    facebookUrl: company?.facebookUrl ?? null,
    instagramUrl: company?.instagramUrl ?? null,
    legalName: company?.legalName ?? null,
    linkedinUrl: company?.linkedinUrl ?? null,
    logoPublicUrl: company?.logoPublicUrl ?? null,
    mobile: company?.mobile ?? null,
    phone: company?.phone ?? "06028 4076000",
    postalCode: company?.postalCode ?? "63843",
    street: company?.street ?? "Depotstraße 2",
    tiktokUrl: company?.tiktokUrl ?? null,
    website: company?.website ?? "https://www.stix-bau.de",
    youtubeUrl: company?.youtubeUrl ?? null,
  };
}

function getNextDailyReportSheetNumber(
  reports: {
    reportNumber: number | null;
    sheetNumber: string;
  }[],
) {
  const highestNumber = reports.reduce((max, report) => {
    const parsedSheetNumber = Number.parseInt(report.sheetNumber, 10);

    return Math.max(
      max,
      report.reportNumber ?? 0,
      Number.isFinite(parsedSheetNumber) ? parsedSheetNumber : 0,
    );
  }, 0);

  return String(highestNumber + 1);
}

function getNextAvailableDailyReportDate(
  startDate: Date,
  reports: {
    reportDate: Date;
  }[],
) {
  const usedDates = new Set(
    reports.map((report) => toDateKey(report.reportDate)),
  );
  const candidate = new Date(startDate);

  for (let offset = 0; offset < 366; offset += 1) {
    const dateKey = toDateKey(candidate);

    if (!usedDates.has(dateKey)) {
      return dateKey;
    }

    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  return toDateKey(startDate);
}

function formatDailyReportWeather({
  category,
  max,
  min,
}: {
  category: string | null;
  max: number | null;
  min: number | null;
}) {
  const temperatures =
    min !== null || max !== null
      ? [formatTemperature(min), formatTemperature(max)]
          .filter(Boolean)
          .join(" / ")
      : "";

  return [category, temperatures].filter(Boolean).join(" · ") || "-";
}

function formatTemperature(value: number | null) {
  if (value === null) return "";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value)} °C`;
}

function ListBlock({
  emptyText,
  items,
}: {
  emptyText: string;
  items: ProjectActorListItem[];
}) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.slice(0, 24).map((item) => (
        <ProjectActorBadge item={item} key={item.label} />
      ))}
    </div>
  );
}

function EmployeeQualificationList({
  emptyText,
  people,
}: {
  emptyText: string;
  people: {
    name: string;
    photoUrl: string | null;
    qualifications: {
      category: string;
      lastReviewedAt: Date | null;
      name: string;
      reviewIntervalMonths: number;
    }[];
  }[];
}) {
  if (people.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      {people.slice(0, 24).map((person) => (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          key={person.name}
        >
          <div className="flex items-start gap-2">
            <ProjectActorAvatar
              label={person.name}
              photoAlt={person.name}
              photoUrl={person.photoUrl}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-gray-900">
                {person.name}
              </div>
              <div className="mt-1.5">
                <EmployeeQualificationBadges
                  qualifications={person.qualifications}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectActorBadge({ item }: { item: ProjectActorListItem }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-gray-100 py-1 pl-1 pr-3 text-xs font-semibold text-gray-800">
      <ProjectActorAvatar
        label={item.label}
        photoAlt={item.photoAlt ?? item.label}
        photoUrl={item.photoUrl ?? null}
        size="sm"
      />
      <span className="min-w-0">
        <span className="block truncate">{item.label}</span>
        {item.detail ? (
          <span className="block truncate text-[10px] font-medium text-gray-500">
            {item.detail}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function ProjectActorAvatar({
  label,
  photoAlt,
  photoUrl,
  size,
}: {
  label: string;
  photoAlt: string | null;
  photoUrl: string | null;
  size: "md" | "sm";
}) {
  const dimension = size === "md" ? 32 : 24;
  const className =
    size === "md"
      ? "h-8 w-8 rounded-full object-cover ring-1 ring-gray-200"
      : "h-6 w-6 rounded-full object-cover ring-1 ring-white";

  if (!photoUrl) {
    if (size === "sm") {
      return null;
    }

    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold uppercase text-gray-500 ring-1 ring-gray-200">
        {getInitials(label)}
      </span>
    );
  }

  return (
    <DismissibleDetails className="relative shrink-0">
      <summary
        className="inline-flex cursor-pointer list-none items-center justify-center rounded-full marker:content-none [&::-webkit-details-marker]:hidden"
        title={`${photoAlt ?? label} Foto vergrößern`}
      >
        <Image
          src={photoUrl}
          alt={`Foto von ${photoAlt ?? label}`}
          width={dimension}
          height={dimension}
          className={`${className} transition hover:scale-105`}
        />
      </summary>

      <CloseDetailsButton
        aria-label="Fotoansicht schließen"
        className="fixed inset-0 z-[120] cursor-default bg-black/70"
      />

      <div className="pointer-events-none fixed inset-0 z-[121] flex items-center justify-center p-6">
        <div className="pointer-events-auto relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-3 shadow-2xl">
          <Image
            src={photoUrl}
            alt={`Foto von ${photoAlt ?? label}`}
            width={960}
            height={720}
            className="max-h-[78vh] max-w-[82vw] rounded-xl object-contain"
          />
          <div className="mt-3 text-center text-sm font-semibold text-gray-900">
            {photoAlt ?? label}
          </div>
          <div className="mt-1 text-center text-xs font-medium text-gray-500">
            Klick außerhalb oder Esc schließt die Ansicht.
          </div>
        </div>
      </div>
    </DismissibleDetails>
  );
}

function ProjectPhotoPreviewSection({
  moveProjects,
  photos,
  projectId,
  projectLabel,
}: {
  moveProjects: {
    id: string;
    label: string;
  }[];
  photos: {
    availableForDailyReports: boolean;
    cameraMake: string | null;
    cameraModel: string | null;
    capturedAt: string | null;
    gpsAddressLabel: string | null;
    gpsCity: string | null;
    gpsCountry: string | null;
    gpsHouseNumber: string | null;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsPostcode: string | null;
    gpsReverseGeocodedAt: string | null;
    gpsStreet: string | null;
    id: string;
    fileSizeBytes: number;
    imageHeight: number | null;
    imageWidth: number | null;
    metadataTaken: boolean;
    notes: string | null;
    originalFileName: string | null;
    publicUrl: string;
    uploadedByName: string | null;
    uploadedByUserId: string | null;
    uploadedAt: string;
  }[];
  projectId: string;
  projectLabel: string;
}) {
  return (
    <section
      id="fotos"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Fotos</h2>
          <p className="mt-2 text-sm text-gray-600">
            Projektfotos mit Notizen und Bautagesbericht-Freigabe.
          </p>
        </div>
        <Link
          className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          href={`/projects/fotos?projectId=${projectId}`}
        >
          Alle Fotos
        </Link>
      </div>

      <ProjectInlinePhotoUpload projectId={projectId} projectLabel={projectLabel} />

      <ProjectPhotoGallery
        currentProjectId={projectId}
        moveProjects={moveProjects}
        photos={photos}
      />
    </section>
  );
}

function ProjectDocumentPreviewSection({
  documents,
  folders,
  projectId,
  projects,
}: {
  documents: {
    displayName: string;
    fileSizeBytes: number;
    folderId: string | null;
    folderName: string | null;
    id: string;
    mimeType: string;
    originalFileName: string;
    projectId: string;
    projectName: string;
    projectNumber: string;
    publicUrl: string;
    uploadedAt: string;
    uploadedByName: string | null;
    uploadedByUserId: string | null;
  }[];
  folders: {
    id: string;
    name: string;
    projectId: string;
    sortOrder: number;
  }[];
  projectId: string;
  projects: {
    id: string;
    label: string;
  }[];
}) {
  return (
    <section
      id="dokumente"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dokumente</h2>
          <p className="mt-2 text-sm text-gray-600">
            Projektdateien mit Ordnern, Vorschau, Filter und Download.
          </p>
        </div>
        <Link
          className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          href={`/projects/dokumente?projectId=${projectId}`}
        >
          Alle Dokumente
        </Link>
      </div>

      <ProjectDocumentManager
        documents={documents}
        embedded
        folders={folders}
        lockedProjectId={projectId}
        projects={projects}
      />
    </section>
  );
}

function ProjectNotesPreviewSection({
  notes,
  projectId,
}: {
  notes: {
    category: string;
    content: string;
    createdByName: string | null;
    id: string;
    includeInDailyReport: boolean;
    noteDate: Date;
    title: string | null;
    visibility: string;
  }[];
  projectId: string;
}) {
  const visibleNotes = notes.slice(0, 8);

  return (
    <section
      id="notizen"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notizen</h2>
          <p className="mt-2 text-sm text-gray-600">
            Projektbezogene Hinweise für Disposition, Kolonnenverteilung und
            Bautagesberichte.
          </p>
        </div>
        <Link
          className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700"
          href={`/projects/notizen?projectId=${projectId}`}
        >
          Notiz erfassen
        </Link>
      </div>

      {visibleNotes.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
          Noch keine Notizen für dieses Projekt erfasst.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {visibleNotes.map((note) => (
            <article
              className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              key={note.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                  {getProjectNoteCategoryLabel(note.category)}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                  {getProjectNoteVisibilityLabel(note.visibility)}
                </span>
                {note.includeInDailyReport ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                    BTB
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">
                {note.title || formatDate(note.noteDate)}
              </h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                {formatDate(note.noteDate)}
                {note.createdByName ? ` · ${note.createdByName}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {note.content}
              </p>
            </article>
          ))}
        </div>
      )}

      {notes.length > visibleNotes.length ? (
        <Link
          className="mt-4 inline-flex text-xs font-semibold text-gray-700 underline-offset-4 hover:underline"
          href={`/projects/notizen?projectId=${projectId}`}
        >
          Alle {notes.length} Notizen öffnen
        </Link>
      ) : null}
    </section>
  );
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

function getProjectNoteVisibilityLabel(value: string) {
  switch (value) {
    case "DISPATCH":
      return "Disposition";
    case "BTB":
      return "BTB / Bericht";
    default:
      return "Intern";
  }
}

function SummaryCard({
  detail,
  label,
  tone = "neutral",
  value,
}: {
  detail?: string;
  label: string;
  tone?: "negative" | "neutral" | "positive";
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-2 text-lg font-bold ${getToneClass(tone)}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const colorMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    FINISHED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  const labelMap: Record<ProjectStatus, string> = {
    NOT_STARTED: "noch nicht begonnen",
    ACTIVE: "aktiv",
    PAUSED: "ruht",
    FINISHED: "beendet",
    CANCELLED: "storniert",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${colorMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

type DailyReportPrefillWeatherLog = {
  currentTemperatureC: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  weatherCategory: string | null;
  weatherDate: Date;
  weatherLabel: string | null;
};

type DailyReportPrefillReport = {
  reportDate: Date;
  weatherCategory: string | null;
  weatherNotes: string | null;
  weatherTempMaxC: number | null;
  weatherTempMinC: number | null;
};

type VehicleLabelInput = {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
} & VehicleWithInventoryLink;

type DailyReportPrefillProject = {
  asphaltDispatchEntries: {
    asphaltMixName: string | null;
    asphaltMixNumber: string | null;
    notes: string | null;
    quantityTons: number;
    tackCoatMaterialName: string | null;
    tackCoatQuantity: number;
    tackCoatUnit: string | null;
    workDate: Date;
  }[];
  asphaltLoadAllocations: {
    asphaltMixName: string | null;
    asphaltMixNumber: string | null;
    endTime: string;
    notes: string | null;
    startTime: string;
    totalTons: number;
    vehicleCategory: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    workDate: Date;
  }[];
  crewPlanningRows: {
    assignments: {
      crew: {
        defaultVehicles: {
          vehicle: VehicleLabelInput;
        }[];
        members: {
          employee: {
            firstName: string;
            lastName: string;
          };
        }[];
      } | null;
      crewName: string;
      endDate: Date;
      endTime: string;
      extraEmployees: {
        employee: {
          firstName: string;
          lastName: string;
        };
      }[];
      extraVehicles: {
        vehicle: VehicleLabelInput;
      }[];
      notes: string | null;
      startDate: Date;
      startTime: string;
    }[];
  }[];
  equipmentDispatchAssignments: {
    endDate: Date;
    notes: string | null;
    startDate: Date;
    vehicle: VehicleLabelInput;
  }[];
  name: string;
  notes: string | null;
  projectNotes: {
    category: string;
    content: string;
    includeInDailyReport: boolean;
    noteDate: Date;
    title: string | null;
    visibility: string;
  }[];
  projectNumber: string;
  shortHaulAssignments: {
    driverName: string | null;
    licensePlate: string | null;
    material: string | null;
    notes: string | null;
    startTime: string;
    vehicleCategory: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    workDate: Date;
  }[];
  shortHaulTours: {
    customPurpose: string | null;
    endTime: string;
    itemName: string | null;
    material: string | null;
    notes: string | null;
    purposeType: string;
    quantity: number | null;
    quantityUnit: string | null;
    startTime: string;
    assignment: {
      driverName: string | null;
      licensePlate: string | null;
      vehicleCategory: string | null;
      vehicleNumber: string | null;
      vehicleType: string | null;
      workDate: Date;
    };
  }[];
  specialVehicleDispatchAssignments: {
    endTime: string;
    materialName: string | null;
    notes: string | null;
    quantity: number | null;
    quantityUnit: string | null;
    startTime: string;
    taskText: string;
    transportVehicle: VehicleLabelInput | null;
    transportVehicleName: string | null;
    vehicle: VehicleLabelInput | null;
    vehicleName: string;
    workDate: Date;
  }[];
  tackCoatLoadAllocations: {
    endTime: string;
    materialName: string;
    notes: string | null;
    quantityUnit: string;
    startTime: string;
    totalLiters: number;
    vehicleCategory: string | null;
    vehicleNumber: string | null;
    vehicleType: string | null;
    workDate: Date;
  }[];
  truckLongHaulEntries: {
    materialName: string | null;
    materialQuantity: number;
    materialUnit: string | null;
    notes: string | null;
    truckAssignments: {
      plannedEndTime: string;
      plannedStartTime: string;
      vehicleCategory: string;
      vehicleNumber: string | null;
      vehicleType: string | null;
    }[];
    workDate: Date;
  }[];
};

function buildDailyReportFormPrefills({
  dailyReports,
  fromDate,
  project,
  toDate,
  weatherLogs,
}: {
  dailyReports: DailyReportPrefillReport[];
  fromDate: Date;
  project: DailyReportPrefillProject;
  toDate: Date;
  weatherLogs: DailyReportPrefillWeatherLog[];
}) {
  const weatherByDate = new Map(
    weatherLogs.map((weatherLog) => [toDateKey(weatherLog.weatherDate), weatherLog]),
  );
  const dailyReportByDate = new Map(
    dailyReports.map((dailyReport) => [
      toDateKey(dailyReport.reportDate),
      dailyReport,
    ]),
  );
  const dateKeys = new Set<string>();

  for (
    let cursor = new Date(fromDate);
    cursor <= toDate;
    cursor = addDays(cursor, 1)
  ) {
    dateKeys.add(toDateKey(cursor));
  }

  return Object.fromEntries(
    Array.from(dateKeys)
      .sort()
      .map((dateKey) => [
        dateKey,
        buildDailyReportFormPrefillForDate({
          dailyReport: dailyReportByDate.get(dateKey) ?? null,
          dateKey,
          project,
          weatherLog: weatherByDate.get(dateKey) ?? null,
        }),
      ]),
  );
}

function buildDailyReportFormPrefillForDate({
  dailyReport,
  dateKey,
  project,
  weatherLog,
}: {
  dailyReport: DailyReportPrefillReport | null;
  dateKey: string;
  project: DailyReportPrefillProject;
  weatherLog: DailyReportPrefillWeatherLog | null;
}): ProjectDailyReportFormPrefill {
  const people = new Set<string>();
  const equipment = new Set<string>();
  const performanceLines: string[] = [];
  const materialLines: string[] = [];

  for (const row of project.crewPlanningRows) {
    for (const assignment of row.assignments) {
      if (!isDateKeyInRange(dateKey, assignment.startDate, assignment.endDate)) {
        continue;
      }

      for (const member of assignment.crew?.members ?? []) {
        people.add(getEmployeeName(member.employee));
      }

      for (const extraEmployee of assignment.extraEmployees) {
        people.add(getEmployeeName(extraEmployee.employee));
      }

      for (const defaultVehicle of assignment.crew?.defaultVehicles ?? []) {
        addNonEmpty(equipment, getVehicleLabel(defaultVehicle.vehicle));
      }

      for (const extraVehicle of assignment.extraVehicles) {
        addNonEmpty(equipment, getVehicleLabel(extraVehicle.vehicle));
      }

      if (assignment.notes) {
        performanceLines.push(
          `${assignment.crewName || "Kolonne"}: ${assignment.notes}`,
        );
      }
    }
  }

  for (const assignment of project.equipmentDispatchAssignments) {
    if (isDateKeyInRange(dateKey, assignment.startDate, assignment.endDate)) {
      addNonEmpty(equipment, getVehicleLabel(assignment.vehicle));
    }
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    if (!isSameDateKey(dateKey, assignment.workDate)) continue;

    addNonEmpty(
      equipment,
      assignment.vehicle
        ? getVehicleLabel(assignment.vehicle)
        : assignment.vehicleName,
    );
    addNonEmpty(
      equipment,
      assignment.transportVehicle
        ? getVehicleLabel(assignment.transportVehicle)
        : assignment.transportVehicleName,
    );
    addNonEmpty(
      performanceLines,
      compactLine([
        assignment.startTime,
        "-",
        assignment.endTime,
        assignment.taskText || "Sonderfahrzeug",
        formatQuantity(assignment.quantity, assignment.quantityUnit),
        assignment.notes,
      ]),
    );
  }

  for (const assignment of project.shortHaulAssignments) {
    if (!isSameDateKey(dateKey, assignment.workDate)) continue;

    addNonEmpty(
      equipment,
      getTruckLabel({
        driverName: assignment.driverName,
        licensePlate: assignment.licensePlate,
        ownerType: "OWN",
        subcontractorName: null,
        vehicleNumber: assignment.vehicleNumber,
        vehicleType: assignment.vehicleType,
      }),
    );
    addNonEmpty(materialLines, assignment.material);
  }

  for (const tour of project.shortHaulTours) {
    if (!isSameDateKey(dateKey, tour.assignment.workDate)) continue;

    addNonEmpty(
      equipment,
      getTruckLabel({
        driverName: tour.assignment.driverName,
        licensePlate: tour.assignment.licensePlate,
        ownerType: "OWN",
        subcontractorName: null,
        vehicleNumber: tour.assignment.vehicleNumber,
        vehicleType: tour.assignment.vehicleType,
      }),
    );
    addNonEmpty(
      performanceLines,
      compactLine([
        tour.startTime,
        "-",
        tour.endTime,
        tour.itemName || tour.customPurpose || tour.purposeType,
        formatQuantity(tour.quantity, tour.quantityUnit),
        tour.material,
        tour.notes,
      ]),
    );
    addNonEmpty(
      materialLines,
      compactLine([
        tour.itemName || tour.customPurpose || tour.material,
        formatQuantity(tour.quantity, tour.quantityUnit),
      ]),
    );
  }

  for (const entry of project.truckLongHaulEntries) {
    if (!isSameDateKey(dateKey, entry.workDate)) continue;

    addNonEmpty(
      materialLines,
      compactLine([
        entry.materialName,
        formatQuantity(entry.materialQuantity, entry.materialUnit),
      ]),
    );
    addNonEmpty(
      performanceLines,
      compactLine([
        entry.materialName,
        formatQuantity(entry.materialQuantity, entry.materialUnit),
        entry.notes,
      ]),
    );

    for (const truckAssignment of entry.truckAssignments) {
      addNonEmpty(
        equipment,
        [truckAssignment.vehicleNumber, truckAssignment.vehicleType]
          .filter(Boolean)
          .join(" · "),
      );
    }
  }

  for (const allocation of project.asphaltLoadAllocations) {
    if (!isSameDateKey(dateKey, allocation.workDate)) continue;

    addNonEmpty(
      equipment,
      [allocation.vehicleNumber, allocation.vehicleType].filter(Boolean).join(" · "),
    );
    addNonEmpty(
      materialLines,
      compactLine([
        allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
        `${formatNumberText(allocation.totalTons)} t`,
      ]),
    );
    addNonEmpty(
      performanceLines,
      compactLine([
        allocation.startTime,
        "-",
        allocation.endTime,
        allocation.asphaltMixName || allocation.asphaltMixNumber || "Asphalt",
        `${formatNumberText(allocation.totalTons)} t`,
        allocation.notes,
      ]),
    );
  }

  for (const allocation of project.tackCoatLoadAllocations) {
    if (!isSameDateKey(dateKey, allocation.workDate)) continue;

    addNonEmpty(
      materialLines,
      compactLine([
        allocation.materialName || "Anspritzmittel",
        `${formatNumberText(allocation.totalLiters)} ${allocation.quantityUnit}`,
      ]),
    );
    addNonEmpty(
      performanceLines,
      compactLine([
        allocation.startTime,
        "-",
        allocation.endTime,
        allocation.materialName || "Anspritzmittel",
        `${formatNumberText(allocation.totalLiters)} ${allocation.quantityUnit}`,
        allocation.notes,
      ]),
    );
  }

  for (const entry of project.asphaltDispatchEntries) {
    if (!isSameDateKey(dateKey, entry.workDate)) continue;

    addNonEmpty(
      materialLines,
      compactLine([
        entry.asphaltMixName || entry.asphaltMixNumber || "Asphalt",
        `${formatNumberText(entry.quantityTons)} t`,
      ]),
    );

    if (entry.tackCoatQuantity > 0) {
      addNonEmpty(
        materialLines,
        compactLine([
          entry.tackCoatMaterialName || "Anspritzmittel",
          `${formatNumberText(entry.tackCoatQuantity)} ${entry.tackCoatUnit || "l"}`,
        ]),
      );
    }
  }

  const weatherCategory =
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
  const incidentLines = dailyReport
    ? []
    : project.projectNotes
        .filter(
          (note) =>
            note.includeInDailyReport &&
            note.visibility !== "INTERNAL" &&
            toDateKey(note.noteDate) === dateKey,
        )
        .map((note) =>
          compactLine([
            getProjectNoteCategoryLabel(note.category),
            note.title,
            note.content,
          ]),
        )
        .filter((line): line is string => Boolean(line?.trim()));

  if (!dailyReport && incidentLines.length === 0 && project.notes?.trim()) {
    incidentLines.push(project.notes.trim());
  }

  return {
    title: `Bautagesbericht ${project.projectNumber} · ${formatDateKey(dateKey)}`,
    values: {
      behinderung: "",
      geraete: joinSet(equipment),
      leistung: joinUnique(performanceLines),
      material: joinUnique(materialLines),
      personal: joinSet(people),
      temperatur_max: formatNumberInput(tempMax),
      temperatur_min: formatNumberInput(tempMin),
      vorkommnisse: joinUnique(incidentLines),
      wetter: [weatherCategory, dailyReport?.weatherNotes]
        .filter(Boolean)
        .join("\n"),
    },
  };
}

function addNonEmpty(target: Set<string> | string[], value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return;

  if (target instanceof Set) {
    target.add(text);
    return;
  }

  target.push(text);
}

function addMaterialItem(
  materials: Map<string, ProjectActorListItem>,
  label: string | null | undefined,
  {
    detail,
  }: {
    detail?: string | null;
  } = {},
) {
  const text = String(label ?? "").trim();
  if (!text) return;
  const key = text.toLocaleLowerCase("de-DE");
  const existing = materials.get(key);
  const details = [existing?.detail, detail]
    .flatMap((value) => String(value ?? "").split(" · "))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueDetails = Array.from(new Set(details)).slice(0, 6);

  setActorListItem(materials, key, {
    detail: uniqueDetails.join(" · ") || null,
    label: text,
  });
}

function compactLine(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function formatQuantity(
  value: number | null | undefined,
  unit: string | null | undefined,
) {
  if (value === null || value === undefined) return "";
  return `${formatNumberText(value)} ${unit ?? ""}`.trim();
}

function joinSet(values: Set<string>) {
  return Array.from(values)
    .sort((a, b) => a.localeCompare(b, "de-DE"))
    .join("\n");
}

function joinUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
    .slice(0, 12)
    .join("\n");
}

function getEmployeeName(employee: { firstName: string; lastName: string }) {
  return `${employee.lastName}, ${employee.firstName}`;
}

function isSameDateKey(dateKey: string, date: Date) {
  return toDateKey(date) === dateKey;
}

function isDateKeyInRange(dateKey: string, startDate: Date, endDate: Date) {
  return toDateKey(startDate) <= dateKey && dateKey <= toDateKey(endDate);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateKey(dateKey: string) {
  return new Intl.DateTimeFormat("de-DE").format(
    new Date(`${dateKey}T12:00:00.000Z`),
  );
}

function formatNumberText(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value);
}

function formatNumberInput(value: number | null) {
  if (value === null) return "";
  return String(Math.round(value * 10) / 10);
}

function getVehicleLabel(vehicle: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
} & VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  if (inventoryItem) {
    return String(inventoryItem.name ?? "").trim() || "Fahrzeug / Gerät";
  }

  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function getVehicleDetail(vehicle: VehicleWithInventoryLink) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  if (!inventoryItem) {
    return null;
  }

  const category = inventoryItem.category?.parentCategory
    ? `${inventoryItem.category.parentCategory.name} / ${inventoryItem.category.name}`
    : inventoryItem.category?.name;
  const responsible = inventoryItem.responsibleCrew
    ? `Kolonne: ${inventoryItem.responsibleCrew.name}`
    : inventoryItem.responsibleEmployee
      ? `Mitarbeiter: ${[
          inventoryItem.responsibleEmployee.lastName,
          inventoryItem.responsibleEmployee.firstName,
        ]
          .filter(Boolean)
          .join(", ")}`
      : null;
  const location = inventoryItem.currentProject
    ? `Baustelle: ${inventoryItem.currentProject.projectNumber}`
    : inventoryItem.currentLocationLabel
      ? `Standort: ${inventoryItem.currentLocationLabel}`
      : null;

  return [category, responsible, location].filter(Boolean).join(" · ");
}

function setActorListItem(
  items: Map<string, ProjectActorListItem>,
  key: string,
  item: ProjectActorListItem,
) {
  if (!item.label) return;
  const existing = items.get(key);

  items.set(key, {
    detail: item.detail ?? existing?.detail ?? null,
    label: item.label,
    photoAlt: item.photoAlt ?? existing?.photoAlt ?? null,
    photoUrl: item.photoUrl ?? existing?.photoUrl ?? null,
  });
}

function addTruck(
  trucks: Map<string, ProjectActorListItem>,
  key: string,
  label: string,
  photoUrl: string | null = null,
  photoAlt: string | null = null,
  detail: string | null = null,
) {
  if (!label) return;
  setActorListItem(trucks, key, {
    detail,
    label,
    photoAlt,
    photoUrl,
  });
}

function getTruckLabel(truck: {
  driverName: string | null;
  licensePlate: string | null;
  ownerType: string | null;
  subcontractorName: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  const vehicleLabel = [
    truck.vehicleNumber,
    truck.licensePlate,
    truck.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
  const ownerLabel =
    truck.ownerType === "SUBCONTRACTOR" && truck.subcontractorName
      ? `Fremd: ${truck.subcontractorName}`
      : null;

  return Array.from(
    new Set([vehicleLabel || ownerLabel, truck.driverName || ownerLabel].filter(Boolean)),
  ).join(" · ");
}

function getDriverName(
  driver:
    | { firstName?: string | null; lastName?: string | null }
    | null
    | undefined,
) {
  if (!driver?.firstName && !driver?.lastName) return null;

  return [driver.lastName, driver.firstName].filter(Boolean).join(", ");
}

function getVehicleDriver(
  vehicle:
    | {
        driverAssignments?: {
          driver: {
            firstName?: string | null;
            lastName?: string | null;
            employee?: {
              photoUrl: string | null;
            } | null;
          };
        }[];
      }
    | null
    | undefined,
) {
  return vehicle?.driverAssignments?.[0]?.driver ?? null;
}

function getVehicleDriverName(
  vehicle:
    | {
        driverAssignments?: {
          driver: {
            firstName?: string | null;
            lastName?: string | null;
          };
        }[];
      }
    | null
    | undefined,
) {
  return getDriverName(getVehicleDriver(vehicle));
}

function getVehicleDriverPhotoUrl(
  vehicle:
    | {
        driverAssignments?: {
          driver: {
            employee?: {
              photoUrl: string | null;
            } | null;
          };
        }[];
      }
    | null
    | undefined,
) {
  return getVehicleDriver(vehicle)?.employee?.photoUrl ?? null;
}

function getInitials(label: string) {
  const normalized = label.replace(",", " ").trim();
  const parts = normalized.split(/\s+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getSnapshotTemplateName(snapshotJson: string | null) {
  if (!snapshotJson) {
    return "Vorlage entfernt";
  }

  try {
    const parsed = JSON.parse(snapshotJson) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name
      : "Vorlage entfernt";
  } catch {
    return "Vorlage entfernt";
  }
}

function getToneClass(tone: "negative" | "neutral" | "positive") {
  if (tone === "positive") {
    return "text-green-700";
  }

  if (tone === "negative") {
    return "text-red-700";
  }

  return "text-gray-900";
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`;
}

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(value);
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}
