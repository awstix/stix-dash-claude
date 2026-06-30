import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

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

export default async function EmployeeCertificatesPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const searchQuery = String(params.q ?? "").trim();
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
  const expiredOrSoon = employees.reduce((total, employee) => {
    return (
      total +
      employee.trainingRecords.filter((record) => {
        const state = getTrainingState(record.validUntil);
        return state.label === "abgelaufen" || state.label === "läuft bald ab";
      }).length
    );
  }, 0);

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

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-20 p-3">Aktion</th>
                <th className="p-3">Firma / Abteilung</th>
                <th className="p-3">Vorname</th>
                <th className="p-3">Nachname</th>
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
                    <td className="p-3 text-gray-700">
                      {[employee.companyLabel, employee.departmentLabel]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {employee.firstName}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {employee.lastName}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {employee.trainingRecords.length ? (
                          employee.trainingRecords.slice(0, 6).map((record) => {
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
                        {employee.trainingRecords.length > 6 ? (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            +{employee.trainingRecords.length - 6}
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

      <details className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none p-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Kreuztabelle / Exportansicht
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Eingeklappt, weil die Übersicht sonst schnell zu breit wird. Später
            kann genau diese Ansicht als Excel exportiert werden.
          </p>
        </summary>
        <div className="border-t border-gray-200 p-6">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] text-left text-xs">
              <thead className="bg-gray-50 uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3">Firma / Abteilung</th>
                  <th className="p-3">Vorname</th>
                  <th className="p-3">Nachname</th>
                  {trainingTopics.map((topic) => (
                    <th className="min-w-[160px] p-3" key={topic.topic}>
                      {topic.topic}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr className="border-t border-gray-100" key={employee.id}>
                    <td className="p-3">
                      {[employee.companyLabel, employee.departmentLabel]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="p-3">{employee.firstName}</td>
                    <td className="p-3">{employee.lastName}</td>
                    {trainingTopics.map((topic) => {
                      const record = employee.trainingRecords.find(
                        (item) => item.topic === topic.topic,
                      );

                      return (
                        <td className="p-3" key={topic.topic}>
                          {record ? formatDate(record.validUntil) : ""}
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
