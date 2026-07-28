import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { GENERAL_RISK_ASSESSMENT_TEMPLATES } from "@/lib/general-risk-assessments";
import { prisma } from "@/lib/prisma";
import { SafetyParticipantSummary } from "../../_components/SafetyParticipantSummary";

export const dynamic = "force-dynamic";

export default async function GeneralRiskAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; projectId?: string }>;
}) {
  const { employeeId = "", projectId = "" } = await searchParams;
  const records = await prisma.generalRiskAssessment.findMany({
    include: {
      assessedEmployee: {
        select: { firstName: true, lastName: true },
      },
      participants: {
        select: {
          employee: { select: { firstName: true, lastName: true } },
          signatureDataUrl: true,
        },
      },
      project: { select: { name: true, projectNumber: true } },
    },
    orderBy: [{ assessmentDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AppShell
      description="Digitale Gefährdungsbeurteilungen auf Basis der freigegebenen STIX-Vorlagen."
      title="Gefährdungsbeurteilungen"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GENERAL_RISK_ASSESSMENT_TEMPLATES.map((template) => (
          <section
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            key={template.key}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {template.code} · Rev. {template.revision}
            </p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">
              {template.title}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {
                template.items.filter(
                  (item) => (item.kind ?? "choice") === "choice",
                ).length
              }{" "}
              bewertbare Positionen ·{" "}
              {template.pageCount} Originalseiten
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-700"
                href={`/safety/risk-assessments/general/new?template=${template.key}&projectId=${projectId}&employeeId=${employeeId}`}
              >
                Ausfüllen
              </Link>
              <a
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-50"
                href={template.sourcePdfPath}
                target="_blank"
              >
                Original
              </a>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Gespeicherte Gefährdungsbeurteilungen
        </h2>
        {records.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white">
            <p className="p-8 text-center text-sm text-gray-600">
              Noch keine dieser Gefährdungsbeurteilungen ausgefüllt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-300 bg-white">
            <table className="min-w-[1150px] w-full text-left text-sm text-black">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3">Vorlage</th>
                  <th className="p-3">Datum</th>
                  <th className="p-3">Projekt / Person</th>
                  <th className="p-3">Betroffene Person(en)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Unterschriften</th>
                  <th className="p-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr className="border-t border-gray-200" key={record.id}>
                    <td className="p-3">
                      <p className="font-bold text-gray-900">
                        {record.templateTitle}
                      </p>
                      <p className="text-xs text-gray-500">
                        {record.templateCode} · Rev. {record.templateRevision}
                      </p>
                    </td>
                    <td className="p-3">
                      <SafetyParticipantSummary
                        names={record.participants.map(
                          (participant) =>
                            `${participant.employee.lastName}, ${participant.employee.firstName}`,
                        )}
                      />
                    </td>
                    <td className="p-3">
                      {record.assessmentDate.toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-3">
                      {record.project
                        ? `${record.project.projectNumber} · ${record.project.name}`
                        : record.assessedEmployee
                          ? `${record.assessedEmployee.lastName}, ${record.assessedEmployee.firstName}`
                          : "Ohne Zuordnung"}
                    </td>
                    <td className="p-3">
                      {record.status === "COMPLETED"
                        ? "Abgeschlossen"
                        : "Entwurf"}
                    </td>
                    <td className="p-3">
                      {
                        record.participants.filter((item) =>
                          Boolean(item.signatureDataUrl),
                        ).length
                      }
                      /{record.participants.length}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                          href={`/safety/risk-assessments/general/${record.id}`}
                        >
                          Öffnen
                        </Link>
                        <a
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                          href={`/safety/risk-assessments/general/${record.id}/pdf`}
                          target="_blank"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
