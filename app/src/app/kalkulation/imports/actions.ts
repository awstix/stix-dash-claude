"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { putFile } from "@/lib/storage";
import { floatValue, moneyCents, rowValue, text, type ExcelRow } from "@/lib/import-value-parsing";
import { parseGaebXml } from "@/lib/gaeb-parser";
import { buildShortlist, normalizeText, type CatalogEntryForMatching } from "@/lib/kalkulation-matching";
import { getAiProvider, type LineItemForMatching } from "@/lib/kalkulation-ai-provider";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";

const STORAGE_BUCKET = "uploads";
const GAEB_EXTENSIONS = /\.(x81|x83|x84|d81|d83|d84)$/i;

type ParsedRow = {
  rawText: string;
  positionNumber: string | null;
  unit: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
};

function parseExcel(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });

  return rows
    .map((row): ParsedRow | null => {
      const rawText = text(rowValue(row, "Text", "Beschreibung", "Kurztext", "Langtext"));
      if (!rawText) return null;

      return {
        rawText,
        positionNumber: text(rowValue(row, "Position", "Positionsnummer", "Pos.", "Pos")),
        unit: text(rowValue(row, "Einheit", "EH", "ME")),
        quantity: floatValue(rowValue(row, "Menge", "Anzahl")),
        unitPriceCents: moneyCents(rowValue(row, "Einheitspreis", "EP")),
        totalPriceCents: moneyCents(rowValue(row, "Gesamtpreis", "GP")),
      };
    })
    .filter((row): row is ParsedRow => row !== null);
}

