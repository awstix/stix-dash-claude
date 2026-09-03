import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { ImportForm } from "@/components/ImportForm";
import { ProjectFileDropInput } from "@/app/projects/ProjectFileDropInput";
import { prisma } from "@/lib/prisma";
import { deleteImport, importLv } from "../../imports/actions";
import { DeleteImportButton } from "../../imports/DeleteImportButton";

type LvImportRow = Prisma.KalkulationLvImportGetPayload<Record<string, never>>;

const STATUS_LABELS: Record<string, string> = {
  IMPORTED: "Importiert",
  MATCHING: "Abgleich läuft",
  REVIEWED: "Geprüft",
};

function ProjectSlot({
  accept,
  emptyLabel,
  hint,
  imports,
  projectNumber,
  returnTo,
  tenderTitle,
  title,
}: {
  accept: string;
  emptyLabel: string;
  hint: string;
  imports: LvImportRow[];
  projectNumber: string;
  returnTo: string;
  tenderTitle: string | null;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{hint}</p>

      {imports.length > 0 ? (
        <ul className="mt-3 divide-y divide-gray-100">
          {imports.map((item) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-2" key={item.id}>
              <div>
                <Link className="text-sm font-semibold text-gray-900 hover:underline" href={`/kalkulation/imports/${item.id}`}>
                  {item.fileName}
                </Link>
                <span className="ml-2 text-xs text-gray-500">
                  {item.rowCount} Positionen · {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
              <form action={deleteImport}>
                <input name="importId" type="hidden" value={item.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <DeleteImportButton fileName={item.fileName} />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-400">Noch nicht hochgeladen.</p>
      )}

      <ImportForm action={importLv} className="mt-4" progressEndpoint="/kalkulation/imports/progress">
        <input name="projectNumber" type="hidden" value={projectNumber} />
        <input name="tenderTitle" type="hidden" value={tenderTitle ?? ""} />
        <ProjectFileDropInput
          accept={accept}
          emptyLabel={emptyLabel}
          name="file"
          required
          selectedLabel="Datei auswählen"
        />
        <button className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700" type="submit">
          Hochladen
        </button>
      </ImportForm>
    </section>
  );
}

export default async function KalkulationProjectPage({
  params,
}: {
  params: Promise<{ projectNumber: string }>;
}) {
  const { projectNumber: encodedProjectNumber } = await params;
  const projectNumber = decodeURIComponent(encodedProjectNumber);

  const [project, imports] = await Promise.all([
    prisma.kalkulationProject.findUnique({ where: { projectNumber } }),
    prisma.kalkulationLvImport.findMany({
      orderBy: { createdAt: "desc" },
      where: { projectNumber },
    }),
  ]);

  if (!project) notFound();

  // Drei feste Zeilen statt einer freien Liste - Zuordnung läuft über
  // sourceFormat (RIB-Kalkulation hat ein eigenes Format) bzw. lvType
  // (bepreist vs. unbepreist), nicht über eine eigene Kennzeichnung beim
  // Import, damit bestehende Imports ohne Änderung reinfallen.
  const kalkulationImports = imports.filter((item) => item.sourceFormat === "RIB_KALKULATION");
  const angebotImports = imports.filter(
    (item) => item.sourceFormat !== "RIB_KALKULATION" && (item.lvType === "ANGEBOT" || item.lvType === "AUFTRAG"),
  );
  const lvImports = imports.filter(
    (item) => item.sourceFormat !== "RIB_KALKULATION" && item.lvType !== "ANGEBOT" && item.lvType !== "AUFTRAG",
  );

  const returnTo = `/kalkulation/projects/${encodeURIComponent(projectNumber)}`;

  return (
    <AppShell description={project.tenderTitle ?? undefined} title={`Projekt ${project.projectNumber}`}>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/projects"
        >
          ← Alle Projekte
        </Link>
      </div>

      <div className="space-y-4">
        <ProjectSlot
          accept=".x81,.x83,.x84,.d81,.d83,.d84,.xlsx,.xls"
          emptyLabel="GAEB (.x81/.x83/.x84/.d81/.d83/.d84) oder Excel (.xlsx/.xls) hierher ziehen oder klicken"
          hint="Unbepreistes Leistungsverzeichnis - welche GAEB-Endung genau (X81 oder X83) hängt von eurer AVA-Software ab, erkannt wird anhand des Inhalts, nicht der Endung."
          imports={lvImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="LV / Angebotsanfrage"
        />
        <ProjectSlot
          accept=".d31"
          emptyLabel=".D31 hierher ziehen oder klicken"
          hint="RIB iTWO-Urkalkulation mit den Kalkulationsansätzen je Position (kein berechneter Preis)"
          imports={kalkulationImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Kalkulation (D31)"
        />
        <ProjectSlot
          accept=".x81,.x83,.x84,.d81,.d83,.d84,.xlsx,.xls"
          emptyLabel="GAEB (.x81/.x83/.x84/.d81/.d83/.d84) oder Excel (.xlsx/.xls) hierher ziehen oder klicken"
          hint="Bepreistes Angebot - welche GAEB-Endung genau (X81 oder X83) hängt von eurer AVA-Software ab, erkannt wird anhand des Inhalts, nicht der Endung."
          imports={angebotImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Kalkuliertes LV"
        />
      </div>
    </AppShell>
  );
}
