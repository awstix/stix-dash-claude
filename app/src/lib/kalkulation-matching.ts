/** Regelbasierte Vorstufe des LV-Positionsabgleichs (Kalkulation) - reine
 * Funktionen ohne Prisma/Netzwerk, damit sie ohne DB/Kosten testbar sind.
 * Liefert für einen rohen LV-Positionstext eine Kurzliste ähnlicher
 * Katalogpositionen, die dann an die KI-Stufe (kalkulation-ai-provider.ts)
 * weitergereicht wird. */

export type CatalogEntryForMatching = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  unit: string;
};

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

const CRITICAL_TOKEN_PATTERNS = [
  /\bdn\s?\d{2,4}\b/g,
  /\bc\s?\d{1,3}\/\d{1,3}\b/g,
  /\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m2|m3|m²|m³|kg|to|t)\b/g,
];

/** Leichte Normalisierung nur fürs Kennwert-Erkennen - anders als
 * `normalizeText` bleiben "/" und "," erhalten (werden für "DN100",
 * "C25/30", "1,5m" gebraucht), es wird nur klein geschrieben und auf
 * Mehrfach-Leerzeichen reduziert. */
function normalizeForTokenExtraction(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrahiert technische Kennwerte (Rohrdurchmesser, Festigkeitsklasse,
 * Maß-/Mengenangaben mit Einheit) aus einem LV-Text - zwei Positionen mit
 * widersprüchlichen Kennwerten (z.B. DN100 vs. DN150) dürfen nie als
 * sichere Übereinstimmung durchgehen, auch wenn der restliche Text sehr
 * ähnlich ist. */
export function extractCriticalTokens(rawText: string): Set<string> {
  const normalized = normalizeForTokenExtraction(rawText);
  const tokens = new Set<string>();

  for (const pattern of CRITICAL_TOKEN_PATTERNS) {
    const matches = normalized.match(pattern);
    if (matches) {
      for (const match of matches) {
        tokens.add(match.replace(/\s+/g, ""));
      }
    }
  }

  return tokens;
}

function hasCriticalTokenMismatch(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return false;
  for (const token of a) {
    if (b.has(token)) return false;
  }
  for (const token of b) {
    if (a.has(token)) return false;
  }
  return true;
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

/** Baut eine Kurzliste der `limit` ähnlichsten Katalogpositionen zu einem
 * rohen LV-Text: erst Dice-Koeffizient über den ganzen Katalog (billig),
 * dann Levenshtein nur zur Fein-Sortierung der besten ~20 Dice-Treffer
 * (präzise, aber teurer). Kandidaten mit widersprüchlichen Kennwerten
 * (DN/Festigkeitsklasse) werden markiert, nicht ausgefiltert - die
 * Entscheidung trifft die KI-Stufe bzw. die manuelle Prüfung. */
export function buildShortlist(
  rawText: string,
  catalog: CatalogEntryForMatching[],
  limit = 5,
): MatchCandidate[] {
  const normalizedRawText = normalizeText(rawText);
  const rawTokens = extractCriticalTokens(rawText);

  const diceRanked = catalog
    .map((entry) => {
      const entryText = normalizeText(`${entry.title} ${entry.description ?? ""}`);
      return {
        entry,
        entryText,
        score: diceCoefficient(normalizedRawText, entryText),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const refined = diceRanked.map(({ entry, entryText, score }) => {
    const maxLength = Math.max(normalizedRawText.length, entryText.length, 1);
    const distance = levenshteinDistance(normalizedRawText, entryText);
    const levenshteinSimilarity = 1 - distance / maxLength;
    const combinedScore = score * 0.5 + levenshteinSimilarity * 0.5;
    const entryTokens = extractCriticalTokens(`${entry.title} ${entry.description ?? ""}`);

    return {
      positionId: entry.id,
      code: entry.code,
      title: entry.title,
      unit: entry.unit,
      similarityScore: combinedScore,
      criticalTokenMismatch: hasCriticalTokenMismatch(rawTokens, entryTokens),
    } satisfies MatchCandidate;
  });

  return refined.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, limit);
}