export async function importLv(formData: FormData) {
  const session = await requireSession();
  const importRunId = text(formData.get("importRunId"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine GAEB- oder Excel-Datei auswählen.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isGaeb = GAEB_EXTENSIONS.test(file.name);

  let rows: ParsedRow[];
  let sourceFormat: string;
  let gaebDocType: string | null = null;
  let lvType = "ANGEBOT";

  if (isGaeb) {
    const parsed = parseGaebXml(buffer, file.name);
    rows = parsed.lineItems;
    sourceFormat = "GAEB_XML";
    gaebDocType = parsed.docType;
    lvType = parsed.isPriced ? "ANGEBOT" : "AUSSCHREIBUNG";
  } else {
    rows = parseExcel(buffer);
    sourceFormat = "EXCEL";
    lvType = rows.some((row) => row.unitPriceCents != null) ? "ANGEBOT" : "AUSSCHREIBUNG";
  }

  if (rows.length === 0) {
    throw new Error("In der Datei wurden keine Positionen gefunden.");
  }

  if (importRunId) {
    await prisma.importProgress.upsert({
      where: { id: importRunId },
      create: { id: importRunId, kind: "kalkulation_lv", total: rows.length },
      update: { processed: 0, status: "running", total: rows.length },
    });
  }

  let originalStoragePath: string | null = null;
  try {
    const key = `kalkulation-lv/${Date.now()}-${file.name}`;
    const stored = await putFile(STORAGE_BUCKET, key, buffer, file.type || "application/octet-stream");
    originalStoragePath = stored.path;
  } catch {
    // Ablage des Originals ist ein Komfort-Extra fürs spätere Nachschlagen,
    // der Import selbst darf daran nicht scheitern.
  }

  const lvImport = await prisma.kalkulationLvImport.create({
    data: {
      fileName: file.name,
      gaebDocType,
      importedByUserId: session.user.id,
      lvType,
      originalStoragePath,
      rowCount: rows.length,
      sourceFormat,
      status: "IMPORTED",
    },
  });

  await prisma.kalkulationLvLineItem.createMany({
    data: rows.map((row, index) => ({
      lvImportId: lvImport.id,
      normalizedText: normalizeText(row.rawText),
      positionNumber: row.positionNumber,
      quantity: row.quantity,
      rawText: row.rawText,
      rowNumber: index + 1,
      totalPriceCents: row.totalPriceCents,
      unit: row.unit,
      unitPriceCents: row.unitPriceCents,
    })),
  });

  if (importRunId) {
    await prisma.importProgress
      .update({
        where: { id: importRunId },
        data: { processed: rows.length, status: "done" },
      })
      .catch(() => undefined);
  }

  revalidatePath("/kalkulation/imports");
  redirect(`/kalkulation/imports/${lvImport.id}`);
}

const BATCH_SIZE = 40;

export async function runMatching(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");

  const aiSettings = await getAiSettings();
  if (!isAiConfigured(aiSettings)) {
    throw new Error("KI-Anbieter ist nicht konfiguriert (Admin > KI-Einstellungen).");
  }

  const [lineItems, catalog] = await Promise.all([
    prisma.kalkulationLvLineItem.findMany({
      where: { lvImportId: importId, matchStatus: { in: ["PENDING", "REJECTED"] } },
    }),
    prisma.kalkulationPosition.findMany({ where: { isActive: true } }),
  ]);

  const catalogForMatching: CatalogEntryForMatching[] = catalog.map((position) => ({
    id: position.id,
    code: position.code,
    title: position.title,
    description: position.description,
    unit: position.unit,
  }));

  const aiProvider = getAiProvider(aiSettings.provider);
  const pendingForAi: LineItemForMatching[] = [];
  const learnedResults = new Map<string, { positionId: string | null; confidence: number | null }>();

  for (const lineItem of lineItems) {
    const learned = await prisma.kalkulationLearnedMapping.findUnique({
      where: { normalizedText: lineItem.normalizedText },
    });

    if (learned) {
      learnedResults.set(lineItem.id, { positionId: learned.matchedPositionId, confidence: learned.confidence });
      await prisma.kalkulationLearnedMapping.update({
        where: { id: learned.id },
        data: { lastUsedAt: new Date(), timesReused: { increment: 1 } },
      });
      continue;
    }

    const shortlist = buildShortlist(lineItem.rawText, catalogForMatching, aiSettings.maxCandidates);
    pendingForAi.push({
      candidates: shortlist,
      lineItemId: lineItem.id,
      quantity: lineItem.quantity,
      rawText: lineItem.rawText,
      unit: lineItem.unit,
    });
  }

  for (const [lineItemId, learned] of learnedResults) {
    await prisma.kalkulationLvLineItem.update({
      where: { id: lineItemId },
      data: {
        matchConfidence: learned.confidence,
        matchStatus: learned.positionId ? "SUGGESTED" : "NO_MATCH",
        matchedPositionId: learned.positionId,
        matchedVia: "LEARNED_MAPPING",
      },
    });
  }

  for (let i = 0; i < pendingForAi.length; i += BATCH_SIZE) {
    const chunk = pendingForAi.slice(i, i + BATCH_SIZE);
    const results = await aiProvider.matchBatch({
      apiKey: aiSettings.apiKey,
      items: chunk,
      model: aiSettings.model,
    });
    const resultsByItem = new Map(results.map((result) => [result.lineItemId, result]));

    for (const item of chunk) {
      const result = resultsByItem.get(item.lineItemId);
      const candidate = item.candidates.find((c) => c.positionId === result?.chosenPositionId);
      const hardMismatch = Boolean(candidate?.criticalTokenMismatch);

      await prisma.kalkulationLvLineItem.update({
        where: { id: item.lineItemId },
        data: {
          matchConfidence: result?.confidence ?? 0,
          matchReasoning: result?.reasoning ?? null,
          matchStatus: !result?.chosenPositionId ? "NO_MATCH" : hardMismatch ? "NEEDS_REVIEW" : "SUGGESTED",
          matchedPositionId: result?.chosenPositionId ?? null,
          matchedVia: "AI",
        },
      });
    }
  }

  const [matchedCount, needsReviewCount] = await Promise.all([
    prisma.kalkulationLvLineItem.count({
      where: { lvImportId: importId, matchStatus: { in: ["SUGGESTED", "CONFIRMED"] } },
    }),
    prisma.kalkulationLvLineItem.count({ where: { lvImportId: importId, matchStatus: "NEEDS_REVIEW" } }),
  ]);

  await prisma.kalkulationLvImport.update({
    where: { id: importId },
    data: {
      matchedCount,
      matchingProvider: aiSettings.provider,
      matchingRunAt: new Date(),
      needsReviewCount,
      status: "MATCHING",
    },
  });

  revalidatePath(`/kalkulation/imports/${importId}`);
}

export async function confirmMatch(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  const positionId = text(formData.get("positionId"));
  if (!lineItemId || !positionId) throw new Error("Position fehlt.");

  const lineItem = await prisma.kalkulationLvLineItem.update({
    where: { id: lineItemId },
    data: {
      confirmedAt: new Date(),
      confirmedByUserId: session.user.id,
      matchStatus: "CONFIRMED",
      matchedPositionId: positionId,
    },
  });

  await prisma.kalkulationLearnedMapping.upsert({
    where: { normalizedText: lineItem.normalizedText },
    create: {
      confirmedByUserId: session.user.id,
      confidence: lineItem.matchConfidence,
      matchedPositionId: positionId,
      matchedVia: lineItem.matchedVia === "MANUAL" ? "MANUAL" : "AI",
      normalizedText: lineItem.normalizedText,
      timesReused: 0,
    },
    update: {
      confirmedByUserId: session.user.id,
      matchedPositionId: positionId,
    },
  });

  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
}

export async function manualMatch(formData: FormData) {
  const lineItemId = text(formData.get("lineItemId"));
  const positionId = text(formData.get("positionId"));
  if (!lineItemId || !positionId) throw new Error("Position fehlt.");

  await prisma.kalkulationLvLineItem.update({
    where: { id: lineItemId },
    data: { matchedVia: "MANUAL", matchStatus: "SUGGESTED", matchedPositionId: positionId },
  });

  await confirmMatch(formData);
}

export async function rejectMatch(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeile fehlt.");

  const lineItem = await prisma.kalkulationLvLineItem.update({
    where: { id: lineItemId },
    data: {
      confirmedAt: new Date(),
      confirmedByUserId: session.user.id,
      matchStatus: "REJECTED",
      matchedPositionId: null,
    },
  });

  await prisma.kalkulationLearnedMapping.upsert({
    where: { normalizedText: lineItem.normalizedText },
    create: {
      confirmedByUserId: session.user.id,
      matchedPositionId: null,
      matchedVia: "MANUAL",
      normalizedText: lineItem.normalizedText,
    },
    update: {
      confirmedByUserId: session.user.id,
      matchedPositionId: null,
    },
  });

  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
}

export async function createPositionFromLineItem(formData: FormData) {
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeile fehlt.");

  const lineItem = await prisma.kalkulationLvLineItem.findUniqueOrThrow({
    where: { id: lineItemId },
  });

  const position = await prisma.kalkulationPosition.create({
    data: {
      title: lineItem.rawText.slice(0, 200),
      unit: lineItem.unit ?? "Stk",
    },
  });

  const withPosition = new FormData();
  withPosition.set("lineItemId", lineItemId);
  withPosition.set("positionId", position.id);
  await manualMatch(withPosition);
}
