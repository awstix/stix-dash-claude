import { prisma } from "@/lib/prisma";
import {
  adoptAnsatzFromCandidate,
  adoptPrice,
  chooseAnsatzAlternative,
  clearPrice,
  confirmAnsatzSuggestion,
  confirmMatch,
  createPositionFromLineItem,
  linkCrossLvMatch,
  manualMatch,
  rejectAnsatzSuggestion,
  rejectMatch,
  updateCrossLvSettings,
} from "./actions";
import { AnsatzSuggestForm } from "./AnsatzSuggestForm";
import { ImportForm } from "@/components/ImportForm";
import { MatchingThresholdInput } from "./MatchingThresholdInput";
import type { StoredCrossLvMatch } from "@/lib/kalkulation-matching";
import {
  ansatzPoolByProjectAndOz,
  buildAnsatzPool,
  type AnsatzPoolEntry,
  type StoredAnsatzAlternative,
} from "@/lib/kalkulation-ansatz-pool";
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
 * Der Vergleich gegen ALLE Positionen anderer LVs in der ganzen DB ist
 * teuer (skaliert mit der Gesamtmenge an Positionen) - läuft deshalb nur
 * beim Klick auf "Abgleich starten" (siehe updateCrossLvSettings in
 * actions.ts), das Ergebnis wird dort gespeichert und hier nur noch
 * gelesen, nicht bei jedem Seitenaufruf neu berechnet. */
