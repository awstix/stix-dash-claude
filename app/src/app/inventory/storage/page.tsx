import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

function formatStock(value: number | null, unit: string) {
  if (value === null) return "—";

  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 3,
  }).format(value)} ${unit}`;
}

export default async function InventoryStoragePage() {
  const items = await prisma.inventoryItem.findMany({
    where: {
      isStockManaged: true,
    },
    include: {
      category: true,
      responsibleCrew: true,
      responsibleEmployee: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <AppShell
      title="Lagerverwaltung"
      description="Erste Übersicht für lagergeführte Inventarobjekte. Ausgabe, Rücknahme und Mitarbeiterhistorie folgen als nächster sauberer Schritt."
    >
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Lagerobjekte
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {items.length} lagergeführte Objekte.
            </p>
          </div>
          <Link
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            href="/inventory"
          >
            Inventar öffnen
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Objekt</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3">Anfangsbestand</th>
                <th className="p-3">Aktueller Bestand</th>
                <th className="p-3">Verantwortlich</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500" colSpan={6}>
                    Noch keine lagergeführten Inventarobjekte vorhanden.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr className="border-t border-gray-100" key={item.id}>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.inventoryNumber ?? "ohne Inventarnummer"}
                      </div>
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.category?.name ?? "—"}
                    </td>
                    <td className="p-3 text-gray-700">
                      {formatStock(item.openingStock, item.stockUnit)}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {formatStock(item.currentStock, item.stockUnit)}
                    </td>
                    <td className="p-3 text-gray-700">
                      {item.responsibleEmployee
                        ? `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`
                        : item.responsibleCrew?.name ?? "—"}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-900">
                        Ausgabe/Rücknahme folgt
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
