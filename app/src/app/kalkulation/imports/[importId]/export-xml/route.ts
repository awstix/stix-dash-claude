import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { looksLikeEstimateXml } from "@/lib/kalkulation-estimate-xml-parser";
import { buildEstimateXmlFile, spliceWbsItemsIntoOriginalXml } from "@/lib/kalkulation-estimate-xml-writer";

export const runtime = "nodejs";

const STORAGE_BUCKET = "uploads";

/** Leitet die LV-eigene WBS-Kennung (Code + Bezeichnung, in iTWO getrennt
 * von der Projektnummer geführt) aus dem Dateinamen des LV-Imports ab -
 * z.B. "26-079191_FBE_Ottorfszell-Kirchzell.X83" -> Code "26-079191",
 * Bezeichnung "FBE_Ottorfszell-Kirchzell". Best-effort: nur sinnvoll, wenn
 * der Dateiname tatsächlich diesem "Code_Bezeichnung"-Muster folgt (wie
 * bei iTWO-Exporten üblich) - sonst wird die ganze Datei als Code
 * verwendet, besser als komplett zu fehlen. */
function deriveWbsFromFileName(fileName: string): { name: string; description: string | null } {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const underscoreIndex = withoutExt.indexOf("_");
  if (underscoreIndex === -1) return { description: null, name: withoutExt };
  return {
    description: withoutExt.slice(underscoreIndex + 1) || null,
    name: withoutExt.slice(0, underscoreIndex),
  };
}

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

  if (!content) {
    // Die eigentliche LV-Kennung (getrennt von der Projektnummer, siehe
    // deriveWbsFromFileName) kommt vom bereits hochgeladenen LV
    // desselben Projekts - iTWO lehnt den Re-Import sonst mit "LV im
    // Projekt nicht vorhanden" ab, wenn die WBS-Kennung nicht zu einem
    // bestehenden LV passt.
    const siblingLvImport = lvImport.projectNumber
      ? await prisma.kalkulationLvImport.findFirst({
          orderBy: { createdAt: "desc" },
          where: { projectNumber: lvImport.projectNumber, sourceFormat: { not: "RIB_KALKULATION" } },
        })
      : null;
    const wbs = siblingLvImport ? deriveWbsFromFileName(siblingLvImport.fileName) : null;

    content = buildEstimateXmlFile({
      projectNumber: lvImport.projectNumber ?? lvImport.fileName,
      tenderTitle: lvImport.tenderTitle,
      wbsDescription: wbs?.description,
      wbsItemBlocks,
      wbsName: wbs?.name,
    });
  }

  const fileName = `${(lvImport.projectNumber ?? lvImport.fileName).replace(/[^\w.-]+/g, "_")}_Kalkulation.xml`;

  return new NextResponse(content, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
