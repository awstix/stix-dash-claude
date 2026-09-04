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
 * nötig. Menge/Einheit kommen unabhängig davon immer vom eigenen LV der
 * Quelle (die Kalkulationsdatei selbst führt das nicht zuverlässig). */

import { prisma } from "@/lib/prisma";
import type { LvMatchInput } from "@/lib/kalkulation-matching";

export type AnsatzPoolEntry = LvMatchInput & {
  sourceLineItemId: string;
  sourceProjectNumber: string;
  sourceImportId: string;
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

  const lvItemByProjectAndOz = new Map<string, (typeof lvItems)[number]>();
  for (const item of lvItems) {
    const projectNumber = item.lvImport.projectNumber;
    if (!projectNumber || !item.positionNumber) continue;
    const key = `${projectNumber}::${item.positionNumber.trim()}`;
    if (!lvItemByProjectAndOz.has(key)) lvItemByProjectAndOz.set(key, item);
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
    const sourceLvItem = lvItemByProjectAndOz.get(`${projectNumber}::${item.positionNumber.trim()}`);
    const shortText = hasOwnText ? item.shortText : (sourceLvItem?.shortText ?? null);
    const rawText = hasOwnText
      ? item.rawText.split("\n\nKalkulationsansätze")[0].trim()
      : sourceLvItem?.rawText;
    // Kein eigener Text und kein zugehöriger LV-Text im selben Projekt
    // gefunden (z.B. LV noch nicht hochgeladen) - dann gibt's nichts,
    // wogegen sich sinnvoll matchen ließe, diese Position bleibt außen vor.
    if (!rawText) continue;

    pool.push({
      ansatzSummary: item.rawText,
      id: item.id,
      quantity: sourceLvItem?.quantity ?? null,
      rawText,
      ribRawBlock: item.ribRawBlock,
      ribRawBlockXml: item.ribRawBlockXml,
      shortText,
      sourceImportId: item.lvImportId,
      sourceLineItemId: item.id,
      sourceProjectNumber: projectNumber,
      unit: sourceLvItem?.unit ?? null,
    });
  }

  return pool;
}
