import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActionIcon } from "@/components/ActionIcon";
import { CategorySelect } from "@/components/CategorySelect";
import { prisma } from "@/lib/prisma";
import { archivePosition, createCategory, createPosition, updatePosition } from "./actions";
import { formatLvSource } from "@/lib/kalkulation-format";
import { ArchivePositionButton } from "./ArchivePositionButton";

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";

function formatCents(cents: number | null) {
  if (cents == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const LV_TYPE_LABELS: Record<string, string> = {
  ANGEBOT: "Angebot",
  AUFTRAG: "Auftrag",
  AUSSCHREIBUNG: "Ausschreibung",
};

export default async function KalkulationKatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string }>;
}) {
  const { position: selectedPositionId } = await searchParams;

  const [positions, categories, selectedHistory] = await Promise.all([
    prisma.kalkulationPosition.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { title: "asc" },
    }),
    prisma.kalkulationPositionCategory.findMany({ where: { isActive: true } }),
    selectedPositionId
      ? prisma.kalkulationLvLineItem.findMany({
          where: { matchedPositionId: selectedPositionId, matchStatus: "CONFIRMED" },
          include: { lvImport: true },
          orderBy: { lvImport: { lvDate: "desc" } },
        })
      : Promise.resolve([]),
  ]);

  const selectedPosition = positions.find((p) => p.id === selectedPositionId);

  return (
    <AppShell
      description="Wiederverwendbare LV-Positionen samt Preishistorie aus früheren Imports."
      title="Positionskatalog"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/kalkulation/imports"
        >
          ← LV-Import
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Neue Position anlegen</h2>
            <form action={createPosition} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                Bezeichnung
                <input className={inputClass} name="title" required />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Code (optional)
                <input className={inputClass} name="code" />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Einheit
                <input className={inputClass} name="unit" placeholder="m, m2, m3, Stk, ..." required />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Beschreibung (optional)
                <textarea className={inputClass} name="description" rows={2} />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Kategorie
                <CategorySelect categories={categories} name="categoryId" />
              </label>
              <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700" type="submit">
                Anlegen
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Neue Kategorie anlegen</h2>
            <form action={createCategory} className="mt-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                Name
                <input className={inputClass} name="name" required />
              </label>
              <label className="block text-sm font-semibold text-gray-900">
                Überkategorie (optional)
                <CategorySelect categories={categories} name="parentCategoryId" />
              </label>
              <button className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50" type="submit">
                Anlegen
              </button>
            </form>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3">Bezeichnung</th>
                <th className="p-3">Einheit</th>
                <th className="p-3">Kategorie</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                  <tr className={`border-t border-gray-100 ${position.id === selectedPositionId ? "bg-gray-50" : ""}`} key={position.id}>
                    <td className="p-3">
                      <Link className="font-semibold text-gray-900 hover:underline" href={`/kalkulation/katalog?position=${position.id}`}>
                        {position.title}
                      </Link>
                      {position.code ? <span className="ml-2 text-xs text-gray-400">{position.code}</span> : null}
                    </td>
                    <td className="p-3">{position.unit}</td>
                    <td className="p-3">{position.category?.name ?? "–"}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <details>
                          <summary
                            aria-label={`${position.title} bearbeiten`}
                            className="inline-flex h-8 w-8 list-none items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            title="Bearbeiten"
                          >
                            <ActionIcon name="edit" className="h-4 w-4" />
                          </summary>
                          <form action={updatePosition} className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <input name="id" type="hidden" value={position.id} />
                            <label className="block text-xs font-semibold text-gray-900">
                              Bezeichnung
                              <input className={inputClass} defaultValue={position.title} name="title" required />
                            </label>
                            <label className="block text-xs font-semibold text-gray-900">
                              Code
                              <input className={inputClass} defaultValue={position.code ?? ""} name="code" />
                            </label>
                            <label className="block text-xs font-semibold text-gray-900">
                              Einheit
                              <input className={inputClass} defaultValue={position.unit} name="unit" required />
                            </label>
                            <label className="block text-xs font-semibold text-gray-900">
                              Beschreibung
                              <textarea className={inputClass} defaultValue={position.description ?? ""} name="description" rows={2} />
                            </label>
                            <label className="block text-xs font-semibold text-gray-900">
                              Kategorie
                              <CategorySelect categories={categories} defaultValue={position.categoryId} name="categoryId" />
                            </label>
                            <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700" type="submit">
                              Speichern
                            </button>
                          </form>
                        </details>
                        <form action={archivePosition}>
                          <input name="id" type="hidden" value={position.id} />
                          <ArchivePositionButton title={position.title} />
                        </form>
                      </div>
                    </td>
                  </tr>
              ))}
              {positions.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={4}>
                    Noch keine Positionen im Katalog.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>

      {selectedPosition ? (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            Preishistorie: {selectedPosition.title}
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-3">Datum</th>
                <th className="p-3">Herkunft</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Einheitspreis</th>
              </tr>
            </thead>
            <tbody>
              {selectedHistory.map((entry) => (
                <tr className="border-t border-gray-100" key={entry.id}>
                  <td className="p-3">
                    {entry.lvImport.lvDate
                      ? new Intl.DateTimeFormat("de-DE").format(entry.lvImport.lvDate)
                      : new Intl.DateTimeFormat("de-DE").format(entry.lvImport.createdAt)}
                  </td>
                  <td className="p-3">
                    {formatLvSource(entry.lvImport)}
                    {entry.lvImport.customerName ? ` (${entry.lvImport.customerName})` : ""}
                  </td>
                  <td className="p-3">{LV_TYPE_LABELS[entry.lvImport.lvType] ?? entry.lvImport.lvType}</td>
                  <td className="p-3">{formatCents(entry.unitPriceCents)}</td>
                </tr>
              ))}
              {selectedHistory.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={4}>
                    Noch keine bestätigten Preise für diese Position.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </AppShell>
  );
}
