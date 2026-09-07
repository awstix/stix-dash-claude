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
  extraFormFields,
  helpText,
  imports,
  itemBadge,
  projectNumber,
  returnTo,
  tenderTitle,
  title,
}: {
  accept: string;
  emptyLabel: string;
  extraEmptyContent?: ReactNode;
  extraFormFields?: ReactNode;
  helpText?: ReactNode;
  imports: LvImportRow[];
  itemBadge?: (item: LvImportRow) => ReactNode;
  projectNumber: string;
  returnTo: string;
  tenderTitle: string | null;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>

      {imports.length === 0 && helpText ? <div className="mt-2">{helpText}</div> : null}

      {imports.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {imports.map((item) => (
            <li className="flex items-center justify-between gap-2" key={item.id}>
              <div className="min-w-0 flex-1">
                <Link
                  className="block truncate text-sm font-semibold text-gray-900 hover:underline"
                  href={`/kalkulation/imports/${item.id}`}
                  title={item.fileName}
                >
                  {item.fileName}
                </Link>
                {itemBadge ? itemBadge(item) : null}
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
          {extraFormFields}
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

  // Zwei feste Zeilen für Kalkulationen (Entwurf vs. finale, verifizierte
  // Referenz - siehe isFinalCalculation) plus eine für alles andere (LV/
  // Angebot/Auftrag als GAEB oder Excel). Die frühere Drei-Wege-Aufteilung
  // nach lvType (unbepreist vs. bepreist) wurde entfernt - die dafür
  // gedachte Kachel "Kalkuliertes LV" wurde nie genutzt (0 Imports in der
  // Praxis) und ihre Bezeichnung (D81/X81, eigentlich das UNbepreiste
  // GAEB-Format) war ohnehin irreführend.
  const kalkulationImports = imports.filter((item) => item.sourceFormat === "RIB_KALKULATION" && !item.isFinalCalculation);
  const finalKalkulationImports = imports.filter((item) => item.sourceFormat === "RIB_KALKULATION" && item.isFinalCalculation);
  const lvImports = imports.filter((item) => item.sourceFormat !== "RIB_KALKULATION");

  // Reihenfolge für die eingebetteten Abgleich-Panels darunter: erst das
  // LV, dann der Kalkulations-Entwurf, dann die finale Kalkulation - jedes
  // vorhandene direkt mit vollständiger Positionstabelle und allen
  // Abgleich-Werkzeugen, ohne dass man dafür extra klicken muss.
  const orderedImports = [...lvImports, ...kalkulationImports, ...finalKalkulationImports];

  // "Leer" (Skelett ohne Ansätze, z.B. frisch aus iTWO exportiert) vs.
  // "kalkuliert" wird nicht als eigenes Feld beim Upload abgefragt (zu
  // fehleranfällig, wenn man es vergisst umzustellen), sondern direkt aus
  // dem Inhalt abgeleitet: enthält mindestens eine Position bereits einen
  // Baustein- oder Kostenart-Ansatz, gilt die Datei als (teilweise)
  // kalkuliert. Gleiche Erkennungslogik wie ribBlockIsEmpty in actions.ts.
  const kalkulationFillCounts = new Map<string, { filled: number; total: number }>();
  await Promise.all(
    [...kalkulationImports, ...finalKalkulationImports].map(async (item) => {
      const [filled, total] = await Promise.all([
        prisma.kalkulationLvLineItem.count({
          where: {
            entryType: "ITEM",
            lvImportId: item.id,
            OR: [{ ribRawBlock: { contains: "#begin[_RIB_BstnA]" } }, { ribRawBlock: { contains: "#begin[_RIB_KoaA]" } }],
          },
        }),
        prisma.kalkulationLvLineItem.count({ where: { entryType: "ITEM", lvImportId: item.id } }),
      ]);
      kalkulationFillCounts.set(item.id, { filled, total });
    }),
  );

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
          emptyLabel="Leere XML hierher ziehen"
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
          helpText={
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-[11px] leading-relaxed text-blue-900">
              <p className="font-semibold">So kommst du zur vorkalkulierten XML:</p>
              <ol className="ml-4 list-decimal space-y-0.5">
                <li>Leere Kalkulations-XML aus iTWO exportieren (Positions-Skelett, noch ohne Ansätze) und hier hochladen.</li>
                <li>Oben im LV auf &quot;Ansätze aus anderen Projekten vorschlagen&quot; klicken.</li>
                <li>Vorschläge prüfen und bestätigen.</li>
                <li>Vorkalkulierte XML oben im LV exportieren und in iTWO einlesen.</li>
              </ol>
              <p className="mt-1 text-blue-700">
                Nach der echten Fertigstellung in iTWO: die fertig kalkulierte XML in der Kachel &quot;Finale
                Kalkulation&quot; daneben hochladen - erst die dortige Datei fließt in Ansatz-Vorschläge für
                andere Projekte ein.
              </p>
            </div>
          }
          imports={kalkulationImports}
          itemBadge={(item) => {
            const counts = kalkulationFillCounts.get(item.id);
            if (!counts || counts.total === 0) return null;
            const label =
              counts.filled === 0
                ? "leer · bereit für Ansätze-Vorschläge"
                : counts.filled === counts.total
                  ? "vollständig kalkuliert (Entwurf)"
                  : `${counts.filled} von ${counts.total} Positionen kalkuliert (Entwurf)`;
            const colorClass = counts.filled === 0 ? "text-gray-500" : "text-amber-700";
            return <p className={`text-[11px] font-medium ${colorClass}`}>{label}</p>;
          }}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Kalkulation (XML) - Entwurf"
        />
        <ProjectSlot
          accept=".xml"
          emptyLabel="Finale Kalkulation hierher ziehen"
          extraFormFields={<input name="isFinalCalculation" type="hidden" value="on" />}
          helpText={
            <p className="rounded-lg border border-green-100 bg-green-50 p-2 text-[11px] leading-relaxed text-green-900">
              Hier kommt die in iTWO fertig kalkulierte XML rein, nachdem der Entwurf links wirklich
              fertiggestellt wurde. Nur diese Datei zählt als Referenz für Ansatz-Vorschläge bei anderen
              Projekten - ein noch unbestätigter Entwurf fließt dort nicht ein.
            </p>
          }
          imports={finalKalkulationImports}
          itemBadge={(item) => {
            const counts = kalkulationFillCounts.get(item.id);
            if (!counts || counts.total === 0) return null;
            return <p className="text-[11px] font-semibold text-green-700">✓ Finale Kalkulation</p>;
          }}
          projectNumber={project.projectNumber}
          returnTo={returnTo}
          tenderTitle={project.tenderTitle}
          title="Finale Kalkulation (XML)"
        />
      </div>

      {orderedImports.length > 0 ? (
        <div className="mt-6 space-y-8">
          {orderedImports.map((item) => {
            // Die Kalkulations-Kachel ist jetzt bewusst eingeklappt: seit
            // "Ansätze aus anderen Projekten vorschlagen" und "Als XML
            // exportieren" auch direkt oben im LV-Panel verfügbar sind
            // (siehe LvReviewPanel.tsx), braucht es die volle Tabelle hier
            // nur noch zur Kontrolle, nicht mehr für die eigentliche Arbeit.
            if (item.sourceFormat === "RIB_KALKULATION") {
              const counts = kalkulationFillCounts.get(item.id);
              return (
                <details className="rounded-2xl border border-gray-200 bg-white p-3" key={item.id}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-bold text-gray-900">
                    {item.fileName}
                    <span className="text-xs font-normal text-gray-500">
                      {counts
                        ? item.isFinalCalculation
                          ? "✓ Finale Kalkulation"
                          : `${counts.filled} von ${counts.total} Positionen kalkuliert (Entwurf)`
                        : `${item.rowCount} Positionen`}
                    </span>
                    {counts && counts.filled > 0 ? (
                      <a
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        href={`/kalkulation/imports/${item.id}/export-xml`}
                        title="Exportiert die Kalkulationsansätze dieses Imports als .xml - zum Wiedereinlesen in iTWO"
                      >
                        {item.isFinalCalculation ? "Finale XML exportieren ↓" : "Vorkalkulierte XML exportieren ↓"}
                      </a>
                    ) : null}
                  </summary>
                  <div className="mt-3">
                    <LvReviewPanel
                      crossLvToggleHref={`${returnTo}?crossLv=${item.id}`}
                      importId={item.id}
                      returnTo={returnTo}
                      showCrossLvMatches={crossLv === item.id}
                    />
                  </div>
                </details>
              );
            }

            return (
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
            );
          })}
        </div>
      ) : null}
    </AppShell>
  );
}
