import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { writeGaebXml } from "@/lib/gaeb-writer";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ importId: string }> }) {
  await requireSession();
  const { importId } = await params;

  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) {
    return NextResponse.json({ error: "Import nicht gefunden." }, { status: 404 });
  }

  const lineItems = await prisma.kalkulationLvLineItem.findMany({
    where: { lvImportId: importId },
    orderBy: { rowNumber: "asc" },
  });

  const xml = writeGaebXml(
    lineItems.map((item) => ({
      entryType: item.entryType as "ITEM" | "TITLE" | "REMARK",
      positionNumber: item.positionNumber,
      shortText: item.shortText,
      rawText: item.rawText,
      unit: item.unit,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
    })),
    {
      projectName: [lvImport.projectNumber, lvImport.tenderTitle].filter(Boolean).join(" - ") || null,
      date: new Date(),
    },
  );

  const fileName = `${lvImport.fileName.replace(/\.[^.]+$/, "")}_vorkalkuliert.x83`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName.replace(/["\\]/g, "_")}"`,
    },
  });
}