export async function LvReviewPanel({
  importId,
  returnTo,
}: {
  importId: string;
  returnTo?: string;
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

  const isKalkulation = lvImport.sourceFormat === "RIB_KALKULATION";

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

  // Ergebnis von "Abgleich starten" wird beim Klick berechnet und in
  // crossLvMatchesJson je Position gespeichert (siehe updateCrossLvSettings
  // in actions.ts) - hier nur noch aus der Datenbank laden und die
  // referenzierten Quell-Positionen auflösen, keine Live-Berechnung mehr
  // bei jedem Seitenaufruf. Zeigt so immer den letzten Abgleich-Stand,
  // auch ohne ihn erneut auszulösen.
  type CrossLvItem = Awaited<ReturnType<typeof prisma.kalkulationLvLineItem.findMany<{ include: { lvImport: true } }>>>[number];
  type CrossLvMatch = {
    exactEinheitMatch: boolean;
    exactMengeMatch: boolean;
    kurztextScore: number;
    langtextScore: number;
    source: CrossLvItem;
  };
  const crossLvMatchesByLineItem = new Map<string, CrossLvMatch[]>();
  const storedMatchesByItemId = new Map<string, StoredCrossLvMatch[]>();
  const referencedSourceIds = new Set<string>();
  for (const item of lineItems) {
    if (!item.crossLvMatchesJson) continue;
    const stored: StoredCrossLvMatch[] = JSON.parse(item.crossLvMatchesJson);
    storedMatchesByItemId.set(item.id, stored);
    for (const match of stored) referencedSourceIds.add(match.sourceLineItemId);
  }
  if (referencedSourceIds.size > 0) {
    const sourceItems = await prisma.kalkulationLvLineItem.findMany({
      include: { lvImport: true },
      where: { id: { in: [...referencedSourceIds] } },
    });
    const sourceItemsById = new Map(sourceItems.map((row) => [row.id, row]));
    for (const [itemId, stored] of storedMatchesByItemId) {
      const resolved = stored
        .map((match) => {
          const source = sourceItemsById.get(match.sourceLineItemId);
          if (!source) return null;
          return {
            exactEinheitMatch: match.exactEinheitMatch,
            exactMengeMatch: match.exactMengeMatch,
            kurztextScore: match.kurztextScore,
            langtextScore: match.langtextScore,
            source,
          } satisfies CrossLvMatch;
        })
        .filter((match): match is CrossLvMatch => match !== null);
      if (resolved.length > 0) crossLvMatchesByLineItem.set(itemId, resolved);
    }
  }
  // Für die Anzeige "X/Y Positionen haben Treffer" direkt in der
  // Abgleich-Kachel - Titel/Vorbemerkungen zählen nicht als Position.
  const matchableItemCount = lineItems.filter((item) => item.entryType === "ITEM").length;
  const itemsWithCrossLvMatchCount = lineItems.filter(
    (item) => item.entryType === "ITEM" && crossLvMatchesByLineItem.has(item.id),
  ).length;

  // Für die "übernommen aus ..."-Anzeige je Zeile: die Quell-Imports
  // übernommener Preise auflösen.
  const priceSourceImportIds = [
    ...new Set(lineItems.map((item) => item.priceSourceLvImportId).filter((id): id is string => Boolean(id))),
  ];
  const priceSourceImports = priceSourceImportIds.length
    ? await prisma.kalkulationLvImport.findMany({ where: { id: { in: priceSourceImportIds } } })
    : [];
  const priceSourceImportById = new Map(priceSourceImports.map((source) => [source.id, source]));

  // Für den Nicht-Kalkulations-Zweig (das eigentliche LV): der verknüpfte
  // Kalkulations-Import dieses Projekts (falls vorhanden) - damit sich
  // "Ansätze vorschlagen" und "Als XML exportieren" direkt von hier aus
  // bedienen lassen, ohne zum separaten Kalkulations-Panel scrollen zu
  // müssen. Ebenso: welche anderen Projekte überhaupt eine als final
  // markierte Kalkulation haben (für den gezielten Projekt-Abgleich) und -
  // nur wenn der Live-Vergleich an ist - ein OZ-Nachschlag, welche der
  // "Ähnlich in anderen LVs"-Treffer bereits einen Ansatz haben (siehe
  // findAnsatzCandidatesViaLvMatch in kalkulation-ansatz-pool.ts - genau
  // dieselbe Logik wie beim Massen-Vorschlag, statt nur die Kalkulations-
  // XML-eigene Textähnlichkeit zu prüfen).
  let linkedKalkulationImportId: string | null = null;
  let linkedKalkulationHasExportableItems = false;
  let ansatzByProjectAndOz = new Map<string, AnsatzPoolEntry>();
  // Welche anderen Projekte überhaupt eine als final markierte Kalkulation
  // haben - Grundlage für die Projekt-Auswahl neben "Ansätze aus anderen
  // Projekten vorschlagen" (gilt für beide Zweige: LV und Kalkulation).
  const finalKalkulationImports = lvImport.projectNumber
    ? await prisma.kalkulationLvImport.findMany({
        distinct: ["projectNumber"],
        select: { projectNumber: true },
        where: {
          isFinalCalculation: true,
          projectNumber: { not: lvImport.projectNumber },
          sourceFormat: "RIB_KALKULATION",
        },
      })
    : [];
  const eligibleTargetProjectNumbers = finalKalkulationImports
    .map((entry) => entry.projectNumber)
    .filter((value): value is string => Boolean(value));
  if (!isKalkulation && lvImport.projectNumber) {
    // Der verknüpfte Kalkulations-Import dieses Projekts (falls vorhanden)
    // - damit sich "Als XML exportieren" direkt von hier aus bedienen
    // lässt, ohne zum separaten Kalkulations-Panel scrollen zu müssen.
    // isFinalCalculation: false, weil dieser Export-Link immer die
    // vorkalkulierte Entwurfsdatei zeigt, nie die als final hochgeladene
    // Referenz (die hat ihre eigene Kachel "Finale Kalkulation").
    const linkedKalkulationImport = await prisma.kalkulationLvImport.findFirst({
      orderBy: { createdAt: "desc" },
      where: { isFinalCalculation: false, projectNumber: lvImport.projectNumber, sourceFormat: "RIB_KALKULATION" },
    });
    if (linkedKalkulationImport) {
      linkedKalkulationImportId = linkedKalkulationImport.id;
      const exportableCount = await prisma.kalkulationLvLineItem.count({
        where: { lvImportId: linkedKalkulationImport.id, ribRawBlockXml: { not: null } },
      });
      linkedKalkulationHasExportableItems = exportableCount > 0;
    }
    // Ein OZ-Nachschlag, welche der "Ähnlich in anderen LVs"-Treffer
    // bereits einen Ansatz haben (siehe findAnsatzCandidatesViaLvMatch in
    // kalkulation-ansatz-pool.ts - genau dieselbe Logik wie beim
    // Massen-Vorschlag, statt nur die Kalkulations-XML-eigene
    // Textähnlichkeit zu prüfen).
    const pool = await buildAnsatzPool(lvImport.projectNumber);
    ansatzByProjectAndOz = ansatzPoolByProjectAndOz(pool);
  }

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
          {/* Eine als final hochgeladene Kalkulation ist die verifizierte
           * Referenzdatei - Vorschläge dürfen die nie befüllen (siehe
           * isFinalCalculation-Filter in suggestAnsaetzeFromHistory), der
           * Button hier würde also ohnehin an dieser Datei vorbeischreiben. */}
          {lvImport.projectNumber && !lvImport.isFinalCalculation ? (
            <AnsatzSuggestForm
              projectNumber={lvImport.projectNumber}
              returnTo={returnTo ?? `/kalkulation/imports/${importId}`}
            />
          ) : null}

          {lineItems.some((item) => item.ribRawBlockXml) ? (
            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export-xml`}
              title="Exportiert die Kalkulationsansätze dieses Imports als .xml - zum Wiedereinlesen in iTWO"
            >
              {lvImport.isFinalCalculation ? "Finale XML exportieren ↓" : "Vorkalkulierte XML exportieren ↓"}
            </a>
          ) : null}
        </div>
      ) : (
        <>
          {/* Abgleich-Kachel und Ansätze-vorschlagen-Block nebeneinander -
           * bei max-w-2xl auf der Abgleich-Kachel bleibt auf normalen
           * Bildschirmbreiten genug Platz rechts daneben frei, statt beides
           * in getrennten volle-Breite-Zeilen untereinander zu zeigen. */}
          <div className="mb-3 flex flex-wrap items-start gap-4">
            {/* Immer sichtbar (nicht nur solange noch nicht geladen) - sonst gibt
             * es nach dem ersten Abgleich keine Möglichkeit mehr, die Kriterien
             * zu ändern und erneut abzugleichen. */}
            <ImportForm
              action={updateCrossLvSettings}
              className="max-w-2xl flex-1 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
              itemLabel="Position"
              progressEndpoint="/kalkulation/imports/progress"
              startingLabel="Abgleich startet …"
            >
              <input name="importId" type="hidden" value={importId} />
              <input name="returnTo" type="hidden" value={returnTo ?? `/kalkulation/imports/${importId}`} />
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
              <label className="mt-3 block text-sm font-semibold text-gray-900">
                Gegen welche Projekte?
                <select
                  className="mt-1 w-full max-w-xs rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  defaultValue={lvImport.crossLvTargetProjectNumber ?? ""}
                  name="targetProjectNumber"
                  title="Gilt für 'Abgleich starten' und 'Ansätze aus anderen Projekten vorschlagen' gleichermaßen"
                >
                  <option value="">Alle Projekte</option>
                  {eligibleTargetProjectNumbers.map((number) => (
                    <option key={number} value={number}>
                      Nur Projekt {number}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                title="Vergleicht jede Position live gegen alle Positionen anderer LVs/Kalkulationen in der Datenbank - dauert je nach Datenmenge einen Moment, deshalb nicht automatisch"
                type="submit"
              >
                {lvImport.crossLvMatchedAt ? "Erneut abgleichen" : "Abgleich starten"}
              </button>
              {lvImport.crossLvMatchedAt ? (
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {itemsWithCrossLvMatchCount}/{matchableItemCount} Positionen haben Treffer in anderen LVs
                </p>
              ) : null}
              {lvImport.crossLvMatchedAt ? (
                <p className="mt-1 text-xs text-gray-500">
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
                  {" · "}
                  {lvImport.crossLvTargetProjectNumber
                    ? `Nur Projekt ${lvImport.crossLvTargetProjectNumber}`
                    : "Alle Projekte"}
                </p>
              ) : null}
            </ImportForm>

            {/* Wichtigste Aktionen daneben: Ansätze vorschlagen und der
             * Export der daraus entstehenden vorkalkulierten XML - vorher
             * stand der Export-Link ganz am Ende der Reihe, nach GAEB/Excel/
             * PDF, obwohl er der eigentliche Ziel-Download dieses Ablaufs ist. */}
            <div className="flex flex-1 flex-col items-start gap-2">
              {lvImport.projectNumber ? (
                <AnsatzSuggestForm
                  projectNumber={lvImport.projectNumber}
                  returnTo={returnTo ?? `/kalkulation/imports/${importId}`}
                />
              ) : null}

              {linkedKalkulationHasExportableItems && linkedKalkulationImportId ? (
                <a
                  className="inline-block rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                  href={`/kalkulation/imports/${linkedKalkulationImportId}/export-xml`}
                  title="Exportiert den aktuellen Kalkulations-Entwurf dieses Projekts als .xml - zum Wiedereinlesen in iTWO"
                >
                  Vorkalkulierte XML exportieren ↓
                </a>
              ) : null}
            </div>
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
                    {(crossLvMatchesByLineItem.get(item.id) ?? []).length === 0 ? (
                      <span className="text-gray-400">–</span>
                    ) : (
                      <div className="space-y-2">
                        {(crossLvMatchesByLineItem.get(item.id) ?? []).map((match) => {
                          const cross = match.source;
                          // Nicht nur prüfen, ob DIESE Treffer-Position selbst aus
                          // einer Kalkulations-XML stammt (das trifft oft nicht zu,
                          // siehe Kommentar bei findAnsatzCandidatesViaLvMatch) -
                          // stattdessen über Projekt+OZ nachschlagen, ob das
                          // Treffer-Projekt für dieselbe Position überhaupt einen
                          // Ansatz hinterlegt hat, unabhängig davon, welche Zeile
                          // hier textlich am ähnlichsten war.
                          const resolvedAnsatz =
                            cross.lvImport.projectNumber && cross.positionNumber
                              ? ansatzByProjectAndOz.get(`${cross.lvImport.projectNumber}::${cross.positionNumber.trim()}`)
                              : undefined;
                          const isAnsatz = Boolean(resolvedAnsatz);
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
                              {isAnsatz && resolvedAnsatz ? (
                                <form action={adoptAnsatzFromCandidate}>
                                  <input name="lineItemId" type="hidden" value={item.id} />
                                  <input name="sourceCandidateId" type="hidden" value={resolvedAnsatz.sourceLineItemId} />
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
                        {/* Übernehmen/Verwerfen bleiben auch nach einer
                         * Entscheidung nutzbar (nur die jeweils schon
                         * aktive Aktion wird ausgeblendet) - sonst gibt es
                         * nach einem Klick keine Möglichkeit mehr, die
                         * Entscheidung zu ändern oder eine Alternative zu
                         * wählen. */}
                        {item.matchStatus !== "CONFIRMED" ? (
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
                        ) : null}
                        {item.matchStatus !== "REJECTED" ? (
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
                        ) : null}
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
                                        Projekt {alternative.sourceProjectNumber} ({Math.round(alternative.similarity * 100)}%,{" "}
                                        {new Intl.DateTimeFormat("de-DE", { month: "2-digit", year: "numeric" }).format(
                                          new Date(alternative.sourceImportDate),
                                        )}
                                        )
                                      </div>
                                      <form action={chooseAnsatzAlternative}>
                                        <input name="lineItemId" type="hidden" value={item.id} />
                                        <input name="alternativeIndex" type="hidden" value={index} />
                                        <button
                                          className="mt-0.5 rounded-lg border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-bold text-purple-800 hover:bg-purple-100"
                                          title="Diesen Ansatz aus diesem Projekt stattdessen übernehmen und direkt bestätigen"
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
