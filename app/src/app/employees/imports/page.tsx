import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { importExcel } from "@/app/admin/imports/actions";

const importTypes = [
  {
    value: "employees",
    label: "Mitarbeiterliste",
    help: "Erwartete Spalten: Status, Eintritt, Austritt, Firma, Abteilung, Vorname, Nachname, Berufsgruppen, Leitung, Geburtsdatum, Geschlecht, Handynummer, Notfallkontakt, Straße, PLZ, Ort, Bemerkung.",
  },
];

export default async function EmployeeImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    skipped?: string;
    type?: string;
    updated?: string;
  }>;
}) {
  const params = await searchParams;
  const hasResult = params.created || params.updated || params.skipped;
  const importedType = importTypes.find((type) => type.value === params.type);

  return (
    <AppShell
      title="Mitarbeiter importieren"
      description="Mitarbeiter-Stammdaten per Excel einlesen. Schulungen und Führerscheine werden direkt in den jeweiligen Bereichen gepflegt."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees"
        >
          ← Mitarbeiterverwaltung
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/employees/driver-licenses"
        >
          Führerscheinkontrolle
        </Link>
      </div>

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

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Excel-Datei importieren
        </h2>

        <form action={importExcel} className="mt-6 space-y-6">
          <input name="returnTo" type="hidden" value="/employees/imports" />

          <label className="block text-sm font-medium text-gray-800">
            Importtyp
            <select
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              defaultValue=""
              name="importType"
              required
            >
              <option disabled value="">
                Bitte wählen
              </option>
              {importTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

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

          <button
            className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Import starten
          </button>
        </form>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {importTypes.map((type) => (
          <div
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            key={type.value}
          >
            <h3 className="font-semibold text-gray-900">{type.label}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">{type.help}</p>
            {type.value === "employees" ? (
              <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                Wenn in der Spalte Berufsgruppen <strong>LKW Fahrer*in</strong>{" "}
                enthalten ist, wird automatisch auch ein Fahrer-Datensatz angelegt
                oder aktualisiert.
              </p>
            ) : null}
            <Link
              className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/employees/imports/template?type=${type.value}`}
            >
              Excel-Vorlage herunterladen
            </Link>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
