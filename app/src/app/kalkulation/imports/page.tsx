import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ImportForm } from "@/components/ImportForm";
import { ProjectFileDropInput } from "@/app/projects/ProjectFileDropInput";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { importLv } from "./actions";

export const maxDuration = 300;

const LV_TYPE_LABELS: Record<string, string> = {
  ANGEBOT: "Angebot (gepreist)",
  AUFTRAG: "Auftrag",
  AUSSCHREIBUNG: "Ausschreibung (ungepreist)",
};

export default async function KalkulationImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ importError?: string }>;
}) {
  const [imports, aiSettings, params] = await Promise.all([
    prisma.kalkulationLvImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getAiSettings(),
    searchParams,
  ]);

  const aiConfigured = isAiConfigured(aiSettings);

  return (
    <AppShell
      description="Leistungsverzeichnisse (GAEB oder Excel) importieren und gegen den Positionskatalog abgleichen."
      title="LV-Import"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/katalog"
        >
          Positionskatalog →
        </Link>
      </div>

      {params.importError ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          Import fehlgeschlagen: {params.importError}
        </div>
      ) : null}

      {!aiConfigured ? (
        <p className="mb-6 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          KI-Abgleich ist noch nicht eingerichtet - Import und manuelle
          Zuordnung funktionieren trotzdem.{" "}
          <Link className="underline" href="/admin/kalkulation-ai-settings">
            Jetzt einrichten
          </Link>
        </p>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">LV hochladen</h2>
        <p className="mt-1 text-sm text-gray-600">
          Unterstützt GAEB DA XML (.x81/.x83/.x84/.d81/.d83/.d84) und Excel
          (Spalten: Position, Text, Einheit, Menge, Einheitspreis).
        </p>
        <ImportForm action={importLv} className="mt-4" progressEndpoint="/kalkulation/imports/progress">
          <ProjectFileDropInput
            accept=".x81,.x83,.x84,.d81,.d83,.d84,.xlsx,.xls"
            emptyLabel="Datei hierher ziehen oder klicken"
            name="file"
            required
            selectedLabel="GAEB- oder Excel-Datei auswählen"
          />
          <button
            className="mt-4 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Importieren
          </button>
        </ImportForm>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3">Datei</th>
              <th className="p-3">Typ</th>
              <th className="p-3">Format</th>
              <th className="p-3">Zeilen</th>
              <th className="p-3">Abgleich</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((lvImport) => (
              <tr className="border-t border-gray-100" key={lvImport.id}>
                <td className="p-3">
                  <Link className="font-semibold text-gray-900 hover:underline" href={`/kalkulation/imports/${lvImport.id}`}>
                    {lvImport.fileName}
                  </Link>
                </td>
                <td className="p-3">{LV_TYPE_LABELS[lvImport.lvType] ?? lvImport.lvType}</td>
                <td className="p-3">{lvImport.sourceFormat === "GAEB_XML" ? "GAEB" : "Excel"}</td>
                <td className="p-3">{lvImport.rowCount}</td>
                <td className="p-3">
                  {lvImport.matchedCount} zugeordnet
                  {lvImport.needsReviewCount > 0 ? `, ${lvImport.needsReviewCount} zu prüfen` : ""}
                </td>
                <td className="p-3">{lvImport.status}</td>
              </tr>
            ))}
            {imports.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={6}>
                  Noch keine LVs importiert.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
