import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

type PersonalSkillsSearchParams = {
  q?: string;
  status?: string;
};

function formatDate(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getTrainingState(validUntil: Date | null) {
  if (!validUntil) {
    return { className: "bg-gray-100 text-gray-700", label: "ohne Ablauf", value: "withoutExpiry" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);

  if (validUntil < today) {
    return { className: "bg-red-100 text-red-900", label: "abgelaufen", value: "expired" };
  }
  if (validUntil <= soon) {
    return { className: "bg-yellow-100 text-yellow-950", label: "läuft bald ab", value: "soon" };
  }
  return { className: "bg-green-100 text-green-900", label: "gültig", value: "valid" };
}

export default async function PersonalSkillsPage({
  searchParams,
}: {
  searchParams: Promise<PersonalSkillsSearchParams>;
}) {
  await requireSession();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = (params.status ?? "").trim();

  const records = await prisma.employeeTrainingRecord.findMany({
    include: { employee: true },
    orderBy: [{ trainingDate: "desc" }],
    where: {
      OR: q
        ? [
            { topic: { contains: q } },
            { employee: { firstName: { contains: q } } },
            { employee: { lastName: { contains: q } } },
          ]
        : undefined,
    },
  });

  const filteredRecords = records.filter((record) => {
    if (!status) return true;
    return getTrainingState(record.validUntil).value === status;
  });

  return (
    <AppShell
      title="Skills"
      description="Schulungen und Qualifikationen aller Mitarbeiter im Überblick. Verwaltet werden sie weiterhin in der Mitarbeiterakte."
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Link
          href="/personal"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Personal-Übersicht
        </Link>
        <Link
          href="/employees/certificates"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Schulung erfassen (Mitarbeiterakte)
        </Link>

        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-xs font-semibold text-gray-700">
            Suche (Name oder Skill)
            <input
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
              defaultValue={q}
              name="q"
              type="text"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Status
            <select
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={status}
              name="status"
            >
              <option value="">Alle</option>
              <option value="valid">Gültig</option>
              <option value="soon">Läuft bald ab</option>
              <option value="expired">Abgelaufen</option>
              <option value="withoutExpiry">Ohne Ablauf</option>
            </select>
          </label>
          <button
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            type="submit"
          >
            Filtern
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-3">Status</th>
              <th className="p-3">Datum</th>
              <th className="p-3">Person</th>
              <th className="p-3">Skill</th>
              <th className="p-3">Gültig bis</th>
              <th className="p-3">Anbieter</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => {
              const state = getTrainingState(record.validUntil);
              return (
                <tr className="border-b border-gray-200" key={record.id}>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${state.className}`}>
                      {state.label}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700">{formatDate(record.trainingDate)}</td>
                  <td className="p-3 font-semibold text-gray-900">
                    {record.employee.lastName}, {record.employee.firstName}
                  </td>
                  <td className="p-3 text-gray-700">{record.topic}</td>
                  <td className="p-3 text-gray-700">{formatDate(record.validUntil)}</td>
                  <td className="p-3 text-gray-700">{record.provider || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredRecords.length ? (
          <div className="p-8 text-center text-sm font-semibold text-gray-500">
            Keine Skills/Schulungen gefunden.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
