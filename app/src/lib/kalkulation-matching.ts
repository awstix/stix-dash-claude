/** Reine Text-Ähnlichkeitsfunktionen (kein Prisma/Netzwerk, damit sie ohne
 * DB/Kosten testbar sind) für den Positionsabgleich zwischen LVs/
 * Kalkulationen verschiedener Projekte (siehe buildLvMatches unten und
 * kalkulation-ansatz-pool.ts). MatchCandidate bleibt für die KI-
 * Verbindungsprüfung in admin/kalkulation-ai-settings erhalten. */

export type MatchCandidate = {
  positionId: string;
  code: string | null;
  title: string;
  unit: string;
  similarityScore: number;
  criticalTokenMismatch: boolean;
};

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const collapsed = value.replace(/\s+/g, " ");
  for (let i = 0; i < collapsed.length - 1; i += 1) {
    const gram = collapsed.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/** Sørensen-Dice-Koeffizient über Bigramme - schnell genug, um jeden
 * Kandidaten im gesamten Katalog zu bewerten (im Gegensatz zu Levenshtein). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const totalA = [...bigramsA.values()].reduce((sum, n) => sum + n, 0);
  const totalB = [...bigramsB.values()].reduce((sum, n) => sum + n, 0);
  if (totalA === 0 || totalB === 0) return 0;

  let overlap = 0;
  for (const [gram, countA] of bigramsA) {
    const countB = bigramsB.get(gram);
    if (countB) overlap += Math.min(countA, countB);
  }

  return (2 * overlap) / (totalA + totalB);
}

/** Klassische Editierdistanz - nur für eine kleine, bereits vorgefilterte
 * Kandidatenmenge sinnvoll (O(n*m)), nicht für den ganzen Katalog. */
export function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) distances[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );
    }
  }

  return distances[rows - 1][cols - 1];
}

function combinedTextScore(a: string, b: string): number {
  const dice = diceCoefficient(a, b);
  const maxLength = Math.max(a.length, b.length, 1);
  const distance = levenshteinDistance(a, b);
  const levenshteinSimilarity = 1 - distance / maxLength;
  return dice * 0.5 + levenshteinSimilarity * 0.5;
}

export type LvMatchInput = {
  id: string;
  shortText: string | null;
  rawText: string;
  quantity: number | null;
  unit: string | null;
};

export type LvMatchResult = {
  candidateId: string;
  kurztextScore: number;
  langtextScore: number;
  exactMengeMatch: boolean;
  exactEinheitMatch: boolean;
};

/** Wie das Ergebnis von "Abgleich starten" in
 * KalkulationLvLineItem.crossLvMatchesJson abgelegt wird (bis zu 3
 * Kandidaten, höchstens einer je Quell-Import) - nur die Referenz-ID wird
 * gespeichert, die eigentlichen Positionsdaten (Text, Preis, Projekt)
 * werden beim Anzeigen frisch nachgeschlagen, damit z.B. ein zwischenzeitlich
 * übernommener Preis dort sofort sichtbar ist. */
export type StoredCrossLvMatch = {
  sourceLineItemId: string;
  kurztextScore: number;
  langtextScore: number;
  exactMengeMatch: boolean;
  exactEinheitMatch: boolean;
};

/** Vergleich direkt gegen andere LV-/Kalkulationspositionen (nicht gegen
 * den Positionskatalog) - bewusst mit getrennten Kriterien statt einer
 * einzelnen Ähnlichkeit: Kurztext und Langtext haben unterschiedliche
 * Aussagekraft (Kurztext ist oft die Standardbezeichnung, Langtext trägt
 * die Details), Menge und Einheit sind je ein eigener exakter Filter,
 * keine Ähnlichkeit - "gleiche Menge" bzw. "gleiche Einheit" ist entweder
 * wahr oder falsch, unabhängig voneinander zuschaltbar.
 *
 * Ein Kandidat muss alle aktiven Kriterien erfüllen, um zurückgegeben zu
 * werden. Grobe Vorfilterung per Dice über den ganzen Pool (billig), erst
 * die besten ~30 nach Langtext-Ähnlichkeit werden mit Levenshtein
 * verfeinert - sonst bei vielen Kandidaten zu teuer. */
export function buildLvMatches(
  target: LvMatchInput,
  candidates: LvMatchInput[],
  options: {
    exactEinheit: boolean;
    exactMenge: boolean;
    filterByKurztext: boolean;
    filterByLangtext: boolean;
    kurztextThreshold: number;
    langtextThreshold: number;
  },
): LvMatchResult[] {
  const targetKurztext = normalizeText(target.shortText ?? "");
  const targetLangtext = normalizeText(target.rawText);

  const roughRanked = candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate) => ({
      candidate,
      roughScore: diceCoefficient(targetLangtext, normalizeText(candidate.rawText)),
    }))
    .sort((a, b) => b.roughScore - a.roughScore)
    .slice(0, 30);

  const results: LvMatchResult[] = [];
  for (const { candidate } of roughRanked) {
    const kurztextScore = combinedTextScore(targetKurztext, normalizeText(candidate.shortText ?? ""));
    const langtextScore = combinedTextScore(targetLangtext, normalizeText(candidate.rawText));
    const exactMengeMatch = target.quantity != null && candidate.quantity != null && target.quantity === candidate.quantity;
    const exactEinheitMatch = (target.unit ?? "").trim().toLowerCase() === (candidate.unit ?? "").trim().toLowerCase();

    if (options.filterByKurztext && kurztextScore < options.kurztextThreshold) continue;
    if (options.filterByLangtext && langtextScore < options.langtextThreshold) continue;
    if (options.exactMenge && !exactMengeMatch) continue;
    if (options.exactEinheit && !exactEinheitMatch) continue;

    results.push({ candidateId: candidate.id, exactEinheitMatch, exactMengeMatch, kurztextScore, langtextScore });
  }

  return results.sort((a, b) => b.langtextScore - a.langtextScore);
}
