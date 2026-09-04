import { prisma } from "@/lib/prisma";
import {
  adoptAnsatzFromCandidate,
  adoptBestPricesForImport,
  adoptPrice,
  chooseAnsatzAlternative,
  clearAdoptedPricesForImport,
  clearPrice,
  confirmAnsatzSuggestion,
  confirmMatch,
  createPositionFromLineItem,
  linkCrossLvMatch,
  manualMatch,
  rejectAnsatzSuggestion,
  rejectMatch,
  suggestAnsaetzeFromHistory,
  updateCrossLvSettings,
} from "./actions";
import { MatchingThresholdInput } from "./MatchingThresholdInput";
import { buildLvMatches } from "@/lib/kalkulation-matching";
import type { StoredAnsatzAlternative } from "@/lib/kalkulation-ansatz-pool";
import { diffWords } from "@/lib/kalkulation-text-diff";
import { formatLvSource } from "@/lib/kalkulation-format";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Offen", className: "bg-gray-100 text-gray-700" },
  SUGGESTED: { label: "Vorschlag", className: "bg-blue-100 text-blue-800" },
  NEEDS_REVIEW: { label: "Prüfen", className: "bg-amber-100 text-amber-900" },
  CONFIRMED: { label: "Bestätigt", className: "bg-green-100 text-green-800" },
  REJECTED: { label: "Abgelehnt", className: "bg-red-100 text-red-800" },
  NO_MATCH: { label: "Kein Treffer", className: "bg-gray-100 text-gray-600" },
};

