import { prisma } from "@/lib/prisma";
import { formatLvSource } from "@/lib/kalkulation-format";

/** Lädt die Zeilen eines LV-Imports plus, je Zeile, den fertig formatierten
 * Herkunfts-Hinweis für übernommene Preise ("Info: aus Projekt ...
 * importiert - Übereinstimmung XX%.") - gemeinsame Grundlage für alle drei
 * Export-Formate (GAEB, Excel, PDF), damit der Hinweis überall gleich
 * aussieht. */
export async function loadLvExportData(importId: string) {
  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) return null;

  const lineItems = await prisma.kalkulationLvLineItem.findMany({
    include: { matchedPosition: true },
    where: { lvImportId: importId },
    orderBy: { rowNumber: "asc" },
  });

  const sourceImportIds = [
    ...new Set(lineItems.map((item) => item.priceSourceLvImportId).filter((id): id is string => Boolean(id))),
  ];
  const sourceImports = sourceImportIds.length
    ? await prisma.kalkulationLvImport.findMany({ where: { id: { in: sourceImportIds } } })
    : [];
  const sourceImportById = new Map(sourceImports.map((source) => [source.id, source]));

  const infoLineByItemId = new Map<string, string>();
  for (const item of lineItems) {
    const source = item.priceSourceLvImportId ? sourceImportById.get(item.priceSourceLvImportId) : null;
    if (source && item.priceSourceSimilarity != null) {
      infoLineByItemId.set(
        item.id,
        `Info: aus Projekt ${formatLvSource(source)} importiert - Übereinstimmung ${Math.round(item.priceSourceSimilarity * 100)}%.`,
      );
    }
  }

  // Fallback für Positionen, die zwar einer Katalogposition zugeordnet/
  // bestätigt sind, aber (noch) KEINEN Preis übernommen haben (z.B. per
  // "Als gleiche Position markieren" bei zwei ungepreisten LVs) - ohne
  // Preis bliebe infoLineByItemId sonst leer und die Herkunft der
  // Zuordnung wäre im Export nicht erkennbar. Sucht dafür in ANDEREN LVs
  // nach einer bereits bestätigten Zeile zur selben Katalogposition.
  const unpricedMatchedIds = lineItems
    .filter((item) => item.matchedPositionId && !infoLineByItemId.has(item.id))
    .map((item) => item.matchedPositionId as string);
  if (unpricedMatchedIds.length > 0) {
    const siblingItems = await prisma.kalkulationLvLineItem.findMany({
      where: {
        matchedPositionId: { in: [...new Set(unpricedMatchedIds)] },
        matchStatus: "CONFIRMED",
        lvImportId: { not: importId },
      },
      include: { lvImport: true },
      orderBy: { confirmedAt: "asc" },
    });
    const siblingByPositionId = new Map<string, (typeof siblingItems)[number]>();
    for (const sibling of siblingItems) {
      if (sibling.matchedPositionId && !siblingByPositionId.has(sibling.matchedPositionId)) {
        siblingByPositionId.set(sibling.matchedPositionId, sibling);
      }
    }
    for (const item of lineItems) {
      if (!item.matchedPositionId || infoLineByItemId.has(item.id)) continue;
      const sibling = siblingByPositionId.get(item.matchedPositionId);
      if (!sibling) continue;
      const similarity = item.matchConfidence != null ? ` - Übereinstimmung ${Math.round(item.matchConfidence * 100)}%` : "";
      infoLineByItemId.set(item.id, `Info: Position zugeordnet zu Projekt ${formatLvSource(sibling.lvImport)}${similarity}.`);
    }
  }

  return { lvImport, lineItems, infoLineByItemId };
}
