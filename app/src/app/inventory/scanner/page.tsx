import { AppShell } from "@/components/AppShell";

export default function InventoryScannerPage() {
  return (
    <AppShell
      title="Inventar-Scanner"
      description="Mobiler Einstieg zum Scannen von Inventar-Codes, Schadenmeldungen und Objektinformationen."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Scanner vorbereiten
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Hier entsteht der mobile Scanner. Geplant sind Code-Erkennung,
          Standorterfassung, Scan-Historie, Baustellenzuordnung über Projektfeld
          und schnelle Aktionen wie Schaden melden oder Rückgabe beauftragen.
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
          Kamera-/Scannerfunktion folgt nach Inventarobjekten und Code-Erzeugung.
        </div>
      </section>
    </AppShell>
  );
}
