import { prisma } from "@/lib/prisma";
import {
  adoptBestPricesForImport,
  adoptPrice,
  confirmMatch,
  createPositionFromLineItem,
  linkCrossLvMatch,
  manualMatch,
  rejectMatch,
  runMatching,
} from "./actions";
import { MatchingThresholdInput } from "./MatchingThresholdInput";
import { buildShortlist, type CatalogEntryForMatching } from "@/lib/kalkulation-matching";
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
 * gerendert werden kann, statt dorthin verlinken zu müssen. */
export async function LvReviewPanel({ importId }: { importId: string }) {
  const [lvImport, lineItems, positions] = await Promise.all([
    prisma.kalkulationLvImport.findUniqueOrThrow({ where: { id: importId } }),
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

  // Direkter Vergleich gegen Positionen ANDERER bereits importierter LVs -
  // unabhängig davon, ob dort schon irgendetwas bestätigt/katalogisiert
  // wurde. Ergänzt (ersetzt nicht) den Katalog-Abgleich.
  const otherLvItems = await prisma.kalkulationLvLineItem.findMany({
    where: { entryType: "ITEM", lvImportId: { not: importId } },
    include: { lvImport: true },
    orderBy: { createdAt: "desc" },
    take: 3000,
  });
  const otherLvItemsById = new Map(otherLvItems.map((row) => [row.id, row]));
  const otherLvCatalog: CatalogEntryForMatching[] = otherLvItems.map((row) => ({
    id: row.id,
    code: row.positionNumber,
    title: row.shortText ?? row.rawText.slice(0, 100),
    description: row.rawText,
    unit: row.unit ?? "",
  }));
  type CrossLvMatch = (typeof otherLvItems)[number] & { similarityScore: number };
  const crossLvMatchesByLineItem = new Map<string, CrossLvMatch[]>();
  if (otherLvCatalog.length > 0) {
    for (const item of lineItems) {
      if (item.entryType !== "ITEM") continue;
      const combinedText = `${item.shortText ?? ""} ${item.rawText}`.trim();
      const candidates = buildShortlist(combinedText, otherLvCatalog, 15, lvImport.matchingThreshold);
      const bestPerImport = new Map<string, CrossLvMatch>();
      for (const candidate of candidates) {
        const source = otherLvItemsById.get(candidate.positionId);
        if (!source) continue;
        const existing = bestPerImport.get(source.lvImportId);
        if (!existing || candidate.similarityScore > existing.similarityScore) {
          bestPerImport.set(source.lvImportId, { ...source, similarityScore: candidate.similarityScore });
        }
      }
      const top3 = [...bestPerImport.values()].sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
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

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start gap-3">
        <form action={runMatching} className="max-w-md rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <input name="importId" type="hidden" value={importId} />
          <MatchingThresholdInput defaultValue={Math.round(lvImport.matchingThreshold * 100)} name="matchingThreshold" />
          <button
            className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            title="Wendet zuerst gelernte Zuordnungen an, danach - falls eingerichtet - die KI"
            type="submit"
          >
            Abgleich starten
          </button>
        </form>

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

      <section className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-3">OZ</th>
              <th className="p-3">Kurztext</th>
              <th className="p-3">Langtext</th>
              <th className="p-3">LV-Menge</th>
              <th className="p-3">Mengeneinheit</th>
              <th className="p-3">EP</th>
              <th className="p-3">Ähnlich in anderen LVs</th>
              <th className="p-3">Vorschlag</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aktion</th>
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
                  <td className="p-3 max-w-sm text-gray-700">{item.rawText}</td>
                  <td className="p-3 whitespace-nowrap">{item.quantity ?? "–"}</td>
                  <td className="p-3 whitespace-nowrap">{item.unit ?? "–"}</td>
                  <td className="p-3 whitespace-nowrap">
                    {formatCents(item.unitPriceCents)}
                    {item.priceSourceLvImportId && priceSourceImportById.has(item.priceSourceLvImportId) ? (
                      <div className="text-xs font-normal text-gray-500">
                        übernommen aus {formatLvSource(priceSourceImportById.get(item.priceSourceLvImportId)!)}
                        {item.priceSourceSimilarity != null ? ` (${Math.round(item.priceSourceSimilarity * 100)}%)` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {(crossLvMatchesByLineItem.get(item.id) ?? []).length === 0 ? (
                      <span className="text-gray-400">–</span>
                    ) : (
                      <div className="space-y-2">
                        {(crossLvMatchesByLineItem.get(item.id) ?? []).map((cross) => (
                          <div className="border-b border-gray-100 pb-2 last:border-0 last:pb-0" key={cross.id}>
                            <div className="font-semibold text-gray-900">{cross.shortText ?? cross.rawText.slice(0, 60)}</div>
                            <div className="text-xs text-gray-500">Ähnlichkeit {Math.round(cross.similarityScore * 100)}%</div>
                            <div className="mt-1 text-xs font-semibold text-green-800">
                              {formatCents(cross.unitPriceCents)} · {formatLvSource(cross.lvImport)}
                              {cross.lvImport.lvDate
                                ? ` (${new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(cross.lvImport.lvDate)})`
                                : ""}
                            </div>
                            {cross.unitPriceCents != null ? (
                              <form action={adoptPrice}>
                                <input name="lineItemId" type="hidden" value={item.id} />
                                <input name="unitPriceCents" type="hidden" value={cross.unitPriceCents} />
                                <input name="quantity" type="hidden" value={item.quantity ?? ""} />
                                <input name="sourceLvImportId" type="hidden" value={cross.lvImportId} />
                                <input name="similarityScore" type="hidden" value={cross.similarityScore} />
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
                                <input name="similarityScore" type="hidden" value={cross.similarityScore} />
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
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {item.matchedPosition ? (
                      <div>
                        <div className="font-semibold text-gray-900">{item.matchedPosition.title}</div>
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
                  <td className="p-3">
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
                        <form action={manualMatch} className="flex gap-1">
                          <input name="lineItemId" type="hidden" value={item.id} />
                          <select className="rounded-lg border border-gray-300 px-2 py-1 text-xs" name="positionId" required>
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
