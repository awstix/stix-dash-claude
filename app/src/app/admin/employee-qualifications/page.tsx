import { AppShell } from "@/components/AppShell";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  confirmEmployeeQualificationReview,
  createQualificationType,
  saveEmployeeQualifications,
  updateQualificationType,
  uploadEmployeeQualificationDocuments,
} from "./actions";
import { EmployeeQualificationDocumentViewerButton } from "./EmployeeQualificationDocumentViewer";
import { EmployeeQualificationDocumentsButton } from "./EmployeeQualificationDocumentsButton";

const categoryLabels: Record<string, string> = {
  DRIVER_LICENSE: "Führerschein",
  MACHINE_LICENSE: "Maschinenschein",
  OTHER: "Sonstige",
};

const documentTypeLabels: Record<string, string> = {
  DRIVER_LICENSE: "Führerschein",
  EARTHMOVING_MACHINE_LICENSE: "Erdbaumaschinenschein",
  CRANE_LICENSE: "Kranschein",
  FORKLIFT_LICENSE: "Staplerschein",
  OTHER: "Sonstiges / eigene Bezeichnung",
};

export default async function EmployeeQualificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const employeeSearch = String(params.q ?? "").trim();
  const requestedPage = Number.parseInt(String(params.page ?? "1"), 10);
  const pageSize = 40;
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const employeeWhere = {
    statusValue: "active",
    ...(employeeSearch
      ? {
          OR: [
            {
              firstName: {
                contains: employeeSearch,
              },
            },
            {
              lastName: {
                contains: employeeSearch,
              },
            },
          ],
        }
      : {}),
  };
  const [
    qualificationTypes,
    employees,
    employeeCount,
    employeeOptions,
    documents,
  ] =
    await Promise.all([
    prisma.employeeQualificationType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: employeeWhere,
      include: {
        qualifications: {
          include: {
            qualificationType: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (currentPage - 1) * pageSize,
      take: 40,
    }),
    prisma.employee.count({
      where: employeeWhere,
    }),
    prisma.employee.findMany({
      where: {
        statusValue: "active",
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        id: true,
        lastName: true,
      },
    }),
    prisma.employeeQualificationDocument.findMany({
      include: {
        employee: true,
        qualificationType: true,
      },
      orderBy: [{ uploadedAt: "desc" }],
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(employeeCount / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const activeTypes = qualificationTypes.filter((type) => type.isActive);
  const documentsByEmployeeId = new Map<string, typeof documents>();

  for (const document of documents) {
    const employeeDocuments = documentsByEmployeeId.get(document.employeeId);

    if (employeeDocuments) {
      employeeDocuments.push(document);
    } else {
      documentsByEmployeeId.set(document.employeeId, [document]);
    }
  }

  const today = startOfToday();

  return (
    <AppShell
      title="Mitarbeiter-Führerscheine und Maschinenscheine"
      description="Berechtigungen einfach per Checkbox pflegen, regelmäßig prüfen und Nachweise ablegen."
    >
      <details className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Berechtigungsarten und Prüfintervalle
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Zum Bearbeiten aufklappen. Das Intervall bestimmt, wann erneut eine
            Dashboard-Meldung erscheint.
          </p>
        </summary>

        <div className="border-t border-gray-200 p-5">
          <div className="space-y-3">
          {qualificationTypes.map((type) => (
            <form
              action={updateQualificationType}
              className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 lg:grid-cols-[1.2fr_180px_130px_90px_1fr_auto]"
              key={type.id}
            >
              <input name="id" type="hidden" value={type.id} />
              <LabeledInput
                defaultValue={type.name}
                label="Bezeichnung"
                name="name"
                required
              />
              <label className="text-xs font-semibold text-gray-700">
                Kategorie
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  defaultValue={type.category}
                  name="category"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <LabeledInput
                defaultValue={String(type.reviewIntervalMonths)}
                label="Prüfung alle Monate"
                min="1"
                name="reviewIntervalMonths"
                type="number"
              />
              <LabeledInput
                defaultValue={String(type.sortOrder)}
                label="Position"
                name="sortOrder"
                type="number"
              />
              <LabeledInput
                defaultValue={type.description ?? ""}
                label="Hinweis"
                name="description"
              />
              <div className="flex items-end gap-2">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700">
                  <input
                    defaultChecked={type.isActive}
                    name="isActive"
                    type="checkbox"
                  />
                  aktiv
                </label>
                <button
                  className="h-10 rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white hover:bg-gray-700"
                  type="submit"
                >
                  Speichern
                </button>
              </div>
            </form>
          ))}
          </div>

          <details className="mt-4 rounded-xl border border-dashed border-gray-300 p-4">
          <summary className="cursor-pointer font-semibold text-gray-900">
            Neue Berechtigungsart anlegen
          </summary>
          <form
            action={createQualificationType}
            className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_180px_140px_90px_1fr_auto]"
          >
            <LabeledInput label="Bezeichnung" name="name" required />
            <label className="text-xs font-semibold text-gray-700">
              Kategorie
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                defaultValue="MACHINE_LICENSE"
                name="category"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <LabeledInput
              defaultValue="6"
              label="Prüfung alle Monate"
              min="1"
              name="reviewIntervalMonths"
              type="number"
            />
            <LabeledInput
              defaultValue="999"
              label="Position"
              name="sortOrder"
              type="number"
            />
            <LabeledInput label="Hinweis" name="description" />
            <div className="flex items-end">
              <button
                className="h-10 rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Anlegen
              </button>
            </div>
          </form>
          </details>
        </div>
      </details>

      <section className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Berechtigungen je Mitarbeiter
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Erst Checkboxen speichern, danach die Sichtprüfung separat
                bestätigen. Dadurch wird der Prüfzeitpunkt nicht versehentlich
                verändert.
              </p>
              <p className="mt-1 text-xs font-semibold text-gray-500">
                Seite {visiblePage} von {pageCount} · {employeeCount} Mitarbeiter
              </p>
            </div>
            <form
              action="/admin/employee-qualifications"
              className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"
            >
              <input
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm lg:w-72"
                defaultValue={employeeSearch}
                name="q"
                placeholder="Vor- oder Nachname"
                type="search"
              />
              <button
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Suchen
              </button>
            </form>
          </div>
          {pageCount > 1 ? (
            <EmployeePagination
              currentPage={visiblePage}
              pageCount={pageCount}
              search={employeeSearch}
            />
          ) : null}
        </div>

        <div className="divide-y divide-gray-100">
          {employees.length === 0 ? (
            <p className="p-8 text-center text-sm font-medium text-gray-500">
              Keine passenden aktiven Mitarbeiter gefunden.
            </p>
          ) : employees.map((employee) => {
            const assignedTypeIds = new Set(
              employee.qualifications.map(
                (qualification) => qualification.qualificationTypeId,
              ),
            );
            const reviewState = getEmployeeReviewState(
              employee.qualifications,
              today,
            );
            const employeeDocuments = documents.filter(
              (document) => document.employeeId === employee.id,
            );
            const formId = `qualifications-${employee.id}`;

            return (
              <div className="px-4 py-3" key={employee.id}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_170px] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-gray-900">
                        {employee.lastName}, {employee.firstName}
                      </div>
                      <ReviewBadge state={reviewState} />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {employee.departmentLabel || "Ohne Abteilung"}
                    </div>
                  </div>

                  <form
                    action={saveEmployeeQualifications}
                    className="min-w-0"
                    id={formId}
                  >
                      <input
                        name="employeeId"
                        type="hidden"
                        value={employee.id}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {activeTypes.map((type) => (
                          <label
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-semibold text-gray-800"
                            key={type.id}
                            title={`${categoryLabels[type.category] ?? type.category} · Prüfung alle ${type.reviewIntervalMonths} Monate`}
                          >
                            <input
                              className="h-3.5 w-3.5"
                              defaultChecked={assignedTypeIds.has(type.id)}
                              name="qualificationTypeIds"
                              type="checkbox"
                              value={type.id}
                            />
                            {type.name}
                          </label>
                        ))}
                      </div>
                  </form>

                  <div className="flex flex-col gap-1.5">
                    <button
                      className="w-full rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
                      form={formId}
                      type="submit"
                    >
                      Berechtigungen speichern
                    </button>
                    <form action={confirmEmployeeQualificationReview}>
                      <input
                        name="employeeId"
                        type="hidden"
                        value={employee.id}
                      />
                      <button
                        className="w-full rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                        disabled={employee.qualifications.length === 0}
                        title={
                          employee.qualifications.length === 0
                            ? "Zuerst mindestens eine Berechtigung auswählen und speichern"
                            : "Gespeicherte Berechtigungen heute als geprüft bestätigen"
                        }
                        type="submit"
                      >
                        Prüfung bestätigen
                      </button>
                    </form>
                    <EmployeeQualificationDocumentsButton
                      documents={employeeDocuments.map((document) =>
                        toDocumentItem(document),
                      )}
                      employeeId={employee.id}
                      employeeName={`${employee.lastName}, ${employee.firstName}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {pageCount > 1 ? (
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-gray-600">
              Mitarbeiter {(visiblePage - 1) * pageSize + 1}–
              {Math.min(visiblePage * pageSize, employeeCount)} von{" "}
              {employeeCount}
            </span>
            <EmployeePagination
              currentPage={visiblePage}
              pageCount={pageCount}
              search={employeeSearch}
            />
          </div>
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Führerschein- und Nachweisdokumente
        </h2>
        <form
          action={uploadEmployeeQualificationDocuments}
          className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto]"
        >
          <label className="text-xs font-semibold text-gray-700">
            Mitarbeiter
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              name="employeeId"
              required
            >
              <option value="">Auswählen</option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.lastName}, {employee.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Dokumentart
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              defaultValue="DRIVER_LICENSE"
              name="documentType"
            >
              {Object.entries(documentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <LabeledInput
            label="Eigene Bezeichnung (nur bei Sonstiges)"
            name="customDocumentType"
          />
          <label className="text-xs font-semibold text-gray-700">
            Dateien
            <input
              accept="image/*,application/pdf"
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              multiple
              name="documents"
              required
              type="file"
            />
          </label>
          <div className="flex items-end">
            <button
              className="h-10 rounded-lg bg-gray-900 px-4 text-xs font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Hochladen
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Mitarbeiter</th>
                <th className="px-3 py-2">Berechtigung</th>
                <th className="px-3 py-2">Dokument</th>
                <th className="px-3 py-2">Hochgeladen</th>
                <th className="px-3 py-2 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    Noch keine Nachweise hochgeladen.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr className="border-t border-gray-100" key={document.id}>
                    <td className="px-3 py-2 font-semibold text-gray-900">
                      {document.employee.lastName},{" "}
                      {document.employee.firstName}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {documentTypeLabels[document.documentType] ||
                        document.displayName}
                    </td>
                    <td className="px-3 py-2">
                      <EmployeeQualificationDocumentViewerButton
                        className="font-semibold text-blue-700 hover:underline"
                        document={toDocumentItem(document)}
                        documents={(
                          documentsByEmployeeId.get(document.employeeId) ?? [
                            document,
                          ]
                        ).map((employeeDocument) =>
                          toDocumentItem(employeeDocument),
                        )}
                      >
                        {document.displayName}
                      </EmployeeQualificationDocumentViewerButton>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {formatDate(document.uploadedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <EmployeeQualificationDocumentViewerButton
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        document={toDocumentItem(document)}
                        documents={(
                          documentsByEmployeeId.get(document.employeeId) ?? [
                            document,
                          ]
                        ).map((employeeDocument) =>
                          toDocumentItem(employeeDocument),
                        )}
                      >
                        Öffnen
                      </EmployeeQualificationDocumentViewerButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function LabeledInput({
  defaultValue,
  label,
  min,
  name,
  required,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  min?: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-xs font-semibold text-gray-700">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        defaultValue={defaultValue}
        min={min}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function PaginationLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-300">
        {label}
      </span>
    );
  }

  return (
    <Link
      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
      href={href}
    >
      {label}
    </Link>
  );
}

function EmployeePagination({
  currentPage,
  pageCount,
  search,
}: {
  currentPage: number;
  pageCount: number;
  search: string;
}) {
  return (
    <nav
      aria-label="Mitarbeiterseiten"
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <PaginationLink
        disabled={currentPage <= 1}
        href={buildEmployeePageHref(search, currentPage - 1)}
        label="← Zurück"
      />
      {Array.from({ length: pageCount }, (_, index) => index + 1).map(
        (page) =>
          page === currentPage ? (
            <span
              aria-current="page"
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white"
              key={page}
            >
              {page}
            </span>
          ) : (
            <Link
              aria-label={`Mitarbeiterseite ${page}`}
              className="inline-flex h-10 min-w-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              href={buildEmployeePageHref(search, page)}
              key={page}
            >
              {page}
            </Link>
          ),
      )}
      <PaginationLink
        disabled={currentPage >= pageCount}
        href={buildEmployeePageHref(search, currentPage + 1)}
        label="Weiter →"
      />
    </nav>
  );
}

function buildEmployeePageHref(search: string, page: number) {
  const params = new URLSearchParams();

  if (search) {
    params.set("q", search);
  }

  params.set("page", String(Math.max(1, page)));
  return `/admin/employee-qualifications?${params.toString()}`;
}

function getEmployeeReviewState(
  qualifications: {
    lastReviewedAt: Date | null;
    qualificationType: {
      reviewIntervalMonths: number;
    };
  }[],
  today: Date,
) {
  if (qualifications.length === 0) {
    return { label: "Keine Berechtigungen", tone: "gray" };
  }

  let earliestDueDate: Date | null = null;

  for (const qualification of qualifications) {
    if (!qualification.lastReviewedAt) {
      return { label: "Prüfung fehlt", tone: "red" };
    }

    const dueDate = addMonths(
      qualification.lastReviewedAt,
      qualification.qualificationType.reviewIntervalMonths,
    );

    if (!earliestDueDate || dueDate < earliestDueDate) {
      earliestDueDate = dueDate;
    }
  }

  if (!earliestDueDate) {
    return { label: "Prüfung fehlt", tone: "red" };
  }

  const daysUntilDue = Math.ceil(
    (earliestDueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysUntilDue < 0) {
    return {
      label: `Überfällig seit ${formatDate(earliestDueDate)}`,
      tone: "red",
    };
  }

  if (daysUntilDue <= 30) {
    return {
      label: `Prüfung bis ${formatDate(earliestDueDate)}`,
      tone: "amber",
    };
  }

  return {
    label: `Geprüft bis ${formatDate(earliestDueDate)}`,
    tone: "green",
  };
}

function ReviewBadge({
  state,
}: {
  state: {
    label: string;
    tone: string;
  };
}) {
  const color =
    state.tone === "red"
      ? "bg-red-100 text-red-800"
      : state.tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : state.tone === "green"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}
    >
      {state.label}
    </span>
  );
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function startOfToday() {
  const result = new Date();
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDocumentItem(document: {
  displayName: string;
  documentType: string;
  employee: {
    firstName: string;
    lastName: string;
  };
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  originalFileName: string;
  publicUrl: string;
  uploadedAt: Date;
}) {
  return {
    displayName: document.displayName,
    documentType: document.documentType,
    documentTypeLabel:
      documentTypeLabels[document.documentType] || document.displayName,
    employeeName: `${document.employee.lastName}, ${document.employee.firstName}`,
    fileSizeLabel: formatFileSize(document.fileSizeBytes),
    id: document.id,
    mimeType: document.mimeType,
    originalFileName: document.originalFileName,
    publicUrl: document.publicUrl,
    uploadedAtLabel: formatDate(document.uploadedAt),
  };
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(1)} MB`;
}
