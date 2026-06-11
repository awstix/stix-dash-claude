import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStatus } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectDailyReportWeatherEditor } from "../ProjectDailyReportWeatherEditor";
import { ProjectDocumentManager } from "../ProjectDocumentManager";
import { ProjectFormManager } from "../ProjectFormManager";
import { ProjectPhotoGallery } from "../ProjectPhotoGallery";
import { ProjectInlinePhotoUpload } from "../ProjectInlinePhotoUpload";
import { ProjectMapEditor } from "../ProjectMapEditor";
import { ProjectWeatherPanel } from "../ProjectWeatherPanel";
import {
  parseProjectFormFields,
  parseProjectFormSnapshotFields,
  parseProjectFormValues,
} from "../projectFormTypes";

const projectTabs = [
  { label: "Übersicht", href: "#uebersicht" },
  { label: "Leistung", href: "#leistung" },
  { label: "Personal", href: "#personal" },
  { label: "Geräte", href: "#geraete" },
  { label: "LKW", href: "#lkw" },
  { label: "Fotos", href: "#fotos" },
  { label: "Dokumente", href: "#dokumente" },
  { label: "Formulare", href: "#formulare" },
  { label: "Notizen", href: "#notizen" },
  { label: "Bautagesberichte", href: "#bautagesberichte" },
];

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
                  members: {
                    where: {
                      isActive: true,
                    },
                    include: {
                      employee: true,
                    },
                  },
                },
              },
              extraEmployees: {
                include: {
                  employee: true,
                },
              },
              extraVehicles: {
                include: {
                  vehicle: true,
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
          vehicle: true,
        },
        orderBy: [{ startDate: "desc" }],
      },
      asphaltLoadAllocations: {
        orderBy: [{ workDate: "desc" }, { startTime: "asc" }],
      },
      shortHaulAssignments: {
        orderBy: [{ workDate: "desc" }],
      },
      shortHaulTours: {
        include: {
          assignment: true,
        },
        orderBy: [{ startTime: "asc" }],
      },
      specialVehicleDispatchAssignments: {
        include: {
          transportVehicle: true,
          vehicle: true,
        },
        orderBy: [{ workDate: "desc" }, { startTime: "asc" }],
      },
      truckLongHaulEntries: {
        include: {
          truckAssignments: true,
        },
        orderBy: [{ workDate: "desc" }],
      },
      tackCoatLoadAllocations: {
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
        where: {
          reportDate: {
            gte: today,
          },
        },
        orderBy: [{ reportDate: "asc" }],
        take: 16,
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
    },
  });

  if (!project) {
    notFound();
  }

  const [photoMoveProjects, documentMoveFolders, formTemplates] = await Promise.all([
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

  const people = new Map<string, string>();
  const equipment = new Map<string, string>();
  const trucks = new Map<string, string>();
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
        people.set(member.employee.id, name);
        assignmentPeople.add(name);
      }

      for (const extraEmployee of assignment.extraEmployees) {
        const name = `${extraEmployee.employee.lastName}, ${extraEmployee.employee.firstName}`;
        people.set(extraEmployee.employee.id, name);
        assignmentPeople.add(name);
      }

      for (const extraVehicle of assignment.extraVehicles) {
        equipment.set(extraVehicle.vehicle.id, getVehicleLabel(extraVehicle.vehicle));
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
    equipment.set(assignment.vehicle.id, getVehicleLabel(assignment.vehicle));
  }

  for (const assignment of project.specialVehicleDispatchAssignments) {
    if (assignment.vehicle) {
      equipment.set(assignment.vehicle.id, getVehicleLabel(assignment.vehicle));
    } else if (assignment.vehicleName) {
      equipment.set(`special-${assignment.id}`, assignment.vehicleName);
    }

    if (assignment.transportVehicle) {
      equipment.set(
        assignment.transportVehicle.id,
        getVehicleLabel(assignment.transportVehicle),
      );
    } else if (assignment.transportVehicleName) {
      equipment.set(`transport-${assignment.id}`, assignment.transportVehicleName);
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
    );
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
    );
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
      );
    }
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
    );
  }

  const peopleList = Array.from(people.values()).sort((a, b) =>
    a.localeCompare(b, "de-DE"),
  );
  const equipmentList = Array.from(equipment.values()).sort((a, b) =>
    a.localeCompare(b, "de-DE"),
  );
  const truckList = Array.from(trucks.values()).sort((a, b) =>
    a.localeCompare(b, "de-DE"),
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
              <MiniMetric label="Geräte" value={`${equipmentList.length}`} />
              <MiniMetric label="LKW" value={`${truckList.length}`} />
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

            {project.notes ? (
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
          <ListBlock
            emptyText="Noch kein Personal über Disposition zugeordnet."
            items={peopleList}
          />
        </section>

        <section
          id="geraete"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-gray-900">Geräte</h2>
          <p className="mt-1 text-sm text-gray-600">
            Geräte und Sonderfahrzeuge aus Geräte- und Sonderfahrzeugdisposition.
          </p>
          <ListBlock
            emptyText="Noch keine Geräte über Disposition zugeordnet."
            items={equipmentList}
          />
        </section>

        <section
          id="lkw"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-semibold text-gray-900">LKW</h2>
          <p className="mt-1 text-sm text-gray-600">
            Aus Kurzstrecke, Langstrecke, Asphalt- und Anspritzmittel-Transporten.
          </p>
          <ListBlock
            emptyText="Noch keine LKW über die LKW-Disposition zugeordnet."
            items={truckList}
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

              return {
                createdAt: submission.createdAt.toISOString(),
                createdByName: submission.createdByName,
                fields: parseProjectFormSnapshotFields(
                  submission.templateSnapshotJson,
                  fallbackFields,
                ),
                formDate: submission.formDate?.toISOString() ?? null,
                id: submission.id,
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
              fields: parseProjectFormFields(template.fieldsJson),
              id: template.id,
              isActive: template.isActive,
              name: template.name,
              sortOrder: template.sortOrder,
            }))}
          />
        </div>
        <ArchiveSection
          id="notizen"
          title="Notizen"
          text="Notizen werden später mit Datum, Benutzer und Sichtbarkeit pro Projekt geführt."
        />
        <section
          id="bautagesberichte"
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Bautagesberichte
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Wetterwerte werden aus dem Wetterprotokoll vorgeschlagen und können
            für den Bautagesbericht je Tag überschrieben werden.
          </p>
          <ProjectDailyReportWeatherEditor
            projectId={project.id}
            rows={dailyReportWeatherRows}
          />
        </section>
      </div>
    </AppShell>
  );
}

function ListBlock({
  emptyText,
  items,
}: {
  emptyText: string;
  items: string[];
}) {
  if (items.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.slice(0, 24).map((item) => (
        <span
          key={item}
          className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-800"
        >
          {item}
        </span>
      ))}
    </div>
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

function ArchiveSection({
  id,
  title,
  text,
}: {
  id: string;
  title: string;
  text: string;
}) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-600">{text}</p>
    </section>
  );
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

function getVehicleLabel(vehicle: {
  licensePlate: string | null;
  vehicleNumber: string | null;
  vehicleType: string | null;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function addTruck(trucks: Map<string, string>, key: string, label: string) {
  if (!label) return;
  trucks.set(key, label);
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
