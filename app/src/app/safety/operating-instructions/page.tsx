import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { SafetyTemplateFolderManager } from "../_components/SafetyTemplateFolderManager";
import { SafetyParticipantSummary } from "../_components/SafetyParticipantSummary";
import catalogJson from "@/lib/operating-instruction-catalog.json";
import { prisma } from "@/lib/prisma";

type CatalogEntry = {
  category: string;
  categoryCode: string;
  date: string | null;
  docxPath: string | null;
  pdfPath: string;
  sections: string[];
  title: string;
};

const catalog = catalogJson as CatalogEntry[];

async function synchronizeCatalog() {
  const specialFolders = new Map<string, string>();
  for (const [systemKey, name] of [
    ["safety-a-30-00-handschuhplan", "A-30-00 · Handschuhplan"],
    ["safety-a-30-00-hautschutzplan", "A-30-00 · Hautschutzplan"],
    ["safety-a-30-20", "A-30-20 · Baustellenordnungen"],
    ["safety-a-30-30", "A-30-30 · Checklisten"],
  ] as const) {
    const folder = await prisma.safetyTemplateFolder.upsert({
      create: {
        area: "OPERATING_INSTRUCTION",
        name,
        systemKey,
      },
      update: {},
      where: { systemKey },
    });
    if (systemKey === "safety-a-30-20") {
      specialFolders.set("A-30-20", folder.id);
    }
  }
  const rootFolder = await prisma.safetyTemplateFolder.upsert({
    create: {
      area: "OPERATING_INSTRUCTION",
      name: "A-30-10 · Betriebsanweisungen",
      systemKey: "operating-instructions-root",
    },
    update: {},
    where: { systemKey: "operating-instructions-root" },
  });
  await prisma.safetyTemplateFolder.upsert({
    create: {
      area: "OPERATING_INSTRUCTION",
      name: "A-30-10 · BA_Archiv",
      parentId: rootFolder.id,
      systemKey: "operating-instructions-archive",
    },
    update: {},
    where: { systemKey: "operating-instructions-archive" },
  });
  const hazardRoot = await prisma.safetyTemplateFolder.upsert({
    create: {
      area: "OPERATING_INSTRUCTION",
      name: "A-30-19 · Gefahrstoffe",
      systemKey: "operating-instructions-a-30-19",
    },
    update: {},
    where: { systemKey: "operating-instructions-a-30-19" },
  });
  for (const [systemKey, name] of [
    ["operating-instructions-a-30-19-00", "A-30-19-00 · Schriftverkehr"],
    ["operating-instructions-a-30-19-01", "A-30-19-01 · GSK-Auszüge"],
    [
      "operating-instructions-a-30-19-1",
      "A-30-19-1 · Gefahrgut transportieren",
    ],
    [
      "operating-instructions-a-30-19-ba",
      "Betriebsanweisungen",
    ],
  ] as const) {
    const folder = await prisma.safetyTemplateFolder.upsert({
      create: {
        area: "OPERATING_INSTRUCTION",
        name,
        parentId: hazardRoot.id,
        systemKey,
      },
      update:
        systemKey === "operating-instructions-a-30-19-ba"
          ? { isDeleted: false, name, parentId: hazardRoot.id }
          : { name, parentId: hazardRoot.id },
      where: { systemKey },
    });
    if (systemKey === "operating-instructions-a-30-19-ba") {
      specialFolders.set("A-30-19", folder.id);
    }
  }
  const categoryFolders = new Map<string, string>(specialFolders);
  for (const entry of catalog) {
    if (categoryFolders.has(entry.categoryCode)) continue;
    const folder = await prisma.safetyTemplateFolder.upsert({
      create: {
        area: "OPERATING_INSTRUCTION",
        name: `${entry.categoryCode} · ${entry.category}`,
        parentId: rootFolder.id,
        systemKey: `operating-instructions-${entry.categoryCode.toLowerCase()}`,
      },
      update: {},
      where: {
        systemKey: `operating-instructions-${entry.categoryCode.toLowerCase()}`,
      },
    });
    categoryFolders.set(entry.categoryCode, folder.id);
  }
  const existing = await prisma.safetyInstructionTemplate.findMany({
    select: { id: true, sourcePdfPath: true, title: true },
    where: { type: "OPERATING_INSTRUCTION" },
  });
  const byTitle = new Map(existing.map((template) => [template.title, template]));
  const bySourcePdfPath = new Map(
    existing
      .filter((template) => template.sourcePdfPath)
      .map((template) => [template.sourcePdfPath, template]),
  );

  await prisma.$transaction(
    catalog.map((entry, index) => {
      const data = {
        content: `SOURCE_PDF:${entry.pdfPath}${entry.docxPath ? `\nSOURCE_DOCX:${entry.docxPath}` : ""}`,
        description: `${entry.categoryCode} · ${entry.category}${entry.date ? ` · Stand ${entry.date}` : ""}`,
        folderId: categoryFolders.get(entry.categoryCode),
        isActive: true,
        sectionsJson: JSON.stringify(entry.sections),
        sourceDocxPath: entry.docxPath,
        sourcePdfPath: entry.pdfPath,
        sortOrder: index,
        title: entry.title,
        type: "OPERATING_INSTRUCTION",
      };
      const current =
        bySourcePdfPath.get(entry.pdfPath) ?? byTitle.get(entry.title);
      return current
        ? prisma.safetyInstructionTemplate.update({
            data,
            where: { id: current.id },
          })
        : prisma.safetyInstructionTemplate.create({ data });
    }),
  );
}