function formatCents(cents: number | null) {
  if (cents == null) return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/** Abgleich-Werkzeuge + die vollständige Positionstabelle eines LV-Imports
 * - ausgelagert aus der Einzel-Review-Seite (imports/[importId]/page.tsx),
 * damit dieselbe Ansicht auch direkt embedded auf der Projektseite
 * gerendert werden kann, statt dorthin verlinken zu müssen.
 *
 * `showCrossLvMatches`/`crossLvToggleHref`: der Live-Vergleich gegen ALLE
 * Positionen anderer LVs in der ganzen DB ist teuer (skaliert mit der
 * Gesamtmenge an Positionen) - lief früher bei jedem Seitenaufruf
 * automatisch mit und hat bei mehreren eingebetteten Panels (Projektseite
 * mit 3 Imports) zu spürbaren Ladezeiten geführt. Deshalb jetzt bewusst
 * per Link zuschaltbar statt automatisch, analog zum bestehenden
 * "KI-Abgleich nur per Klick"-Prinzip. */
export async function LvReviewPanel({
  crossLvToggleHref,
  importId,
  returnTo,
  showCrossLvMatches = false,
}: {
  crossLvToggleHref: string;
  importId: string;
  returnTo?: string;
  showCrossLvMatches?: boolean;
}) {
  const [lvImport, lineItems, positions] = await Promise.all([
    prisma.kalkulationLvImport.findUniqueOrThrow({
      include: { crossLvMatchedByUser: true },
      where: { id: importId },
    }),
    prisma.kalkulationLvLineItem.findMany({
      where: { lvImportId: importId },
      include: { matchedPosition: true },
      orderBy: { rowNumber: "asc" },
    }),
    prisma.kalkulationPosition.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
    }),
  ]);

  // Preishistorie aus ANDEREN Projekten für jede in diesem LV bereits
  // (vorgeschlagen oder bestätigt) zugeordnete Position - damit man beim
  // Prüfen direkt sieht, was dieselbe Position anderswo schon gekostet hat.
  const matchedPositionIds = [
    ...new Set(lineItems.map((item) => item.matchedPositionId).filter((id): id is string => Boolean(id))),
  ];
  const historyRows = matchedPositionIds.length
    ? await prisma.kalkulationLvLineItem.findMany({
        where: {
          matchedPositionId: { in: matchedPositionIds },
          matchStatus: "CONFIRMED",
          lvImportId: { not: importId },
        },
        include: { lvImport: true },
        orderBy: { lvImport: { lvDate: "desc" } },
      })
    : [];
  const priceHistoryByPosition = new Map<string, typeof historyRows>();
  for (const row of historyRows) {
    if (!row.matchedPositionId) continue;
    const existing = priceHistoryByPosition.get(row.matchedPositionId) ?? [];
    if (existing.length < 2) existing.push(row);
    priceHistoryByPosition.set(row.matchedPositionId, existing);
  }

  // Direkter Vergleich gegen Positionen ANDERER bereits importierter LVs
  // UND Kalkulationen - unabhängig davon, ob dort schon irgendetwas
  // bestätigt/katalogisiert wurde. Ergänzt (ersetzt nicht) den Katalog-
  // Abgleich. Teuer (skaliert mit der Gesamtmenge an Positionen in der DB)
  // - läuft deshalb nur, wenn explizit zugeschaltet (siehe
  // showCrossLvMatches oben). Getrennte Kurztext-/Langtext-Schwellen +
  // je ein exakter Menge- bzw. Einheit-Filter statt einer einzelnen
  // Ähnlichkeit (siehe buildLvMatches) - ein Kandidat muss alle aktiven
  // Kriterien erfüllen.
  type CrossLvItem = Awaited<ReturnType<typeof prisma.kalkulationLvLineItem.findMany<{ include: { lvImport: true } }>>>[number];
  type CrossLvMatch = {
    exactEinheitMatch: boolean;
    exactMengeMatch: boolean;
    kurztextScore: number;
    langtextScore: number;
    source: CrossLvItem;
  };
  const crossLvMatchesByLineItem = new Map<string, CrossLvMatch[]>();
  if (showCrossLvMatches) {
    const otherLvItems = await prisma.kalkulationLvLineItem.findMany({
      where: {
        entryType: "ITEM",
        lvImportId: { not: importId },
        // D31-Positionen ohne echten Text (Platzhalter "Kalkulation OZ X",
        // siehe kalkulation-ansatz-pool.ts) taugen nicht für den
        // Textvergleich - raus, sonst nur falsche Treffer.
        NOT: { shortText: { startsWith: "Kalkulation OZ " } },
      },
      include: { lvImport: true },
      orderBy: { createdAt: "desc" },
      take: 3000,
    });
    const otherLvItemsById = new Map(otherLvItems.map((row) => [row.id, row]));
    const candidateInputs = otherLvItems.map((row) => ({
      id: row.id,
      quantity: row.quantity,
      rawText: row.rawText,
      shortText: row.shortText,
      unit: row.unit,
    }));

    for (const item of lineItems) {
      if (item.entryType !== "ITEM") continue;
      const matches = buildLvMatches(
        { id: item.id, quantity: item.quantity, rawText: item.rawText, shortText: item.shortText, unit: item.unit },
        candidateInputs,
        {
          exactEinheit: lvImport.crossLvExactEinheit,
          exactMenge: lvImport.crossLvExactMenge,
          kurztextThreshold: lvImport.crossLvKurztextThreshold,
          langtextThreshold: lvImport.crossLvLangtextThreshold,
        },
      );
      const bestPerImport = new Map<string, CrossLvMatch>();
      for (const match of matches) {
        const source = otherLvItemsById.get(match.candidateId);
        if (!source) continue;
        const existing = bestPerImport.get(source.lvImportId);
        if (!existing || match.langtextScore > existing.langtextScore) {
          bestPerImport.set(source.lvImportId, {
            exactEinheitMatch: match.exactEinheitMatch,
            exactMengeMatch: match.exactMengeMatch,
            kurztextScore: match.kurztextScore,
            langtextScore: match.langtextScore,
            source,
          });
        }
      }
      const top3 = [...bestPerImport.values()].sort((a, b) => b.langtextScore - a.langtextScore).slice(0, 3);
      if (top3.length > 0) crossLvMatchesByLineItem.set(item.id, top3);
    }
  }

  // Für die "übernommen aus ..."-Anzeige je Zeile: die Quell-Imports
  // übernommener Preise auflösen.
  const priceSourceImportIds = [
    ...new Set(lineItems.map((item) => item.priceSourceLvImportId).filter((id): id is string => Boolean(id))),
  ];
  const priceSourceImports = priceSourceImportIds.length
    ? await prisma.kalkulationLvImport.findMany({ where: { id: { in: priceSourceImportIds } } })
    : [];
  const priceSourceImportById = new Map(priceSourceImports.map((source) => [source.id, source]));

  const isKalkulation = lvImport.sourceFormat === "RIB_KALKULATION";

  return (
    <div>
      {isKalkulation ? (
        // Kalkulations-Positionen (OZ + Ansätze aus iTWO) haben keinen mit
        // echten LVs vergleichbaren Kurz-/Langtext - der generische
        // Kurztext-/Langtext-Abgleich unten fand hier praktisch nie etwas
        // und wurde mit dem gleichnamigen "Abgleich starten" der eigentlichen
        // LV-Kachel verwechselt. Deshalb hier bewusst NUR der dafür
        // gebaute Mechanismus (Ansätze aus anderen Projekten vorschlagen)
        // + der XML-Export, kein zweites "Abgleich starten".
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {lvImport.projectNumber ? (
            <form action={suggestAnsaetzeFromHistory}>
              <input name="projectNumber" type="hidden" value={lvImport.projectNumber} />
              <input name="returnTo" type="hidden" value={returnTo ?? `/kalkulation/imports/${importId}`} />
              <button
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                title="Befüllt noch leere Positionen dieser Kalkulation mit den ähnlichsten Ansätzen aus anderen Projekten - vorhandene Ansätze bleiben unangetastet"
                type="submit"
              >
                Ansätze aus anderen Projekten vorschlagen
              </button>
            </form>
          ) : null}

          {lineItems.some((item) => item.ribRawBlockXml) ? (
            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export-xml`}
              title="Exportiert die Kalkulationsansätze dieses Imports als .xml - zum Wiedereinlesen in iTWO"
            >
              Als XML exportieren ↓
            </a>
          ) : null}
        </div>
      ) : (
        <>
          {/* Immer sichtbar (nicht nur solange noch nicht geladen) - sonst gibt
           * es nach dem ersten Abgleich keine Möglichkeit mehr, die Kriterien
           * zu ändern und erneut abzugleichen. */}
          <form
            action={updateCrossLvSettings}
            className="mb-3 max-w-2xl rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
          >
            <input name="importId" type="hidden" value={importId} />
            <input name="returnTo" type="hidden" value={crossLvToggleHref} />
            <div className="grid gap-4 sm:grid-cols-2">
              <MatchingThresholdInput
                defaultValue={Math.round(lvImport.crossLvKurztextThreshold * 100)}
                label="Kurztext-Ähnlichkeit"
                max={100}
                min={0}
                name="crossLvKurztextThreshold"
              />
              <MatchingThresholdInput
                defaultValue={Math.round(lvImport.crossLvLangtextThreshold * 100)}
                label="Langtext-Ähnlichkeit"
                max={100}
                min={0}
                name="crossLvLangtextThreshold"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  className="h-5 w-5 accent-gray-900"
                  defaultChecked={lvImport.crossLvExactMenge}
                  name="crossLvExactMenge"
                  type="checkbox"
                />
                Menge muss gleich sein
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  className="h-5 w-5 accent-gray-900"
                  defaultChecked={lvImport.crossLvExactEinheit}
                  name="crossLvExactEinheit"
                  type="checkbox"
                />
                Einheit muss gleich sein
              </label>
            </div>
            <button
              className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              title="Vergleicht jede Position live gegen alle Positionen anderer LVs/Kalkulationen in der Datenbank - dauert je nach Datenmenge einen Moment, deshalb nicht automatisch"
              type="submit"
            >
              {showCrossLvMatches ? "Erneut abgleichen" : "Abgleich starten"}
            </button>
            {lvImport.crossLvMatchedAt ? (
              <p className="mt-2 text-xs text-gray-500">
                Letzter Abgleich:{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Berlin",
                }).format(lvImport.crossLvMatchedAt)}
                {lvImport.crossLvMatchedByUser ? ` von ${lvImport.crossLvMatchedByUser.name}` : ""}
                {" · "}Kurztext {Math.round(lvImport.crossLvKurztextThreshold * 100)}%
                {" · "}Langtext {Math.round(lvImport.crossLvLangtextThreshold * 100)}%
                {" · "}Menge: {lvImport.crossLvExactMenge ? "muss gleich sein" : "beliebig"}
                {" · "}Einheit: {lvImport.crossLvExactEinheit ? "muss gleich sein" : "beliebig"}
              </p>
            ) : null}
          </form>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <form action={adoptBestPricesForImport}>
              <input name="importId" type="hidden" value={importId} />
              <button
                className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                title="Füllt jede noch ungepreiste Position mit dem besten verfügbaren Preis - aus bestätigten Katalog-Zuordnungen, sonst aus dem ähnlichsten Treffer in einem anderen LV"
                type="submit"
              >
                Alle mit bestem Treffer vorkalkulieren
              </button>
            </form>

            {lineItems.some((item) => item.priceSourceLvImportId) ? (
              <form action={clearAdoptedPricesForImport}>
                <input name="importId" type="hidden" value={importId} />
                <button
                  className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  title="Entfernt bei allen Positionen dieses Imports einen übernommenen Preis wieder - Preise aus der Originaldatei sind davon nicht betroffen"
                  type="submit"
                >
                  Übernommene Preise zurücksetzen
                </button>
              </form>
            ) : null}

            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export`}
              title="Exportiert dieses LV als GAEB (X83) mit den aktuell hinterlegten Einheitspreisen - z.B. zum Weiterverarbeiten in iTWO"
            >
              Als GAEB exportieren ↓
            </a>

            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export-excel`}
              title="Exportiert dieses LV als Excel-Tabelle mit den aktuell hinterlegten Einheitspreisen"
            >
              Als Excel exportieren ↓
            </a>

            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export-pdf`}
              title="Exportiert dieses LV als druckbares PDF mit den aktuell hinterlegten Einheitspreisen"
            >
              Als PDF exportieren ↓
            </a>
          </div>
        </>
      )}

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3">OZ</th>
              <th className="p-3">Kurztext</th>
              <th className="p-3">Langtext</th>
              <th className="p-3">LV-Menge</th>
              <th className="p-3">Einheit</th>
              <th className="p-3">EP</th>
              <th className="p-3 w-64">Ähnlich in anderen LVs</th>
              <th className="p-3 w-40">Vorschlag</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-40">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => {
              if (item.entryType === "TITLE") {
                return (
                  <tr key={item.id}>
                    <td className="bg-gray-900 p-3 font-bold text-white" colSpan={10}>
                      {item.rawText}
                    </td>
                  </tr>
                );
              }

              if (item.entryType === "REMARK") {
                return (
                  <tr key={item.id}>
                    <td className="whitespace-pre-line bg-amber-50 p-3 text-sm italic text-amber-950" colSpan={10}>
                      <span className="font-bold not-italic">Vorbemerkung: </span>
                      {item.rawText}
                    </td>
                  </tr>
                );
              }

              const status = STATUS_LABELS[item.matchStatus] ?? STATUS_LABELS.PENDING;
              return (
                <tr className="border-t border-gray-100 align-top" key={item.id}>
                  <td className="p-3 text-gray-500">{item.positionNumber ?? "–"}</td>
                  <td className="p-3 max-w-xs font-semibold text-gray-900">{item.shortText ?? "–"}</td>
                  <td className="whitespace-pre-line p-3 max-w-sm text-gray-700">{item.rawText}</td>
                  <td className="p-3 whitespace-nowrap">{item.quantity ?? "–"}</td>
                  <td className="p-3 whitespace-nowrap">{item.unit ?? "–"}</td>
                  <td className="w-28 max-w-28 p-3">
                    <span className="whitespace-nowrap">{formatCents(item.unitPriceCents)}</span>
                    {item.priceSourceLvImportId && priceSourceImportById.has(item.priceSourceLvImportId) ? (
                      <div className="whitespace-normal break-words text-xs font-normal text-gray-500">
                        übernommen aus {formatLvSource(priceSourceImportById.get(item.priceSourceLvImportId)!)}
                        {item.priceSourceSimilarity != null ? ` (${Math.round(item.priceSourceSimilarity * 100)}%)` : ""}
                        <form action={clearPrice} className="mt-1">
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <button className="font-bold text-red-700 underline" type="submit">
                            entfernen
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </td>
                  <td className="w-64 max-w-64 p-3">
                    {!showCrossLvMatches ? (
                      <span className="text-gray-400">nicht geladen</span>
                    ) : (crossLvMatchesByLineItem.get(item.id) ?? []).length === 0 ? (
                      <span className="text-gray-400">–</span>
                    ) : (
                      <div className="space-y-2">
                        {(crossLvMatchesByLineItem.get(item.id) ?? []).map((match) => {
                          const cross = match.source;
                          const isAnsatz = cross.lvImport.sourceFormat === "RIB_KALKULATION";
                          const diffTokens = diffWords(item.rawText, cross.rawText);
                          return (
                            <div className="border-b border-gray-100 pb-2 last:border-0 last:pb-0" key={cross.id}>
                              <div className="break-words font-semibold text-gray-900">{cross.shortText ?? cross.rawText.slice(0, 60)}</div>
                              <div className="text-xs text-gray-500">
                                Kurztext {Math.round(match.kurztextScore * 100)}% · Langtext {Math.round(match.langtextScore * 100)}%
                                {match.exactMengeMatch ? " · Menge gleich" : ""}
                                {match.exactEinheitMatch ? " · Einheit gleich" : ""}
                              </div>
                              <div className="mt-1 text-xs font-semibold text-green-800">
                                {isAnsatz ? "Kalkulationsansatz" : formatCents(cross.unitPriceCents)} · {formatLvSource(cross.lvImport)}
                                {cross.lvImport.lvDate
                                  ? ` (${new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(cross.lvImport.lvDate)})`
                                  : ""}
                              </div>
                              <details className="mt-1">
                                <summary className="cursor-pointer text-xs font-semibold text-blue-700 underline">
                                  Unterschiede anzeigen
                                </summary>
                                <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-700">
                                  {diffTokens.map((token, index) =>
                                    token.changed ? (
                                      <strong className="text-red-700" key={index}>
                                        {token.text}{" "}
                                      </strong>
                                    ) : (
                                      <span key={index}>{token.text} </span>
                                    ),
                                  )}
                                </p>
                              </details>
                              {isAnsatz ? (
                                <form action={adoptAnsatzFromCandidate}>
                                  <input name="lineItemId" type="hidden" value={item.id} />
                                  <input name="sourceCandidateId" type="hidden" value={cross.id} />
                                  <button
                                    className="mt-1 rounded-lg bg-purple-700 px-2 py-1 text-xs font-bold text-white hover:bg-purple-800"
                                    title="Übernimmt den Kalkulationsansatz dieser Position in die eigene Kalkulation dieses Projekts"
                                    type="submit"
                                  >
                                    Ansatz übernehmen
                                  </button>
                                </form>
                              ) : cross.unitPriceCents != null ? (
                                <form action={adoptPrice}>
                                  <input name="lineItemId" type="hidden" value={item.id} />
                                  <input name="unitPriceCents" type="hidden" value={cross.unitPriceCents} />
                                  <input name="quantity" type="hidden" value={item.quantity ?? ""} />
                                  <input name="sourceLvImportId" type="hidden" value={cross.lvImportId} />
                                  <input name="similarityScore" type="hidden" value={match.langtextScore} />
                                  {cross.matchedPositionId ? (
                                    <input name="sourcePositionId" type="hidden" value={cross.matchedPositionId} />
                                  ) : null}
                                  <button
                                    className="mt-1 rounded-lg bg-blue-700 px-2 py-1 text-xs font-bold text-white hover:bg-blue-800"
                                    title={
                                      cross.matchedPositionId
                                        ? "Übernimmt Preis UND Katalogzuordnung, bestätigt die Position"
                                        : "Übernimmt nur den Preis - die Quellposition ist selbst noch keiner Katalogposition zugeordnet"
                                    }
                                    type="submit"
                                  >
                                    {cross.matchedPositionId ? "Diesen Treffer übernehmen" : "Nur Preis übernehmen"}
                                  </button>
                                </form>
                              ) : (
                                <form action={linkCrossLvMatch}>
                                  <input name="lineItemId" type="hidden" value={item.id} />
                                  <input name="sourceLineItemId" type="hidden" value={cross.id} />
                                  <input name="similarityScore" type="hidden" value={match.langtextScore} />
                                  <button
                                    className="mt-1 rounded-lg bg-blue-700 px-2 py-1 text-xs font-bold text-white hover:bg-blue-800"
                                    title="Markiert diese Position als dieselbe wie im anderen LV - noch ohne Preis, aber für später verknüpft (z.B. sobald eines der beiden LVs kalkuliert wird)"
                                    type="submit"
                                  >
                                    Als gleiche Position markieren
                                  </button>
                                </form>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="w-40 max-w-40 p-3">
                    {item.matchedPosition ? (
                      <div>
                        <div className="break-words font-semibold text-gray-900">{item.matchedPosition.title}</div>
                        {item.matchConfidence != null ? (
                          <div className="text-xs text-gray-500">
                            Konfidenz {Math.round(item.matchConfidence * 100)}%
                          </div>
                        ) : null}
                        {item.matchReasoning ? (
                          <div className="text-xs text-gray-500">{item.matchReasoning}</div>
                        ) : null}
                        {(priceHistoryByPosition.get(item.matchedPosition.id) ?? []).map((history) => (
                          <div className="mt-1" key={history.id}>
                            <div className="text-xs font-semibold text-green-800">
                              {formatCents(history.unitPriceCents)} · {formatLvSource(history.lvImport)}
                              {history.lvImport.lvDate
                                ? ` (${new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(history.lvImport.lvDate)})`
                                : ""}
                            </div>
                            {history.unitPriceCents != null ? (
                              <form action={adoptPrice}>
                                <input name="lineItemId" type="hidden" value={item.id} />
                                <input name="unitPriceCents" type="hidden" value={history.unitPriceCents} />
                                <input name="quantity" type="hidden" value={item.quantity ?? ""} />
                                <input name="sourceLvImportId" type="hidden" value={history.lvImportId} />
                                <button className="text-xs font-bold text-blue-700 underline" type="submit">
                                  Preis übernehmen
                                </button>
                              </form>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">–</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="w-40 max-w-40 p-3">
                    {item.matchedVia === "CROSS_PROJECT_ANSATZ" ? (
                      <div className="flex flex-col gap-2">
                        {item.matchStatus !== "CONFIRMED" && item.matchStatus !== "REJECTED" ? (
                          <>
                            <form action={confirmAnsatzSuggestion}>
                              <input name="lineItemId" type="hidden" value={item.id} />
                              <button
                                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white"
                                title="Diesen übernommenen Ansatz behalten - zählt zum D31-Export dazu"
                                type="submit"
                              >
                                Übernehmen
                              </button>
                            </form>
                            <form action={rejectAnsatzSuggestion}>
                              <input name="lineItemId" type="hidden" value={item.id} />
                              <button
                                className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                                title="Diesen Vorschlag verwerfen - fehlt dann im D31-Export"
                                type="submit"
                              >
                                Verwerfen
                              </button>
                            </form>
                            {item.ansatzAlternativesJson ? (
                              (() => {
                                const alternatives: StoredAnsatzAlternative[] = JSON.parse(item.ansatzAlternativesJson);
                                if (alternatives.length === 0) return null;
                                return (
                                  <details className="mt-1">
                                    <summary className="cursor-pointer text-xs font-semibold text-blue-700 underline">
                                      Andere Vorschläge ({alternatives.length})
                                    </summary>
                                    <div className="mt-1 space-y-1.5">
                                      {alternatives.map((alternative, index) => (
                                        <div className="border-t border-gray-100 pt-1" key={`${alternative.sourceProjectNumber}-${index}`}>
                                          <div className="break-words text-xs text-gray-700">
                                            Projekt {alternative.sourceProjectNumber} ({Math.round(alternative.similarity * 100)}%)
                                          </div>
                                          <form action={chooseAnsatzAlternative}>
                                            <input name="lineItemId" type="hidden" value={item.id} />
                                            <input name="alternativeIndex" type="hidden" value={index} />
                                            <button
                                              className="mt-0.5 rounded-lg border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-bold text-purple-800 hover:bg-purple-100"
                                              title="Diesen Ansatz aus diesem Projekt stattdessen übernehmen"
                                              type="submit"
                                            >
                                              Diesen stattdessen nehmen
                                            </button>
                                          </form>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                );
                              })()
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : (
                    <div className="flex flex-col gap-2">
                      {item.matchedPositionId && item.matchStatus !== "CONFIRMED" ? (
                        <form action={confirmMatch}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <input name="positionId" type="hidden" value={item.matchedPositionId} />
                          <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white" type="submit">
                            Bestätigen
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "REJECTED" && item.matchStatus !== "CONFIRMED" ? (
                        <form action={rejectMatch}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50" type="submit">
                            Ablehnen
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "CONFIRMED" ? (
                        <form action={manualMatch} className="flex flex-col gap-1">
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <select className="w-full max-w-full rounded-lg border border-gray-300 px-2 py-1 text-xs" name="positionId" required>
                            <option value="">Manuell wählen …</option>
                            {positions.map((position) => (
                              <option key={position.id} value={position.id}>
                                {position.title}
                              </option>
                            ))}
                          </select>
                          <button className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold hover:bg-gray-50" type="submit">
                            OK
                          </button>
                        </form>
                      ) : null}

                      {item.matchStatus !== "CONFIRMED" ? (
                        <form action={createPositionFromLineItem}>
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <button className="text-left text-xs text-gray-500 underline" type="submit">
                            Neue Katalogposition anlegen
                          </button>
                        </form>
                      ) : null}
                    </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
