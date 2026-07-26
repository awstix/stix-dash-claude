import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { createHazardousSubstance } from "../actions";

function formatDate(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function HazardousSubstancesPage() {
  const substances = await prisma.safetyHazardousSubstance.findMany({
    include: {
      safetyDataSheets: {
        orderBy: [
          {
            versionDate: "desc",
          },
          {
            uploadedAt: "desc",
          },
        ],
      },
    },
    orderBy: [
      {
        category: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const activeCount = substances.filter((substance) => substance.isActive).length;
  const sheetCount = substances.reduce(
    (sum, substance) => sum + substance.safetyDataSheets.length,
    0,
  );

  return (
    <AppShell
      title="Gefahrstoffe"
      description="Gefahrstoffkataster mit Sicherheitsdatenblättern, Lagerort, Schutzmaßnahmen und Verantwortlichkeit."
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          href="/safety"
        >
          ← Arbeitssicherheit
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Gefahrstoffe
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-950">
            {substances.length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Aktiv
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Sicherheitsdatenblätter
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{sheetCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Gefahrstoff anlegen
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Grunddaten erfassen und Sicherheitsdatenblatt direkt als PDF/JPG
            anhängen.
          </p>

          <form action={createHazardousSubstance} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Gefahrstoff
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="name"
                  placeholder="z. B. Dieselkraftstoff"
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Hersteller / Lieferant
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="manufacturer"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Kategorie
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="category"
                  placeholder="Kraftstoff, Reinigungsmittel, Bindemittel..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Einsatzbereich
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="usageArea"
                  placeholder="Werkstatt, Bauhof, Baustelle..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Lagerort
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="storagePlace"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Verantwortlich
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="responsibleName"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Signalwort
                </span>
                <select
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm"
                  name="signalWord"
                >
                  <option value="">Keine Angabe</option>
                  <option value="Gefahr">Gefahr</option>
                  <option value="Achtung">Achtung</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Gefahrensymbole
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="hazardSymbols"
                  placeholder="GHS02, GHS07..."
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  H-Sätze
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="hStatements"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  P-Sätze
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="pStatements"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Schutzmaßnahmen
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="protectiveMeasures"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Erste Hilfe / Entsorgung
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="firstAidMeasures"
                  placeholder="Erste-Hilfe-Maßnahmen"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-gray-800">
                Sicherheitsdatenblatt
              </span>
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <input
                  className="rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="versionDate"
                  type="date"
                />
                <input
                  accept="application/pdf,image/*"
                  className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm text-gray-800"
                  multiple
                  name="safetyDataSheets"
                  type="file"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-gray-800">
                Notizen
              </span>
              <textarea
                className="min-h-20 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                name="notes"
              />
            </label>

            <button
              className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 hover:bg-yellow-300"
              type="submit"
            >
              Gefahrstoff speichern
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Gefahrstoffkataster
          </h2>
          <div className="mt-4 space-y-3">
            {substances.length === 0 ? (
              <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                Noch keine Gefahrstoffe angelegt.
              </p>
            ) : (
              substances.map((substance) => (
                <article
                  className="rounded-2xl border border-gray-200 p-4"
                  key={substance.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-gray-950">
                        {substance.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {[substance.category, substance.manufacturer]
                          .filter(Boolean)
                          .join(" · ") || "Ohne Kategorie"}
                      </p>
                    </div>
                    {substance.signalWord ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-950">
                        {substance.signalWord}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <p>
                      <span className="font-bold text-gray-700">Lagerort:</span>{" "}
                      {substance.storagePlace || "—"}
                    </p>
                    <p>
                      <span className="font-bold text-gray-700">
                        Einsatzbereich:
                      </span>{" "}
                      {substance.usageArea || "—"}
                    </p>
                    <p>
                      <span className="font-bold text-gray-700">
                        Verantwortlich:
                      </span>{" "}
                      {substance.responsibleName || "—"}
                    </p>
                    <p>
                      <span className="font-bold text-gray-700">
                        Gefahrensymbole:
                      </span>{" "}
                      {substance.hazardSymbols || "—"}
                    </p>
                  </div>

                  <details className="mt-4 rounded-2xl bg-gray-50 p-4">
                    <summary className="cursor-pointer text-sm font-bold text-gray-950">
                      Schutz / Hinweise anzeigen
                    </summary>
                    <div className="mt-3 grid gap-3 text-sm text-gray-700">
                      <p className="whitespace-pre-wrap">
                        <span className="font-bold text-gray-900">H-Sätze:</span>{" "}
                        {substance.hStatements || "—"}
                      </p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-bold text-gray-900">P-Sätze:</span>{" "}
                        {substance.pStatements || "—"}
                      </p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-bold text-gray-900">
                          Schutzmaßnahmen:
                        </span>{" "}
                        {substance.protectiveMeasures || "—"}
                      </p>
                      <p className="whitespace-pre-wrap">
                        <span className="font-bold text-gray-900">
                          Erste Hilfe:
                        </span>{" "}
                        {substance.firstAidMeasures || "—"}
                      </p>
                    </div>
                  </details>

                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-sm font-bold text-gray-950">
                      Sicherheitsdatenblätter
                    </p>
                    {substance.safetyDataSheets.length === 0 ? (
                      <p className="mt-2 text-sm text-gray-500">
                        Noch kein Sicherheitsdatenblatt hinterlegt.
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {substance.safetyDataSheets.map((sheet) => (
                          <a
                            className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
                            href={sheet.publicUrl}
                            key={sheet.id}
                            target="_blank"
                          >
                            📄 {sheet.displayName} · {formatDate(sheet.versionDate)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
