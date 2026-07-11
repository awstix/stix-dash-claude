import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { importExcel } from "./actions";

const importTypes = [
  {
    value: "employees",
    label: "Mitarbeiterliste",
    help: "Erwartete Spalten: Status, Eintritt, Austritt, Firma, Abteilung, Vorname, Nachname, Berufsgruppen, Leitung, Geburtsdatum, Geschlecht, Handynummer, Notfallkontakt, Straße, PLZ, Ort, Bemerkung",
  },
  {
    value: "drivers",
    label: "Fahrer",
    help: "Erwartete Spalten: Vorname, Nachname, Kürzel, Telefon, Bemerkung",
  },
  {
    value: "options",
    label: "Auswahllisten",
    help: "Erwartete Spalten: Gruppe, Interner Wert, Bezeichnung, Position, Aktiv. Bestehende Werte werden über Gruppe + Interner Wert aktualisiert.",
  },
];

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    created?: string;
    updated?: string;
    skipped?: string;
  }>;
}) {
  const params = await searchParams;

  const hasResult = params.created || params.updated || params.skipped;
  const importedType = importTypes.find((type) => type.value === params.type);

  return (
    <AppShell
      title="Excel-Import"
      description="Allgemeine Mitarbeiter-/Fahrer-/Auswahllisten importieren. Inventar, Material, Asphalt, Geräte und Fahrzeuge werden zentral unter Inventar importiert."
    >
      {hasResult ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
          <h2 className="text-lg font-semibold">Import abgeschlossen</h2>
          <p className="mt-2 text-sm">
            {importedType ? (
              <>
                Importtyp: <strong>{importedType.label}</strong> ·{" "}
              </>
            ) : null}
            Angelegt: <strong>{params.created ?? 0}</strong> · Aktualisiert:{" "}
            <strong>{params.updated ?? 0}</strong> · Übersprungen:{" "}
            <strong>{params.skipped ?? 0}</strong>
          </p>
        </div>
      ) : null}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Datei importieren
        </h2>

        <form action={importExcel} className="mt-6 space-y-6">
          <input name="returnTo" type="hidden" value="/admin/imports" />

          <div>
            <label className="text-sm font-medium text-gray-800">
              Importtyp
            </label>

            <select
              name="importType"
              required
              defaultValue=""
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            >
              <option value="" disabled>
                Bitte wählen
              </option>

              {importTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-800">
              Excel-Datei
            </label>

            <input
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Import starten
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {importTypes.map((type) => (
          <div
            key={type.value}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h3 className="font-semibold text-gray-900">{type.label}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {type.help}
            </p>

            {type.value === "employees" ? (
              <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                Wenn in der Spalte Berufsgruppen{" "}
                <strong>LKW Fahrer*in</strong> enthalten ist, wird automatisch
                auch ein Fahrer-Datensatz angelegt oder aktualisiert.
              </p>
            ) : null}

            <Link
              href={`/admin/imports/template?type=${type.value}`}
              className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Excel-Vorlage herunterladen
            </Link>

            {type.value === "options" ? (
              <Link
                href="/admin/imports/export?type=options"
                className="ml-2 mt-4 inline-flex rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Aktuelle Auswahllisten exportieren
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
