import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ImportForm } from "@/components/ImportForm";
import { ProjectFileDropInput } from "@/app/projects/ProjectFileDropInput";
import { prisma } from "@/lib/prisma";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";
import { deleteImport, importLv } from "./actions";
import { DeleteImportButton } from "./DeleteImportButton";

export const maxDuration = 300;

const LV_TYPE_LABELS: Record<string, string> = {
  ANGEBOT: "Angebot (gepreist)",
  AUFTRAG: "Auftrag",
  AUSSCHREIBUNG: "Ausschreibung (ungepreist)",
};

const SOURCE_FORMAT_LABELS: Record<string, string> = {
  GAEB_XML: "GAEB",
  GAEB90: "GAEB (alt)",
  EXCEL: "Excel",
};

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

export default async function KalkulationImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ importError?: string; prefillProjectNumber?: string; prefillTenderTitle?: string }>;
}) {
  const [imports, aiSettings, params] = await Promise.all([
    prisma.kalkulationLvImport.findMany({
      include: { importedByUser: true },
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
          KI ist optional und noch nicht eingerichtet - der Abgleich über
          gelernte Zuordnungen sowie Import und manuelle Zuordnung
          funktionieren unabhängig davon.{" "}
          <Link className="underline" href="/admin/kalkulation-ai-settings">
            KI trotzdem einrichten
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-gray-900">
              Projektnummer (optional)
              <input className={inputClass} defaultValue={params.prefillProjectNumber ?? ""} name="projectNumber" />
            </label>
            <label className="block text-sm font-semibold text-gray-900">
              Projektname (optional)
              <input
                className={inputClass}
                defaultValue={params.prefillTenderTitle ?? ""}
                name="tenderTitle"
                placeholder="wird sonst aus der Datei übernommen, falls vorhanden"
              />
            </label>
          </div>
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
              <th className="p-3">Projekt</th>
              <th className="p-3">Typ</th>
              <th className="p-3">Format</th>
              <th className="p-3">Positionen</th>
              <th className="p-3">Abgleich</th>
              <th className="p-3">Status</th>
              <th className="p-3">Importiert von</th>
              <th className="p-3" />
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
                <td className="p-3">
                  {lvImport.projectNumber ? `${lvImport.projectNumber} ` : ""}
                  {lvImport.tenderTitle ?? (lvImport.projectNumber ? "" : "–")}
                </td>
                <td className="p-3">{LV_TYPE_LABELS[lvImport.lvType] ?? lvImport.lvType}</td>
                <td className="p-3">{SOURCE_FORMAT_LABELS[lvImport.sourceFormat] ?? lvImport.sourceFormat}</td>
                <td className="p-3">{lvImport.rowCount}</td>
                <td className="p-3">
                  {lvImport.matchedCount} zugeordnet
                  {lvImport.needsReviewCount > 0 ? `, ${lvImport.needsReviewCount} zu prüfen` : ""}
                </td>
                <td className="p-3">{lvImport.status}</td>
                <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                  {lvImport.importedByUser?.name ?? "–"}
                  <br />
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Europe/Berlin",
                  }).format(lvImport.createdAt)}
                </td>
                <td className="p-3">
                  <form action={deleteImport}>
                    <input name="importId" type="hidden" value={lvImport.id} />
                    <DeleteImportButton fileName={lvImport.fileName} />
                  </form>
                </td>
              </tr>
            ))}
            {imports.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={9}>
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