export default async function OperatingInstructionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  await synchronizeCatalog();
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLocaleLowerCase("de");
  const [records, customFolders, customTemplates] = await Promise.all([
    prisma.safetyInstructionRecord.findMany({
      include: {
        _count: { select: { signatures: true } },
        project: { select: { name: true, projectNumber: true } },
        signatures: {
          select: { employeeName: true, signatureDataUrl: true },
        },
        template: { select: { title: true } },
      },
      orderBy: [{ instructionDate: "desc" }, { createdAt: "desc" }],
      take: 80,
      where: { template: { type: "OPERATING_INSTRUCTION" } },
    }),
    prisma.safetyTemplateFolder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: { area: "OPERATING_INSTRUCTION", isDeleted: false },
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
        type: "OPERATING_INSTRUCTION",
      },
    }),
  ]);
  const visibleTemplates = query
    ? customTemplates.filter((template) =>
        template.title.toLocaleLowerCase("de").includes(query),
      )
    : customTemplates;

  return (
    <AppShell
      description="Originale Betriebsanweisungen öffnen, projektbezogen unterweisen und von Mitarbeitern digital unterschreiben lassen."
      title="Betriebsanweisungen"
    >
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950">
              Vorlagenkatalog
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {catalog.length} freigegebene Betriebsanweisungen
            </p>
          </div>
          <Link
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700"
            href="/safety"
          >
            ← Arbeitssicherheit
          </Link>
        </div>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-gray-950"
            defaultValue={params.q}
            name="q"
            placeholder="Betriebsanweisung suchen …"
          />
          <button
            className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white"
            type="submit"
          >
            Suchen
          </button>
        </form>
      </section>

      <div className="mt-6">
        <SafetyTemplateFolderManager
          area="OPERATING_INSTRUCTION"
          folders={customFolders}
          templates={visibleTemplates}
        />
      </div>

      <section className="mt-6">
        <h2 className="mb-4 text-xl font-bold text-gray-900">
          Laufende und abgeschlossene Unterweisungen
        </h2>
        {records.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white">
            <p className="p-8 text-center text-sm text-gray-600">
              Noch keine Betriebsunterweisung durchgeführt.
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
                  <th className="p-3">Unterwiesene Person(en)</th>
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
                        {record.template.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Betriebsanweisung
                      </p>
                    </td>
                    <td className="p-3">
                      <SafetyParticipantSummary
                        names={record.signatures.map(
                          (signature) => signature.employeeName,
                        )}
                      />
                    </td>
                    <td className="p-3">
                      {record.instructionDate.toLocaleDateString("de-DE")}
                    </td>
                    <td className="p-3">
                      {record.project
                        ? `${record.project.projectNumber} · ${record.project.name}`
                        : record.projectSnapshot || "Ohne Projekt"}
                    </td>
                    <td className="p-3">
                      {record.status === "SIGNED"
                        ? "Abgeschlossen"
                        : "Unterschriften offen"}
                    </td>
                    <td className="p-3">
                      {
                        record.signatures.filter((signature) =>
                          Boolean(signature.signatureDataUrl),
                        ).length
                      }
                      /{record._count.signatures}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                          href={`/safety/instruction-records/${record.id}`}
                        >
                          Öffnen
                        </Link>
                        <a
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                          href={`/safety/instruction-records/${record.id}/pdf`}
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
