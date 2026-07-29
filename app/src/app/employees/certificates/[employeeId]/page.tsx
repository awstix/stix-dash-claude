import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createEmployeeTrainingRecord } from "../actions";
import { EmployeeTrainingRecordRows } from "./EmployeeTrainingRecordRows";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function safetyValidity(date: Date | null) {
  if (!date) return { className: "bg-gray-100 text-gray-700", label: "—" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);
  if (date < today) {
    return { className: "bg-red-100 text-red-900", label: "Abgelaufen" };
  }
  if (date <= soon) {
    return { className: "bg-yellow-100 text-yellow-950", label: "Bald fällig" };
  }
  return { className: "bg-green-100 text-green-900", label: "Gültig" };
}

function formatAddress(employee: {
  city: string | null;
  postalCode: string | null;
  street: string | null;
}) {
  const cityLine = [employee.postalCode, employee.city].filter(Boolean).join(" ");
  return [employee.street, cityLine].filter(Boolean).join(", ") || "—";
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) return "—";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hadBirthday) age -= 1;

  return `${age}`;
}

function formatStock(value: number | null, unit: string) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

function formatTonsFromKilograms(value: number | null) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value / 1000)} t`;
}

function getInventoryStatusLabel(status: string | null) {
  if (status === "DEFECT") return "Defekt";
  if (status === "LOCKED") return "Gesperrt";
  if (status === "IN_SERVICE") return "In Wartung";
  return "Aktiv";
}

function getInventoryStatusClass(status: string | null) {
  if (status === "DEFECT") return "bg-red-50 text-red-800 ring-red-200";
  if (status === "LOCKED") return "bg-gray-100 text-gray-700 ring-gray-300";
  if (status === "IN_SERVICE") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-green-50 text-green-800 ring-green-200";
}

function getInventoryMovementLabel(eventType: string | null) {
  if (eventType === "ISSUE") return "Ausgabe";
  if (eventType === "RETURN") return "Rücknahme";
  if (eventType === "PERSONAL_ISSUE") return "Persönliche Ausgabe";
  if (eventType === "PERSONAL_RETURN") return "Persönliche Rücknahme";
  if (eventType === "ADJUSTMENT") return "Korrektur";
  if (eventType === "ASSIGNMENT") return "Zuordnung";
  if (eventType === "RETURN_TO_BASE") return "Rückgabe";
  return eventType || "Bewegung";
}

function getInventoryMovementClass(eventType: string | null) {
  if (eventType === "ISSUE") return "bg-blue-50 text-blue-900 ring-blue-200";
  if (eventType === "RETURN" || eventType === "RETURN_TO_BASE") {
    return "bg-green-50 text-green-800 ring-green-200";
  }
  if (eventType === "ADJUSTMENT") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-gray-100 text-gray-700 ring-gray-300";
}

type TrainingTypeOption = {
  id: string;
  isImportedFallback?: boolean;
  number: string | null;
  topic: string;
};

export default async function EmployeeCertificateDetailPage({
  params,
}: {
  params: Promise<{
    employeeId: string;
  }>;
}) {
  const { employeeId } = await params;
  const [employee, trainingTypes, fallbackTrainingRecords] = await Promise.all([
    prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
      include: {
        qualificationDocuments: {
          include: {
            qualificationType: true,
          },
          orderBy: [{ uploadedAt: "desc" }],
        },
        qualifications: {
          include: {
            qualificationType: true,
          },
          orderBy: [{ qualificationType: { sortOrder: "asc" } }],
        },
        trainingRecords: {
          include: {
            documents: {
              orderBy: [{ uploadedAt: "desc" }],
            },
          },
          orderBy: [{ validUntil: "asc" }, { trainingDate: "desc" }],
        },
        projectStartChecklistParticipants: {
          include: {
            checklist: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectNumber: true,
                  },
                },
              },
            },
          },
          orderBy: [{ instructionDate: "desc" }, { createdAt: "desc" }],
        },
        assessedGeneralRiskAssessments: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
              },
            },
          },
          orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
        },
        generalRiskAssessmentParticipants: {
          include: {
            assessment: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectNumber: true,
                  },
                },
              },
            },
          },
          orderBy: [{ instructionDate: "desc" }, { createdAt: "desc" }],
        },
        safetyInstructionSignatures: {
          include: {
            record: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    projectNumber: true,
                  },
                },
                template: {
                  select: { title: true, type: true },
                },
              },
            },
          },
          orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
        },
        inventoryAssignments: {
          include: {
            category: true,
            currentProject: {
              select: {
                name: true,
                projectNumber: true,
              },
            },
            photos: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
            vehicle: {
              select: {
                category: true,
                licensePlate: true,
                vehicleNumber: true,
                vehicleType: true,
              },
            },
          },
          orderBy: [{ name: "asc" }],
        },
        personalInventoryAssignments: {
          include: {
            item: {
              include: {
                category: { include: { parentCategory: true } },
              },
            },
          },
          orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
        },
        inventoryUsageHistory: {
          include: {
            item: {
              include: {
                category: {
                  include: {
                    parentCategory: true,
                  },
                },
                photos: {
                  orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
                  take: 1,
                },
              },
            },
            project: {
              select: {
                name: true,
                projectNumber: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 80,
          where: {
            item: {
              isStockManaged: true,
              category: {
                OR: [
                  {
                    useInEmployeeFile: true,
                  },
                  {
                    isPersonalInventory: true,
                  },
                  {
                    parentCategory: {
                      useInEmployeeFile: true,
                    },
                  },
                  {
                    parentCategory: {
                      isPersonalInventory: true,
                    },
                  },
                ],
              },
            },
          },
        },
      },
    }),
    prisma.employeeTrainingType.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { topic: "asc" }],
    }),
    prisma.employeeTrainingRecord.findMany({
      orderBy: [{ topic: "asc" }, { trainingDate: "desc" }, { createdAt: "desc" }],
      select: {
        number: true,
        topic: true,
      },
    }),
  ]);

  if (!employee) {
    notFound();
  }
  const generalSafetyEntries = Array.from(
    [
      ...employee.assessedGeneralRiskAssessments.map((assessment) => ({
        assessmentDate: assessment.assessmentDate,
        id: assessment.id,
        instructionDate: assessment.assessmentDate,
        project: assessment.project,
        signed: false,
        status: assessment.status,
        templateCode: assessment.templateCode,
        templateRevision: assessment.templateRevision,
        templateTitle: assessment.templateTitle,
        typeLabel: "Personenbezogene GBU",
        validUntil: assessment.validUntil,
        recordPath: `/safety/risk-assessments/general/${assessment.id}`,
        pdfPath: `/safety/risk-assessments/general/${assessment.id}/pdf`,
      })),
      ...employee.generalRiskAssessmentParticipants.map((participant) => ({
        assessmentDate: participant.assessment.assessmentDate,
        id: participant.assessment.id,
        instructionDate:
          participant.instructionDate ??
          participant.assessment.assessmentDate,
        project: participant.assessment.project,
        signed: Boolean(participant.signatureDataUrl),
        status: participant.assessment.status,
        templateCode: participant.assessment.templateCode,
        templateRevision: participant.assessment.templateRevision,
        templateTitle: participant.assessment.templateTitle,
        typeLabel: "Unterweisung",
        validUntil: participant.assessment.validUntil,
        recordPath: `/safety/risk-assessments/general/${participant.assessment.id}`,
        pdfPath: `/safety/risk-assessments/general/${participant.assessment.id}/pdf`,
      })),
      ...employee.safetyInstructionSignatures
        .filter(
          (signature) =>
            signature.record.template.type === "OPERATING_INSTRUCTION" ||
            signature.record.template.type === "COMMISSION",
        )
        .map((signature) => ({
          assessmentDate: signature.record.instructionDate,
          id: signature.record.id,
          instructionDate:
            signature.signedAt ?? signature.record.instructionDate,
          pdfPath: `/safety/instruction-records/${signature.record.id}/pdf`,
          project: signature.record.project,
          recordPath: `/safety/instruction-records/${signature.record.id}`,
          signed: Boolean(signature.signatureDataUrl),
          status:
            signature.record.status === "SIGNED" ? "COMPLETED" : "DRAFT",
          templateCode:
            signature.record.template.type === "COMMISSION"
              ? "A-90"
              : "A-30",
          templateRevision: "Originalstand",
          templateTitle: signature.record.template.title,
          typeLabel:
            signature.record.template.type === "COMMISSION"
              ? "Beauftragung"
              : "Betriebsanweisung",
          validUntil: signature.record.validUntil,
        })),
    ]
      .reduce(
        (entries, entry) => entries.set(entry.id, entry),
        new Map<
          string,
          {
            assessmentDate: Date;
            id: string;
            instructionDate: Date;
            project: {
              id: string;
              name: string;
              projectNumber: string;
            } | null;
            signed: boolean;
            status: string;
            templateCode: string;
            templateRevision: string;
            templateTitle: string;
            typeLabel: string;
            validUntil: Date | null;
            recordPath: string;
            pdfPath: string;
          }
        >(),
      )
      .values(),
  ).sort(
    (a, b) => b.instructionDate.getTime() - a.instructionDate.getTime(),
  );
  const trainingTypeTopics = new Set(
    trainingTypes.map((type) => type.topic.trim().toLowerCase()),
  );
  const fallbackTrainingTypeOptions = Array.from(
    fallbackTrainingRecords.reduce((items, record) => {
      const key = record.topic.trim().toLowerCase();

      if (!trainingTypeTopics.has(key) && !items.has(key)) {
        items.set(key, {
          id: `import-topic:${encodeURIComponent(record.topic)}`,
          isImportedFallback: true,
          number: record.number,
          topic: record.topic,
        } satisfies TrainingTypeOption);
      }

      return items;
    }, new Map<string, TrainingTypeOption>()),
  )
    .map(([, option]) => option)
    .sort((a, b) => a.topic.localeCompare(b.topic, "de"));
  const trainingTypeOptions: TrainingTypeOption[] = [
    ...trainingTypes.map((type) => ({
      id: type.id,
      number: type.number,
      topic: type.topic,
    })),
    ...fallbackTrainingTypeOptions,
  ];

  return (
    <AppShell
      title={`${employee.firstName} ${employee.lastName}`}
      description="Mitarbeiterakte mit Führerscheinen, Maschinenscheinen, Schulungen und zugeordnetem Inventar."
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees/certificates"
        >
          ← Zurück zur Mitarbeiterakte
        </Link>
        <a
          className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
          href={`/employees/certificates/${employee.id}/pdf`}
        >
          Mitarbeiterakte als PDF
        </a>
        <Link
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees/driver-licenses"
        >
          Führerscheinkontrolle öffnen
        </Link>
        <Link
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/employees?firstName=${encodeURIComponent(
            employee.firstName,
          )}&lastName=${encodeURIComponent(employee.lastName)}`}
        >
          Verwaltung öffnen
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
            {employee.photoUrl ? (
              <img
                alt={`${employee.firstName} ${employee.lastName}`}
                className="h-32 w-32 rounded-2xl border border-gray-200 object-cover shadow-sm"
                src={employee.photoUrl}
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-3xl font-bold text-gray-400">
                {employee.firstName.slice(0, 1)}
                {employee.lastName.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Mitarbeiterakte
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">
                {employee.lastName}, {employee.firstName}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {[employee.companyLabel, employee.departmentLabel]
                  .filter(Boolean)
                  .join(" · ") || "Keine Firma/Abteilung hinterlegt"}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <EmployeeInfo label="Status" value={employee.statusLabel ?? "—"} />
                <EmployeeInfo label="Eintritt" value={formatDate(employee.entryDate)} />
                <EmployeeInfo label="Austritt" value={formatDate(employee.exitDate)} />
                <EmployeeInfo label="Geburtsdatum" value={formatDate(employee.birthDate)} />
                <EmployeeInfo label="Alter" value={calculateAge(employee.birthDate)} />
                <EmployeeInfo label="Geschlecht" value={employee.genderLabel ?? "—"} />
                <EmployeeInfo label="Mobil" value={employee.mobilePhone ?? "—"} />
                <EmployeeInfo
                  label="Telefon (Haus)"
                  value={employee.homePhone ?? "—"}
                />
                <EmployeeInfo label="E-Mail" value={employee.email ?? "—"} />
                <EmployeeInfo
                  label="Notfallkontakt"
                  value={
                    [
                      [
                        employee.emergencyFirstName,
                        employee.emergencyLastName,
                      ]
                        .filter(Boolean)
                        .join(" "),
                      employee.emergencyPhone,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"
                  }
                />
                <EmployeeInfo label="Adresse" value={formatAddress(employee)} />
                <EmployeeInfo
                  label="Führungskraft"
                  value={employee.isLeadership ? "Ja" : "Nein"}
                />
              </div>
              {employee.notes ? (
                <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Notizen
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{employee.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Persönliches Inventar
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Quittierte Ausgaben und offene Rückgaben dieses Mitarbeiters.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory"
          >
            Inventar öffnen
          </Link>
        </div>
        {employee.personalInventoryAssignments.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Noch kein persönliches Inventar ausgegeben.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3">Gegenstand</th>
                  <th className="p-3">Kategorie</th>
                  <th className="p-3">Ausgabe</th>
                  <th className="p-3">Menge</th>
                  <th className="p-3">Rückgabe</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {employee.personalInventoryAssignments.map((assignment) => {
                  const open =
                    assignment.quantity - assignment.returnedQuantity;
                  return (
                    <tr className="border-t border-gray-100" key={assignment.id}>
                      <td className="p-3">
                        <Link className="font-semibold text-gray-950 hover:underline" href={`/inventory/${assignment.item.id}`}>
                          {assignment.item.name}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">
                          {[assignment.item.objectNumber, assignment.item.inventoryNumber, assignment.item.serialNumber]
                            .filter(Boolean)
                            .join(" · ") || "ohne Kennnummer"}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">
                        {assignment.item.category?.parentCategory
                          ? `${assignment.item.category.parentCategory.name} · ${assignment.item.category.name}`
                          : assignment.item.category?.name ?? "—"}
                      </td>
                      <td className="p-3 text-gray-700">{formatDate(assignment.issuedAt)}</td>
                      <td className="p-3 font-semibold text-gray-950">
                        {formatStock(assignment.quantity, assignment.item.stockUnit)}
                      </td>
                      <td className="p-3 text-gray-700">
                        {assignment.returnedAt ? formatDate(assignment.returnedAt) : "offen"}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${open > 0 ? "bg-amber-100 text-amber-950" : "bg-green-100 text-green-900"}`}>
                          {open > 0
                            ? `${formatStock(open, assignment.item.stockUnit)} zurückzugeben`
                            : "Zurückgegeben"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Arbeitssicherheit / Unterweisungen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Projektbezogene Unterweisungen aus Gefährdungsbeurteilungen mit
              Datum und Unterschriftsnachweis.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href={`/safety/risk-assessments/general?employeeId=${employee.id}`}
          >
            Gefährdungsbeurteilung anlegen
          </Link>
        </div>

        {employee.projectStartChecklistParticipants.length === 0 &&
        generalSafetyEntries.length === 0 ? (
          <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
            Für diesen Mitarbeiter sind noch keine projektbezogenen
            Unterweisungen hinterlegt.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3">Unterweisung</th>
                  <th className="p-3">Projekt</th>
                  <th className="p-3">Unterwiesen am</th>
                  <th className="p-3">Gültig bis</th>
                  <th className="p-3">Unterschrift</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {generalSafetyEntries.map((entry) => (
                  <tr className="border-t border-gray-100" key={entry.id}>
                    <td className="p-3">
                      <p className="font-semibold text-gray-900">
                        {entry.templateTitle}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {entry.templateCode} · Rev. {entry.templateRevision} ·{" "}
                        {entry.typeLabel}
                      </p>
                    </td>
                    <td className="p-3">
                      {entry.project ? (
                        <Link
                          className="font-semibold text-gray-900 hover:underline"
                          href={`/projects/${entry.project.id}#arbeitssicherheit`}
                        >
                          {entry.project.projectNumber} · {entry.project.name}
                        </Link>
                      ) : (
                        <span className="text-gray-500">
                          Personenbezogene Beurteilung
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatDate(entry.instructionDate)}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${safetyValidity(entry.validUntil).className}`}>
                        {formatDate(entry.validUntil)} · {safetyValidity(entry.validUntil).label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                          entry.signed
                            ? "bg-green-50 text-green-800 ring-green-200"
                            : entry.typeLabel === "Personenbezogene GBU"
                              ? "bg-gray-100 text-gray-700 ring-gray-300"
                              : "bg-amber-50 text-amber-900 ring-amber-200"
                        }`}
                      >
                        {entry.signed
                          ? "Unterschrieben"
                          : entry.typeLabel === "Personenbezogene GBU"
                            ? "Bewertete Person"
                            : "Offen"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                          entry.status === "COMPLETED"
                            ? "bg-green-50 text-green-800 ring-green-200"
                            : "bg-amber-50 text-amber-900 ring-amber-200"
                        }`}
                      >
                        {entry.status === "COMPLETED"
                          ? "Abgeschlossen"
                          : "Entwurf"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                          href={entry.recordPath}
                        >
                          Öffnen
                        </Link>
                        <a
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                          href={entry.pdfPath}
                          target="_blank"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {employee.projectStartChecklistParticipants.map(
                  (participant) => (
                    <tr
                      className="border-t border-gray-100"
                      key={participant.id}
                    >
                      <td className="p-3">
                        <p className="font-semibold text-gray-900">
                          Projektstart Tiefbau / Asphaltbau
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {participant.checklist.templateCode} · Rev.{" "}
                          {participant.checklist.templateRevision}
                        </p>
                      </td>
                      <td className="p-3">
                        <Link
                          className="font-semibold text-gray-900 hover:underline"
                          href={`/projects/${participant.checklist.project.id}#arbeitssicherheit`}
                        >
                          {participant.checklist.project.projectNumber} ·{" "}
                          {participant.checklist.project.name}
                        </Link>
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatDate(participant.instructionDate)}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${safetyValidity(participant.checklist.validUntil).className}`}>
                          {formatDate(participant.checklist.validUntil)} · {safetyValidity(participant.checklist.validUntil).label}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                            participant.signatureDataUrl
                              ? "bg-green-50 text-green-800 ring-green-200"
                              : "bg-amber-50 text-amber-900 ring-amber-200"
                          }`}
                        >
                          {participant.signatureDataUrl
                            ? "Unterschrieben"
                            : "Offen"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
                            participant.checklist.status === "COMPLETED"
                              ? "bg-green-50 text-green-800 ring-green-200"
                              : "bg-amber-50 text-amber-900 ring-amber-200"
                          }`}
                        >
                          {participant.checklist.status === "COMPLETED"
                            ? "Abgeschlossen"
                            : "Entwurf"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                            href={`/safety/risk-assessments/project-start/${participant.checklist.id}`}
                          >
                            Öffnen
                          </Link>
                          <a
                            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                            href={`/safety/risk-assessments/project-start/${participant.checklist.id}/pdf`}
                            target="_blank"
                          >
                            PDF
                          </a>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Inventar / Fahrzeuge
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Aktuell dem Mitarbeiter zugeordnete Inventarobjekte, Fahrzeuge,
              Maschinen und ausgegebene Lagerobjekte.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href={`/inventory?responsibleEmployee=${employee.id}`}
          >
            Inventar öffnen
          </Link>
        </div>

        {employee.inventoryAssignments.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Aktuell sind diesem Mitarbeiter keine Inventarobjekte zugeordnet.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-20 p-3">Foto</th>
                  <th className="p-3">Objekt</th>
                  <th className="p-3">Kategorie</th>
                  <th className="p-3">Kennzeichen</th>
                  <th className="p-3">Nutzlast</th>
                  <th className="p-3">Baustelle</th>
                  <th className="p-3">Lager</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {employee.inventoryAssignments.map((item) => {
                  const photo = item.photos[0];

                  return (
                    <tr className="border-t border-gray-100" key={item.id}>
                      <td className="p-3">
                        {photo ? (
                          <img
                            alt={photo.originalName ?? item.name}
                            className="h-12 w-12 rounded-lg border border-gray-200 object-cover"
                            src={photo.url}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs font-bold text-gray-400">
                            —
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Link
                          className="font-semibold text-gray-900 hover:underline"
                          href={`/inventory/${item.id}`}
                        >
                          {item.name}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">
                          {[item.objectNumber, item.inventoryNumber]
                            .filter(Boolean)
                            .join(" · ") || "ohne Objekt-ID"}
                        </div>
                      </td>
                      <td className="p-3 text-gray-700">
                        {item.category?.name ??
                          item.vehicle?.category ??
                          item.vehicle?.vehicleType ??
                          "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {item.licensePlate ?? item.vehicle?.licensePlate ?? "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatTonsFromKilograms(item.payloadKg)}
                      </td>
                      <td className="p-3 text-gray-700">
                        {item.currentProject
                          ? `${item.currentProject.projectNumber} · ${item.currentProject.name}`
                          : "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {item.isStockManaged
                          ? formatStock(item.currentStock, item.stockUnit)
                          : "Nein"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getInventoryStatusClass(
                            item.status,
                          )}`}
                        >
                          {getInventoryStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Ausgegebene Lagerobjekte
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Lagerbewegungen aus Kategorien, die für die Personalakte freigegeben sind
              – z. B. Arbeitskleidung, PSA oder Werkzeug.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/inventory/storage"
          >
            Lagerverwaltung öffnen
          </Link>
        </div>

        {employee.inventoryUsageHistory.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Für diese Personalakte sind noch keine freigegebenen Lagerbewegungen vorhanden.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="w-20 p-3">Foto</th>
                  <th className="p-3">Lagerobjekt</th>
                  <th className="p-3">Bewegung</th>
                  <th className="p-3">Menge</th>
                  <th className="p-3">Bestand</th>
                  <th className="p-3">Projekt</th>
                  <th className="p-3">Datum</th>
                  <th className="p-3">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {employee.inventoryUsageHistory.map((entry) => {
                  const photo = entry.item.photos[0];

                  return (
                    <tr className="border-t border-gray-100" key={entry.id}>
                      <td className="p-3">
                        {photo ? (
                          <img
                            alt={photo.originalName ?? entry.item.name}
                            className="h-12 w-12 rounded-lg border border-gray-200 object-cover"
                            src={photo.url}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs font-bold text-gray-400">
                            —
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Link
                          className="font-semibold text-gray-900 hover:underline"
                          href={`/inventory/${entry.item.id}`}
                        >
                          {entry.item.name}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">
                          {[
                            entry.item.objectNumber,
                            entry.item.inventoryNumber,
                            entry.item.category?.parentCategory?.name ??
                              entry.item.category?.name,
                            entry.item.category?.parentCategory ? entry.item.category?.name : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "ohne Kategorie"}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getInventoryMovementClass(
                            entry.eventType,
                          )}`}
                        >
                          {getInventoryMovementLabel(entry.eventType)}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        {formatStock(entry.quantity ?? null, entry.item.stockUnit)}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatStock(entry.stockBefore ?? null, entry.item.stockUnit)} →{" "}
                        {formatStock(entry.stockAfter ?? null, entry.item.stockUnit)}
                      </td>
                      <td className="p-3 text-gray-700">
                        {entry.project
                          ? `${entry.project.projectNumber} · ${entry.project.name}`
                          : "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="p-3 text-gray-600">
                        {entry.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Führerscheine / Maschinenscheine
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Diese Daten kommen aus der bestehenden Führerschein- und
          Maschinenschein-Kontrolle.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {employee.qualifications.length ? (
            employee.qualifications.map((qualification) => (
              <div
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                key={qualification.id}
              >
                <div className="font-semibold text-gray-900">
                  {qualification.qualificationType.name}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  geprüft: {formatDate(qualification.lastReviewedAt)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              Noch keine Führerscheine oder Maschinenscheine hinterlegt.
            </p>
          )}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Dokumente: {employee.qualificationDocuments.length}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Schulungen</h2>
            <p className="mt-1 text-sm text-gray-600">
              Einzelne Schulungen je Mitarbeiter erfassen. „gültig bis“ wird aus
              Schulungsdatum + Gültigkeit berechnet, kann aber überschrieben
              werden.
            </p>
          </div>
        </div>

        <details className="mt-5 rounded-2xl border border-gray-200 bg-gray-50">
          <summary className="cursor-pointer list-none p-4 font-semibold text-gray-900">
            + Schulung eintragen
          </summary>
          <form
            action={createEmployeeTrainingRecord}
            className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <input name="employeeId" type="hidden" value={employee.id} />
            <label className="text-sm font-semibold text-gray-800">
              Schulungsvorlage auswählen
              <select
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                name="trainingTypeId"
              >
                <option value="">Ohne Vorlage / freie Schulung eintragen</option>
                {trainingTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {[type.number, type.topic].filter(Boolean).join(" · ")}
                    {type.isImportedFallback ? " · aus Import" : ""}
                  </option>
                ))}
              </select>
            </label>
            <TextInput label="Nr." name="number" placeholder="01" />
            <TextInput label="Anbieter" name="provider" placeholder="z.B. DVGW" />
            <TextInput
              label="Thema Kurs"
              name="topic"
              placeholder="z.B. Erste Hilfe Kurs"
            />
            <DateInput label="Datum der Schulung" name="trainingDate" />
            <TextInput label="Typ" name="type" placeholder="Allgemein, DVGW..." />
            <TextInput label="Ort" name="location" placeholder="Intern, Frankfurt..." />
            <TextInput label="Dauer [Tage]" name="durationDays" placeholder="0,5" />
            <DateInput label="Buchung am" name="bookedAt" />
            <DateInput label="Buchungsbestätigung" name="bookingConfirmedAt" />
            <DateInput label="Zertifikat erhalten" name="certificateReceivedAt" />
            <TextInput label="Gültigkeit [Jahre]" name="validityYears" placeholder="z.B. 2" />
            <DateInput label="gültig bis" name="validUntil" />
            <label className="text-sm font-semibold text-gray-800 xl:col-span-4">
              Bemerkung
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                name="notes"
                placeholder="z.B. Auffrischung geplant, Teilnehmerliste folgt..."
              />
            </label>
            <div className="rounded-xl bg-white p-3 text-xs text-gray-600 xl:col-span-4">
              Hinweis: Bei „Gültigkeit“ bitte Jahre wie in deiner Excel-Liste
              eintragen. Intern wird daraus automatisch die Laufzeit berechnet.
            </div>
            <div className="xl:col-span-4">
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Schulung speichern
              </button>
            </div>
          </form>
        </details>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-24 p-3">Aktion</th>
                <th className="w-28 p-3">Zertifikate</th>
                <th className="w-[28%] p-3">Schulung</th>
                <th className="w-28 p-3">Datum</th>
                <th className="w-28 p-3">gültig bis</th>
                <th className="w-28 p-3">% / Status</th>
                <th className="p-3">Auffrischung / Info</th>
              </tr>
            </thead>
            <tbody>
              <EmployeeTrainingRecordRows
                employeeId={employee.id}
                records={employee.trainingRecords.map((record) => ({
                  bookedAt: record.bookedAt?.toISOString() ?? null,
                  bookingConfirmedAt:
                    record.bookingConfirmedAt?.toISOString() ?? null,
                  certificateReceivedAt:
                    record.certificateReceivedAt?.toISOString() ?? null,
                  durationDays: record.durationDays,
                  documents: record.documents.map((document) => ({
                    displayName: document.displayName,
                    fileName: document.fileName,
                    fileSizeBytes: document.fileSizeBytes,
                    id: document.id,
                    mimeType: document.mimeType,
                    notes: document.notes,
                    originalFileName: document.originalFileName,
                    publicUrl: document.publicUrl,
                    uploadedAt: document.uploadedAt.toISOString(),
                    uploadedByName: document.uploadedByName,
                  })),
                  id: record.id,
                  location: record.location,
                  notes: record.notes,
                  number: record.number,
                  provider: record.provider,
                  topic: record.topic,
                  trainingDate: record.trainingDate?.toISOString() ?? null,
                  type: record.type,
                  validityMonths: record.validityMonths,
                  validUntil: record.validUntil?.toISOString() ?? null,
                }))}
              />
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function TextInput({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function DateInput({
  defaultValue,
  label,
  name,
}: {
  defaultValue?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
        type="date"
      />
    </label>
  );
}

function EmployeeInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 break-words font-semibold text-gray-900">{value}</div>
    </div>
  );
}
