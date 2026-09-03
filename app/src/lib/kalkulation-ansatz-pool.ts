/** Baut den projektübergreifenden Pool aller bereits importierten D31-
 * Kalkulationspositionen, angereichert um den echten Positionstext aus dem
 * jeweils eigenen LV-Import desselben Projekts. Nötig, weil eine D31-Datei
 * selbst keinen Positionstext enthält, nur OZ + Ansätze (siehe
 * rib-kalkulation-parser.ts) - der Abgleich für ein neues, leeres LV kann
 * also nur über den Umweg "D31-Position -> eigene OZ -> eigenes LV -> Text"
 * laufen. */

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
    const descriptionText = descriptionByProjectAndOz.get(`${projectNumber}::${item.positionNumber.trim()}`);
    // Kein zugehöriger LV-Text im selben Projekt gefunden (z.B. LV noch
    // nicht hochgeladen) - dann gibt's nichts, wogegen sich sinnvoll matchen
    // ließe, diese Position bleibt außen vor.
    if (!descriptionText) continue;

    pool.push({
      ansatzSummary: item.rawText,
      descriptionText,
      key: item.id,
      ribRawBlock: item.ribRawBlock,
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
