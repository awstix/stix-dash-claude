"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { deleteFile, putFile } from "@/lib/storage";
import { floatValue, moneyCents, rowValue, text, type ExcelRow } from "@/lib/import-value-parsing";
import { parseGaebXml } from "@/lib/gaeb-parser";
import { looksLikeGaeb90, parseGaeb90 } from "@/lib/gaeb90-parser";
import { looksLikeRibKalkulation, parseRibKalkulation } from "@/lib/rib-kalkulation-parser";
import { buildShortlist, normalizeText, type CatalogEntryForMatching } from "@/lib/kalkulation-matching";
import { getAiProvider, type LineItemForMatching } from "@/lib/kalkulation-ai-provider";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";

const STORAGE_BUCKET = "uploads";
const GAEB_EXTENSIONS = /\.(x81|x83|x84|d81|d83|d84)$/i;
const RIB_KALKULATION_EXTENSIONS = /\.(d31)$/i;

type ParsedRow = {
  entryType: "ITEM" | "TITLE" | "REMARK";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
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
      const shortText = text(rowValue(row, "Kurztext"));
      const rawText = text(rowValue(row, "Langtext", "Text", "Beschreibung")) ?? shortText;
      if (!rawText) return null;

      return {
        entryType: "ITEM",
        positionNumber: text(rowValue(row, "OZ", "Position", "Positionsnummer", "Pos.", "Pos")),
        shortText,
        rawText,
        unit: text(rowValue(row, "Mengeneinheit", "Einheit", "EH", "ME")),
        quantity: floatValue(rowValue(row, "LV-Menge", "Menge", "Anzahl")),
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
  const projectNumberInput = text(formData.get("projectNumber"));
  const tenderTitleInput = text(formData.get("tenderTitle"));
  const matchingThresholdRaw = text(formData.get("matchingThreshold"));
  const matchingThreshold = matchingThresholdRaw ? Number.parseInt(matchingThresholdRaw, 10) / 100 : 0.3;

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine GAEB- oder Excel-Datei auswählen.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isGaeb = GAEB_EXTENSIONS.test(file.name);

  let rows: ParsedRow[];
  let sourceFormat: string;
  let gaebDocType: string | null = null;
  let lvType = "ANGEBOT";
  let extractedTenderTitle: string | null = null;
  let extractedCustomerName: string | null = null;

  try {
    if (isGaeb && !looksLikeGaeb90(buffer)) {
      const parsed = parseGaebXml(buffer, file.name);
      rows = parsed.entries;
      sourceFormat = "GAEB_XML";
      gaebDocType = parsed.docType;
      lvType = parsed.isPriced ? "ANGEBOT" : "AUSSCHREIBUNG";
      extractedTenderTitle = parsed.tenderTitle;
      extractedCustomerName = parsed.customerName;
    } else if (isGaeb) {
      const parsed = parseGaeb90(buffer);
      rows = parsed.entries;
      sourceFormat = "GAEB90";
      lvType = parsed.isPriced ? "ANGEBOT" : "AUSSCHREIBUNG";
    } else if (RIB_KALKULATION_EXTENSIONS.test(file.name) || looksLikeRibKalkulation(buffer)) {
      // RIB iTWO "Urkalkulation" (z.B. .D31) - kein Standard-GAEB, enthält
      // keinen fertig berechneten Preis, nur Kalkulationsansätze je
      // Position. Die werden als lesbarer Referenztext übernommen (siehe
      // rib-kalkulation-parser.ts), lvType bewusst "ANGEBOT" trotz
      // fehlender Einheitspreise - das ist die eigene Kalkulation, keine
      // Ausschreibung.
      const parsed = parseRibKalkulation(buffer);
      rows = parsed.entries;
      sourceFormat = "RIB_KALKULATION";
      lvType = "ANGEBOT";
      extractedTenderTitle = parsed.tenderTitle;
    } else {
      rows = parseExcel(buffer);
      sourceFormat = "EXCEL";
      lvType = rows.some((row) => row.unitPriceCents != null) ? "ANGEBOT" : "AUSSCHREIBUNG";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Datei konnte nicht gelesen werden.";
    redirect(`/kalkulation/imports?importError=${encodeURIComponent(message)}`);
  }

  const itemRows = rows.filter((row) => row.entryType === "ITEM");
  if (itemRows.length === 0) {
    redirect(
      `/kalkulation/imports?importError=${encodeURIComponent("In der Datei wurden keine Positionen gefunden.")}`,
    );
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
      customerName: extractedCustomerName,
      fileName: file.name,
      gaebDocType,
      importedByUserId: session.user.id,
      lvType,
      matchingThreshold,
      originalStoragePath,
      projectNumber: projectNumberInput || null,
      rowCount: itemRows.length,
      sourceFormat,
      status: "IMPORTED",
      tenderTitle: tenderTitleInput || extractedTenderTitle,
    },
  });

  await prisma.kalkulationLvLineItem.createMany({
    data: rows.map((row, index) => ({
      entryType: row.entryType,
      lvImportId: lvImport.id,
      normalizedText: normalizeText(`${row.shortText ?? ""} ${row.rawText}`),
      positionNumber: row.positionNumber,
      quantity: row.quantity,
      rawText: row.rawText,
      rowNumber: index + 1,
      shortText: row.shortText,
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

async function computeImportCounts(importId: string) {
  const [matchedCount, needsReviewCount] = await Promise.all([
    prisma.kalkulationLvLineItem.count({
      where: { lvImportId: importId, matchStatus: { in: ["SUGGESTED", "CONFIRMED"] } },
    }),
    prisma.kalkulationLvLineItem.count({ where: { lvImportId: importId, matchStatus: "NEEDS_REVIEW" } }),
  ]);
  return { matchedCount, needsReviewCount };
}

/** Hält den "X zugeordnet"-Zähler auf der Import-Übersicht aktuell. Der
 * Zähler steht auf KalkulationLvImport (nicht live berechnet), damit die
 * Übersichtsliste nicht bei jedem Zeilen-Join rechnen muss - jede Aktion,
 * die matchStatus einzelner Zeilen ändert (bestätigen, ablehnen,
 * LV-Verknüpfung), muss ihn deshalb selbst nachziehen. */
async function refreshImportCounts(importId: string) {
  const counts = await computeImportCounts(importId);
  await prisma.kalkulationLvImport.update({ where: { id: importId }, data: counts });
}

export async function runMatching(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");

  // KI ist ein optionales Goodie, keine Voraussetzung: die gelernte
  // Zuordnung (exakter Text-Treffer) läuft immer, unabhängig davon, ob ein
  // KI-Anbieter eingerichtet ist. Nur für Positionen, die dadurch nicht
  // aufgelöst werden, wird zusätzlich die KI gefragt - sofern konfiguriert.
  const aiSettings = await getAiSettings();
  const aiAvailable = isAiConfigured(aiSettings);

  const newThresholdRaw = text(formData.get("matchingThreshold"));
  if (newThresholdRaw) {
    await prisma.kalkulationLvImport.update({
      where: { id: importId },
      data: { matchingThreshold: Number.parseInt(newThresholdRaw, 10) / 100 },
    });
  }

  const [lvImport, lineItems, catalog] = await Promise.all([
    prisma.kalkulationLvImport.findUniqueOrThrow({ where: { id: importId } }),
    prisma.kalkulationLvLineItem.findMany({
      where: { entryType: "ITEM", lvImportId: importId, matchStatus: { in: ["PENDING", "REJECTED"] } },
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

  const maxCandidates = aiSettings?.maxCandidates ?? 5;
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

    const combinedText = `${lineItem.shortText ?? ""} ${lineItem.rawText}`.trim();
    const shortlist = buildShortlist(combinedText, catalogForMatching, maxCandidates, lvImport.matchingThreshold);
    // Kein Kandidat erreicht die eingestellte Mindest-Ähnlichkeit - dann
    // gibt's nichts, das sich lohnt, der KI vorzulegen (spart die Anfrage).
    if (!aiAvailable || shortlist.length === 0) continue;
    pendingForAi.push({
      candidates: shortlist,
      lineItemId: lineItem.id,
      quantity: lineItem.quantity,
      rawText: combinedText,
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

  if (aiAvailable && pendingForAi.length > 0) {
    const aiProvider = getAiProvider(aiSettings.provider);

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
  }

  const counts = await computeImportCounts(importId);

  await prisma.kalkulationLvImport.update({
    where: { id: importId },
    data: {
      ...counts,
      matchingProvider: aiAvailable ? aiSettings.provider : null,
      matchingRunAt: new Date(),
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

  await refreshImportCounts(lineItem.lvImportId);
  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
  revalidatePath("/kalkulation/imports");
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

  await refreshImportCounts(lineItem.lvImportId);
  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
  revalidatePath("/kalkulation/imports");
}

export async function createPositionFromLineItem(formData: FormData) {
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeile fehlt.");

  const lineItem = await prisma.kalkulationLvLineItem.findUniqueOrThrow({
    where: { id: lineItemId },
  });

  const position = await prisma.kalkulationPosition.create({
    data: {
      description: lineItem.rawText.slice(0, 2000),
      title: (lineItem.shortText || lineItem.rawText).slice(0, 200),
      unit: lineItem.unit ?? "Stk",
    },
  });

  const withPosition = new FormData();
  withPosition.set("lineItemId", lineItemId);
  withPosition.set("positionId", position.id);
  await manualMatch(withPosition);
}

export async function deleteImport(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");
  // Von der Abgleich-Seite eines VERKNÜPFTEN LVs aus gelöscht (z.B. das
  // nachgereichte kalkulierte Angebot beim Anzeigen der Ausschreibung) -
  // dann dorthin zurückkehren statt immer zur Liste zu springen, da das
  // gerade angezeigte LV selbst ja unverändert bestehen bleibt.
  const returnTo = text(formData.get("returnTo")) || "/kalkulation/imports";

  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) return;

  // Zeilen hängen per onDelete: Cascade an der Import-Zeile, werden also
  // automatisch mitgelöscht - nur die abgelegte Originaldatei muss
  // separat aus dem Storage entfernt werden.
  await prisma.kalkulationLvImport.delete({ where: { id: importId } });

  if (lvImport.originalStoragePath) {
    await deleteFile(STORAGE_BUCKET, lvImport.originalStoragePath).catch(() => undefined);
  }

  revalidatePath("/kalkulation/imports");
  revalidatePath(returnTo);
  redirect(returnTo);
}

/** Übernimmt einen Einheitspreis (aus dem Katalog-Vorschlag oder einem
 * ähnlichen LV) direkt in DIESE LV-Zeile - macht das LV selbst
 * "vorkalkuliert", ohne dass dafür erst eine Katalogzuordnung bestätigt
 * werden muss. Die eigentliche Zuordnung (matchStatus/matchedPositionId)
 * bleibt davon unberührt. */
/** "Diesen Treffer übernehmen" - das ist die eigentliche Auswahl unter
 * mehreren Vorschlägen (statt einer separaten Checkbox: der Klick auf
 * genau diesen Vorschlag IST die Auswahl). Übernimmt den Preis und, falls
 * die Quellposition selbst einer Katalogposition zugeordnet ist, auch
 * gleich diese Zuordnung - macht aus der Preisübernahme eine vollständige
 * Bestätigung statt nur eine Zahl zu kopieren. */
export async function adoptPrice(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  const unitPriceCentsRaw = text(formData.get("unitPriceCents"));
  if (!lineItemId || !unitPriceCentsRaw) throw new Error("Preis fehlt.");
  const unitPriceCents = Number.parseInt(unitPriceCentsRaw, 10);
  const sourceLvImportId = text(formData.get("sourceLvImportId"));
  const sourcePositionId = text(formData.get("sourcePositionId"));
  const similarityRaw = text(formData.get("similarityScore"));
  // Katalog-Preishistorie liefert keinen Ähnlichkeitswert (exakte
  // Zuordnung über dieselbe Katalogposition) - dafür 100% annehmen, damit
  // der GAEB-Export-Hinweis konsistent eine Prozentzahl zeigt.
  const similarityScore = similarityRaw ? Number.parseFloat(similarityRaw) : 1;

  const current = await prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: lineItemId } });
  const totalPriceCents = current.quantity != null ? Math.round(unitPriceCents * current.quantity) : null;

  const lineItem = await prisma.kalkulationLvLineItem.update({
    where: { id: lineItemId },
    data: {
      priceSourceLvImportId: sourceLvImportId || null,
      priceSourceSimilarity: sourceLvImportId ? similarityScore : null,
      totalPriceCents,
      unitPriceCents,
      ...(sourcePositionId
        ? {
            confirmedAt: new Date(),
            confirmedByUserId: session.user.id,
            matchConfidence: similarityScore,
            matchStatus: "CONFIRMED",
            matchedPositionId: sourcePositionId,
            matchedVia: "CROSS_LV",
          }
        : {}),
    },
  });

  if (sourcePositionId) {
    await prisma.kalkulationLearnedMapping.upsert({
      where: { normalizedText: lineItem.normalizedText },
      create: {
        confirmedByUserId: session.user.id,
        confidence: similarityScore,
        matchedPositionId: sourcePositionId,
        matchedVia: "CROSS_LV",
        normalizedText: lineItem.normalizedText,
        timesReused: 0,
      },
      update: {
        confirmedByUserId: session.user.id,
        matchedPositionId: sourcePositionId,
      },
    });
  }

  if (sourcePositionId) {
    await refreshImportCounts(lineItem.lvImportId);
    revalidatePath("/kalkulation/imports");
  }
  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
}

/** Verknüpft zwei ähnliche Positionen aus VERSCHIEDENEN LVs als dieselbe
 * Katalogposition - auch OHNE Preis, z.B. wenn beide LVs noch ungepreiste
 * Ausschreibungen sind. Ohne diese Funktion gibt es für Cross-LV-Vorschläge
 * ohne Preis (adoptPrice greift nur MIT Preis) gar keine Möglichkeit, einen
 * der Vorschläge auszuwählen. Nutzt eine bereits vorhandene
 * Katalogzuordnung (von dieser oder der Quellzeile), sonst wird eine neue
 * Katalogposition angelegt - und BEIDE Zeilen werden bestätigt, damit der
 * Zusammenhang auch beim späteren Öffnen der anderen LV sichtbar bleibt. */
export async function linkCrossLvMatch(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  const sourceLineItemId = text(formData.get("sourceLineItemId"));
  if (!lineItemId || !sourceLineItemId) throw new Error("Position fehlt.");
  const similarityRaw = text(formData.get("similarityScore"));
  const similarityScore = similarityRaw ? Number.parseFloat(similarityRaw) : 1;

  const [current, source] = await Promise.all([
    prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: lineItemId } }),
    prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: sourceLineItemId } }),
  ]);

  let positionId = current.matchedPositionId ?? source.matchedPositionId;
  if (!positionId) {
    const created = await prisma.kalkulationPosition.create({
      data: {
        description: current.rawText.slice(0, 2000),
        title: (current.shortText || current.rawText).slice(0, 200),
        unit: current.unit ?? source.unit ?? "Stk",
      },
    });
    positionId = created.id;
  }

  const confirmedAt = new Date();
  await prisma.$transaction([
    prisma.kalkulationLvLineItem.update({
      where: { id: current.id },
      data: {
        confirmedAt,
        confirmedByUserId: session.user.id,
        matchConfidence: similarityScore,
        matchStatus: "CONFIRMED",
        matchedPositionId: positionId,
        matchedVia: "CROSS_LV",
      },
    }),
    prisma.kalkulationLvLineItem.update({
      where: { id: source.id },
      data: {
        confirmedAt,
        confirmedByUserId: session.user.id,
        matchConfidence: similarityScore,
        matchStatus: "CONFIRMED",
        matchedPositionId: positionId,
        matchedVia: "CROSS_LV",
      },
    }),
  ]);

  for (const normalizedText of new Set([current.normalizedText, source.normalizedText])) {
    await prisma.kalkulationLearnedMapping.upsert({
      where: { normalizedText },
      create: {
        confirmedByUserId: session.user.id,
        confidence: similarityScore,
        matchedPositionId: positionId,
        matchedVia: "CROSS_LV",
        normalizedText,
        timesReused: 0,
      },
      update: { confirmedByUserId: session.user.id, matchedPositionId: positionId },
    });
  }

  await refreshImportCounts(current.lvImportId);
  if (source.lvImportId !== current.lvImportId) await refreshImportCounts(source.lvImportId);

  revalidatePath(`/kalkulation/imports/${current.lvImportId}`);
  revalidatePath(`/kalkulation/imports/${source.lvImportId}`);
  revalidatePath("/kalkulation/imports");
}

/** Bulk-Variante von adoptPrice: übernimmt für JEDE noch ungepreiste
 * Position dieses LVs automatisch den besten verfügbaren Preis - erst aus
 * bestätigten Katalog-Zuordnungen, sonst aus dem ähnlichsten Treffer in
 * einem anderen LV (gleiche Genauigkeits-Schwelle wie beim Abgleich). */
export async function adoptBestPricesForImport(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");

  const lvImport = await prisma.kalkulationLvImport.findUniqueOrThrow({ where: { id: importId } });

  const unpriced = await prisma.kalkulationLvLineItem.findMany({
    where: { entryType: "ITEM", lvImportId: importId, unitPriceCents: null },
  });
  if (unpriced.length === 0) {
    revalidatePath(`/kalkulation/imports/${importId}`);
    return;
  }

  const matchedPositionIds = [
    ...new Set(unpriced.map((item) => item.matchedPositionId).filter((id): id is string => Boolean(id))),
  ];
  const catalogHistory = matchedPositionIds.length
    ? await prisma.kalkulationLvLineItem.findMany({
        where: { matchedPositionId: { in: matchedPositionIds }, matchStatus: "CONFIRMED", lvImportId: { not: importId } },
        orderBy: { lvImport: { lvDate: "desc" } },
      })
    : [];
  const bestCatalogPriceByPosition = new Map<string, { unitPriceCents: number; sourceLvImportId: string }>();
  for (const row of catalogHistory) {
    if (!row.matchedPositionId || row.unitPriceCents == null) continue;
    if (!bestCatalogPriceByPosition.has(row.matchedPositionId)) {
      bestCatalogPriceByPosition.set(row.matchedPositionId, {
        sourceLvImportId: row.lvImportId,
        unitPriceCents: row.unitPriceCents,
      });
    }
  }

  const otherLvItems = await prisma.kalkulationLvLineItem.findMany({
    where: { entryType: "ITEM", lvImportId: { not: importId } },
    take: 3000,
    orderBy: { createdAt: "desc" },
  });
  const otherLvCatalog: CatalogEntryForMatching[] = otherLvItems.map((row) => ({
    id: row.id,
    code: row.positionNumber,
    title: row.shortText ?? row.rawText.slice(0, 100),
    description: row.rawText,
    unit: row.unit ?? "",
  }));
  const otherLvItemsById = new Map(otherLvItems.map((row) => [row.id, row]));

  for (const item of unpriced) {
    let unitPriceCents: number | null = null;
    let sourceLvImportId: string | null = null;
    let similarityScore = 1; // exakte Katalog-Zuordnung, sofern nicht unten überschrieben

    if (item.matchedPositionId) {
      const catalogMatch = bestCatalogPriceByPosition.get(item.matchedPositionId);
      if (catalogMatch) {
        unitPriceCents = catalogMatch.unitPriceCents;
        sourceLvImportId = catalogMatch.sourceLvImportId;
      }
    }

    if (unitPriceCents == null && otherLvCatalog.length > 0) {
      const combinedText = `${item.shortText ?? ""} ${item.rawText}`.trim();
      const [best] = buildShortlist(combinedText, otherLvCatalog, 1, lvImport.matchingThreshold);
      if (best) {
        const source = otherLvItemsById.get(best.positionId);
        if (source?.unitPriceCents != null) {
          unitPriceCents = source.unitPriceCents;
          sourceLvImportId = source.lvImportId;
          similarityScore = best.similarityScore;
        }
      }
    }

    if (unitPriceCents == null) continue;

    await prisma.kalkulationLvLineItem.update({
      where: { id: item.id },
      data: {
        priceSourceLvImportId: sourceLvImportId,
        priceSourceSimilarity: sourceLvImportId ? similarityScore : null,
        totalPriceCents: item.quantity != null ? Math.round(unitPriceCents * item.quantity) : null,
        unitPriceCents,
      },
    });
  }

  revalidatePath(`/kalkulation/imports/${importId}`);
}
