import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { deleteImport } from "../actions";
import { DeleteImportButton } from "../DeleteImportButton";
import { LvReviewPanel } from "../LvReviewPanel";
import { formatLvSource } from "@/lib/kalkulation-format";

const LV_TYPE_LABELS: Record<string, string> = {
  ANGEBOT: "Angebot (gepreist)",
  AUFTRAG: "Auftrag",
  AUSSCHREIBUNG: "Ausschreibung (ungepreist)",
};

export default async function KalkulationImportReviewPage({
  params,
}: {
  params: Promise<{ importId: string }>;
}) {
  const { importId } = await params;

  const [lvImport, aiSettings] = await Promise.all([
    prisma.kalkulationLvImport.findUnique({ where: { id: importId } }),
    getAiSettings(),
  ]);

  if (!lvImport) notFound();

  // Andere Imports desselben Projekts (z.B. erst die ungepreiste
  // Ausschreibung, später das eigene kalkulierte Angebot dazu) - verknüpft
  // rein über die Projektnummer, kein eigenes Datenfeld nötig.
  const relatedImports = lvImport.projectNumber
    ? await prisma.kalkulationLvImport.findMany({
        where: { projectNumber: lvImport.projectNumber, id: { not: importId } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const aiConfigured = isAiConfigured(aiSettings);
  const projectLabel = [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" – ");
  const prefillParams = new URLSearchParams();
  if (lvImport.projectNumber) prefillParams.set("prefillProjectNumber", lvImport.projectNumber);
  if (lvImport.tenderTitle) prefillParams.set("prefillTenderTitle", lvImport.tenderTitle);

  return (
    <AppShell
      description={projectLabel ? `${lvImport.fileName} · ${projectLabel}` : lvImport.fileName}
      title="LV-Abgleich"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/imports"
        >
          ← Alle Imports
        </Link>

        {lvImport.projectNumber ? (
          <Link
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            href={`/kalkulation/projects/${encodeURIComponent(lvImport.projectNumber)}`}
          >
            → Zur Projektseite
          </Link>
        ) : null}

        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/kalkulation/imports?${prefillParams.toString()}`}
          title="Legt einen zweiten, mit diesem Projekt verknüpften Import an"
        >
          Kalkuliertes Angebot nachreichen →
        </Link>

        {!aiConfigured ? (
          <span className="text-sm text-amber-800">
            KI nicht konfiguriert (optional) -{" "}
            <Link className="underline" href="/admin/kalkulation-ai-settings">
              einrichten
            </Link>
          </span>
        ) : null}
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900">Imports zu diesem Projekt</h2>
        <p className="mt-1 text-xs text-gray-500">
          Löschen geht hier direkt je Import - z.B. um ein nachgereichtes kalkuliertes Angebot wieder zu entfernen.
        </p>
        <ul className="mt-3 divide-y divide-gray-100">
          <li className="flex flex-wrap items-center justify-between gap-3 py-2">
            <div>
              <span className="text-sm font-semibold text-gray-900">{lvImport.fileName}</span>
              <span className="ml-2 text-xs text-gray-500">
                {formatLvSource(lvImport)} · {LV_TYPE_LABELS[lvImport.lvType] ?? lvImport.lvType}
              </span>
            </div>
            <form action={deleteImport}>
              <input name="importId" type="hidden" value={importId} />
              <DeleteImportButton fileName={lvImport.fileName} />
            </form>
          </li>
          {relatedImports.map((related) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-2" key={related.id}>
              <div>
                <Link className="text-sm font-semibold text-gray-900 hover:underline" href={`/kalkulation/imports/${related.id}`}>
                  {related.fileName}
                </Link>
                <span className="ml-2 text-xs text-gray-500">
                  {formatLvSource(related)} · {LV_TYPE_LABELS[related.lvType] ?? related.lvType}
                </span>
              </div>
              <form action={deleteImport}>
                <input name="importId" type="hidden" value={related.id} />
                <input name="returnTo" type="hidden" value={`/kalkulation/imports/${importId}`} />
                <DeleteImportButton fileName={related.fileName} />
              </form>
            </li>
          ))}
        </ul>
      </section>

      <LvReviewPanel importId={importId} />
    </AppShell>
  );
}
