import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { getResetPreview } from "@/lib/data-maintenance";
import {
  cleanupLegacyMasterDataAction,
  resetDashboardDataAction,
} from "./actions";

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
    backup?: string;
    deleted?: string;
    legacyCleanup?: string;
    reset?: string;
    uploads?: string;
  }>;
}) {
  const [params, preview] = await Promise.all([
    searchParams,
    Promise.resolve(getResetPreview()),
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
              Datensätze. Backup: <strong>{params.backup}</strong>
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
              alte Material-/Asphalt-/Beton-Datensätze. Backup:{" "}
              <strong>{params.backup}</strong>
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Komplett-Backup direkt herunterladen
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Erstellt ein ZIP aus der aktuellen <strong>dev.db</strong>{" "}
                sowie vorhandenen Upload-/Exportdateien und lädt es direkt
                herunter. Zusätzlich wird die Datenbankkopie im Ordner{" "}
                <strong>app/backups</strong> abgelegt.
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                So hast du vor einem Reset nicht nur die Tabellen, sondern auch
                Fotos, Dokumente, Zertifikate und erzeugte Exporte mitgesichert.
              </p>
            </div>

            <Link
              href="/admin/backup-reset/backup"
              className="inline-flex justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white hover:bg-gray-700"
            >
              Komplett-Backup herunterladen
            </Link>
          </div>
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

        <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-amber-950">
                Alte Stammdaten-Leichen bereinigen
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-700">
                Löscht nur die alten Listen für Material, Asphalt und Beton.
                Das neue Inventar, Inventarkategorien, Mitarbeiter, Projekte
                und Dispositionen bleiben erhalten. Vorher wird automatisch ein
                Datenbank-Backup erstellt.
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Die interne Fahrzeug-Brücke bleibt vorerst erhalten, bis alle
                Dispositionen vollständig direkt auf Inventarobjekte zugreifen.
              </p>
            </div>

            <form action={cleanupLegacyMasterDataAction}>
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700"
              >
                Alte Stammdaten bereinigen
              </button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
