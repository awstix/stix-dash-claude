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
      <div className="mb-6">
        <Link
          className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees/certificates"
        >
          ← Zurück zur Mitarbeiterakte
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row">
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
            <div>
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
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                <EmployeeInfo label="Status" value={employee.statusLabel ?? "—"} />
                <EmployeeInfo label="Eintritt" value={formatDate(employee.entryDate)} />
                <EmployeeInfo label="Austritt" value={formatDate(employee.exitDate)} />
                <EmployeeInfo label="Geburtsdatum" value={formatDate(employee.birthDate)} />
                <EmployeeInfo label="Alter" value={calculateAge(employee.birthDate)} />
                <EmployeeInfo label="Geschlecht" value={employee.genderLabel ?? "—"} />
                <EmployeeInfo label="Mobil" value={employee.mobilePhone ?? "—"} />
                <EmployeeInfo
                  label="Notfallkontakt"
                  value={employee.emergencyPhone ?? "—"}
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
          <div className="flex flex-wrap gap-2 lg:justify-end">
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
        </div>
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
