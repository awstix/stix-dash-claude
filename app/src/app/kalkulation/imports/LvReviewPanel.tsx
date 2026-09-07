import { prisma } from "@/lib/prisma";
import {
  adoptAnsatzFromCandidate,
  chooseAnsatzAlternative,
  clearAnsatzSuggestions,
  confirmAnsatzSuggestion,
  rejectAnsatzSuggestion,
  updateCrossLvSettings,
} from "./actions";
import { AnsatzSuggestForm } from "./AnsatzSuggestForm";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
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
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Übernehmen/Verwerfen/Andere Vorschläge für eine automatisch per Ansatz-
 * Übernahme befüllte Kalkulationszeile - wird sowohl direkt in der
 * Kalkulations-Tabelle als auch (über den verknüpften Kalkulations-
 * Eintrag) direkt an der zugehörigen LV-Zeile gerendert, damit man nicht
 * extra zur Kalkulations-Kachel scrollen muss, um eine Übernahme rückgängig
 * zu machen. Übernehmen/Verwerfen bleiben auch nach einer Entscheidung
 * nutzbar (nur die jeweils schon aktive Aktion wird ausgeblendet). */
function AnsatzActions({
  target,
}: {
  target: {
    id: string;
    ansatzAlternativesJson: string | null;
    matchStatus: string;
  };
}) {
  const alternatives: StoredAnsatzAlternative[] = target.ansatzAlternativesJson
    ? JSON.parse(target.ansatzAlternativesJson)
    : [];
  return (
    <div className="flex flex-col gap-2">
      {target.matchStatus !== "CONFIRMED" ? (
        <form action={confirmAnsatzSuggestion}>
          <input name="lineItemId" type="hidden" value={target.id} />
          <button
            className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-bold text-white"
            title="Diesen übernommenen Ansatz behalten - zählt zum D31-Export dazu"
            type="submit"
          >
            Übernehmen
          </button>
        </form>
      ) : null}
      {target.matchStatus !== "REJECTED" ? (
        <form action={rejectAnsatzSuggestion}>
          <input name="lineItemId" type="hidden" value={target.id} />
          <button
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
            title="Diesen Vorschlag verwerfen - fehlt dann im D31-Export"
            type="submit"
          >
            Verwerfen
          </button>
        </form>
      ) : null}
      {alternatives.length > 0 ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-blue-700 underline">
            Andere Vorschläge ({alternatives.length})
          </summary>
          <div className="mt-1 space-y-1.5">
            {alternatives.map((alternative, index) => (
              <div
                className="border-t border-gray-100 pt-1"
                key={`${alternative.sourceProjectNumber}-${index}`}
              >
                <div className="break-words text-xs text-gray-700">
                  Projekt {alternative.sourceProjectNumber} (
                  {Math.round(alternative.similarity * 100)}%,{" "}
                  {new Intl.DateTimeFormat("de-DE", {
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(alternative.sourceImportDate))}
                  )
                </div>
                <form action={chooseAnsatzAlternative}>
                  <input name="lineItemId" type="hidden" value={target.id} />
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
      ) : null}
    </div>
  );
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
  const [lvImport, lineItems] = await Promise.all([
    prisma.kalkulationLvImport.findUniqueOrThrow({
      include: { crossLvMatchedByUser: true },
      where: { id: importId },
    }),
    prisma.kalkulationLvLineItem.findMany({
      where: { lvImportId: importId },
      orderBy: { rowNumber: "asc" },
    }),
  ]);

  const isKalkulation = lvImport.sourceFormat === "RIB_KALKULATION";

  // Ergebnis von "Abgleich starten" wird beim Klick berechnet und in
  // crossLvMatchesJson je Position gespeichert (siehe updateCrossLvSettings
  // in actions.ts) - hier nur noch aus der Datenbank laden und die
  // referenzierten Quell-Positionen auflösen, keine Live-Berechnung mehr
  // bei jedem Seitenaufruf. Zeigt so immer den letzten Abgleich-Stand,
  // auch ohne ihn erneut auszulösen.
  type CrossLvItem = Awaited<
    ReturnType<
      typeof prisma.kalkulationLvLineItem.findMany<{
        include: { lvImport: true };
      }>
    >
  >[number];
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
  const matchableItemCount = lineItems.filter(
    (item) => item.entryType === "ITEM",
  ).length;
  const itemsWithCrossLvMatchCount = lineItems.filter(
    (item) =>
      item.entryType === "ITEM" && crossLvMatchesByLineItem.has(item.id),
  ).length;

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
  let linkedKalkulationHasAnsatzSuggestions = false;
  let ansatzByProjectAndOz = new Map<string, AnsatzPoolEntry>();
  // Zeigt direkt an der LV-Zeile an, ob ihre Position in der eigenen
  // Kalkulation dieses Projekts bereits einen übernommenen Ansatz hat -
  // sonst sieht man einem Klick auf "Ansatz übernehmen" nicht an, dass er
  // etwas bewirkt hat (er schreibt in die separate Kalkulationsdatei, die
  // LV-Zeile selbst ändert sich dabei nicht). id/ansatzAlternativesJson
  // werden mitgeführt, damit sich Verwerfen/Andere Vorschläge auch direkt
  // von der LV-Zeile aus bedienen lassen (Status/Aktion sind bei einer
  // reinen LV-Zeile sonst tot, seit der Preiskatalog-Abgleich entfernt ist).
  let ownAnsatzStatusByOz = new Map<
    string,
    {
      id: string;
      ansatzAlternativesJson: string | null;
      matchStatus: string;
      rawText: string;
    }
  >();
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
      where: {
        isFinalCalculation: false,
        projectNumber: lvImport.projectNumber,
        sourceFormat: "RIB_KALKULATION",
      },
    });
    if (linkedKalkulationImport) {
      linkedKalkulationImportId = linkedKalkulationImport.id;
      const [exportableCount, suggestionCount] = await Promise.all([
        prisma.kalkulationLvLineItem.count({
          where: {
            lvImportId: linkedKalkulationImport.id,
            ribRawBlockXml: { not: null },
          },
        }),
        prisma.kalkulationLvLineItem.count({
          where: {
            lvImportId: linkedKalkulationImport.id,
            matchedVia: "CROSS_PROJECT_ANSATZ",
          },
        }),
      ]);
      linkedKalkulationHasExportableItems = exportableCount > 0;
      linkedKalkulationHasAnsatzSuggestions = suggestionCount > 0;

      const ownAnsatzItems = await prisma.kalkulationLvLineItem.findMany({
        where: {
          lvImportId: linkedKalkulationImport.id,
          matchedVia: "CROSS_PROJECT_ANSATZ",
          positionNumber: { not: null },
        },
        select: {
          ansatzAlternativesJson: true,
          id: true,
          matchStatus: true,
          positionNumber: true,
          rawText: true,
        },
      });
      ownAnsatzStatusByOz = new Map(
        ownAnsatzItems.map((row) => [
          row.positionNumber!.trim(),
          {
            id: row.id,
            ansatzAlternativesJson: row.ansatzAlternativesJson,
            matchStatus: row.matchStatus,
            rawText: row.rawText,
          },
        ]),
      );
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

          {lineItems.some(
            (item) => item.matchedVia === "CROSS_PROJECT_ANSATZ",
          ) ? (
            <form action={clearAnsatzSuggestions}>
              <input name="importId" type="hidden" value={importId} />
              <input
                name="returnTo"
                type="hidden"
                value={returnTo ?? `/kalkulation/imports/${importId}`}
              />
              <ConfirmSubmitButton
                ariaLabel="Alle Ansatz-Vorschläge löschen"
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                confirmLabel="Löschen"
                icon="delete"
                label="Vorschläge löschen"
                message="Setzt ALLE automatisch übernommenen Ansatz-Vorschläge dieses Imports zurück auf offen - egal ob schon bestätigt oder noch zu prüfen. Echte, direkt aus iTWO hochgeladene Ansätze bleiben unberührt. Danach lässt sich neu zuordnen (erneut vorschlagen oder manuell)."
                title="Vorschläge löschen"
              />
            </form>
          ) : null}

          {lineItems.some((item) => item.ribRawBlockXml) ? (
            <a
              className="inline-block rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              href={`/kalkulation/imports/${importId}/export-xml`}
              title="Exportiert die Kalkulationsansätze dieses Imports als .xml - zum Wiedereinlesen in iTWO"
            >
              {lvImport.isFinalCalculation
                ? "Finale XML exportieren ↓"
                : "Vorkalkulierte XML exportieren ↓"}
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
              <input
                name="returnTo"
                type="hidden"
                value={returnTo ?? `/kalkulation/imports/${importId}`}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input
                      className="h-5 w-5 accent-gray-900"
                      defaultChecked={lvImport.crossLvFilterByKurztext}
                      name="crossLvFilterByKurztext"
                      type="checkbox"
                    />
                    Kurztext als Filter nutzen
                  </label>
                  <MatchingThresholdInput
                    defaultValue={Math.round(
                      lvImport.crossLvKurztextThreshold * 100,
                    )}
                    label="Kurztext-Ähnlichkeit"
                    max={100}
                    min={0}
                    name="crossLvKurztextThreshold"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <input
                      className="h-5 w-5 accent-gray-900"
                      defaultChecked={lvImport.crossLvFilterByLangtext}
                      name="crossLvFilterByLangtext"
                      type="checkbox"
                    />
                    Langtext als Filter nutzen
                  </label>
                  <MatchingThresholdInput
                    defaultValue={Math.round(
                      lvImport.crossLvLangtextThreshold * 100,
                    )}
                    label="Langtext-Ähnlichkeit"
                    max={100}
                    min={0}
                    name="crossLvLangtextThreshold"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Nicht angehakt = Schwelle wird nur angezeigt, aber nicht
                geprüft. Ein Treffer muss alle angehakten Kriterien gleichzeitig
                erfüllen (UND-Verknüpfung) - z.B. bei nur Langtext angehakt
                zählt ein sehr ähnlicher Langtext auch dann, wenn der Kurztext
                ganz anders formuliert ist.
              </p>
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
                {lvImport.crossLvMatchedAt
                  ? "Erneut abgleichen"
                  : "Abgleich starten"}
              </button>
              {lvImport.crossLvMatchedAt ? (
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {itemsWithCrossLvMatchCount}/{matchableItemCount} Positionen
                  haben Treffer in anderen LVs
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
                  {lvImport.crossLvMatchedByUser
                    ? ` von ${lvImport.crossLvMatchedByUser.name}`
                    : ""}
                  {" · "}Kurztext{" "}
                  {lvImport.crossLvFilterByKurztext
                    ? `${Math.round(lvImport.crossLvKurztextThreshold * 100)}% (gefiltert)`
                    : "nicht gefiltert"}
                  {" · "}Langtext{" "}
                  {lvImport.crossLvFilterByLangtext
                    ? `${Math.round(lvImport.crossLvLangtextThreshold * 100)}% (gefiltert)`
                    : "nicht gefiltert"}
                  {" · "}Menge:{" "}
                  {lvImport.crossLvExactMenge ? "muss gleich sein" : "beliebig"}
                  {" · "}Einheit:{" "}
                  {lvImport.crossLvExactEinheit
                    ? "muss gleich sein"
                    : "beliebig"}
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

              {linkedKalkulationHasAnsatzSuggestions &&
              linkedKalkulationImportId ? (
                <form action={clearAnsatzSuggestions}>
                  <input
                    name="importId"
                    type="hidden"
                    value={linkedKalkulationImportId}
                  />
                  <input
                    name="returnTo"
                    type="hidden"
                    value={returnTo ?? `/kalkulation/imports/${importId}`}
                  />
                  <ConfirmSubmitButton
                    ariaLabel="Alle Ansatz-Vorschläge löschen"
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    confirmLabel="Löschen"
                    icon="delete"
                    label="Vorschläge löschen"
                    message="Setzt ALLE automatisch übernommenen Ansatz-Vorschläge dieses Projekts zurück auf offen - egal ob schon bestätigt oder noch zu prüfen. Echte, direkt aus iTWO hochgeladene Ansätze bleiben unberührt. Danach lässt sich neu zuordnen (erneut vorschlagen oder manuell)."
                    title="Vorschläge löschen"
                  />
                </form>
              ) : null}

              {linkedKalkulationHasExportableItems &&
              linkedKalkulationImportId ? (
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

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Eigene, nach oben begrenzte Scroll-Box statt reinem overflow-x-auto
         * - position:sticky für die Kopfzeile braucht einen Vorfahren, der
         * selbst tatsächlich vertikal scrollt (nicht nur überläuft). Ein
         * Container, der nur horizontal überläuft, scrollt intern nie
         * vertikal (das übernimmt sonst die ganze Seite) und sticky greift
         * dann nicht. max-h wirkt nur als Obergrenze - kurze Tabellen zeigen
         * keinen eigenen Scrollbalken. */}
        <div className="max-h-[75vh] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">OZ</th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">Kurztext</th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">Langtext</th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">LV-Menge</th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">Einheit</th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">EP</th>
                <th className="sticky top-0 z-10 w-64 bg-gray-50 p-3">
                  Ähnlich in anderen LVs
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 p-3">Status</th>
                <th className="sticky top-0 z-10 w-40 bg-gray-50 p-3">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => {
                if (item.entryType === "TITLE") {
                  return (
                    <tr key={item.id}>
                      <td
                        className="bg-gray-900 p-3 font-bold text-white"
                        colSpan={9}
                      >
                        {item.rawText}
                      </td>
                    </tr>
                  );
                }

                if (item.entryType === "REMARK") {
                  return (
                    <tr key={item.id}>
                      <td
                        className="whitespace-pre-line bg-amber-50 p-3 text-sm italic text-amber-950"
                        colSpan={9}
                      >
                        <span className="font-bold not-italic">
                          Vorbemerkung:{" "}
                        </span>
                        {item.rawText}
                      </td>
                    </tr>
                  );
                }

                const status =
                  STATUS_LABELS[item.matchStatus] ?? STATUS_LABELS.PENDING;
                return (
                  <tr
                    className="border-t border-gray-100 align-top even:bg-gray-50"
                    key={item.id}
                  >
                    <td className="p-3 text-gray-500">
                      {item.positionNumber ?? "–"}
                    </td>
                    <td className="p-3 max-w-xs font-semibold text-gray-900">
                      {item.shortText ?? "–"}
                    </td>
                    <td className="whitespace-pre-line p-3 max-w-sm text-gray-700">
                      {item.rawText}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.quantity ?? "–"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.unit ?? "–"}
                    </td>
                    <td className="w-28 max-w-28 p-3">
                      <span className="whitespace-nowrap">
                        {formatCents(item.unitPriceCents)}
                      </span>
                    </td>
                    <td className="w-64 max-w-64 p-3">
                      {item.positionNumber &&
                      ownAnsatzStatusByOz.has(item.positionNumber.trim())
                        ? (() => {
                            const ansatzStatus = ownAnsatzStatusByOz.get(
                              item.positionNumber!.trim(),
                            )!;
                            return (
                              <details className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                                <summary className="cursor-pointer font-semibold text-blue-700 underline">
                                  Übernommenen Ansatz anzeigen
                                </summary>
                                <p className="mt-1 whitespace-pre-line break-words text-gray-700">
                                  {ansatzStatus.rawText}
                                </p>
                              </details>
                            );
                          })()
                        : null}
                      {(crossLvMatchesByLineItem.get(item.id) ?? []).length ===
                      0 ? (
                        <span className="text-gray-400">–</span>
                      ) : (
                        <div className="space-y-2">
                          {(crossLvMatchesByLineItem.get(item.id) ?? []).map(
                            (match) => {
                              const cross = match.source;
                              // Nicht nur prüfen, ob DIESE Treffer-Position selbst aus
                              // einer Kalkulations-XML stammt (das trifft oft nicht zu,
                              // siehe Kommentar bei findAnsatzCandidatesViaLvMatch) -
                              // stattdessen über Projekt+OZ nachschlagen, ob das
                              // Treffer-Projekt für dieselbe Position überhaupt einen
                              // Ansatz hinterlegt hat, unabhängig davon, welche Zeile
                              // hier textlich am ähnlichsten war.
                              const resolvedAnsatz =
                                cross.lvImport.projectNumber &&
                                cross.positionNumber
                                  ? ansatzByProjectAndOz.get(
                                      `${cross.lvImport.projectNumber}::${cross.positionNumber.trim()}`,
                                    )
                                  : undefined;
                              const isAnsatz = Boolean(resolvedAnsatz);
                              const diffTokens = diffWords(
                                item.rawText,
                                cross.rawText,
                              );
                              return (
                                <div
                                  className="border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                                  key={cross.id}
                                >
                                  <div className="break-words font-semibold text-gray-900">
                                    {cross.shortText ??
                                      cross.rawText.slice(0, 60)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Kurztext{" "}
                                    {Math.round(match.kurztextScore * 100)}% ·
                                    Langtext{" "}
                                    {Math.round(match.langtextScore * 100)}%
                                    {match.exactMengeMatch
                                      ? " · Menge gleich"
                                      : ""}
                                    {match.exactEinheitMatch
                                      ? " · Einheit gleich"
                                      : ""}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-green-800">
                                    {isAnsatz
                                      ? "Kalkulationsansatz"
                                      : "Kein Ansatz vorhanden"}{" "}
                                    · {formatLvSource(cross.lvImport)}
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
                                          <strong
                                            className="text-red-700"
                                            key={index}
                                          >
                                            {token.text}{" "}
                                          </strong>
                                        ) : (
                                          <span key={index}>{token.text} </span>
                                        ),
                                      )}
                                    </p>
                                  </details>
                                  {isAnsatz && resolvedAnsatz ? (
                                    <details className="mt-1">
                                      <summary className="cursor-pointer text-xs font-semibold text-purple-700 underline">
                                        Ansatz anzeigen
                                      </summary>
                                      <p className="mt-1 whitespace-pre-line break-words text-xs text-gray-700">
                                        {resolvedAnsatz.ansatzSummary}
                                      </p>
                                    </details>
                                  ) : null}
                                  {isAnsatz && resolvedAnsatz ? (
                                    <form action={adoptAnsatzFromCandidate}>
                                      <input
                                        name="lineItemId"
                                        type="hidden"
                                        value={item.id}
                                      />
                                      <input
                                        name="sourceCandidateId"
                                        type="hidden"
                                        value={resolvedAnsatz.sourceLineItemId}
                                      />
                                      <button
                                        className="mt-1 rounded-lg bg-purple-700 px-2 py-1 text-xs font-bold text-white hover:bg-purple-800"
                                        title="Übernimmt den Kalkulationsansatz dieser Position in die eigene Kalkulation dieses Projekts"
                                        type="submit"
                                      >
                                        Ansatz übernehmen
                                      </button>
                                      <p className="mt-0.5 text-[11px] text-gray-500">
                                        Kopiert den Kalkulationsansatz
                                        (Bausteine/Kostenarten) oben in die
                                        eigene Kalkulation dieses Projekts,
                                        sichtbar in der Kachel &quot;Kalkulation
                                        (XML)&quot; weiter unten.
                                      </p>
                                    </form>
                                  ) : (
                                    <p className="mt-1 text-xs text-gray-500">
                                      Für diese Position ist in{" "}
                                      {formatLvSource(cross.lvImport)} kein
                                      Kalkulationsansatz hinterlegt.
                                    </p>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {isKalkulation ? (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      ) : (
                        (() => {
                          // Preis-/Katalog-Status gibt es für eine reine
                          // LV-Zeile nicht mehr (Preiskatalog-Abgleich
                          // entfernt) - hier zählt nur noch, ob für diese
                          // Position bereits ein Ansatz übernommen wurde.
                          const ansatzStatus = item.positionNumber
                            ? ownAnsatzStatusByOz.get(
                                item.positionNumber.trim(),
                              )
                            : undefined;
                          if (!ansatzStatus) {
                            return (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                                Offen
                              </span>
                            );
                          }
                          const isConfirmed =
                            ansatzStatus.matchStatus === "CONFIRMED";
                          return (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${isConfirmed ? "bg-purple-100 text-purple-800" : "bg-red-100 text-red-800"}`}
                            >
                              {isConfirmed
                                ? "Ansatz übernommen"
                                : "Ansatz verworfen"}
                            </span>
                          );
                        })()
                      )}
                    </td>
                    <td className="w-40 max-w-40 p-3">
                      {isKalkulation ? (
                        item.matchedVia === "CROSS_PROJECT_ANSATZ" ? (
                          <AnsatzActions
                            target={{
                              id: item.id,
                              ansatzAlternativesJson:
                                item.ansatzAlternativesJson,
                              matchStatus: item.matchStatus,
                            }}
                          />
                        ) : (
                          <span className="text-gray-400">–</span>
                        )
                      ) : (
                        (() => {
                          const ansatzStatus = item.positionNumber
                            ? ownAnsatzStatusByOz.get(
                                item.positionNumber.trim(),
                              )
                            : undefined;
                          return ansatzStatus ? (
                            <AnsatzActions target={ansatzStatus} />
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        })()
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
