/** Baut den projektübergreifenden Pool aller bereits importierten
 * Kalkulationspositionen (D31 oder Kalkulations-XML), angereichert um den
 * echten Positionstext.
 *
 * Bei aus XML importierten Positionen (kalkulation-estimate-xml-parser.ts)
 * ist der echte Positionstext bereits direkt an der Position selbst
 * gespeichert (OutlineSpecs). Bei D31-Positionen (rib-kalkulation-parser.ts,
 * erkennbar am generischen shortText "Kalkulation OZ X") ist das nicht der
 * Fall - eine D31-Datei enthält nur OZ + Ansätze, keinen Positionstext -
 * dort bleibt der Umweg "D31-Position -> eigene OZ -> eigenes LV -> Text"
 * nötig. */

import { prisma } from "@/lib/prisma";
import type { CatalogEntryForMatching } from "@/lib/kalkulation-matching";

export type AnsatzPoolEntry = {
  key: string;
  sourceLineItemId: string;
  sourceProjectNumber: string;
  sourceImportId: string;
  descriptionText: string;
  ansatzSummary: string;
  ribRawBlock: string;
  ribRawBlockXml: string | null;
};

export async function buildAnsatzPool(excludeProjectNumber?: string): Promise<AnsatzPoolEntry[]> {
  const kalkulationItems = await prisma.kalkulationLvLineItem.findMany({
    include: { lvImport: true },
    where: {
      entryType: "ITEM",
      lvImport: { projectNumber: { not: null }, sourceFormat: "RIB_KALKULATION" },
      positionNumber: { not: null },
      ribRawBlock: { not: null },
    },
  });

  const relevantKalkulationItems = kalkulationItems.filter(
    (item) => item.lvImport.projectNumber !== excludeProjectNumber,
  );
  if (relevantKalkulationItems.length === 0) return [];

  const projectNumbers = [
    ...new Set(relevantKalkulationItems.map((item) => item.lvImport.projectNumber!)),
  ];

  const lvItems = await prisma.kalkulationLvLineItem.findMany({
    include: { lvImport: true },
    where: {
      entryType: "ITEM",
      lvImport: { projectNumber: { in: projectNumbers }, sourceFormat: { not: "RIB_KALKULATION" } },
      positionNumber: { not: null },
    },
  });

  const descriptionByProjectAndOz = new Map<string, string>();
  for (const item of lvItems) {
    const projectNumber = item.lvImport.projectNumber;
    if (!projectNumber || !item.positionNumber) continue;
    const key = `${projectNumber}::${item.positionNumber.trim()}`;
    if (!descriptionByProjectAndOz.has(key)) {
      descriptionByProjectAndOz.set(key, `${item.shortText ?? ""} ${item.rawText}`.trim());
    }
  }

  const pool: AnsatzPoolEntry[] = [];
  for (const item of relevantKalkulationItems) {
    const projectNumber = item.lvImport.projectNumber;
    if (!projectNumber || !item.positionNumber || !item.ribRawBlock) continue;

    // Aus XML importiert -> trägt den echten Positionstext schon selbst
    // (siehe Dateikommentar oben) - der Ansatz-Teil (ab "\n\nKalkulations-
    // ansätze") wird für den Textvergleich abgeschnitten, der soll nur den
    // Positionstext selbst vergleichen, nicht die Ansatz-Details.
    const hasOwnText = Boolean(item.shortText) && !item.shortText!.startsWith("Kalkulation OZ ");
    // item.rawText beginnt für XML-Positionen bereits mit dem vollen
    // Positionstext (der die shortText-Zeile mit einschließt) - shortText
    // hier nochmal davorzuhängen würde sie doppelt reinschreiben.
    const descriptionText = hasOwnText
      ? item.rawText.split("\n\nKalkulationsansätze")[0].trim()
      : descriptionByProjectAndOz.get(`${projectNumber}::${item.positionNumber.trim()}`);
    // Kein eigener Text und kein zugehöriger LV-Text im selben Projekt
    // gefunden (z.B. LV noch nicht hochgeladen) - dann gibt's nichts,
    // wogegen sich sinnvoll matchen ließe, diese Position bleibt außen vor.
    if (!descriptionText) continue;

    pool.push({
      ansatzSummary: item.rawText,
      descriptionText,
      key: item.id,
      ribRawBlock: item.ribRawBlock,
      ribRawBlockXml: item.ribRawBlockXml,
      sourceImportId: item.lvImportId,
      sourceLineItemId: item.id,
      sourceProjectNumber: projectNumber,
    });
  }

  return pool;
}

export function poolToCatalog(pool: AnsatzPoolEntry[]): CatalogEntryForMatching[] {
  return pool.map((entry) => ({
    code: null,
    description: null,
    id: entry.key,
    title: entry.descriptionText,
    unit: "",
  }));
}
