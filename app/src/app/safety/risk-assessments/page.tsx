import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { SafetyTemplateFolderManager } from "../_components/SafetyTemplateFolderManager";

export default async function RiskAssessmentsPage() {
  const [folders, templates] = await Promise.all([
    prisma.safetyTemplateFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: { area: "RISK_ASSESSMENT", isDeleted: false },
    }),
    prisma.safetyInstructionTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        folderId: true,
        id: true,
        sourceDocxPath: true,
        sourcePdfPath: true,
        title: true,
      },
      where: {
        folderId: { not: null },
        type: "RISK_ASSESSMENT",
      },
    }),
  ]);
  return (
    <AppShell title="Gefährdungsbeurteilungen" description="Projektbezogene Beurteilungen am Rechner oder Tablet ausfüllen, unterschreiben und als PDF speichern.">
      <div className="mb-5">
        <SafetyTemplateFolderManager
          area="RISK_ASSESSMENT"
          folders={folders}
          templates={templates}
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Link className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm hover:border-gray-500" href="/safety/risk-assessments/general">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Fünf freigegebene Vorlagen</p>
          <h2 className="mt-2 text-xl font-bold text-black">Allgemeine Gefährdungsbeurteilungen</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">MuSchG, Bürotätigkeiten, Straßenwalze, Tiefbau und Asphaltbau digital ausfüllen und unterschreiben.</p>
          <span className="mt-5 inline-flex rounded-xl bg-gray-950 px-4 py-2 font-bold text-white">Vorlagen öffnen →</span>
        </Link>
        <Link className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm hover:border-gray-500" href="/safety/risk-assessments/templates">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Vorlagenverwaltung</p>
          <h2 className="mt-2 text-xl font-bold text-black">Weitere Vorlagen</h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">Zusätzliche allgemeine Vorlagen und spätere Revisionen verwalten.</p>
        </Link>
      </div>
    </AppShell>
  );
}
