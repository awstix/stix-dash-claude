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

  return { lvImport, lineItems, infoLineByItemId };
}
