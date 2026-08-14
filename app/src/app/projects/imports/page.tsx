import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { importProjects } from "./actions";

export const maxDuration = 300;

export default async function ProjectImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    report?: string;
    skipped?: string;
    updated?: string;
  }>;
}) {
  const params = await searchParams;
  const hasResult = params.created || params.updated || params.skipped;

  return (
    <AppShell
      title="Projekte importieren"
      description="Projektstammdaten per Excel anlegen oder aktualisieren."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/projects"
        >
          ← Projektübersicht
        </Link>
      </div>

      {hasResult ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
          <h2 className="text-lg font-semibold">Projektimport abgeschlossen</h2>
          <p className="mt-2 text-sm">
            Angelegt: <strong>{params.created ?? 0}</strong> · Aktualisiert:{" "}
            <strong>{params.updated ?? 0}</strong> · Übersprungen:{" "}
            <strong>{params.skipped ?? 0}</strong>
          </p>
          {params.report ? (
            <a
              className="mt-4 inline-flex rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-semibold text-green-900 hover:bg-green-100"
              download
              href={params.report}
            >
              Importbericht herunterladen
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Excel-Datei importieren
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Die Datei muss die Spalten der Vorlage enthalten. Die Projektnummer
            ist der eindeutige Schlüssel: Ist sie schon vorhanden, wird das
            bestehende Projekt aktualisiert, sonst neu angelegt.
          </p>

          <form action={importProjects} className="mt-6 space-y-6">
            <label className="block text-sm font-medium text-gray-800">
              Excel-Datei
              <input
                accept=".xlsx,.xls,.csv"
                className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                name="file"
                required
                type="file"
              />
            </label>

            <FormSubmitButton
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              idleLabel="Projekte importieren"
              pendingLabel="Import läuft … bitte warten"
            />
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Importvorlage
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Enthält alle Projektfelder inkl. Dropdown-Auswahl für Status und
            Ja/Nein-Felder sowie ein Hinweise-Blatt.
          </p>

          <a
            className="mt-5 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            download
            href="/projects/imports/template"
          >
            Excel-Vorlage herunterladen
          </a>

          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">
              Bestehende Projekte bearbeiten
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Lädt alle Projekte mit allen aktuellen Werten im gleichen Format
              wie die Importvorlage herunter. So kannst du Änderungen direkt in
              Excel machen und die Datei anschließend hier wieder hochladen,
              ohne andere Felder zu verlieren.
            </p>
            <a
              className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              download
              href="/projects/imports/export"
            >
              Aktuelle Projekte exportieren
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
