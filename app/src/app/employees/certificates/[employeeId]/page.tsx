import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createEmployeeTrainingRecord,
  deleteEmployeeTrainingRecord,
} from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTrainingProgress(trainingDate: Date | null, validUntil: Date | null) {
  if (!trainingDate || !validUntil || validUntil <= trainingDate) return null;

  const today = new Date();
  const total = validUntil.getTime() - trainingDate.getTime();
  const elapsed = today.getTime() - trainingDate.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function getRefreshText(validUntil: Date | null) {
  if (!validUntil) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return `seit ${Math.abs(diffDays)} Tagen abgelaufen`;
  if (diffDays === 0) return "heute";
  return `in ${diffDays} Tagen`;
}

function getTrainingState(validUntil: Date | null) {
  if (!validUntil) {
    return {
      className: "bg-gray-100 text-gray-700 ring-gray-200",
      label: "ohne Ablauf",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);

  if (validUntil < today) {
    return {
      className: "bg-red-100 text-red-900 ring-red-200",
      label: "abgelaufen",
    };
  }

  if (validUntil <= soon) {
    return {
      className: "bg-yellow-100 text-yellow-950 ring-yellow-200",
      label: "läuft bald ab",
    };
  }

  return {
    className: "bg-green-100 text-green-900 ring-green-200",
    label: "gültig",
  };
}

export default async function EmployeeCertificateDetailPage({
  params,
}: {
  params: Promise<{
    employeeId: string;
  }>;
}) {
  const { employeeId } = await params;
  const [employee, trainingTypes] = await Promise.all([
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
  ]);

  if (!employee) {
    notFound();
  }

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
              Vorlage / bestehende Schulung
              <select
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                name="trainingTypeId"
              >
                <option value="">Ohne Vorlage / frei eintragen</option>
                {trainingTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {[type.number, type.topic].filter(Boolean).join(" · ")}
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

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1300px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-20 p-3">Aktion</th>
                <th className="p-3">Nr.</th>
                <th className="p-3">Anbieter</th>
                <th className="p-3">Thema Kurs</th>
                <th className="p-3">Datum</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Ort</th>
                <th className="p-3">Dauer</th>
                <th className="p-3">gültig bis</th>
                <th className="p-3">% abgelaufen</th>
                <th className="p-3">Auffrischung</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.trainingRecords.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={12}>
                    Noch keine Schulungen hinterlegt.
                  </td>
                </tr>
              ) : (
                employee.trainingRecords.map((record) => {
                  const state = getTrainingState(record.validUntil);
                  const progress = getTrainingProgress(
                    record.trainingDate,
                    record.validUntil,
                  );

                  return (
                    <tr className="border-t border-gray-100" key={record.id}>
                      <td className="p-3">
                        <form action={deleteEmployeeTrainingRecord}>
                          <input name="id" type="hidden" value={record.id} />
                          <input
                            name="employeeId"
                            type="hidden"
                            value={employee.id}
                          />
                          <button
                            aria-label={`${record.topic} löschen`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            title="Löschen"
                            type="submit"
                          >
                            <ActionIcon name="delete" className="h-4 w-4" />
                          </button>
                        </form>
                      </td>
                      <td className="p-3 text-gray-700">{record.number ?? "—"}</td>
                      <td className="p-3 text-gray-700">{record.provider ?? "—"}</td>
                      <td className="p-3 font-semibold text-gray-900">
                        {record.topic}
                        {record.notes ? (
                          <div className="mt-1 text-xs font-normal text-gray-500">
                            {record.notes}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatDate(record.trainingDate)}
                      </td>
                      <td className="p-3 text-gray-700">{record.type ?? "—"}</td>
                      <td className="p-3 text-gray-700">{record.location ?? "—"}</td>
                      <td className="p-3 text-gray-700">
                        {record.durationDays ?? "—"}
                      </td>
                      <td className="p-3 text-gray-700">
                        {formatDate(record.validUntil)}
                      </td>
                      <td className="p-3 text-gray-700">
                        {progress === null ? "—" : `${progress} %`}
                      </td>
                      <td className="p-3 text-gray-700">
                        {getRefreshText(record.validUntil)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${state.className}`}
                        >
                          {state.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function TextInput({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}

function DateInput({ label, name }: { label: string; name: string }) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        name={name}
        type="date"
      />
    </label>
  );
}
