import { AppShell } from "@/components/AppShell";

const tapeWidths = ["9 mm", "12 mm", "24 mm", "36 mm"];

export default function InventoryLabelsPage() {
  return (
    <AppShell
      title="Etikettenvorlagen"
      description="Vorbereitung für P-touch/TZe-Etiketten mit DataMatrix- oder QR-Code."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Vorlagenmanager
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Hier entsteht der Editor für Etikettenbreiten, Code, Inventarnummer,
          Objektname, Kategorie und weitere Bausteine. Für den Start sind die
          üblichen TZe-Bandbreiten vorbereitet.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          {tapeWidths.map((width) => (
            <div
              className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
              key={width}
            >
              <div className="text-lg font-bold text-gray-900">{width}</div>
              <p className="mt-2 text-sm text-gray-600">
                Standardvorlage wird im nächsten Schritt ergänzt.
              </p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
