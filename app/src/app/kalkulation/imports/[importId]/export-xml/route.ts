import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { looksLikeEstimateXml } from "@/lib/kalkulation-estimate-xml-parser";
import { buildEstimateXmlFile, spliceWbsItemsIntoOriginalXml } from "@/lib/kalkulation-estimate-xml-writer";

export const runtime = "nodejs";

const STORAGE_BUCKET = "uploads";

export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  await requireSession();
  const { importId } = await params;

  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) {
    return NextResponse.json({ error: "Import nicht gefunden." }, { status: 404 });
  }

  const lineItems = await prisma.kalkulationLvLineItem.findMany({
    orderBy: { rowNumber: "asc" },
    where: { entryType: "ITEM", lvImportId: importId, ribRawBlockXml: { not: null } },
  });

  // Abgelehnte Ansatz-Vorschläge (siehe suggestAnsaetzeFromHistory) fliegen
  // raus - eigene, direkt hochgeladene Positionen sind davon nicht
  // betroffen: matchStatus REJECTED bedeutet dort nur "Katalog-Preisvorschlag
  // abgelehnt", nicht "Ansatz verwerfen".
  const wbsItemBlocks = lineItems
    .filter((item) => !(item.matchedVia === "CROSS_PROJECT_ANSATZ" && item.matchStatus === "REJECTED"))
    .map((item) => item.ribRawBlockXml)
    .filter((block): block is string => Boolean(block));

  if (wbsItemBlocks.length === 0) {
    return NextResponse.json({ error: "Keine exportierbaren Kalkulationsansätze in diesem Import." }, { status: 400 });
  }

  // Wurde dieser Import selbst als echte iTWO-XML hochgeladen, die
  // Positionsliste direkt in die Original-Datei zurücksetzen - dann bleibt
  // JEDES Projekt-/Estimate-Setting (u.a. IsDomesticEstimate, das beim
  // von Hand nachgebauten Rahmen zunächst fehlte und den Import mit
  // "Inlandsprojekt stimmt nicht überein" abgebrochen hat) exakt so
  // erhalten, wie iTWO es selbst geschrieben hat.
  let content: string | null = null;
  if (lvImport.originalStoragePath) {
    try {
      const originalBuffer = await readFile(STORAGE_BUCKET, lvImport.originalStoragePath);
      if (looksLikeEstimateXml(originalBuffer)) {
        content = spliceWbsItemsIntoOriginalXml(originalBuffer.toString("utf8"), wbsItemBlocks);
      }
    } catch {
      // Original nicht mehr verfügbar (z.B. Import ist eine Kopie ohne
      // eigene Datei) - unten auf den nachgebauten Rahmen zurückfallen.
    }
  }

  content ??= buildEstimateXmlFile({
    projectNumber: lvImport.projectNumber ?? lvImport.fileName,
    tenderTitle: lvImport.tenderTitle,
    wbsItemBlocks,
  });

  const fileName = `${(lvImport.projectNumber ?? lvImport.fileName).replace(/[^\w.-]+/g, "_")}_Kalkulation.xml`;

  return new NextResponse(content, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
