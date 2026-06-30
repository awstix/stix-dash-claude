import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createEmployeeTrainingRecordsForParticipants,
  createEmployeeTrainingType,
  deleteEmployeeTrainingType,
  importEmployeeTrainingsFromExcel,
  updateEmployeeTrainingType,
} from "./actions";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
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

type TrainingValidityLevel =
  | "validMoreThan50"
  | "validMoreThan25"
  | "validLessThan25"
  | "expired"
  | "withoutExpiry";

type TrainingRecordLike = {
  createdAt: Date;
  topic: string;
  trainingDate: Date | null;
  validUntil: Date | null;
};

type TrainingTypeOption = {
  defaultDurationDays?: number | null;
  defaultLocation?: string | null;
  defaultValidityMonths?: number | null;
  id: string;
  isImportedFallback?: boolean;
  number: string | null;
  provider?: string | null;
  topic: string;
  type?: string | null;
};

function getTrainingValidityLevel(record: {
  trainingDate: Date | null;
  validUntil: Date | null;
}): TrainingValidityLevel {
  if (!record.validUntil) return "withoutExpiry";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validUntil = new Date(record.validUntil);
  validUntil.setHours(0, 0, 0, 0);

  if (validUntil < today) return "expired";

  if (record.trainingDate) {
    const trainingDate = new Date(record.trainingDate);
    trainingDate.setHours(0, 0, 0, 0);

    const totalRuntime = validUntil.getTime() - trainingDate.getTime();
    if (totalRuntime > 0) {
      const remainingRuntime = validUntil.getTime() - today.getTime();
      const remainingRatio = remainingRuntime / totalRuntime;

      if (remainingRatio > 0.5) return "validMoreThan50";
      if (remainingRatio > 0.25) return "validMoreThan25";
      return "validLessThan25";
    }
  }

  const remainingDays = Math.ceil(
    (validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (remainingDays > 180) return "validMoreThan50";
  if (remainingDays > 90) return "validMoreThan25";
  return "validLessThan25";
}

function getTrainingMatrixCellClass(level: TrainingValidityLevel | null) {
  switch (level) {
    case "validMoreThan50":
      return "bg-green-100 text-green-950 ring-1 ring-inset ring-green-200";
    case "validMoreThan25":
      return "bg-yellow-100 text-yellow-950 ring-1 ring-inset ring-yellow-200";
    case "validLessThan25":
      return "bg-pink-100 text-pink-950 ring-1 ring-inset ring-pink-200";
    case "expired":
      return "bg-red-200 text-red-950 ring-1 ring-inset ring-red-300";
    case "withoutExpiry":
      return "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200";
    default:
      return "bg-white text-gray-900";
  }
}

function getRecordActualityTime(record: TrainingRecordLike) {
  return (
    record.trainingDate?.getTime() ??
    record.validUntil?.getTime() ??
    record.createdAt.getTime()
  );
}

function getLatestTrainingRecords<TRecord extends TrainingRecordLike>(
  records: TRecord[],
) {
  const latestByTopic = new Map<string, TRecord>();

  for (const record of records) {
    const key = record.topic.trim().toLowerCase();
    const current = latestByTopic.get(key);

    if (!current || getRecordActualityTime(record) > getRecordActualityTime(current)) {
      latestByTopic.set(key, record);
    }
  }

  return Array.from(latestByTopic.values()).sort((a, b) =>
    a.topic.localeCompare(b.topic, "de"),
  );
}

function matchesMatrixStatus(
  record: {
    trainingDate: Date | null;
    validUntil: Date | null;
  },
  matrixStatus: string,
) {
  const level = getTrainingValidityLevel(record);

  if (matrixStatus === "valid") {
    return (
      level === "validMoreThan50" ||
      level === "validMoreThan25" ||
      level === "validLessThan25"
    );
  }

  return level === matrixStatus;
}

export default async function EmployeeCertificatesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    errorFile?: string;
    imported?: string;
    matrixDepartment?: string;
    matrixCompany?: string;
    matrixQuery?: string;
    matrixStatus?: string;
    q?: string;
    skipped?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
  const matrixCompany = String(params.matrixCompany ?? "").trim();
  const matrixDepartment = String(params.matrixDepartment ?? "").trim();
  const matrixQuery = String(params.matrixQuery ?? "").trim().toLowerCase();
  const matrixStatus = String(params.matrixStatus ?? "").trim();
  const importedCount = Number.parseInt(String(params.imported ?? ""), 10);
  const skippedCount = Number.parseInt(String(params.skipped ?? ""), 10);
  const errorFile = String(params.errorFile ?? "").trim();
  const hasImportResult =
    Number.isFinite(importedCount) || Number.isFinite(skippedCount);
  const employees = await prisma.employee.findMany({
    where: {
      statusValue: "active",
      ...(searchQuery
        ? {
            OR: [
              { firstName: { contains: searchQuery } },
              { lastName: { contains: searchQuery } },
              { companyLabel: { contains: searchQuery } },
              { departmentLabel: { contains: searchQuery } },
              {
                trainingRecords: {
                  some: {
                    topic: {
                      contains: searchQuery,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      trainingRecords: {
        orderBy: [{ validUntil: "asc" }, { trainingDate: "desc" }],
      },
    },
    orderBy: [{ companyLabel: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  const trainingTypes = await prisma.employeeTrainingType.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { topic: "asc" }],
  });
  const fallbackTrainingRecords = await prisma.employeeTrainingRecord.findMany({
    orderBy: [{ topic: "asc" }, { trainingDate: "desc" }, { createdAt: "desc" }],
    select: {
      durationDays: true,
      location: true,
      number: true,
      provider: true,
      topic: true,
      type: true,
      validityMonths: true,
    },
  });
  const trainingTypeTopics = new Set(
    trainingTypes.map((type) => type.topic.trim().toLowerCase()),
  );
  const fallbackTrainingTypeOptions = Array.from(
    fallbackTrainingRecords.reduce((items, record) => {
      const key = record.topic.trim().toLowerCase();

      if (!trainingTypeTopics.has(key) && !items.has(key)) {
        items.set(key, {
          defaultDurationDays: record.durationDays,
          defaultLocation: record.location,
          defaultValidityMonths: record.validityMonths,
          id: `import-topic:${encodeURIComponent(record.topic)}`,
          isImportedFallback: true,
          number: record.number,
          provider: record.provider,
          topic: record.topic,
          type: record.type,
        } satisfies TrainingTypeOption);
      }

      return items;
    }, new Map<string, TrainingTypeOption>()),
  )
    .map(([, option]) => option)
    .sort((a, b) => a.topic.localeCompare(b.topic, "de"));
  const trainingTypeOptions: TrainingTypeOption[] = [
    ...trainingTypes.map((type) => ({
      defaultDurationDays: type.defaultDurationDays,
      defaultLocation: type.defaultLocation,
      defaultValidityMonths: type.defaultValidityMonths,
      id: type.id,
      number: type.number,
      provider: type.provider,
      topic: type.topic,
      type: type.type,
    })),
    ...fallbackTrainingTypeOptions,
  ];
  const trainingRecordCountByTopic = employees.reduce((counts, employee) => {
    for (const record of employee.trainingRecords) {
      const key = record.topic.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
  const trainingTopics = await prisma.employeeTrainingRecord.findMany({
    distinct: ["topic"],
    orderBy: [{ topic: "asc" }],
    select: {
      topic: true,
    },
  });
  const totalTrainingRecords = employees.reduce(
    (total, employee) => total + employee.trainingRecords.length,
    0,
  );
  const latestTrainingRecordsByEmployeeId = new Map(
    employees.map((employee) => [
      employee.id,
      getLatestTrainingRecords(employee.trainingRecords),
    ]),
  );
  const expiredOrSoon = employees.reduce((total, employee) => {
    const latestTrainingRecords =
      latestTrainingRecordsByEmployeeId.get(employee.id) ?? [];

    return (
      total +
      latestTrainingRecords.filter((record) => {
        const state = getTrainingState(record.validUntil);
        return state.label === "abgelaufen" || state.label === "läuft bald ab";
      }).length
    );
  }, 0);
  const matrixCompanies = Array.from(
    new Set(employees.map((employee) => employee.companyLabel).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b), "de"));
  const matrixDepartments = Array.from(
    new Set(
      employees.map((employee) => employee.departmentLabel).filter(Boolean),
    ),
  ).sort((a, b) => String(a).localeCompare(String(b), "de"));
  const matrixEmployees = employees.filter((employee) => {
    if (matrixCompany && employee.companyLabel !== matrixCompany) return false;
    if (matrixDepartment && employee.departmentLabel !== matrixDepartment) {
      return false;
    }

    if (matrixQuery) {
      const searchableText = [
        employee.companyLabel,
        employee.departmentLabel,
        employee.firstName,
        employee.lastName,
        ...(latestTrainingRecordsByEmployeeId.get(employee.id) ?? []).map(
          (record) => record.topic,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(matrixQuery)) return false;
    }

    if (matrixStatus) {
      const hasMatchingStatus = (
        latestTrainingRecordsByEmployeeId.get(employee.id) ?? []
      ).some((record) => matchesMatrixStatus(record, matrixStatus));

      if (!hasMatchingStatus) return false;
    }

    return true;
  });
  const dueTrainingRows = employees
    .flatMap((employee) =>
      (latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
        .map((record) => ({
          employee,
          record,
          state: getTrainingState(record.validUntil),
        }))
        .filter(
          (item) =>
            item.state.label === "abgelaufen" ||
            item.state.label === "läuft bald ab",
        ),
    )
    .sort((a, b) => {
      if (!a.record.validUntil && !b.record.validUntil) return 0;
      if (!a.record.validUntil) return 1;
      if (!b.record.validUntil) return -1;
      return a.record.validUntil.getTime() - b.record.validUntil.getTime();
    });
  const exportQuery = new URLSearchParams();
  if (matrixCompany) exportQuery.set("matrixCompany", matrixCompany);
  if (matrixDepartment) exportQuery.set("matrixDepartment", matrixDepartment);
  if (matrixQuery) exportQuery.set("matrixQuery", matrixQuery);
  if (matrixStatus) exportQuery.set("matrixStatus", matrixStatus);
  const matrixExportHref = `/employees/certificates/export${
    exportQuery.size ? `?${exportQuery.toString()}` : ""
  }`;
  const dueExportHref = "/employees/certificates/export?mode=due";

  return (
    <AppShell
      title="Mitarbeiterzertifikate"
      description="Kurze Übersicht je Mitarbeiter. Schulungen und Führerscheine werden im Mitarbeiterdetail gepflegt."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Mitarbeiter sichtbar" value={String(employees.length)} />
        <SummaryCard label="Schulungseinträge" value={String(totalTrainingRecords)} />
        <SummaryCard label="Bald fällig / abgelaufen" value={String(expiredOrSoon)} />
      </div>

      <details className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
        <summary className="cursor-pointer list-none p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-amber-950">
                Bald fällig / abgelaufen ansehen
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                Zeigt genau, welche Schulung bei welchem Mitarbeiter fällig ist.
              </p>
            </div>
            <Link
              className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-100"
              href={dueExportHref}
            >
              Fälligkeiten exportieren
            </Link>
          </div>
        </summary>
        <div className="border-t border-amber-200 bg-white p-5">
          {dueTrainingRows.length ? (
            <div className="max-h-96 overflow-auto rounded-xl border border-gray-200">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="w-32 p-3">Status</th>
                    <th className="p-3">Firma</th>
                    <th className="p-3">Abteilung</th>
                    <th className="p-3">Mitarbeiter</th>
                    <th className="p-3">Schulung</th>
                    <th className="w-32 p-3">gültig bis</th>
                  </tr>
                </thead>
                <tbody>
                  {dueTrainingRows.map(({ employee, record, state }) => (
                    <tr className="border-t border-gray-100" key={record.id}>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${state.className}`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="truncate p-3 text-gray-800">
                        {employee.companyLabel || "—"}
                      </td>
                      <td className="truncate p-3 text-gray-800">
                        {employee.departmentLabel || "—"}
                      </td>
                      <td className="truncate p-3 font-semibold">
                        <Link
                          className="text-gray-900 underline decoration-gray-300 underline-offset-4 hover:text-blue-700 hover:decoration-blue-500"
                          href={`/employees/certificates/${employee.id}`}
                        >
                          {employee.firstName} {employee.lastName}
                        </Link>
                      </td>
                      <td className="truncate p-3 text-gray-900">{record.topic}</td>
                      <td className="p-3 font-semibold text-gray-900">
                        {formatDate(record.validUntil)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
              Aktuell keine bald fälligen oder abgelaufenen Schulungen.
            </div>
          )}
        </div>
      </details>

      {hasImportResult ? (
        <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 shadow-sm">
          <h2 className="text-lg font-semibold">Import abgeschlossen</h2>
          <p className="mt-1 text-sm">
            Importiert:{" "}
            <span className="font-bold">
              {Number.isFinite(importedCount) ? importedCount : 0}
            </span>{" "}
            · Übersprungen:{" "}
            <span className="font-bold">
              {Number.isFinite(skippedCount) ? skippedCount : 0}
            </span>
          </p>
          {errorFile ? (
            <Link
              className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-950 ring-1 ring-blue-200 hover:bg-blue-100"
              href={errorFile}
            >
              Fehlerliste herunterladen
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4">
        <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Schulungsvorlage anlegen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Hier entstehen die Schulungen, die später auswählbar sind.
            </p>
          </summary>
          <form
            action={createEmployeeTrainingType}
            className="grid grid-cols-1 gap-3 border-t border-gray-200 p-5 md:grid-cols-2 xl:grid-cols-4"
          >
            <TextInput label="Nr." name="number" placeholder="01" />
            <TextInput label="Anbieter" name="provider" placeholder="z.B. DVGW" />
            <TextInput
              label="Thema Kurs"
              name="topic"
              placeholder="z.B. Erste Hilfe Kurs"
              required
            />
            <TextInput label="Typ" name="type" placeholder="Allgemein, DVGW..." />
            <TextInput label="Ort" name="location" placeholder="Intern, Frankfurt..." />
            <TextInput label="Dauer [Tage]" name="durationDays" placeholder="0,5" />
            <TextInput
              label="Gültigkeit [Jahre]"
              name="validityYears"
              placeholder="z.B. 2"
            />
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 xl:self-end"
              type="submit"
            >
              Vorlage speichern
            </button>
          </form>
          <div className="border-t border-gray-200 p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
              Vorlagen verwalten
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Löschen entfernt die Vorlage und alle Schulungseinträge dieses
              Themas bei allen Mitarbeitern.
            </p>
            <div className="mt-3 grid max-h-96 grid-cols-1 gap-2 overflow-y-auto pr-1 xl:grid-cols-2 2xl:grid-cols-3">
              {trainingTypeOptions.length ? (
                trainingTypeOptions.map((type) => {
                  const recordCount =
                    trainingRecordCountByTopic.get(
                      type.topic.trim().toLowerCase(),
                    ) ?? 0;

                  return (
                    <details
                      className="rounded-xl border border-gray-200 bg-gray-50"
                      key={type.id}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900">
                            {[type.number, type.topic].filter(Boolean).join(" · ")}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {recordCount} Einträge
                            {type.isImportedFallback ? " · aus Import" : ""}
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-gray-500">
                          Bearbeiten
                        </div>
                      </summary>
                      <form
                        action={updateEmployeeTrainingType}
                        className="grid grid-cols-1 gap-3 border-t border-gray-200 p-3 md:grid-cols-2"
                      >
                        <input name="trainingTypeId" type="hidden" value={type.id} />
                        <input name="oldTopic" type="hidden" value={type.topic} />
                        <TextInput
                          defaultValue={type.number ?? ""}
                          label="Nr."
                          name="number"
                        />
                        <TextInput
                          defaultValue={type.topic}
                          label="Thema Kurs"
                          name="topic"
                          required
                        />
                        <TextInput
                          defaultValue={type.provider ?? ""}
                          label="Anbieter"
                          name="provider"
                        />
                        <TextInput
                          defaultValue={type.type ?? ""}
                          label="Typ"
                          name="type"
                        />
                        <TextInput
                          defaultValue={type.defaultLocation ?? ""}
                          label="Ort"
                          name="location"
                        />
                        <TextInput
                          defaultValue={
                            type.defaultDurationDays === null ||
                            type.defaultDurationDays === undefined
                              ? ""
                              : String(type.defaultDurationDays).replace(".", ",")
                          }
                          label="Dauer [Tage]"
                          name="durationDays"
                        />
                        <TextInput
                          defaultValue={
                            type.defaultValidityMonths
                              ? String(type.defaultValidityMonths / 12).replace(
                                  ".",
                                  ",",
                                )
                              : ""
                          }
                          label="Gültigkeit [Jahre]"
                          name="validityYears"
                        />
                        <div className="flex gap-2 md:col-span-2">
                          <button
                            className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                            type="submit"
                          >
                            Speichern
                          </button>
                        </div>
                      </form>
                      <form
                        action={deleteEmployeeTrainingType}
                        className="border-t border-gray-200 p-3"
                      >
                        <input name="trainingTypeId" type="hidden" value={type.id} />
                        <input name="topic" type="hidden" value={type.topic} />
                        <button
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                          title="Schulung löschen"
                          type="submit"
                        >
                          <ActionIcon name="delete" className="h-4 w-4" />
                          Löschen
                        </button>
                      </form>
                    </details>
                  );
                })
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  Noch keine Schulungsvorlagen vorhanden.
                </div>
              )}
            </div>
          </div>
        </details>

        <details className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Schulung für mehrere Teilnehmer eintragen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Eine Schulung einmal eintragen und direkt mehreren Mitarbeitern
              zuweisen.
            </p>
          </summary>
          <form
            action={createEmployeeTrainingRecordsForParticipants}
            className="grid grid-cols-1 gap-4 border-t border-gray-200 p-5 lg:grid-cols-4"
          >
            <label className="text-sm font-semibold text-gray-800 lg:col-span-2">
              Schulungsvorlage
              <select
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                name="trainingTypeId"
              >
                <option value="">Ohne Vorlage / freie Schulung</option>
                {trainingTypeOptions.map((type) => (
                  <option key={type.id} value={type.id}>
                    {[type.number, type.topic].filter(Boolean).join(" · ")}
                    {type.isImportedFallback ? " · aus Import" : ""}
                  </option>
                ))}
              </select>
            </label>
            <TextInput label="Thema Kurs" name="topic" placeholder="falls ohne Vorlage" />
            <DateInput label="Datum der Schulung" name="trainingDate" />
            <TextInput label="Nr." name="number" placeholder="optional" />
            <TextInput label="Anbieter" name="provider" placeholder="optional" />
            <TextInput label="Typ" name="type" placeholder="optional" />
            <TextInput label="Ort" name="location" placeholder="optional" />
            <TextInput label="Dauer [Tage]" name="durationDays" placeholder="0,5" />
            <DateInput label="Buchung am" name="bookedAt" />
            <DateInput label="Buchungsbestätigung" name="bookingConfirmedAt" />
            <DateInput label="Zertifikat erhalten" name="certificateReceivedAt" />
            <TextInput label="Gültigkeit [Jahre]" name="validityYears" placeholder="2" />
            <DateInput label="gültig bis" name="validUntil" />
            <label className="text-sm font-semibold text-gray-800 lg:col-span-4">
              Bemerkung
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                name="notes"
              />
            </label>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 lg:col-span-4">
              <div className="mb-2 text-sm font-semibold text-gray-900">
                Teilnehmer auswählen
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {employees.map((employee) => (
                  <label
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-800 ring-1 ring-gray-200"
                    key={employee.id}
                  >
                    <input
                      className="h-4 w-4 rounded border-gray-300"
                      name="employeeIds"
                      type="checkbox"
                      value={employee.id}
                    />
                    <span>
                      {employee.lastName}, {employee.firstName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 lg:col-span-4"
              type="submit"
            >
              Schulung für Teilnehmer speichern
            </button>
          </form>
        </details>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Excel Import / Export
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Import erkennt die Spalten aus deiner Schulungsübersicht über
              Vorname/Nachname/Thema Kurs. Die Vorlage passt zur bisherigen
              Excel-Struktur.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Link
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
              href="/employees/certificates/import-template"
            >
              <span className="block text-sm font-bold text-gray-900">
                Importvorlage
              </span>
              <span className="mt-1 block text-sm text-gray-600">
                Leere Excel-Datei mit den passenden Spalten herunterladen.
              </span>
            </Link>
            <form
              action={importEmployeeTrainingsFromExcel}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <label className="text-sm font-semibold text-gray-800">
                Excel importieren
                <input
                  accept=".xlsx,.xls,.xlsm"
                  className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-100"
                  name="file"
                  type="file"
                />
              </label>
              <button
                className="mt-3 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Importieren
              </button>
            </form>
            <Link
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
              href="/employees/certificates/export"
            >
              <span className="block text-sm font-bold text-gray-900">
                Excel exportieren
              </span>
              <span className="mt-1 block text-sm text-gray-600">
                Kurzliste, Kreuztabelle und Farblegende als XLSX laden.
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Zertifikatsliste kurz
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Firma/Abteilung, Vorname, Nachname und aktuelle Schulungen. Details
              öffnest du je Mitarbeiter.
            </p>
          </div>

          <form className="flex w-full flex-col gap-3 md:max-w-xl md:flex-row md:items-end">
            <label className="flex-1 text-sm font-semibold text-gray-800">
              Suche
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                defaultValue={searchQuery}
                name="q"
                placeholder="Name, Firma, Abteilung, Schulung..."
              />
            </label>
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Suchen
            </button>
            <Link
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href="/employees/certificates"
            >
              Zurücksetzen
            </Link>
          </form>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-20 p-3">Aktion</th>
                <th className="w-[22%] p-3">Firma / Abteilung</th>
                <th className="w-[14%] p-3">Vorname</th>
                <th className="w-[14%] p-3">Nachname</th>
                <th className="p-3">Schulungen</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={5}>
                    Keine passenden Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr className="border-t border-gray-100" key={employee.id}>
                    <td className="p-3">
                      <Link
                        aria-label={`${employee.firstName} ${employee.lastName} öffnen`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        href={`/employees/certificates/${employee.id}`}
                        title="Mitarbeiter öffnen"
                      >
                        <ActionIcon name="open" className="h-4 w-4" />
                      </Link>
                    </td>
                    <td className="truncate p-3 text-gray-700">
                      {[employee.companyLabel, employee.departmentLabel]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="truncate p-3 font-semibold text-gray-900">
                      {employee.firstName}
                    </td>
                    <td className="truncate p-3 font-semibold text-gray-900">
                      {employee.lastName}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {(latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
                          .length ? (
                          (latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
                            .slice(0, 6)
                            .map((record) => {
                            const state = getTrainingState(record.validUntil);

                            return (
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${state.className}`}
                                key={record.id}
                                title={`gültig bis ${formatDate(record.validUntil)}`}
                              >
                                {record.topic}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-500">Noch keine Schulungen</span>
                        )}
                        {(latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
                          .length > 6 ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            +
                            {(latestTrainingRecordsByEmployeeId.get(employee.id) ?? [])
                              .length - 6}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details
        className="mt-6 scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-sm"
        id="kreuztabelle"
      >
        <summary className="cursor-pointer list-none p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Kreuztabelle / Exportansicht
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Eingeklappt, weil die Übersicht sonst schnell zu breit wird. Diese
            Ansicht wird über den Excel-Export mit ausgegeben.
          </p>
        </summary>
        <div className="border-t border-gray-200 p-6">
          <form
            action="/employees/certificates#kreuztabelle"
            className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-4"
          >
            {searchQuery ? <input name="q" type="hidden" value={searchQuery} /> : null}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
              <label className="text-sm font-semibold text-gray-800">
                Firma
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue={matrixCompany}
                  name="matrixCompany"
                >
                  <option value="">Alle Firmen</option>
                  {matrixCompanies.map((company) => (
                    <option key={company} value={company ?? ""}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Abteilung
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue={matrixDepartment}
                  name="matrixDepartment"
                >
                  <option value="">Alle Abteilungen</option>
                  {matrixDepartments.map((department) => (
                    <option key={department} value={department ?? ""}>
                      {department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Status
                <select
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue={matrixStatus}
                  name="matrixStatus"
                >
                  <option value="">Alle Status</option>
                  <option value="valid">gültig</option>
                  <option value="validMoreThan50">gültig &gt;50%</option>
                  <option value="validMoreThan25">gültig &gt;25%</option>
                  <option value="validLessThan25">gültig &lt;25%</option>
                  <option value="expired">abgelaufen</option>
                  <option value="withoutExpiry">ohne Ablauf</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-800">
                Suche
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  defaultValue={matrixQuery}
                  name="matrixQuery"
                  placeholder="Name oder Schulung..."
                />
              </label>
              <div className="flex gap-2 self-end">
                <button
                  className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  type="submit"
                >
                  Filtern
                </button>
                <Link
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  href={
                    searchQuery
                      ? `/employees/certificates?q=${encodeURIComponent(
                          searchQuery,
                        )}#kreuztabelle`
                      : "/employees/certificates#kreuztabelle"
                  }
                >
                  Reset
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="mr-1 text-gray-600">
                {matrixEmployees.length} von {employees.length} Mitarbeitern
              </span>
              <Link
                className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700"
                href={matrixExportHref}
              >
                Gefilterte Kreuztabelle exportieren
              </Link>
              <span className="rounded-full bg-green-100 px-3 py-1.5 text-green-950 ring-1 ring-green-200">
                gültig &gt;50%
              </span>
              <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-yellow-950 ring-1 ring-yellow-200">
                gültig &gt;25%
              </span>
              <span className="rounded-full bg-pink-100 px-3 py-1.5 text-pink-950 ring-1 ring-pink-200">
                gültig &lt;25%
              </span>
              <span className="rounded-full bg-red-200 px-3 py-1.5 text-red-950 ring-1 ring-red-300">
                abgelaufen
              </span>
            </div>
          </form>
          <div className="max-h-[70vh] max-w-full overflow-auto rounded-xl border border-gray-200">
            <table className="min-w-full w-max text-left text-xs text-gray-900">
              <thead className="sticky top-0 z-20 bg-gray-50 uppercase tracking-wide text-gray-800 shadow-sm">
                <tr>
                  <th className="sticky left-0 z-30 w-[120px] min-w-[120px] border-r border-gray-200 bg-gray-50 p-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                    Firma
                  </th>
                  <th className="sticky left-[120px] z-30 w-[130px] min-w-[130px] border-r border-gray-200 bg-gray-50 p-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                    Abteilung
                  </th>
                  <th className="sticky left-[250px] z-30 w-[120px] min-w-[120px] border-r border-gray-200 bg-gray-50 p-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                    Vorname
                  </th>
                  <th className="sticky left-[370px] z-30 w-[130px] min-w-[130px] border-r border-gray-200 bg-gray-50 p-3 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                    Nachname
                  </th>
                  {trainingTopics.map((topic) => (
                    <th className="w-32 min-w-[8rem] p-3" key={topic.topic}>
                      {topic.topic}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixEmployees.map((employee) => (
                  <tr className="border-t border-gray-100" key={employee.id}>
                    <td className="sticky left-0 z-10 w-[120px] min-w-[120px] truncate border-r border-gray-200 bg-white p-3 text-gray-900 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      {employee.companyLabel || "—"}
                    </td>
                    <td className="sticky left-[120px] z-10 w-[130px] min-w-[130px] truncate border-r border-gray-200 bg-white p-3 text-gray-900 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      {employee.departmentLabel || "—"}
                    </td>
                    <td className="sticky left-[250px] z-10 w-[120px] min-w-[120px] truncate border-r border-gray-200 bg-white p-3 text-gray-900 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      {employee.firstName}
                    </td>
                    <td className="sticky left-[370px] z-10 w-[130px] min-w-[130px] truncate border-r border-gray-200 bg-white p-3 font-semibold text-gray-900 shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                      {employee.lastName}
                    </td>
                    {trainingTopics.map((topic) => {
                      const record = (
                        latestTrainingRecordsByEmployeeId.get(employee.id) ?? []
                      ).find(
                        (item) => item.topic === topic.topic,
                      );
                      const shouldShowRecord =
                        record &&
                        (!matrixStatus ||
                          matchesMatrixStatus(record, matrixStatus));
                      const level = record
                        ? getTrainingValidityLevel(record)
                        : null;

                      return (
                        <td
                          className={`p-3 font-semibold ${getTrainingMatrixCellClass(
                            shouldShowRecord ? level : null,
                          )}`}
                          key={topic.topic}
                        >
                          {shouldShowRecord
                            ? record.validUntil
                              ? formatDate(record.validUntil)
                              : "ohne Ablauf"
                            : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function TextInput({
  defaultValue,
  label,
  name,
  placeholder,
  required = false,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
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
