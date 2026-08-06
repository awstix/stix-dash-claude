import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { getResetPreview } from "@/lib/data-maintenance";
import { resetDashboardDataAction } from "./actions";

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function MaintenanceTable({
  headline,
  items,
  tone,
}: {
  headline: string;
  items: {
    count: number;
    name: string;
  }[];
  tone: "keep" | "delete";
}) {
  const count = items.reduce((sum, item) => sum + item.count, 0);
  const toneClasses =
    tone === "keep"
      ? "border-green-200 bg-green-50 text-green-950"
      : "border-red-200 bg-red-50 text-red-950";

  return (
    <section className={`rounded-2xl border p-6 ${toneClasses}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{headline}</h2>
          <p className="mt-1 text-sm opacity-80">
            {formatNumber(count)} Datensätze in {items.length} Tabellen
          </p>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide">
          {tone === "keep" ? "bleibt" : "wird geleert"}
        </span>
      </div>

      <div className="mt-5 max-h-[420px] overflow-auto rounded-xl border border-white/60 bg-white/70">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Tabelle</th>
              <th className="px-4 py-3 text-right font-semibold">
                Datensätze
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-900">
            {items.map((item) => (
              <tr key={item.name}>
                <td className="px-4 py-2 font-medium">{item.name}</td>
                <td className="px-4 py-2 text-right">
                  {formatNumber(item.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function BackupResetPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string;
    legacyCleanup?: string;
    reset?: string;
    uploads?: string;
  }>;
}) {
  await requireAdmin();
  const [params, preview] = await Promise.all([
    searchParams,
    getResetPreview(),
  ]);
  const hasResetResult = params.reset === "1";
  const hasLegacyCleanupResult = params.legacyCleanup === "1";

  return (
    <AppShell
      title="Datensicherung & Reset"
      description="Direktes Datenbank-Backup erstellen und das Dashboard bei Bedarf kontrolliert leerziehen."
    >
      <div className="space-y-6">
        {hasResetResult ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-950 shadow-sm">
            <h2 className="text-xl font-bold">Reset abgeschlossen</h2>
            <p className="mt-2 text-sm leading-6">
              Gelöscht: <strong>{formatNumber(Number(params.deleted ?? 0))}</strong>{" "}
              Datensätze.
              {Number(params.uploads ?? 0) > 0 ? (
                <>
                  {" "}
                  · Upload-Ordner geleert:{" "}
                  <strong>{formatNumber(Number(params.uploads))}</strong>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        {hasLegacyCleanupResult ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-950 shadow-sm">
            <h2 className="text-xl font-bold">
              Alte Stammdaten-Leichen bereinigt
            </h2>
            <p className="mt-2 text-sm leading-6">
              Gelöscht: <strong>{formatNumber(Number(params.deleted ?? 0))}</strong>{" "}
              alte Material-/Asphalt-/Beton-Datensätze.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-blue-950">
            Datenbank-Backups
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-950/80">
            Backups der Datenbank übernimmt Supabase automatisch (Point-in-Time-
            Recovery / tägliche Snapshots je nach Projekt-Plan). Ein manuelles
            ZIP-Backup wird hier nicht mehr benötigt.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <MaintenanceTable
            headline="Bleibt standardmäßig erhalten"
            items={preview.keptTables}
            tone="keep"
          />
          <MaintenanceTable
            headline="Wird beim Reset geleert"
            items={preview.tablesToClear}
            tone="delete"
          />
        </div>

        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold text-red-950">
              Dashboard leeren
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              Der Reset erstellt automatisch zuerst ein Backup und löscht dann
              Bewegungsdaten sowie Stammdaten wie Projekte, Mitarbeiter,
              Fahrzeuge, Inventarobjekte, Materiallisten und Dispositionen.
              Firmeninfos, Arbeitszeiten, Formularvorlagen, Etikettenvorlagen,
              Inventarkategorien und Auswahllisten bleiben standardmäßig
              erhalten.
            </p>
          </div>

          <form action={resetDashboardDataAction} className="mt-6 space-y-5">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <label className="text-sm font-bold text-gray-900">
                Zur Bestätigung RESET eingeben
              </label>
              <input
                name="confirmation"
                type="text"
                autoComplete="off"
                placeholder="RESET"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <label className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <input name="deleteUploads" type="checkbox" className="mt-1" />
                <span>
                  <strong className="block text-gray-900">
                    Upload-/Exportordner leeren
                  </strong>
                  Fotos, Dokumente und generierte Exporte zusätzlich entfernen.
                </span>
              </label>

              <label className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <input
                  name="deleteCategories"
                  type="checkbox"
                  className="mt-1"
                />
                <span>
                  <strong className="block text-gray-900">
                    Inventarkategorien mit löschen
                  </strong>
                  Nur setzen, wenn auch die Kategorien komplett neu aufgebaut
                  werden sollen.
                </span>
              </label>

              <label className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                <input
                  name="deleteQualificationTypes"
                  type="checkbox"
                  className="mt-1"
                />
                <span>
                  <strong className="block text-gray-900">
                    Führerschein-/Nachweisarten löschen
                  </strong>
                  Nur setzen, wenn auch diese Listen komplett neu gepflegt
                  werden sollen.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800"
            >
              Backup erstellen und Dashboard leeren
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-blue-950">
            Technische Inventar-Brücken
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-950/80">
            Die früheren Material- und Asphaltlisten sind in der Oberfläche
            ausgeblendet, werden intern aber noch für bestehende Dispositionen
            und Bautagesberichte benötigt. Neue Einträge werden über das
            Inventar gepflegt und technisch synchronisiert.
          </p>
          <p className="mt-2 text-xs leading-5 text-blue-950/65">
            Eine Bereinigung ist erst möglich, wenn alle Relationen vollständig
            auf Inventarobjekte umgestellt wurden.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
