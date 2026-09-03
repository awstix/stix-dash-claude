import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { buildRibKalkulationFile } from "@/lib/rib-kalkulation-writer";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  await requireSession();
  const { importId } = await params;

  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) {
    return NextResponse.json({ error: "Import nicht gefunden." }, { status: 404 });
  }

  const lineItems = await prisma.kalkulationLvLineItem.findMany({
    orderBy: { rowNumber: "asc" },
    where: { entryType: "ITEM", lvImportId: importId, ribRawBlock: { not: null } },
  });

  // Abgelehnte Ansatz-Vorschläge (siehe suggestAnsaetzeFromHistory) fliegen
  // raus - eigene, direkt hochgeladene D31-Positionen sind davon nicht
  // betroffen: matchStatus REJECTED bedeutet dort nur "Katalog-Preisvorschlag
  // abgelehnt", nicht "Ansatz verwerfen".
  const rawBlocks = lineItems
    .filter((item) => !(item.matchedVia === "CROSS_PROJECT_ANSATZ" && item.matchStatus === "REJECTED"))
    .map((item) => item.ribRawBlock)
    .filter((block): block is string => Boolean(block));

  if (rawBlocks.length === 0) {
    return NextResponse.json({ error: "Keine exportierbaren Kalkulationsansätze in diesem Import." }, { status: 400 });
  }

  const content = buildRibKalkulationFile({
    projectNumber: lvImport.projectNumber ?? lvImport.fileName,
    rawBlocks,
    tenderTitle: lvImport.tenderTitle,
  });

  const fileName = `${(lvImport.projectNumber ?? lvImport.fileName).replace(/[^\w.-]+/g, "_")}_Kalkulation.D31`;

  return new NextResponse(Buffer.from(content, "latin1"), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
