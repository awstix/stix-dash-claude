import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { LiveSearchInput } from "@/components/LiveSearchInput";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { createKalkulationProject } from "./actions";

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
      select: { lvType: true, projectNumber: true, sourceFormat: true },
    }),
    getAiSettings(),
  ]);
  const aiConfigured = isAiConfigured(aiSettings);

  // Drei feste Spalten pro Projekt (LV/Angebotsanfrage, RIB-Kalkulation,
  // kalkuliertes LV) - hier nur als Trefferzahl je Spalte, damit man auf
  // einen Blick sieht, was für ein Projekt schon vorhanden ist. Immer über
  // ALLE Imports berechnet, unabhängig von der Suche.
  const slotCountsByProject = new Map<string, { angebot: number; kalkulation: number; lv: number }>();
  for (const item of imports) {
    if (!item.projectNumber) continue;
    const counts = slotCountsByProject.get(item.projectNumber) ?? { angebot: 0, kalkulation: 0, lv: 0 };
    if (item.sourceFormat === "RIB_KALKULATION") counts.kalkulation += 1;
    else if (item.lvType === "ANGEBOT" || item.lvType === "AUFTRAG") counts.angebot += 1;
    else counts.lv += 1;
    slotCountsByProject.set(item.projectNumber, counts);
  }

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
      description="Bündelt LV/Angebotsanfrage, RIB-Urkalkulation und kalkuliertes LV je Bauvorhaben an einer Stelle."
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
              <th className="p-3">LV / Angebotsanfrage</th>
              <th className="p-3">Kalkulation (D31)</th>
              <th className="p-3">Kalkuliertes LV</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const counts = slotCountsByProject.get(project.projectNumber) ?? { angebot: 0, kalkulation: 0, lv: 0 };
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
                  <td className="p-3">{counts.lv > 0 ? `✓ (${counts.lv})` : "–"}</td>
                  <td className="p-3">{counts.kalkulation > 0 ? `✓ (${counts.kalkulation})` : "–"}</td>
                  <td className="p-3">{counts.angebot > 0 ? `✓ (${counts.angebot})` : "–"}</td>
                </tr>
              );
            })}
            {projects.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>
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
