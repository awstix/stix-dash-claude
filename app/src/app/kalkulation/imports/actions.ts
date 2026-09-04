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
import { looksLikeRibKalkulation, parseRibKalkulation, rewriteOzInRawBlock } from "@/lib/rib-kalkulation-parser";
import { looksLikeEstimateXml, parseEstimateXml, rewriteOzInXmlBlock } from "@/lib/kalkulation-estimate-xml-parser";
import { ansatzPoolByProjectAndOz, buildAnsatzPool, findBestAnsatzViaLvMatch } from "@/lib/kalkulation-ansatz-pool";
import { buildLvMatches, buildShortlist, normalizeText, type CatalogEntryForMatching } from "@/lib/kalkulation-matching";
import { getAiProvider, type LineItemForMatching } from "@/lib/kalkulation-ai-provider";
import { getAiSettings, isAiConfigured } from "@/lib/kalkulation-ai-settings";

const STORAGE_BUCKET = "uploads";
const GAEB_EXTENSIONS = /\.(x81|x83|x84|d81|d83|d84)$/i;
const RIB_KALKULATION_EXTENSIONS = /\.(d31|x31)$/i;

type ParsedRow = {
  entryType: "ITEM" | "TITLE" | "REMARK";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
  unit: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  // Nur bei RIB_KALKULATION gesetzt (siehe rib-kalkulation-parser.ts bzw.
  // kalkulation-estimate-xml-parser.ts) - die unveränderten Original-
  // Rohblöcke, die die Exporte später wieder 1:1 einbauen.
  ribRawBlock?: string | null;
  ribRawBlockXml?: string | null;
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
  // Von einer Projekt-Zeile aus hochgeladen (ein leeres Slot befüllt) -
  // dann dorthin zurückkehren statt immer zur Einzel-Review-Seite zu
  // springen, sonst sieht man nach dem Upload die eigenen "3 Zeilen"
  // nicht mehr.
  const returnTo = text(formData.get("returnTo"));

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `${returnTo || "/kalkulation/projects"}?importError=${encodeURIComponent("Bitte eine GAEB- oder Excel-Datei auswählen.")}`,
    );
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
    } else if (looksLikeEstimateXml(buffer)) {
      // RIB iTWO Kalkulations-XML-Export ("EstimateRoot") - im Gegensatz
      // zur D31 trägt hier jede Position ihren Beschreibungstext direkt
      // (kein Umweg über ein separat hochgeladenes LV nötig), deshalb das
      // bevorzugte Format für hochgeladene Kalkulationen. Gleicher
      // sourceFormat wie D31, da beide denselben ribRawBlock liefern und
      // die restliche Pipeline (Pool-Aufbau, Matching, D31-Export) davon
      // nicht wissen muss, aus welchem Format eine Kalkulation stammt.
      const parsed = parseEstimateXml(buffer);
      rows = parsed.entries;
      sourceFormat = "RIB_KALKULATION";
      lvType = "ANGEBOT";
      extractedTenderTitle = parsed.tenderTitle;
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
    redirect(`${returnTo || "/kalkulation/projects"}?importError=${encodeURIComponent(message)}`);
  }

  const itemRows = rows.filter((row) => row.entryType === "ITEM");
  if (itemRows.length === 0) {
    redirect(
      `${returnTo || "/kalkulation/projects"}?importError=${encodeURIComponent("In der Datei wurden keine Positionen gefunden.")}`,
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

  // Hält KalkulationProject synchron, egal auf welchem Weg importiert wird
  // (neue Projektseite oder der freie Upload hier) - ohne das würde eine
  // Projektnummer, die nur hier eingetippt wurde, auf der Projektübersicht
  // fehlen. Bestehenden Projekttitel dabei nicht überschreiben.
  if (projectNumberInput) {
    await prisma.kalkulationProject.upsert({
      create: { projectNumber: projectNumberInput, tenderTitle: tenderTitleInput || extractedTenderTitle },
      update: {},
      where: { projectNumber: projectNumberInput },
    });
  }

  await prisma.kalkulationLvLineItem.createMany({
    data: rows.map((row, index) => ({
      entryType: row.entryType,
      lvImportId: lvImport.id,
      normalizedText: normalizeText(`${row.shortText ?? ""} ${row.rawText}`),
      positionNumber: row.positionNumber,
      quantity: row.quantity,
      rawText: row.rawText,
      ribRawBlock: row.ribRawBlock ?? null,
      ribRawBlockXml: row.ribRawBlockXml ?? null,
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

  revalidatePath("/kalkulation/projects");
  if (returnTo) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }
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
  revalidatePath("/kalkulation/projects");
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
  revalidatePath("/kalkulation/projects");
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
  const returnTo = text(formData.get("returnTo")) || "/kalkulation/projects";

  const lvImport = await prisma.kalkulationLvImport.findUnique({ where: { id: importId } });
  if (!lvImport) return;

  // Zeilen hängen per onDelete: Cascade an der Import-Zeile, werden also
  // automatisch mitgelöscht - nur die abgelegte Originaldatei muss
  // separat aus dem Storage entfernt werden.
  await prisma.kalkulationLvImport.delete({ where: { id: importId } });

  if (lvImport.originalStoragePath) {
    await deleteFile(STORAGE_BUCKET, lvImport.originalStoragePath).catch(() => undefined);
  }

  revalidatePath("/kalkulation/projects");
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
    revalidatePath("/kalkulation/projects");
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
  revalidatePath("/kalkulation/projects");
}

/** Bulk-Variante von adoptPrice: übernimmt für JEDE noch ungepreiste
 * Position dieses LVs automatisch den besten verfügbaren Preis - erst aus
 * bestätigten Katalog-Zuordnungen, sonst aus dem ähnlichsten Treffer in
 * einem anderen LV. Nutzt für Letzteres dieselben Kurztext-/Langtext-/
 * Menge-/Einheit-Kriterien wie "Abgleich starten" (buildLvMatches) - vorher
 * lief hier noch die alte, nicht mehr sichtbare Einzel-Schwelle
 * (matchingThreshold), inkonsistent zu dem, was der Nutzer tatsächlich
 * einstellt. */
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
    where: {
      entryType: "ITEM",
      lvImportId: { not: importId },
      NOT: { shortText: { startsWith: "Kalkulation OZ " } },
    },
    take: 3000,
    orderBy: { createdAt: "desc" },
  });
  const otherLvCandidates = otherLvItems.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    rawText: row.rawText,
    shortText: row.shortText,
    unit: row.unit,
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

    if (unitPriceCents == null && otherLvCandidates.length > 0) {
      const [best] = buildLvMatches(
        { id: item.id, quantity: item.quantity, rawText: item.rawText, shortText: item.shortText, unit: item.unit },
        otherLvCandidates,
        {
          exactEinheit: lvImport.crossLvExactEinheit,
          exactMenge: lvImport.crossLvExactMenge,
          kurztextThreshold: lvImport.crossLvKurztextThreshold,
          langtextThreshold: lvImport.crossLvLangtextThreshold,
        },
      );
      if (best) {
        const source = otherLvItemsById.get(best.candidateId);
        if (source?.unitPriceCents != null) {
          unitPriceCents = source.unitPriceCents;
          sourceLvImportId = source.lvImportId;
          similarityScore = best.langtextScore;
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

/** Macht eine per "Preis übernehmen"/"Diesen Treffer übernehmen" gesetzte
 * Preisübernahme für EINE Position wieder rückgängig - die Position wird
 * wieder ungepreist. Rührt bewusst NICHT an einer eventuell schon
 * bestätigten Katalogzuordnung (matchedPositionId/matchStatus), das ist
 * ein eigener Schritt (dafür gibt's "Ablehnen"). */
export async function clearPrice(formData: FormData) {
  await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeilen-ID fehlt.");

  const lineItem = await prisma.kalkulationLvLineItem.update({
    data: {
      priceSourceLvImportId: null,
      priceSourceSimilarity: null,
      totalPriceCents: null,
      unitPriceCents: null,
    },
    where: { id: lineItemId },
  });

  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
  revalidatePath("/kalkulation/projects");
}

/** Wie clearPrice, aber für ALLE Positionen eines Imports auf einmal -
 * betrifft nur Positionen, deren Preis tatsächlich übernommen wurde
 * (priceSourceLvImportId gesetzt), nicht Preise aus der Originaldatei. */
export async function clearAdoptedPricesForImport(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");

  await prisma.kalkulationLvLineItem.updateMany({
    data: {
      priceSourceLvImportId: null,
      priceSourceSimilarity: null,
      totalPriceCents: null,
      unitPriceCents: null,
    },
    where: { lvImportId: importId, priceSourceLvImportId: { not: null } },
  });

  revalidatePath(`/kalkulation/imports/${importId}`);
  revalidatePath("/kalkulation/projects");
}

/** Eine D31-Position gilt als "leer" (noch keine echte Kalkulation), wenn ihr
 * Rohblock keine Baustein- oder Kostenart-Ansätze enthält - z.B. ein aus
 * iTWO frisch exportiertes Skelett zu einem neuen LV, noch ohne Ansätze. Nur
 * solche Positionen werden mit einem Vorschlag befüllt, echte, bereits
 * vorhandene Ansätze werden nie überschrieben. */
function ribBlockIsEmpty(raw: string | null): boolean {
  if (!raw) return true;
  return !raw.includes("#begin[_RIB_BstnA]") && !raw.includes("#begin[_RIB_KoaA]");
}

/** Schlägt für jede Position eines Projekts die ähnlichste D31-
 * Kalkulationsposition aus allen ANDEREN Projekten vor - Ziel: eine
 * Vorlage, die man vor der eigentlichen Kalkulation in iTWO einliest, statt
 * bei null anzufangen. Zwei Fälle:
 * - Noch keine D31 im Projekt: legt einen neuen RIB_KALKULATION-Import an,
 *   eine Zeile je LV-Position.
 * - Bereits eine D31 vorhanden (z.B. ein aus iTWO frisch exportiertes,
 *   noch leeres Kalkulations-Skelett): befüllt NUR deren leere Positionen
 *   direkt, vorhandene Ansätze bleiben unangetastet - so bleibt die exakte
 *   OZ-Struktur aus iTWO erhalten.
 * In beiden Fällen Status "Prüfen" je Zeile, nichts wird automatisch
 * übernommen. */
export async function suggestAnsaetzeFromHistory(formData: FormData) {
  const session = await requireSession();
  const projectNumber = text(formData.get("projectNumber"));
  const returnTo = text(formData.get("returnTo")) || "/kalkulation/projects";
  if (!projectNumber) throw new Error("Projektnummer fehlt.");

  const project = await prisma.kalkulationProject.findUnique({ where: { projectNumber } });
  if (!project) throw new Error("Projekt nicht gefunden.");

  // Die D31-Datei selbst enthält keinen Positionstext (nur OZ + Ansätze) -
  // der Abgleich braucht deshalb den echten Text aus dem eigenen LV dieses
  // Projekts als Grundlage, in beiden Fällen unten.
  const ownLvImport = await prisma.kalkulationLvImport.findFirst({
    orderBy: { createdAt: "desc" },
    where: { projectNumber, sourceFormat: { not: "RIB_KALKULATION" } },
  });
  if (!ownLvImport) {
    redirect(
      `${returnTo}?importError=${encodeURIComponent("Bitte zuerst das LV (Angebotsabgabe) hochladen - daraus werden die Positionstexte für den Abgleich genommen.")}`,
    );
    return;
  }
  // Non-null-Zwischenvariable, weil TypeScript die obige Narrowing-Prüfung
  // nicht in die weiter unten definierte findSuggestion-Closure überträgt.
  const ownLvImportChecked = ownLvImport;

  const ownLineItems = await prisma.kalkulationLvLineItem.findMany({
    orderBy: { rowNumber: "asc" },
    where: { entryType: "ITEM", lvImportId: ownLvImport.id, positionNumber: { not: null } },
  });
  const ownTextByOz = new Map<
    string,
    { shortText: string | null; rawText: string; quantity: number | null; unit: string | null }
  >();
  for (const item of ownLineItems) {
    if (!item.positionNumber) continue;
    const key = item.positionNumber.trim();
    if (!ownTextByOz.has(key)) {
      ownTextByOz.set(key, { quantity: item.quantity, rawText: item.rawText, shortText: item.shortText, unit: item.unit });
    }
  }

  const pool = await buildAnsatzPool(projectNumber);
  if (pool.length === 0) {
    redirect(
      `${returnTo}?importError=${encodeURIComponent("Es gibt noch keine auswertbaren Kalkulationsansätze in anderen Projekten (D31 hochgeladen UND eigenes LV mit passenden OZ nötig).")}`,
    );
  }
  const ansatzByProjectAndOz = ansatzPoolByProjectAndOz(pool);

  // Nicht direkt gegen den (oft schlechter aufbereiteten) Text der
  // Kalkulationsdatei selbst matchen, sondern über denselben, größeren und
  // verlässlicheren LV-Textvergleich wie "Abgleich starten" oben im
  // LV-Panel - der findet zuverlässig deutlich mehr Übereinstimmungen.
  // Danach nur prüfen, ob das jeweils beste Projekt für dieselbe OZ auch
  // einen Ansatz hat (siehe findBestAnsatzViaLvMatch).
  const otherLvItems = await prisma.kalkulationLvLineItem.findMany({
    include: { lvImport: true },
    where: {
      entryType: "ITEM",
      lvImport: { projectNumber: { not: projectNumber }, sourceFormat: { not: "RIB_KALKULATION" } },
      NOT: { shortText: { startsWith: "Kalkulation OZ " } },
      positionNumber: { not: null },
    },
    take: 3000,
  });
  const otherLvCandidates = otherLvItems.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    rawText: row.rawText,
    shortText: row.shortText,
    unit: row.unit,
  }));
  const otherLvMetaById = new Map(
    otherLvItems.map((row) => [row.id, { positionNumber: row.positionNumber, projectNumber: row.lvImport.projectNumber! }]),
  );

  function findSuggestion(
    positionNumber: string,
    ownText: { shortText: string | null; rawText: string; quantity: number | null; unit: string | null },
  ) {
    const result = findBestAnsatzViaLvMatch(
      { id: "__target__", quantity: ownText.quantity, rawText: ownText.rawText, shortText: ownText.shortText, unit: ownText.unit },
      otherLvCandidates,
      otherLvMetaById,
      ansatzByProjectAndOz,
      {
        exactEinheit: ownLvImportChecked.crossLvExactEinheit,
        exactMenge: ownLvImportChecked.crossLvExactMenge,
        kurztextThreshold: ownLvImportChecked.crossLvKurztextThreshold,
        langtextThreshold: ownLvImportChecked.crossLvLangtextThreshold,
      },
    );
    if (!result) return null;
    const source = result.ansatz;
    return {
      matchConfidence: result.langtextScore,
      rawText: `Vorschlag aus Projekt ${source.sourceProjectNumber} (Ähnlichkeit ${Math.round(result.langtextScore * 100)}%), bitte prüfen:\n${source.ansatzSummary}`,
      ribRawBlock: rewriteOzInRawBlock(source.ribRawBlock, positionNumber),
      ribRawBlockXml: source.ribRawBlockXml ? rewriteOzInXmlBlock(source.ribRawBlockXml, positionNumber) : null,
    };
  }

  const existingKalkulationImport = await prisma.kalkulationLvImport.findFirst({
    orderBy: { createdAt: "desc" },
    where: { projectNumber, sourceFormat: "RIB_KALKULATION" },
  });

  let filledCount = 0;

  if (existingKalkulationImport) {
    // Vorhandene D31 (z.B. frisch aus iTWO exportiertes Skelett) direkt an
    // ihren eigenen, leeren Positionen befüllen - deren OZ-Struktur ist
    // bereits die richtige für dieses Projekt.
    const targetItems = await prisma.kalkulationLvLineItem.findMany({
      orderBy: { rowNumber: "asc" },
      where: { entryType: "ITEM", lvImportId: existingKalkulationImport.id, positionNumber: { not: null } },
    });

    for (const item of targetItems) {
      if (!item.positionNumber || !ribBlockIsEmpty(item.ribRawBlock)) continue;
      const ownText = ownTextByOz.get(item.positionNumber.trim());
      if (!ownText) continue;
      const suggestion = findSuggestion(item.positionNumber, ownText);
      if (!suggestion) continue;

      await prisma.kalkulationLvLineItem.update({
        data: {
          matchConfidence: suggestion.matchConfidence,
          matchedVia: "CROSS_PROJECT_ANSATZ",
          matchStatus: "NEEDS_REVIEW",
          rawText: suggestion.rawText,
          ribRawBlock: suggestion.ribRawBlock,
          ribRawBlockXml: suggestion.ribRawBlockXml,
        },
        where: { id: item.id },
      });
      filledCount += 1;
    }

    if (filledCount === 0) {
      redirect(
        `${returnTo}?importError=${encodeURIComponent("Keine leeren Positionen mit ausreichend ähnlichen Ansätzen in anderen Projekten gefunden.")}`,
      );
    }

    revalidatePath(`/kalkulation/imports/${existingKalkulationImport.id}`);
  } else {
    // Noch keine D31 im Projekt - neuen Import aus den LV-Positionen anlegen.
    const rowsToCreate: Array<{
      matchConfidence: number;
      positionNumber: string;
      rawText: string;
      ribRawBlock: string;
      ribRawBlockXml: string | null;
      shortText: string | null;
    }> = [];

    for (const item of ownLineItems) {
      if (!item.positionNumber) continue;
      const suggestion = findSuggestion(item.positionNumber, item);
      if (!suggestion) continue;
      rowsToCreate.push({ ...suggestion, positionNumber: item.positionNumber, shortText: item.shortText });
    }

    if (rowsToCreate.length === 0) {
      redirect(
        `${returnTo}?importError=${encodeURIComponent("Keine ausreichend ähnlichen Ansätze in anderen Projekten gefunden.")}`,
      );
    }

    const suggestionImport = await prisma.kalkulationLvImport.create({
      data: {
        fileName: "Kalkulationsansätze-Vorschläge (aus anderen Projekten)",
        importedByUserId: session.user.id,
        lvType: "ANGEBOT",
        projectNumber,
        rowCount: rowsToCreate.length,
        sourceFormat: "RIB_KALKULATION",
        status: "IMPORTED",
        tenderTitle: project.tenderTitle,
      },
    });

    await prisma.kalkulationLvLineItem.createMany({
      data: rowsToCreate.map((row, index) => ({
        entryType: "ITEM",
        lvImportId: suggestionImport.id,
        matchConfidence: row.matchConfidence,
        matchedVia: "CROSS_PROJECT_ANSATZ",
        matchStatus: "NEEDS_REVIEW",
        normalizedText: normalizeText(`${row.shortText ?? ""} ${row.rawText}`),
        positionNumber: row.positionNumber,
        rawText: row.rawText,
        ribRawBlock: row.ribRawBlock,
        ribRawBlockXml: row.ribRawBlockXml,
        rowNumber: index + 1,
        shortText: row.shortText,
      })),
    });
  }

  revalidatePath("/kalkulation/projects");
  revalidatePath(returnTo);
  redirect(returnTo);
}

/** Bestätigt einen einzelnen Ansatz-Vorschlag (siehe
 * suggestAnsaetzeFromHistory) - zählt danach zum D31-Export dieses Imports. */
export async function confirmAnsatzSuggestion(formData: FormData) {
  await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeilen-ID fehlt.");

  const item = await prisma.kalkulationLvLineItem.update({
    data: { matchStatus: "CONFIRMED" },
    where: { id: lineItemId },
  });

  revalidatePath(`/kalkulation/imports/${item.lvImportId}`);
  revalidatePath("/kalkulation/projects");
}

/** Lehnt einen Ansatz-Vorschlag ab - fliegt dadurch aus dem späteren
 * D31-Export dieses Imports raus (Zeile selbst bleibt zur Nachvollziehbarkeit
 * stehen, wird beim Export aber übersprungen). */
export async function rejectAnsatzSuggestion(formData: FormData) {
  await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  if (!lineItemId) throw new Error("Zeilen-ID fehlt.");

  const item = await prisma.kalkulationLvLineItem.update({
    data: { matchStatus: "REJECTED" },
    where: { id: lineItemId },
  });

  revalidatePath(`/kalkulation/imports/${item.lvImportId}`);
  revalidatePath("/kalkulation/projects");
}

/** Speichert die drei Abgleich-Kriterien für "Ähnlich in anderen LVs"
 * (Kurztext-/Langtext-Ähnlichkeit, Menge+Einheit exakt) - pro Import, wie
 * schon bei matchingThreshold für den Katalog-Abgleich üblich. */
export async function updateCrossLvSettings(formData: FormData) {
  const session = await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");
  const returnTo = text(formData.get("returnTo")) || `/kalkulation/imports/${importId}`;

  const kurztextRaw = text(formData.get("crossLvKurztextThreshold"));
  const langtextRaw = text(formData.get("crossLvLangtextThreshold"));
  const exactMenge = formData.get("crossLvExactMenge") === "on";
  const exactEinheit = formData.get("crossLvExactEinheit") === "on";

  await prisma.kalkulationLvImport.update({
    data: {
      crossLvExactEinheit: exactEinheit,
      crossLvExactMenge: exactMenge,
      crossLvKurztextThreshold: kurztextRaw ? Number.parseInt(kurztextRaw, 10) / 100 : 0.5,
      crossLvLangtextThreshold: langtextRaw ? Number.parseInt(langtextRaw, 10) / 100 : 0.3,
      crossLvMatchedAt: new Date(),
      crossLvMatchedByUserId: session.user.id,
    },
    where: { id: importId },
  });

  revalidatePath(`/kalkulation/imports/${importId}`);
  revalidatePath("/kalkulation/projects");
  redirect(returnTo);
}

/** Übernimmt den Kalkulationsansatz einer per "Ähnlich in anderen LVs"
 * gefundenen Position (egal ob deren Quelle selbst ein LV mit
 * Kalkulation ist oder direkt eine Kalkulationsposition) in die eigene
 * Kalkulation dieses Projekts - legt sie bei Bedarf an. Anders als beim
 * Massen-Vorschlag (suggestAnsaetzeFromHistory) ist das hier eine
 * bewusste Einzel-Übernahme NACH Prüfung (der Diff war ja sichtbar),
 * deshalb direkt als "Bestätigt" markiert statt "Prüfen". */
export async function adoptAnsatzFromCandidate(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  const sourceCandidateId = text(formData.get("sourceCandidateId"));
  if (!lineItemId || !sourceCandidateId) throw new Error("Position fehlt.");

  const [lineItem, sourceItem] = await Promise.all([
    prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: lineItemId }, include: { lvImport: true } }),
    prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: sourceCandidateId }, include: { lvImport: true } }),
  ]);

  if (!lineItem.positionNumber || !lineItem.lvImport.projectNumber || !sourceItem.ribRawBlock) {
    throw new Error("Für diese Position ist keine Ansatz-Übernahme möglich.");
  }
  const projectNumber = lineItem.lvImport.projectNumber;

  let kalkulationImport = await prisma.kalkulationLvImport.findFirst({
    orderBy: { createdAt: "desc" },
    where: { projectNumber, sourceFormat: "RIB_KALKULATION" },
  });
  if (!kalkulationImport) {
    kalkulationImport = await prisma.kalkulationLvImport.create({
      data: {
        fileName: "Kalkulationsansätze-Vorschläge (aus anderen Projekten)",
        importedByUserId: session.user.id,
        lvType: "ANGEBOT",
        projectNumber,
        rowCount: 0,
        sourceFormat: "RIB_KALKULATION",
        status: "IMPORTED",
        tenderTitle: lineItem.lvImport.tenderTitle,
      },
    });
  }

  const ribRawBlock = rewriteOzInRawBlock(sourceItem.ribRawBlock, lineItem.positionNumber);
  const ribRawBlockXml = sourceItem.ribRawBlockXml
    ? rewriteOzInXmlBlock(sourceItem.ribRawBlockXml, lineItem.positionNumber)
    : null;
  const sourceProjectLabel = sourceItem.lvImport.projectNumber ?? sourceItem.lvImport.fileName;
  const rawText = `Übernommen aus Projekt ${sourceProjectLabel}:\n${sourceItem.rawText}`;
  const data = {
    matchConfidence: 1,
    matchedVia: "CROSS_PROJECT_ANSATZ",
    matchStatus: "CONFIRMED",
    normalizedText: normalizeText(`${lineItem.shortText ?? ""} ${rawText}`),
    positionNumber: lineItem.positionNumber,
    rawText,
    ribRawBlock,
    ribRawBlockXml,
    shortText: lineItem.shortText,
  };

  const existingTarget = await prisma.kalkulationLvLineItem.findFirst({
    where: { lvImportId: kalkulationImport.id, positionNumber: lineItem.positionNumber },
  });

  if (existingTarget) {
    await prisma.kalkulationLvLineItem.update({ data, where: { id: existingTarget.id } });
  } else {
    const rowCount = await prisma.kalkulationLvLineItem.count({ where: { lvImportId: kalkulationImport.id } });
    await prisma.kalkulationLvLineItem.create({
      data: { ...data, entryType: "ITEM", lvImportId: kalkulationImport.id, rowNumber: rowCount + 1 },
    });
    await prisma.kalkulationLvImport.update({
      data: { rowCount: rowCount + 1 },
      where: { id: kalkulationImport.id },
    });
  }

  revalidatePath(`/kalkulation/imports/${kalkulationImport.id}`);
  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
  revalidatePath("/kalkulation/projects");
}
