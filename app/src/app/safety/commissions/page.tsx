import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import catalogJson from "@/lib/safety-commission-catalog.json";
import { prisma } from "@/lib/prisma";

import { SafetyTemplateFolderManager } from "../_components/SafetyTemplateFolderManager";

type CatalogEntry = {
  docxPath: string | null;
  folderCode: string;
  pdfPath: string;
  sections: string[];
  title: string;
};
const catalog = catalogJson as CatalogEntry[];

async function systemFolder(
  systemKey: string,
  name: string,
  parentId: string | null,
) {
  return prisma.safetyTemplateFolder.upsert({
    create: { area: "COMMISSION", name, parentId, systemKey },
    update: { isDeleted: false, name, parentId },
    where: { systemKey },
  });
}

async function synchronizeCommissionCatalog() {
  const root = await systemFolder(
    "commission-a-90",
    "A-90 · Beauftragungen",
    null,
  );
  const folderIds = new Map<string, string>();
  for (const [code, name] of [
    ["A-90-00", "A-90-00 · Bestellung SiFa + BA"],
    ["A-90-10", "A-90-10 · Beauftragung Bauleitung"],
    ["A-90-20", "A-90-20 · Beauftragung Polier"],
    ["A-90-30", "A-90-30 · Ersthelfer"],
    ["A-90-40", "A-90-40 · Brandschutzhelfer"],
    ["A-90-50", "A-90-50 · Sicherheitsbeauftragte"],
    ["A-90-60", "A-90-60 · Beauftragung Geräteführer"],
    ["A-90-100", "A-90-100 · Einarbeitungen"],
  ]) {
    const entry = await systemFolder(
      `commission-${code}`,
      name,
      root.id,
    );
    folderIds.set(code, entry.id);
  }
  for (const [code, name] of [
    ["A-90-60-001", "A-90-60-001 · Beauftragung Erdbaumaschinen"],
    ["A-90-60-002-STAPLER", "A-90-60-002 · Beauftragung Gabelstapler"],
    ["A-90-60-002-LKW", "A-90-60-002 · Beauftragung LKW-PKW"],
    ["A-90-60-003", "A-90-60-003 · Beauftragung Kranführer"],
    ["A-90-60-004", "A-90-60-004 · Beauftragung Hubarbeitsbühne"],
  ]) {
    const entry = await systemFolder(
      `commission-${code}`,
      name,
      folderIds.get("A-90-60")!,
    );
    folderIds.set(code, entry.id);
  }
  const existing = await prisma.safetyInstructionTemplate.findMany({
    select: { id: true, sourcePdfPath: true, title: true },
    where: { type: "COMMISSION" },
  });
  const bySource = new Map(
    existing
      .filter((entry) => entry.sourcePdfPath)
      .map((entry) => [entry.sourcePdfPath, entry]),
  );
  const byTitle = new Map(existing.map((entry) => [entry.title, entry]));
  await prisma.$transaction(
    catalog.map((entry, index) => {
      const data = {
        content: `SOURCE_PDF:${entry.pdfPath}${entry.docxPath ? `\nSOURCE_DOCX:${entry.docxPath}` : ""}`,
        description: entry.folderCode,
        folderId: folderIds.get(entry.folderCode),
        isActive: true,
        sectionsJson: JSON.stringify(entry.sections),
        sortOrder: index,
        sourceDocxPath: entry.docxPath,
        sourcePdfPath: entry.pdfPath,
        title: entry.title,
        type: "COMMISSION",
      };
      const current = bySource.get(entry.pdfPath) ?? byTitle.get(entry.title);
      return current
        ? prisma.safetyInstructionTemplate.update({
            data,
            where: { id: current.id },
          })
        : prisma.safetyInstructionTemplate.create({ data });
    }),
  );
}

export default async function SafetyCommissionsPage() {
  await synchronizeCommissionCatalog();
  const [folders, templates, records] = await Promise.all([
    prisma.safetyTemplateFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: { area: "COMMISSION", isDeleted: false },
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
      where: { folderId: { not: null }, type: "COMMISSION" },
    }),
    prisma.safetyInstructionRecord.findMany({
      include: {
        project: { select: { name: true, projectNumber: true } },
        template: { select: { title: true } },
      },
      orderBy: [{ instructionDate: "desc" }, { createdAt: "desc" }],
      take: 80,
      where: { template: { type: "COMMISSION" } },
    }),
  ]);
  return (
    <AppShell
      description="Beauftragungen am PC oder Tablet ausfüllen, direkt unterschreiben und in den Akten ablegen."
      title="Beauftragungen"
    >
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-950">A-90 Vorlagen</h2>
          <p className="mt-1 text-sm text-gray-600">
            {catalog.length} freigegebene Beauftragungen
          </p>
        </div>
        <Link
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700"
          href="/safety"
        >
          ← Arbeitssicherheit
        </Link>
      </section>
      <SafetyTemplateFolderManager
        area="COMMISSION"
        folders={folders}
        templates={templates}
      />
      <section className="mt-6">
        <h2 className="mb-4 text-xl font-bold text-gray-950">
          Laufende und abgeschlossene Beauftragungen
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-300 bg-white">
          <table className="min-w-[850px] w-full text-left text-sm text-black">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3">Beauftragung</th>
                <th className="p-3">Datum</th>
                <th className="p-3">Projekt</th>
                <th className="p-3">Status</th>
                <th className="p-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-gray-200" key={record.id}>
                  <td className="p-3 font-semibold">{record.template.title}</td>
                  <td className="p-3">
                    {record.instructionDate.toLocaleDateString("de-DE")}
                  </td>
                  <td className="p-3">
                    {record.project
                      ? `${record.project.projectNumber} · ${record.project.name}`
                      : "–"}
                  </td>
                  <td className="p-3">
                    {record.status === "SIGNED" ? "Abgeschlossen" : "Offen"}
                  </td>
                  <td className="p-3">
                    <Link
                      className="rounded-lg border border-gray-300 px-3 py-2 font-bold"
                      href={`/safety/instruction-records/${record.id}`}
                    >
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
              {!records.length ? (
                <tr>
                  <td className="p-6 text-center text-gray-600" colSpan={5}>
                    Noch keine Beauftragung durchgeführt.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
