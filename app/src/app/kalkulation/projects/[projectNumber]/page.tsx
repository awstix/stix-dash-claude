import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { ImportForm } from "@/components/ImportForm";
import { ProjectFileDropInput } from "@/app/projects/ProjectFileDropInput";
import { prisma } from "@/lib/prisma";
import { deleteImport, importLv, suggestAnsaetzeFromHistory } from "../../imports/actions";
import { DeleteImportButton } from "../../imports/DeleteImportButton";
import { LvReviewPanel } from "../../imports/LvReviewPanel";

type LvImportRow = Prisma.KalkulationLvImportGetPayload<Record<string, never>>;

/** Kompakte Kopf-Kachel je Zeile - zeigt entweder die hochgeladene Datei
 * (mit Löschen-Icon) oder ein kleines Upload-Feld, wenn die Zeile noch
 * leer ist. Drei davon nebeneinander statt einer großen Karte pro Zeile. */
function ProjectSlot({
  accept,
  emptyLabel,
  extraEmptyContent,
  imports,
  projectNumber,
  returnTo,
  tenderTitle,
  title,
}: {
  accept: string;
  emptyLabel: string;
  extraEmptyContent?: ReactNode;
  imports: LvImportRow[];
  projectNumber: string;
  returnTo: string;
  tenderTitle: string | null;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>

      {imports.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {imports.map((item) => (
            <li className="flex items-center justify-between gap-2" key={item.id}>
              <Link
                className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 hover:underline"
                href={`/kalkulation/imports/${item.id}`}
                title={item.fileName}
              >
                {item.fileName}
              </Link>
              <form action={deleteImport}>
                <input name="importId" type="hidden" value={item.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <DeleteImportButton fileName={item.fileName} />
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <ImportForm action={importLv} className="mt-2" progressEndpoint="/kalkulation/imports/progress">
          <input name="projectNumber" type="hidden" value={projectNumber} />
          <input name="tenderTitle" type="hidden" value={tenderTitle ?? ""} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <ProjectFileDropInput
            accept={accept}
            compact
            emptyLabel={emptyLabel}
            name="file"
            required
            selectedLabel="Datei auswählen"
          />
          <button
            className="mt-2 w-full rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Hochladen
          </button>
        </ImportForm>
      )}
      {imports.length === 0 ? extraEmptyContent : null}
    </section>
  );
}

export default async function KalkulationProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectNumber: string }>;
  searchParams: Promise<{ crossLv?: string; importError?: string }>;
}) {
  const { projectNumber: encodedProjectNumber } = await params;
  const projectNumber = decodeURIComponent(encodedProjectNumber);
  const { crossLv, importError } = await searchParams;

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

  // Reihenfolge für die eingebetteten Abgleich-Panels darunter: erst das
  // unbepreiste LV, dann die Kalkulation, dann das kalkulierte LV - jedes
  // vorhandene direkt mit vollständiger Positionstabelle und allen
  // Abgleich-Werkzeugen, ohne dass man dafür extra klicken muss.
  const orderedImports = [...lvImports, ...kalkulationImports, ...angebotImports];

  const returnTo = `/kalkulation/projects/${encodeURIComponent(projectNumber)}`;

  return (
    <AppShell description={project.tenderTitle ?? undefined} title={`Projekt ${project.projectNumber}`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/projects"
        >
          ← Alle Projekte
        </Link>
      </div>

      {importError ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          Import fehlgeschlagen: {importError}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <ProjectSlot
          accept=".x81,.x83,.x84,.d81,.d83,.d84,.xlsx,.xls"
          emptyLabel="LV hierher ziehen (D83/X83)"
          imports={lvImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="LV Angebotsabgabe (D83/X83)"
        />
        <ProjectSlot
          accept=".xml"
          emptyLabel=".XML hierher ziehen"
          extraEmptyContent={
            lvImports.length > 0 ? (
              <form action={suggestAnsaetzeFromHistory} className="mt-2 border-t border-gray-100 pt-2">
                <input name="projectNumber" type="hidden" value={project.projectNumber} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <button
                  className="w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  title="Sucht für jede Position im hochgeladenen LV die ähnlichsten Kalkulationsansätze aus anderen Projekten - als Vorschlag, jede Position einzeln bestätigbar"
                  type="submit"
                >
                  Ansätze aus anderen Projekten vorschlagen
                </button>
              </form>
            ) : null
          }
          imports={kalkulationImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Kalkulation (XML)"
        />
        <ProjectSlot
          accept=".x81,.x83,.x84,.d81,.d83,.d84,.xlsx,.xls"
          emptyLabel="LV hierher ziehen (D81/X81)"
          imports={angebotImports}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Kalkuliertes LV (D81/X81)"
        />
      </div>

      {orderedImports.length > 0 ? (
        <div className="mt-6 space-y-8">
          {orderedImports.map((item) => (
            <div key={item.id}>
              <h2 className="mb-2 text-sm font-bold text-gray-900">
                {item.fileName}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {item.rowCount} Positionen ·{" "}
                  {item.crossLvMatchedAt
                    ? `abgeglichen am ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "Europe/Berlin" }).format(item.crossLvMatchedAt)}`
                    : "noch nicht abgeglichen"}
                </span>
              </h2>
              <LvReviewPanel
                crossLvToggleHref={`${returnTo}?crossLv=${item.id}`}
                importId={item.id}
                returnTo={returnTo}
                showCrossLvMatches={crossLv === item.id}
              />
            </div>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
