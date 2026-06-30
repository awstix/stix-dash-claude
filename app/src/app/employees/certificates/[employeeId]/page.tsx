import Link from "next/link";
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
      description="Führerscheine, Maschinenscheine und Schulungen je Mitarbeiter pflegen."
    >
      <div className="mb-6">
        <Link
          className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees/certificates"
        >
          ← Zurück zur Zertifikatsliste
        </Link>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Mitarbeiter
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">
              {employee.lastName}, {employee.firstName}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {[employee.companyLabel, employee.departmentLabel]
                .filter(Boolean)
                .join(" · ") || "Keine Firma/Abteilung hinterlegt"}
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href="/employees/driver-licenses"
          >
            Führerscheinkontrolle öffnen
          </Link>
        </div>
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
