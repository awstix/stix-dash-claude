import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { LiveSearchInput } from "@/components/LiveSearchInput";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { createKalkulationProject, deleteKalkulationProject } from "./actions";
import { DeleteProjectButton } from "./DeleteProjectButton";

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

export default async function KalkulationProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const searchQuery = String(q ?? "").trim();

  const [imports, aiSettings] = await Promise.all([
    prisma.kalkulationLvImport.findMany({
      select: { id: true, isFinalCalculation: true, projectNumber: true, sourceFormat: true },
    }),
    getAiSettings(),
  ]);
  const aiConfigured = isAiConfigured(aiSettings);

  // Drei feste Spalten pro Projekt, spiegelt die drei Kacheln der
  // Projekt-Detailseite (LV Angebotsabgabe / Kalkulation-Entwurf / Finale
  // Kalkulation - siehe [projectNumber]/page.tsx) - vorher gab es hier noch
  // eine eigene "Kalkuliertes LV"-Spalte für die nie genutzte lvType-
  // Aufteilung, die mit der Umbenennung dieser Kachel entfallen ist.
  const slotCountsByProject = new Map<
    string,
    { entwurfImportId: string | null; finalCount: number; lv: number }
  >();
  for (const item of imports) {
    if (!item.projectNumber) continue;
    const counts = slotCountsByProject.get(item.projectNumber) ?? { entwurfImportId: null, finalCount: 0, lv: 0 };
    if (item.sourceFormat === "RIB_KALKULATION") {
      if (item.isFinalCalculation) counts.finalCount += 1;
      else counts.entwurfImportId = item.id;
    } else {
      counts.lv += 1;
    }
    slotCountsByProject.set(item.projectNumber, counts);
  }

  // Für die Entwurfs-Spalte: "leer" vs. "X von Y kalkuliert", dieselbe
  // Erkennung wie der Badge auf der Projekt-Detailseite (ribBlockIsEmpty-
  // Logik in actions.ts) - nur für Projekte mit einem Entwurf, nicht für
  // jedes Projekt in der Liste.
  const entwurfFillCounts = new Map<string, { filled: number; total: number }>();
  await Promise.all(
    [...slotCountsByProject.values()]
      .map((counts) => counts.entwurfImportId)
      .filter((id): id is string => Boolean(id))
      .map(async (entwurfImportId) => {
        const [filled, total] = await Promise.all([
          prisma.kalkulationLvLineItem.count({
            where: {
              entryType: "ITEM",
              lvImportId: entwurfImportId,
              OR: [{ ribRawBlock: { contains: "#begin[_RIB_BstnA]" } }, { ribRawBlock: { contains: "#begin[_RIB_KoaA]" } }],
            },
          }),
          prisma.kalkulationLvLineItem.count({ where: { entryType: "ITEM", lvImportId: entwurfImportId } }),
        ]);
        entwurfFillCounts.set(entwurfImportId, { filled, total });
      }),
  );

  // Durchsucht Projektnummer/-name direkt UND - eine Ebene tiefer - Dateiname
  // sowie einzelne Positionen innerhalb der zugehörigen LVs (frühere
  // "Alle LV-Imports"-Suche, jetzt hier statt auf einer eigenen Seite).
  let where: Prisma.KalkulationProjectWhereInput = {};
  if (searchQuery) {
    const contentMatches = await prisma.kalkulationLvImport.findMany({
      select: { projectNumber: true },
      where: {
        projectNumber: { not: null },
        OR: [
          { fileName: { contains: searchQuery, mode: "insensitive" } },
          { customerName: { contains: searchQuery, mode: "insensitive" } },
          {
            lineItems: {
              some: {
                OR: [
                  { rawText: { contains: searchQuery, mode: "insensitive" } },
                  { shortText: { contains: searchQuery, mode: "insensitive" } },
                  { positionNumber: { contains: searchQuery, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
    });
    const matchingProjectNumbers = [
      ...new Set(contentMatches.map((m) => m.projectNumber).filter((v): v is string => Boolean(v))),
    ];

    where = {
      OR: [
        { projectNumber: { contains: searchQuery, mode: "insensitive" } },
        { tenderTitle: { contains: searchQuery, mode: "insensitive" } },
        ...(matchingProjectNumbers.length > 0 ? [{ projectNumber: { in: matchingProjectNumbers } }] : []),
      ],
    };
  }

  const projects = await prisma.kalkulationProject.findMany({ orderBy: { createdAt: "desc" }, where });

  return (
    <AppShell
      description="Bündelt LV, Kalkulations-Entwurf und finale Kalkulation je Bauvorhaben an einer Stelle."
      title="Kalkulation - Projekte"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/katalog"
        >
          Positionskatalog →
        </Link>
      </div>

      {!aiConfigured ? (
        <p className="mb-6 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          KI ist optional und noch nicht eingerichtet - der Abgleich über
          gelernte Zuordnungen sowie Import und manuelle Zuordnung
          funktionieren unabhängig davon.{" "}
          <Link className="underline" href="/admin/kalkulation-ai-settings">
            KI trotzdem einrichten
          </Link>
        </p>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Neues Projekt anlegen</h2>
        <form action={createKalkulationProject} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-gray-900">
            Projektnummer
            <input className={inputClass} name="projectNumber" required />
          </label>
          <label className="block text-sm font-semibold text-gray-900">
            Projektname (optional)
            <input className={inputClass} name="tenderTitle" />
          </label>
          <button
            className="w-fit rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 sm:col-span-2"
            type="submit"
          >
            Anlegen
          </button>
        </form>
      </section>

      <LiveSearchInput
        className="mt-6 w-full max-w-md rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        placeholder="Suche nach Projektnummer, Projektname, Dateiname oder Position..."
      />

      <section className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3">Projekt</th>
              <th className="p-3">LV / Angebotsabgabe</th>
              <th className="p-3">Kalkulation (Entwurf)</th>
              <th className="p-3">Finale Kalkulation</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const counts = slotCountsByProject.get(project.projectNumber) ?? {
                entwurfImportId: null,
                finalCount: 0,
                lv: 0,
              };
              const entwurfCounts = counts.entwurfImportId ? entwurfFillCounts.get(counts.entwurfImportId) : null;
              const entwurfLabel = !counts.entwurfImportId
                ? "–"
                : !entwurfCounts || entwurfCounts.total === 0
                  ? "leer"
                  : entwurfCounts.filled === 0
                    ? "leer"
                    : entwurfCounts.filled === entwurfCounts.total
                      ? "vollständig kalkuliert"
                      : `${entwurfCounts.filled} von ${entwurfCounts.total} kalkuliert`;
              return (
                <tr className="border-t border-gray-100" key={project.id}>
                  <td className="p-3">
                    <Link
                      className="font-semibold text-gray-900 hover:underline"
                      href={`/kalkulation/projects/${encodeURIComponent(project.projectNumber)}`}
                    >
                      {project.projectNumber}
                    </Link>
                    {project.tenderTitle ? <div className="text-xs text-gray-500">{project.tenderTitle}</div> : null}
                  </td>
                  <td className="p-3 font-semibold text-gray-900">{counts.lv > 0 ? `✓ (${counts.lv})` : "–"}</td>
                  <td className="p-3 font-semibold text-gray-900">{entwurfLabel}</td>
                  <td className="p-3 font-semibold text-gray-900">
                    {counts.finalCount > 0 ? `✓ (${counts.finalCount})` : "–"}
                  </td>
                  <td className="p-3">
                    <form action={deleteKalkulationProject}>
                      <input name="projectNumber" type="hidden" value={project.projectNumber} />
                      <DeleteProjectButton projectNumber={project.projectNumber} />
                    </form>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={5}>
                  {searchQuery ? `Keine Treffer für "${searchQuery}".` : "Noch keine Projekte angelegt."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
