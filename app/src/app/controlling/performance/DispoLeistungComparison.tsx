"use client";

import { useState } from "react";

type BreakdownLine = {
  category: string;
  costCents: number;
  detail: string;
  label: string;
  quantity: number;
  unit: string;
};

type Scenario = {
  breakdown: BreakdownLine[];
  detail: string;
  forecastCents: number;
  forecastPercent: string;
  formula: string;
  label: string;
  vorUmlage: {
    formula: string;
    resultCents: number;
    resultPercent: string;
  };
};

export function DispoLeistungComparison({
  approved,
  planned,
}: {
  approved: Scenario;
  planned: Scenario;
}) {
  const [openScenario, setOpenScenario] = useState<Scenario | null>(null);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Vergleich</p>
      <h2 className="mt-1 text-xl font-bold text-gray-950">
        Ergebnis nach Dispo vs. nach Leistung
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        Zeigt dasselbe Ergebnis einmal komplett mit Dispo-Werten (Stunden nach Arbeitsplan,
        Asphalt-/Anspritzmittelmengen nach Disposition statt Lieferschein) und einmal komplett mit
        den tatsächlich erfassten Werten (freigegebene Zeiterfassung, gefahrene Mengen) -
        unabhängig davon, welcher Modus oben gerade aktiv ist. Stand vom letzten
        &quot;Übernehmen&quot;, kein Live-Wert. Klick auf eine Kachel zeigt die Aufstellung.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ComparisonTile onOpen={() => setOpenScenario(planned)} scenario={planned} />
        <ComparisonTile onOpen={() => setOpenScenario(approved)} scenario={approved} />
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
        Ergebnis vor Umlage
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <VorUmlageTile label={planned.label} vorUmlage={planned.vorUmlage} />
        <VorUmlageTile label={approved.label} vorUmlage={approved.vorUmlage} />
      </div>

      {openScenario ? (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setOpenScenario(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-950">{openScenario.label}</h3>
                <p className="mt-1 text-sm text-gray-500">{openScenario.formula}</p>
              </div>
              <button
                autoFocus
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                onClick={() => setOpenScenario(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <BreakdownTable lines={openScenario.breakdown} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ComparisonTile({
  onOpen,
  scenario,
}: {
  onOpen: () => void;
  scenario: Scenario;
}) {
  return (
    <button
      className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left text-gray-950 hover:border-gray-300 hover:bg-gray-100"
      onClick={onOpen}
      type="button"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
        {scenario.label}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold">{formatMoney(scenario.forecastCents)}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            scenario.forecastCents >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          DB {scenario.forecastPercent}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{scenario.detail}</p>
      <p className="mt-2 text-xs font-semibold text-blue-700">Aufstellung anzeigen →</p>
    </button>
  );
}

function VorUmlageTile({
  label,
  vorUmlage,
}: {
  label: string;
  vorUmlage: Scenario["vorUmlage"];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-gray-950">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <p className="text-xl font-bold">{formatMoney(vorUmlage.resultCents)}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            vorUmlage.resultCents >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          DB {vorUmlage.resultPercent}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{vorUmlage.formula}</p>
    </div>
  );
}

function BreakdownTable({ lines }: { lines: BreakdownLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Keine Zeilen vorhanden - Bericht seit der letzten Änderung noch nicht neu über
        &quot;Übernehmen&quot; eingelesen.
      </p>
    );
  }

  const categories = [...new Set(lines.map((line) => line.category))];

  return (
    <div className="mt-4 space-y-4">
      {categories.map((category) => {
        const categoryLines = lines.filter((line) => line.category === category);
        const categorySumCents = categoryLines.reduce((sum, line) => sum + line.costCents, 0);

        return (
          <div key={category}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                {category}
              </h4>
              <span className="text-xs font-semibold text-gray-700">
                {formatMoney(categorySumCents)}
              </span>
            </div>
            <table className="mt-1.5 w-full text-left text-sm">
              <tbody>
                {categoryLines.map((line, index) => (
                  <tr className="border-t border-gray-100" key={`${line.label}-${index}`}>
                    <td className="py-1.5 pr-2 align-top text-gray-900">
                      <div className="font-medium">{line.label}</div>
                      {line.detail ? (
                        <div className="text-xs text-gray-500">{line.detail}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap py-1.5 pr-2 align-top text-right text-gray-700">
                      {formatDecimal(line.quantity)} {line.unit}
                    </td>
                    <td className="whitespace-nowrap py-1.5 align-top text-right font-semibold text-gray-900">
                      {formatMoney(line.costCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    style: "currency",
  }).format(cents / 100);
}

function formatDecimal(value: number) {
  return value.toLocaleString("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}
