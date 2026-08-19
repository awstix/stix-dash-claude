import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import {
  dashboardWidgets,
  defaultDashboardWidgetKeys,
} from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";
import { leaveRequestIdsInProjectScope } from "@/lib/leave-request-access";
import { DashboardGrid } from "./DashboardGrid";

type AsphaltDispatchEntryForSummary = {
  asphaltMixName: string | null;
  quantityTons: number;
  tackCoatMaterialName: string | null;
  tackCoatQuantity: number;
  tackCoatUnit: string | null;
};

function formatTons(value: number) {
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} t`;
}

/** Gruppiert Asphalt-Dispo-Einträge nach Mischgut (Summe je Sorte, danach
 * Gesamtsumme) und listet Anspritzmittel separat (eigene Mengeneinheit,
 * kann nicht mit Asphalt-Tonnen zusammengezählt werden) - gemeinsam von
 * der Wochen- und der Tageszusammenfassung Asphalt genutzt, damit beide
 * exakt gleich rechnen. */
function buildAsphaltSummary(entries: AsphaltDispatchEntryForSummary[]) {
  const mixTotals = new Map<string, number>();
  const tackCoatTotals = new Map<string, { quantity: number; unit: string }>();
  let totalAsphaltTons = 0;

  for (const entry of entries) {
    if (entry.asphaltMixName && entry.quantityTons > 0) {
      mixTotals.set(
        entry.asphaltMixName,
        (mixTotals.get(entry.asphaltMixName) ?? 0) + entry.quantityTons,
      );
      totalAsphaltTons += entry.quantityTons;
    }
    if (entry.tackCoatMaterialName && entry.tackCoatQuantity > 0) {
      const unit = entry.tackCoatUnit || "l";
      const current = tackCoatTotals.get(entry.tackCoatMaterialName) ?? {
        quantity: 0,
        unit,
      };
      current.quantity += entry.tackCoatQuantity;
      tackCoatTotals.set(entry.tackCoatMaterialName, current);
    }
  }

  const items: string[] = [];
  for (const [mixName, tons] of mixTotals.entries()) {
    items.push(`${mixName}: ${formatTons(tons)}`);
  }
  if (mixTotals.size > 0) {
    items.push(`Summe Asphalt: ${formatTons(totalAsphaltTons)}`);
  }
  for (const [materialName, { quantity, unit }] of tackCoatTotals.entries()) {
    items.push(
      `${materialName}: ${quantity.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`,
    );
  }
  if (items.length === 0) {
    items.push("Keine Einträge in diesem Zeitraum.");
  }

  return { items, valueText: formatTons(totalAsphaltTons) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ access?: string }>;
}) {
  const session = await requireSession();
  const accessDenied = (await searchParams)?.access === "denied";
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
      include: {
        featureAccesses: { where: { canView: true } },
        projectAccesses: { where: { canViewProjectData: true } },
      },
      where: { id: session.user.id },
    }),
  ]);
  const admin = String(currentUser?.role ?? "").split(",").includes("admin");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // Montag-Sonntag der laufenden Kalenderwoche, exakt wie startOfWeek() auf
  // der Asphaltdispo-Seite (src/app/asphalt-dispatch/page.tsx) - nicht
  // "heute + 7 Tage nach vorne", sonst fehlen hier bereits erfasste Tage
  // der laufenden Woche, die vor heute liegen (z.B. Montag-Eintrag, wenn
  // heute schon Mittwoch ist).
  const weekStart = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const weekStartDay = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStartDay + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const assignedProjectRows = currentUser?.employeeId
    ? await prisma.crewPlanningAssignment.findMany({
        select: { row: { select: { projectId: true } } },
        where: {
          OR: [
            { crew: { members: { some: { employeeId: currentUser.employeeId, isActive: true } } } },
            { extraEmployees: { some: { employeeId: currentUser.employeeId, mode: { not: "EXCLUDE" } } } },
          ],
        },
      })
    : [];
  const projectIds = Array.from(
    new Set([
      ...(currentUser?.projectAccesses.map((access) => access.projectId) ?? []),
      ...assignedProjectRows.flatMap((assignment) =>
        assignment.row.projectId ? [assignment.row.projectId] : [],
      ),
    ]),
  );
  const projectAssignments = admin || projectIds.length
    ? await prisma.crewPlanningAssignment.findMany({
        include: {
          crew: {
            include: {
              members: {
                select: {
                  employee: { select: { firstName: true, lastName: true } },
                  employeeId: true,
                },
                where: { isActive: true },
              },
            },
          },
          extraEmployees: {
            select: {
              employee: { select: { firstName: true, lastName: true } },
              employeeId: true,
              mode: true,
            },
          },
          row: { select: { projectId: true } },
        },
        where: {
          row: {
            projectId: admin ? { not: null } : { in: projectIds },
          },
        },
      })
    : [];
  const visibleEmployeeIds = new Set<string>();
  if (currentUser?.employeeId) visibleEmployeeIds.add(currentUser.employeeId);
  for (const assignment of projectAssignments) {
    assignment.crew?.members.forEach((member) =>
      visibleEmployeeIds.add(member.employeeId),
    );
    assignment.extraEmployees
      .filter((employee) => employee.mode.toUpperCase() !== "EXCLUDE")
      .forEach((employee) => visibleEmployeeIds.add(employee.employeeId));
  }
  const globalEmployeeData = admin || Boolean(currentUser?.canApproveLeaveRequests);
  const scopedProjectWhere = admin ? {} : { projectId: { in: projectIds } };
  const [
    latestPhotos,
    asphaltWeekEntries,
    pendingLeaveCandidates,
    todayAbsences,
    mapProjects,
    todayEquipment,
    todayCrews,
    todayLongHaul,
    todayShortHaul,
    todayCrewTimes,
  ] =
    await Promise.all([
      prisma.projectPhoto.findMany({
        include: { project: { select: { name: true, projectNumber: true } } },
        orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
        where: scopedProjectWhere,
      }),
      prisma.asphaltDispatchEntry.findMany({
        orderBy: [{ workDate: "asc" }, { crew: "asc" }],
        where: {
          ...scopedProjectWhere,
          workDate: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.leaveRequest.findMany({
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 80,
        where: { status: "PENDING" },
      }),
      prisma.employeeDispositionEntry.findMany({
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { employee: { lastName: "asc" } },
        where: {
          endDate: { gte: today },
          startDate: { lt: tomorrow },
          typeValue: { in: ["urlaub", "krank", "zeitausgleich"] },
          ...(globalEmployeeData
            ? {}
            : { employeeId: { in: [...visibleEmployeeIds] } }),
        },
      }),
      prisma.project.findMany({
        orderBy: { projectNumber: "asc" },
        select: {
          id: true,
          mapLatitude: true,
          mapLongitude: true,
          name: true,
          projectNumber: true,
        },
        where: {
          ...(admin ? {} : { id: { in: projectIds } }),
          mapLatitude: { not: null },
          mapLongitude: { not: null },
          status: { in: ["NOT_STARTED", "ACTIVE", "PAUSED"] },
        },
      }),
      prisma.equipmentDispatchAssignment.findMany({
        include: {
          inventoryItem: { select: { name: true, objectNumber: true } },
          project: { select: { name: true, projectNumber: true } },
          vehicle: {
            select: {
              licensePlate: true,
              vehicleNumber: true,
              vehicleType: true,
            },
          },
        },
        orderBy: [{ project: { projectNumber: "asc" } }, { vehicle: { vehicleNumber: "asc" } }],
        where: {
          endDate: { gte: today },
          startDate: { lt: tomorrow },
          ...(admin ? {} : { projectId: { in: projectIds } }),
        },
      }),
      prisma.crewPlanningAssignment.findMany({
        include: {
          crew: { select: { name: true } },
          row: {
            select: {
              projectId: true,
              projectName: true,
              projectNumber: true,
            },
          },
        },
        orderBy: [{ row: { projectNumber: "asc" } }, { crewName: "asc" }],
        where: {
          endDate: { gte: today },
          startDate: { lt: tomorrow },
          row: {
            projectId: admin ? { not: null } : { in: projectIds },
          },
        },
      }),
      prisma.truckLongHaulEntry.findMany({
        include: {
          project: { select: { name: true, projectNumber: true } },
          truckAssignments: {
            select: {
              driver: {
                select: {
                  employee: { select: { id: true } },
                },
              },
              driverName: true,
              licensePlate: true,
              subcontractorName: true,
              vehicleNumber: true,
              vehicleType: true,
            },
          },
        },
        orderBy: [{ projectNumber: "asc" }, { projectName: "asc" }],
        where: {
          workDate: { gte: today, lt: tomorrow },
          ...(admin ? {} : { projectId: { in: projectIds } }),
        },
      }),
      prisma.shortHaulAssignment.findMany({
        include: {
          driver: {
            select: {
              employee: { select: { id: true } },
            },
          },
          project: { select: { name: true, projectNumber: true } },
        },
        orderBy: [{ projectNumber: "asc" }, { startTime: "asc" }],
        where: {
          workDate: { gte: today, lt: tomorrow },
          ...(admin ? {} : { projectId: { in: projectIds } }),
        },
      }),
      prisma.crewTimeEntry.findMany({
        include: { employees: true },
        where: {
          workDate: { gte: today, lt: tomorrow },
          ...(admin ? {} : { projectId: { in: projectIds } }),
        },
      }),
    ]);
  const scopedLeaveIds = globalEmployeeData
    ? new Set(pendingLeaveCandidates.map((request) => request.id))
    : await leaveRequestIdsInProjectScope(projectIds, pendingLeaveCandidates);
  const pendingLeaveRequests = pendingLeaveCandidates
    .filter(
      (request) =>
        request.requesterUserId === session.user.id ||
        scopedLeaveIds.has(request.id),
    )
    .slice(0, 8);
  const personnelByProject = new Map<string, Set<string>>();
  const timeStatusByEmployee = new Map<string, string>();
  const todayTimeEmployees = todayCrewTimes.flatMap((entry) =>
    entry.employees.map((employee) => ({
      crewName: entry.crewName,
      employee,
      projectNumber: entry.projectNumber,
      status: getCrewEmployeeStatus(employee),
    })),
  );
  for (const entry of todayCrewTimes) {
    for (const employee of entry.employees) {
      timeStatusByEmployee.set(
        `${entry.projectId}:${employee.employeeId}`,
        getCrewEmployeeStatus(employee),
      );
    }
  }
  for (const assignment of projectAssignments) {
    if (
      !assignment.row.projectId ||
      assignment.startDate >= tomorrow ||
      assignment.endDate < today
    ) {
      continue;
    }
    const employees =
      personnelByProject.get(assignment.row.projectId) ?? new Set<string>();
    assignment.crew?.members.forEach((member) =>
      employees.add(
        `${member.employee.lastName}, ${member.employee.firstName} · ${
          timeStatusByEmployee.get(
            `${assignment.row.projectId}:${member.employeeId}`,
          ) ?? "Nicht angemeldet"
        }`,
      ),
    );
    assignment.extraEmployees
      .filter((employee) => employee.mode.toUpperCase() !== "EXCLUDE")
      .forEach((employee) =>
        employees.add(`${employee.employee.lastName}, ${employee.employee.firstName} · ${
          timeStatusByEmployee.get(
            `${assignment.row.projectId}:${employee.employeeId}`,
          ) ?? "Nicht angemeldet"
        }`),
      );
    personnelByProject.set(assignment.row.projectId, employees);
  }
  for (const entry of todayLongHaul) {
    if (!entry.projectId) continue;
    const employees =
      personnelByProject.get(entry.projectId) ?? new Set<string>();
    for (const truck of entry.truckAssignments) {
      const status = truck.driver?.employee?.id
        ? timeStatusByEmployee.get(
            `${entry.projectId}:${truck.driver.employee.id}`,
          ) ?? "Nicht angemeldet"
        : null;
      if (truck.driverName) {
        employees.add(
          `${truck.driverName} · LKW-Fahrer${status ? ` · ${status}` : ""}`,
        );
      } else if (truck.subcontractorName) {
        employees.add(`Fremdfahrer · ${truck.subcontractorName}`);
      }
    }
    personnelByProject.set(entry.projectId, employees);
  }
  for (const assignment of todayShortHaul) {
    if (!assignment.projectId) continue;
    const employees =
      personnelByProject.get(assignment.projectId) ?? new Set<string>();
    const status = assignment.driver?.employee?.id
      ? timeStatusByEmployee.get(
          `${assignment.projectId}:${assignment.driver.employee.id}`,
        ) ?? "Nicht angemeldet"
      : null;
    if (assignment.driverName) {
      employees.add(
        `${assignment.driverName} · LKW-Fahrer${status ? ` · ${status}` : ""}`,
      );
    }
    personnelByProject.set(assignment.projectId, employees);
  }
  const mapMarkers = mapProjects.flatMap((project) =>
    project.mapLatitude !== null && project.mapLongitude !== null
      ? [{
          employees: [...(personnelByProject.get(project.id) ?? [])].sort(
            (a, b) => a.localeCompare(b, "de-DE"),
          ),
          label: `${project.projectNumber} · ${project.name}`,
          latitude: project.mapLatitude,
          longitude: project.mapLongitude,
        }]
      : [],
  );
  const mapCenter = mapMarkers.length
    ? {
        latitude:
          mapMarkers.reduce((sum, marker) => sum + marker.latitude, 0) /
          mapMarkers.length,
        longitude:
          mapMarkers.reduce((sum, marker) => sum + marker.longitude, 0) /
          mapMarkers.length,
      }
    : null;
  const notCheckedInToday = [...personnelByProject.values()]
    .flatMap((employees) => [...employees])
    .filter((employee) => employee.endsWith("· Nicht angemeldet"));
  const inheritedWidgetAccess: Record<string, string> = {
    "project-crews-today": "crew-dispatch",
    "project-machines-today": "crew-dispatch",
    "project-materials-today": "truck-dispatch",
    "project-trucks-today": "truck-dispatch",
  };
  const availableWidgets = admin
    ? [...dashboardWidgets]
    : dashboardWidgets.filter((widget) =>
        currentUser?.featureAccesses.some(
          (access) =>
            access.featureKey === widget.key ||
            access.featureKey === inheritedWidgetAccess[widget.key],
        ),
      );
  const availableKeySet = new Set(availableWidgets.map((widget) => widget.key));
  const selectedWidgetKeys =
    widgetPreferences.length > 0
      ? widgetPreferences.map((preference) => preference.widgetKey).filter((key) => availableKeySet.has(key as never))
      : [...defaultDashboardWidgetKeys].filter((key) => availableKeySet.has(key as never));
  const pinnedWidgets = selectedWidgetKeys
    .map((key) => availableWidgets.find((widget) => widget.key === key))
    .filter((widget): widget is (typeof dashboardWidgets)[number] => Boolean(widget));
  const dueQualifications = qualifications
    .map((qualification) => {
      const dueDate = qualification.lastReviewedAt
        ? addMonths(
            qualification.lastReviewedAt,
            qualification.qualificationType.reviewIntervalMonths,
          )
        : null;
      const daysUntilDue = dueDate ? differenceInDays(new Date(), dueDate) : null;
      if (daysUntilDue !== null && daysUntilDue > 30) return null;
      return {
        dueDate,
        employeeName: `${qualification.employee.lastName}, ${qualification.employee.firstName}`,
        qualificationName: qualification.qualificationType.name,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const asphaltDayEntries = asphaltWeekEntries.filter(
    (entry) => entry.workDate >= today && entry.workDate < tomorrow,
  );
  const asphaltWeekSummary = buildAsphaltSummary(asphaltWeekEntries);
  const asphaltDaySummary = buildAsphaltSummary(asphaltDayEntries);
  const dashboardValues: Record<string, string> = {
    projects: `${activeProjectCount}`,
    inventory: `${inventoryLocationAlertCount} Meldungen`,
    "asphalt-week": asphaltWeekSummary.valueText,
    "asphalt-day": asphaltDaySummary.valueText,
    "leave-pending": `${pendingLeaveRequests.length}`,
    "absent-today": `${todayAbsences.length}`,
    "vacation-today": `${todayAbsences.filter((entry) => entry.typeValue === "urlaub").length}`,
    "sick-today": `${todayAbsences.filter((entry) => entry.typeValue === "krank").length}`,
    "qualifications-due": `${dueQualifications.length}`,
    "project-map": `${mapMarkers.length} Baustellen`,
    "time-account": `${pendingLeaveCandidates
      .filter(
        (request) =>
          request.requesterUserId === session.user.id &&
          request.absenceType === "TIME_ACCOUNT" &&
          request.status === "PENDING",
      )
      .reduce((sum, request) => sum + (request.timeHours ?? 0), 0)
      .toLocaleString("de-DE")} Std. beantragt`,
    "project-machines-today": `${todayEquipment.length}`,
    "project-crews-today": `${todayCrews.length}`,
    "project-trucks-today": `${todayLongHaul.reduce((sum, entry) => sum + entry.truckAssignments.length, 0) + todayShortHaul.length}`,
    "project-materials-today": `${todayLongHaul.filter((entry) => entry.materialName).length + asphaltWeekEntries.filter((entry) => entry.workDate >= today && entry.workDate < tomorrow && (entry.asphaltMixName || entry.tackCoatMaterialName)).length}`,
    "checked-in": `${[...timeStatusByEmployee.values()].filter((status) => status === "Angemeldet" || status === "Pause").length}`,
    "checked-out": `${[...timeStatusByEmployee.values()].filter((status) => status === "Feierabend").length}`,
    "not-checked-in": `${notCheckedInToday.length}`,
  };
  const dashboardItems: Record<string, string[]> = {
    "checked-in": todayTimeEmployees
      .filter((row) => row.status === "Angemeldet" || row.status === "Pause")
      .map(
        (row) =>
          `${row.employee.employeeName} · ${row.status} · ${row.projectNumber} · ${row.crewName}`,
      )
      .slice(0, 12),
    "checked-out": todayTimeEmployees
      .filter((row) => row.status === "Feierabend")
      .map(
        (row) =>
          `${row.employee.employeeName} · ${row.projectNumber} · ${row.crewName}`,
      )
      .slice(0, 12),
    "not-checked-in": notCheckedInToday.slice(0, 12),
    "project-machines-today": todayEquipment.slice(0, 12).map(
      (assignment) =>
        `${assignment.project.projectNumber} · ${assignment.inventoryItem?.objectNumber ?? assignment.vehicle.vehicleNumber} · ${assignment.inventoryItem?.name ?? assignment.vehicle.vehicleType}`,
    ),
    "project-crews-today": todayCrews.slice(0, 12).map(
      (assignment) =>
        `${assignment.row.projectNumber} · ${assignment.crew?.name || assignment.crewName || "Kolonne ohne Bezeichnung"}`,
    ),
    "project-trucks-today": [
      ...todayLongHaul.flatMap((entry) =>
        entry.truckAssignments.map(
          (truck) =>
            `${entry.project?.projectNumber || entry.projectNumber} · ${truck.vehicleNumber || truck.licensePlate || truck.subcontractorName || truck.vehicleType || "LKW"}`,
        ),
      ),
      ...todayShortHaul.map(
        (truck) =>
          `${truck.project?.projectNumber || truck.projectNumber} · ${truck.vehicleNumber || truck.licensePlate || truck.vehicleType || "LKW"}`,
      ),
    ].slice(0, 12),
    "project-materials-today": [
      ...todayLongHaul
        .filter((entry) => entry.materialName)
        .map(
          (entry) =>
            `${entry.project?.projectNumber || entry.projectNumber} · ${entry.materialName} · ${entry.materialQuantity.toLocaleString("de-DE")} ${entry.materialUnit || "t"}`,
        ),
      ...asphaltWeekEntries
        .filter(
          (entry) =>
            entry.workDate >= today &&
            entry.workDate < tomorrow &&
            (entry.asphaltMixName || entry.tackCoatMaterialName),
        )
        .flatMap((entry) => [
          ...(entry.asphaltMixName
            ? [`${entry.projectNumber} · ${entry.asphaltMixName} · ${entry.quantityTons.toLocaleString("de-DE")} t`]
            : []),
          ...(entry.tackCoatMaterialName
            ? [`${entry.projectNumber} · ${entry.tackCoatMaterialName} · ${entry.tackCoatQuantity.toLocaleString("de-DE")} ${entry.tackCoatUnit || "l"}`]
            : []),
        ]),
    ].slice(0, 12),
    "asphalt-week": asphaltWeekSummary.items,
    "asphalt-day": asphaltDaySummary.items,
    "leave-pending": pendingLeaveRequests.map(
      (request) =>
        `${request.employee.lastName}, ${request.employee.firstName} · ${request.absenceType === "TIME_ACCOUNT" ? "Zeitkonto" : "Urlaub"}`,
    ),
    "absent-today": todayAbsences.slice(0, 8).map(
      (entry) =>
        `${entry.employee.lastName}, ${entry.employee.firstName} · ${entry.typeLabel}`,
    ),
    "vacation-today": todayAbsences
      .filter((entry) => entry.typeValue === "urlaub")
      .slice(0, 8)
      .map((entry) => `${entry.employee.lastName}, ${entry.employee.firstName}`),
    "sick-today": todayAbsences
      .filter((entry) => entry.typeValue === "krank")
      .slice(0, 8)
      .map((entry) => `${entry.employee.lastName}, ${entry.employee.firstName}`),
    "qualifications-due": dueQualifications.slice(0, 8).map(
      (entry) =>
        `${entry.employeeName} · ${entry.qualificationName} · ${entry.dueDate ? new Intl.DateTimeFormat("de-DE").format(entry.dueDate) : "ungeprüft"}`,
    ),
  };
  const enrichWidget = (widget: (typeof dashboardWidgets)[number]) => ({
    ...widget,
    items: dashboardItems[widget.key],
    photos:
      widget.key === "project-photos"
        ? latestPhotos.map((photo) => ({
            availableForDailyReports: photo.availableForDailyReports,
            cameraMake: photo.cameraMake,
            cameraModel: photo.cameraModel,
            cameraAperture: photo.cameraAperture,
            cameraExposureTime: photo.cameraExposureTime,
            cameraFocalLength: photo.cameraFocalLength,
            cameraIso: photo.cameraIso,
            capturedAt: photo.capturedAt?.toISOString() ?? null,
            fileSizeBytes: photo.fileSizeBytes,
            gpsAddressLabel: photo.gpsAddressLabel,
            gpsCity: photo.gpsCity,
            gpsCountry: photo.gpsCountry,
            gpsHouseNumber: photo.gpsHouseNumber,
            gpsLatitude: photo.gpsLatitude,
            gpsLongitude: photo.gpsLongitude,
            gpsHeading: photo.gpsHeading,
            gpsAltitude: photo.gpsAltitude,
            gpsPostcode: photo.gpsPostcode,
            gpsReverseGeocodedAt:
              photo.gpsReverseGeocodedAt?.toISOString() ?? null,
            gpsStreet: photo.gpsStreet,
            id: photo.id,
            imageHeight: photo.imageHeight,
            imageWidth: photo.imageWidth,
            metadataTaken: photo.metadataTaken,
            notes: photo.notes ?? "",
            originalFileName: photo.originalFileName,
            projectLabel: `${photo.project.projectNumber} · ${photo.project.name}`,
            projectNumber: photo.project.projectNumber,
            publicUrl: photo.publicUrl,
            uploadedAt: photo.uploadedAt.toISOString(),
            uploadedByName: photo.uploadedByName,
            uploadedByUserId: photo.uploadedByUserId,
          }))
        : undefined,
    map:
      widget.key === "project-map" && mapCenter
        ? {
            ...mapCenter,
            markers: mapMarkers,
            zoom: mapMarkers.length > 1 ? 9 : 14,
          }
        : undefined,
    value: dashboardValues[widget.key],
  });
  const availableTiles = availableWidgets.map(enrichWidget);
  const dashboardTiles = pinnedWidgets.map((widget, index) => {
    const preference = widgetPreferences.find(
      (entry) => entry.widgetKey === widget.key,
    );
    return {
      ...enrichWidget(widget),
      height: preference?.height ?? 2,
      gridX: preference?.gridX ?? (index * 2) % 8,
      gridY: preference?.gridY ?? Math.floor((index * 2) / 8) * 2,
      width: preference?.width ?? 2,
    };
  });
  return (
    <AppShell
      title="Dashboard"
      description="Rollenbasierte Übersicht über Projekte, Dispositionen und offene Aufgaben."
    >
      {accessDenied ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          Kein Zugriff: Für deine Rolle ist dieser Bereich nicht freigegeben.
        </div>
      ) : null}
      <DashboardGrid available={availableTiles} initial={dashboardTiles} />
    </AppShell>
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

function getCrewEmployeeStatus(
  employee: {
    attendanceStatus: string;
    isPresent: boolean;
  },
) {
  if (!employee.isPresent) return "Nicht anwesend";
  if (employee.attendanceStatus === "CHECKED_OUT") return "Feierabend";
  if (employee.attendanceStatus === "BREAK") return "Pause";
  if (employee.attendanceStatus === "CHECKED_IN") return "Angemeldet";
  return "Nicht angemeldet";
}
