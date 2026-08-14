import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { ImportForm } from "@/components/ImportForm";
import { prisma } from "@/lib/prisma";
import { importInventoryItems } from "./actions";

// Large Excel imports (hundreds of rows, each doing a couple of DB round
// trips for object-number assignment etc.) can run well past Vercel's
// default Server Action timeout. Vercel caps this at whatever the plan
// allows regardless of this value, so it's safe to ask for the max here.
export const maxDuration = 300;

export default async function InventoryImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    report?: string;
    skipped?: string;
    updated?: string;
  }>;
}) {
  const [params, categoryCount, lastImportRun] = await Promise.all([
    searchParams,
    prisma.inventoryCategory.count({
      where: {
        isActive: true,
      },
    }),
    prisma.importProgress.findFirst({
      where: {
        kind: "inventory",
        status: "done",
        reportStoragePath: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        created: true,
        updated: true,
        skipped: true,
        updatedAt: true,
      },
    }),
  ]);
  const hasResult = params.created || params.updated || params.skipped;

  return (
    <AppShell
      title="Inventar importieren"
      description="Zentrale Excel-Schnittstelle für Material, Fahrzeuge, Sonderfahrzeuge, Baumaschinen, Werkzeuge und Lagerobjekte."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory"
        >
          ← Inventarverwaltung
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/admin/inventory-categories"
        >
          Kategorien / Nummernkreise pflegen →
        </Link>
      </div>

      {hasResult ? (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
          <h2 className="text-lg font-semibold">Inventarimport abgeschlossen</h2>
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

      {lastImportRun ? (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Letzter Importbericht
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {new Intl.DateTimeFormat("de-DE", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(lastImportRun.updatedAt)}
            {" · "}
            Angelegt: <strong>{lastImportRun.created}</strong> · Aktualisiert:{" "}
            <strong>{lastImportRun.updated}</strong> · Übersprungen:{" "}
            <strong>{lastImportRun.skipped}</strong>
          </p>
          <a
            className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            download
            href="/inventory/imports/last-report"
          >
            Bericht herunterladen
          </a>
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <h2 className="text-lg font-bold text-blue-950">
          Neuer Standard: alles läuft über Inventar
        </h2>
        <p className="mt-2 text-sm leading-6 text-blue-900">
          Du pflegst zuerst Kategorien und Unterkategorien mit Nummernkreisen.
          Danach importierst du alle Objekte in einer zentralen Liste. Die
          Kategorie entscheidet später, ob das Objekt als Material,
          Maschine/Gerät, LKW-Transportgut, Lagerobjekt oder BTB-Position
          verwendet wird.
        </p>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Importbasis / vorbereitete Listen
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Die Grundstruktur steht: Kategorien zuerst pflegen, danach Objekte
          importieren. Mitarbeiter und Schulungen bleiben auf ihren eigenen
          Seiten, damit die Menüleiste nicht unnötig voll wird.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ImportReadyCard
            href="/admin/inventory-categories"
            label="Kategorien"
            text="Kategorien, Unterkategorien, Nummernkreise und Verwendungen."
          />
          <ImportReadyCard
            href="/inventory/imports/template"
            label="Inventarobjekte"
            text="Material, Fahrzeuge, Maschinen, Lagerobjekte und Kontakte."
          />
          <ImportReadyCard
            href="/employees/imports"
            label="Mitarbeiter"
            text="Personalstammdaten getrennt vom Inventar importieren."
          />
          <ImportReadyCard
            href="/employees/certificates"
            label="Schulungen"
            text="Schulungsübersicht mit Fehlerbericht und Kreuztabelle."
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Excel-Datei importieren
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Die Datei muss die Spalten der Vorlage enthalten. Bestehende Objekte
            werden über Objekt-ID oder Inventarnummer aktualisiert. Wenn die
            Objekt-ID leer bleibt, wird sie aus dem Nummernkreis der gewählten
            Kategorie vergeben.
          </p>

          <ImportForm
            action={importInventoryItems}
            className="mt-6 space-y-6"
            progressEndpoint="/inventory/imports/progress"
          >
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
              idleLabel="Inventar importieren"
              pendingLabel="Import läuft … bitte warten"
            />
          </ImportForm>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Importvorlage
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Enthält alle wichtigen Inventarfelder und ein Zusatzblatt mit den
            aktuell gepflegten Kategorien und Unterkategorien aus dem Dashboard.
          </p>

          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-bold text-gray-900">
              {categoryCount} aktive Kategorien / Unterkategorien
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-600">
              Wenn hier 0 steht, bitte erst Kategorien und Nummernkreise
              anlegen.
            </p>
          </div>

          <a
            className="mt-5 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            download
            href="/inventory/imports/template"
          >
            Excel-Vorlage herunterladen
          </a>

          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">
              Bestehendes Inventar bearbeiten
            </h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Lädt alle aktiven Objekte mit allen aktuellen Werten im gleichen
              Format wie die Importvorlage herunter. So kannst du Änderungen
              (z. B. Verrechnungssatz) direkt in Excel machen und die Datei
              anschließend hier wieder hochladen, ohne andere Felder zu
              verlieren.
            </p>
            <a
              className="mt-4 inline-flex rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              download
              href="/inventory/imports/export"
            >
              Aktuelles Inventar exportieren
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ImportReadyCard({
  href,
  label,
  text,
}: {
  href: string;
  label: string;
  text: string;
}) {
  return (
    <Link
      className="rounded-2xl border border-gray-200 bg-gray-50 p-4 hover:border-gray-300 hover:bg-gray-100"
      href={href}
    >
      <div className="text-sm font-bold text-gray-950">{label}</div>
      <p className="mt-1 text-xs leading-5 text-gray-600">{text}</p>
    </Link>
  );
}
