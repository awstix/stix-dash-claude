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
import {
  ansatzPoolByProjectAndOz,
  buildAnsatzPool,
  findAnsatzCandidatesViaLvMatch,
  type StoredAnsatzAlternative,
} from "@/lib/kalkulation-ansatz-pool";
import { buildLvMatches, normalizeText, type StoredCrossLvMatch } from "@/lib/kalkulation-matching";

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
  // Nur für den Kalkulations-Upload-Slot relevant (siehe ProjectSlot in
  // page.tsx) - markiert eine echte, in iTWO fertiggestellte Kalkulation
  // als Referenzdaten für Ansatz-Vorschläge bei anderen Projekten.
  const isFinalCalculation = formData.get("isFinalCalculation") === "on";
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
      isFinalCalculation: sourceFormat === "RIB_KALKULATION" && isFinalCalculation,
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

/** Eine D31-Position gilt als "leer" (noch keine echte Kalkulation), wenn ihr
 * Rohblock keine Baustein- oder Kostenart-Ansätze enthält - z.B. ein aus
 * iTWO frisch exportiertes Skelett zu einem neuen LV, noch ohne Ansätze. Nur
 * solche Positionen werden mit einem Vorschlag befüllt, echte, bereits
 * vorhandene Ansätze werden nie überschrieben. */
function ribBlockIsEmpty(raw: string | null): boolean {
  if (!raw) return true;
  return !raw.includes("#begin[_RIB_BstnA]") && !raw.includes("#begin[_RIB_KoaA]");
}

/** Übernimmt für JEDE Position eines Projekts automatisch den besten
 * verfügbaren Kalkulationsansatz aus allen ANDEREN Projekten (direkt als
 * "Bestätigt", wie eine manuelle Einzel-Übernahme über "Ähnlich in
 * anderen LVs") - Ziel: mit einem Klick eine vollständig vorkalkulierte
 * Basis, statt bei null anzufangen. Bis zu 2 weitere Kandidaten werden
 * als "Andere Vorschläge" mitgespeichert, falls der automatisch gewählte
 * nicht passt (siehe chooseAnsatzAlternative). Zwei Fälle:
 * - Noch keine Kalkulation im Projekt: legt einen neuen RIB_KALKULATION-
 *   Import an, eine Zeile je LV-Position.
 * - Bereits eine Kalkulation vorhanden (z.B. ein aus iTWO frisch
 *   exportiertes, noch leeres Skelett): befüllt NUR deren leere oder noch
 *   unentschiedene Positionen, vorhandene/bestätigte/verworfene Ansätze
 *   bleiben unangetastet - so bleibt die exakte OZ-Struktur aus iTWO
 *   erhalten. */
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
  // Derselbe Projekt-Filter wie "Abgleich starten" (im LV selbst
  // eingestellt, siehe updateCrossLvSettings) - leer heißt "alle Projekte".
  const targetProjectNumber = ownLvImportChecked.crossLvTargetProjectNumber ?? undefined;

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

  const pool = await buildAnsatzPool(projectNumber, targetProjectNumber);
  if (pool.length === 0) {
    redirect(
      `${returnTo}?importError=${encodeURIComponent("Es gibt noch keine auswertbaren, als final markierten Kalkulationsansätze in anderen Projekten.")}`,
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
      lvImport: {
        projectNumber: targetProjectNumber ? targetProjectNumber : { not: projectNumber },
        sourceFormat: { not: "RIB_KALKULATION" },
      },
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
    // Bis zu 3 Kandidaten (je einer pro Quellprojekt) statt nur des
    // einen besten - der beste wird direkt übernommen, die übrigen als
    // "Andere Vorschläge" mitgespeichert, damit der Nutzer z.B. zwischen
    // 3 verschiedenen LVs mit "Baustelle einrichten" wählen kann.
    const [best, ...rest] = findAnsatzCandidatesViaLvMatch(
      { id: "__target__", quantity: ownText.quantity, rawText: ownText.rawText, shortText: ownText.shortText, unit: ownText.unit },
      otherLvCandidates,
      otherLvMetaById,
      ansatzByProjectAndOz,
      {
        exactEinheit: ownLvImportChecked.crossLvExactEinheit,
        exactMenge: ownLvImportChecked.crossLvExactMenge,
        filterByKurztext: ownLvImportChecked.crossLvFilterByKurztext,
        filterByLangtext: ownLvImportChecked.crossLvFilterByLangtext,
        kurztextThreshold: ownLvImportChecked.crossLvKurztextThreshold,
        langtextThreshold: ownLvImportChecked.crossLvLangtextThreshold,
      },
      3,
    );
    if (!best) return null;
    const source = best.ansatz;
    const alternatives: StoredAnsatzAlternative[] = rest.map((candidate) => ({
      ansatzSummary: candidate.ansatz.ansatzSummary,
      ribRawBlock: rewriteOzInRawBlock(candidate.ansatz.ribRawBlock, positionNumber),
      ribRawBlockXml: candidate.ansatz.ribRawBlockXml
        ? rewriteOzInXmlBlock(candidate.ansatz.ribRawBlockXml, positionNumber)
        : null,
      similarity: candidate.langtextScore,
      sourceImportDate: candidate.ansatz.sourceImportDate.toISOString(),
      sourceProjectNumber: candidate.ansatz.sourceProjectNumber,
    }));
    return {
      alternativesJson: alternatives.length > 0 ? JSON.stringify(alternatives) : null,
      matchConfidence: best.langtextScore,
      rawText: `Übernommen aus Projekt ${source.sourceProjectNumber} (Ähnlichkeit ${Math.round(best.langtextScore * 100)}%):\n${source.ansatzSummary}`,
      ribRawBlock: rewriteOzInRawBlock(source.ribRawBlock, positionNumber),
      ribRawBlockXml: source.ribRawBlockXml ? rewriteOzInXmlBlock(source.ribRawBlockXml, positionNumber) : null,
    };
  }

  // isFinalCalculation: false - eine als final hochgeladene Kalkulation ist
  // die verifizierte Referenzdatei dieses Projekts und darf niemals durch
  // automatische Vorschläge überschrieben werden, nur der Entwurf.
  const existingKalkulationImport = await prisma.kalkulationLvImport.findFirst({
    orderBy: { createdAt: "desc" },
    where: { isFinalCalculation: false, projectNumber, sourceFormat: "RIB_KALKULATION" },
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
      if (!item.positionNumber) continue;
      // Echte, direkt hochgeladene Ansätze (kein Vorschlag von uns) und
      // bereits vom Nutzer entschiedene Positionen (Bestätigt/Verworfen)
      // werden nie angetastet - alles andere darf (erneut) automatisch
      // befüllt werden, z.B. wenn seit dem letzten Lauf ein weiteres
      // Projekt mit Ansätzen dazugekommen ist.
      const isRealUploadedAnsatz = !ribBlockIsEmpty(item.ribRawBlock) && item.matchedVia !== "CROSS_PROJECT_ANSATZ";
      const isDecided = item.matchStatus === "CONFIRMED" || item.matchStatus === "REJECTED";
      if (isRealUploadedAnsatz || isDecided) continue;
      const ownText = ownTextByOz.get(item.positionNumber.trim());
      if (!ownText) continue;
      const suggestion = findSuggestion(item.positionNumber, ownText);
      if (!suggestion) continue;

      await prisma.kalkulationLvLineItem.update({
        data: {
          ansatzAlternativesJson: suggestion.alternativesJson,
          confirmedAt: new Date(),
          confirmedByUserId: session.user.id,
          matchConfidence: suggestion.matchConfidence,
          matchedVia: "CROSS_PROJECT_ANSATZ",
          matchStatus: "CONFIRMED",
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
        `${returnTo}?importError=${encodeURIComponent("Keine leeren oder noch unentschiedenen Positionen mit ausreichend ähnlichen Ansätzen in anderen Projekten gefunden.")}`,
      );
    }

    revalidatePath(`/kalkulation/imports/${existingKalkulationImport.id}`);
  } else {
    // Noch keine D31 im Projekt - neuen Import aus den LV-Positionen anlegen.
    const rowsToCreate: Array<{
      alternativesJson: string | null;
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

    const suggestionConfirmedAt = new Date();
    await prisma.kalkulationLvLineItem.createMany({
      data: rowsToCreate.map((row, index) => ({
        ansatzAlternativesJson: row.alternativesJson,
        confirmedAt: suggestionConfirmedAt,
        confirmedByUserId: session.user.id,
        entryType: "ITEM",
        lvImportId: suggestionImport.id,
        matchConfidence: row.matchConfidence,
        matchedVia: "CROSS_PROJECT_ANSATZ",
        matchStatus: "CONFIRMED",
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

/** Ersetzt den aktuell übernommenen Ansatz-Vorschlag durch einen der
 * mitgespeicherten Alternativ-Kandidaten (siehe ansatzAlternativesJson) -
 * z.B. wenn 3 andere LVs dieselbe Position ("Baustelle einrichten")
 * enthalten und der automatisch beste nicht der gewünschte ist. Die
 * gewählte Alternative fliegt danach aus der Liste, der Rest bleibt für
 * eine weitere Auswahl stehen. */
export async function chooseAnsatzAlternative(formData: FormData) {
  const session = await requireSession();
  const lineItemId = text(formData.get("lineItemId"));
  const alternativeIndexRaw = text(formData.get("alternativeIndex"));
  const alternativeIndex = alternativeIndexRaw ? Number.parseInt(alternativeIndexRaw, 10) : Number.NaN;
  if (!lineItemId || Number.isNaN(alternativeIndex)) throw new Error("Ungültige Auswahl.");

  const lineItem = await prisma.kalkulationLvLineItem.findUniqueOrThrow({ where: { id: lineItemId } });
  const alternatives: StoredAnsatzAlternative[] = lineItem.ansatzAlternativesJson
    ? JSON.parse(lineItem.ansatzAlternativesJson)
    : [];
  const chosen = alternatives[alternativeIndex];
  if (!chosen) throw new Error("Alternative nicht gefunden.");
  const remaining = alternatives.filter((_, index) => index !== alternativeIndex);

  await prisma.kalkulationLvLineItem.update({
    data: {
      ansatzAlternativesJson: remaining.length > 0 ? JSON.stringify(remaining) : null,
      confirmedAt: new Date(),
      confirmedByUserId: session.user.id,
      matchConfidence: chosen.similarity,
      matchedVia: "CROSS_PROJECT_ANSATZ",
      matchStatus: "CONFIRMED",
      rawText: `Übernommen aus Projekt ${chosen.sourceProjectNumber} (Ähnlichkeit ${Math.round(chosen.similarity * 100)}%):\n${chosen.ansatzSummary}`,
      ribRawBlock: chosen.ribRawBlock,
      ribRawBlockXml: chosen.ribRawBlockXml,
    },
    where: { id: lineItemId },
  });

  revalidatePath(`/kalkulation/imports/${lineItem.lvImportId}`);
  revalidatePath("/kalkulation/projects");
}

/** Setzt ALLE automatisch übernommenen Ansatz-Vorschläge dieses Imports
 * zurück auf leer/offen - egal ob noch offen oder schon bestätigt/
 * verworfen. Für den Fall, dass die Vorschläge insgesamt nicht passen
 * (z.B. falscher Projekt-Filter oder Schwellenwert) und man neu zuordnen
 * will, statt jede Position einzeln per "Verwerfen" durchzugehen. Echte,
 * direkt aus iTWO hochgeladene Ansätze (matchedVia ist dort nie
 * CROSS_PROJECT_ANSATZ) bleiben davon unberührt. */
export async function clearAnsatzSuggestions(formData: FormData) {
  await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");
  const returnTo = text(formData.get("returnTo")) || `/kalkulation/imports/${importId}`;

  await prisma.kalkulationLvLineItem.updateMany({
    data: {
      ansatzAlternativesJson: null,
      confirmedAt: null,
      confirmedByUserId: null,
      matchConfidence: null,
      matchedVia: null,
      matchStatus: "PENDING",
      rawText: "Kalkulationsansätze:",
      ribRawBlock: null,
      ribRawBlockXml: null,
    },
    where: { lvImportId: importId, matchedVia: "CROSS_PROJECT_ANSATZ" },
  });

  revalidatePath(`/kalkulation/imports/${importId}`);
  revalidatePath("/kalkulation/projects");
  redirect(returnTo);
}

/** Speichert die drei Abgleich-Kriterien für "Ähnlich in anderen LVs"
 * (Kurztext-/Langtext-Ähnlichkeit, Menge+Einheit exakt) - pro Import, wie
 * schon bei matchingThreshold für den Katalog-Abgleich üblich. */
export async function updateCrossLvSettings(formData: FormData) {
  const session = await requireSession();
  const importId = text(formData.get("importId"));
  if (!importId) throw new Error("Import-ID fehlt.");
  const returnTo = text(formData.get("returnTo")) || `/kalkulation/imports/${importId}`;
  const importRunId = text(formData.get("importRunId"));

  const kurztextRaw = text(formData.get("crossLvKurztextThreshold"));
  const langtextRaw = text(formData.get("crossLvLangtextThreshold"));
  const exactMenge = formData.get("crossLvExactMenge") === "on";
  const exactEinheit = formData.get("crossLvExactEinheit") === "on";
  const filterByKurztext = formData.get("crossLvFilterByKurztext") === "on";
  const filterByLangtext = formData.get("crossLvFilterByLangtext") === "on";
  const kurztextThreshold = kurztextRaw ? Number.parseInt(kurztextRaw, 10) / 100 : 0.5;
  const langtextThreshold = langtextRaw ? Number.parseInt(langtextRaw, 10) / 100 : 0.3;
  // Leer = gegen alle anderen Projekte - gilt danach auch für "Ansätze aus
  // anderen Projekten vorschlagen" (liest denselben gespeicherten Wert).
  const targetProjectNumber = text(formData.get("targetProjectNumber")) || null;

  const updatedImport = await prisma.kalkulationLvImport.update({
    data: {
      crossLvExactEinheit: exactEinheit,
      crossLvExactMenge: exactMenge,
      crossLvFilterByKurztext: filterByKurztext,
      crossLvFilterByLangtext: filterByLangtext,
      crossLvKurztextThreshold: kurztextThreshold,
      crossLvLangtextThreshold: langtextThreshold,
      crossLvMatchedAt: new Date(),
      crossLvMatchedByUserId: session.user.id,
      crossLvTargetProjectNumber: targetProjectNumber,
    },
    where: { id: importId },
  });

  // Ergebnis direkt hier berechnen und je Position speichern
  // (crossLvMatchesJson), statt bei jedem Seitenaufruf live neu zu
  // rechnen - "Abgleich starten" bleibt der einzige (teure) Auslöser,
  // das Ergebnis bleibt danach aber dauerhaft sichtbar, auch ohne
  // erneuten Klick ("letzter Stand" statt Live-Neuberechnung pro Ansicht).
  const [ownItems, otherLvItems] = await Promise.all([
    prisma.kalkulationLvLineItem.findMany({ where: { entryType: "ITEM", lvImportId: importId } }),
    prisma.kalkulationLvLineItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 3000,
      where: {
        entryType: "ITEM",
        lvImportId: { not: importId },
        NOT: { shortText: { startsWith: "Kalkulation OZ " } },
        ...(targetProjectNumber
          ? { lvImport: { projectNumber: targetProjectNumber } }
          : updatedImport.projectNumber
            ? { lvImport: { projectNumber: { not: updatedImport.projectNumber } } }
            : {}),
      },
    }),
  ]);
  const otherLvItemsById = new Map(otherLvItems.map((row) => [row.id, row]));
  const candidateInputs = otherLvItems.map((row) => ({
    id: row.id,
    quantity: row.quantity,
    rawText: row.rawText,
    shortText: row.shortText,
    unit: row.unit,
  }));

  // Läuft leicht über mehrere Sekunden bei größeren LVs (ein Update pro
  // Position) - Fortschritt wie beim Datei-Import über ImportProgress
  // sichtbar machen, statt dass der Button einfach nur reglos hängt.
  if (importRunId) {
    await prisma.importProgress.upsert({
      create: { id: importRunId, kind: "cross_lv_abgleich", total: ownItems.length },
      update: { processed: 0, status: "running", total: ownItems.length },
      where: { id: importRunId },
    });
  }

  for (const [index, item] of ownItems.entries()) {
    if (importRunId && index % 3 === 0) {
      await prisma.importProgress
        .update({ data: { processed: index }, where: { id: importRunId } })
        .catch(() => undefined);
    }
    const matches = buildLvMatches(
      { id: item.id, quantity: item.quantity, rawText: item.rawText, shortText: item.shortText, unit: item.unit },
      candidateInputs,
      { exactEinheit, exactMenge, filterByKurztext, filterByLangtext, kurztextThreshold, langtextThreshold },
    );
    const bestPerImport = new Map<string, StoredCrossLvMatch>();
    for (const match of matches) {
      const source = otherLvItemsById.get(match.candidateId);
      if (!source) continue;
      const existing = bestPerImport.get(source.lvImportId);
      if (!existing || match.langtextScore > existing.langtextScore) {
        bestPerImport.set(source.lvImportId, {
          exactEinheitMatch: match.exactEinheitMatch,
          exactMengeMatch: match.exactMengeMatch,
          kurztextScore: match.kurztextScore,
          langtextScore: match.langtextScore,
          sourceLineItemId: source.id,
        });
      }
    }
    const top3 = [...bestPerImport.values()].sort((a, b) => b.langtextScore - a.langtextScore).slice(0, 3);
    await prisma.kalkulationLvLineItem.update({
      data: { crossLvMatchesJson: top3.length > 0 ? JSON.stringify(top3) : null },
      where: { id: item.id },
    });
  }

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

  // isFinalCalculation: false - eine Einzel-Übernahme landet immer im
  // Entwurf, niemals in der als final hochgeladenen Referenzdatei.
  let kalkulationImport = await prisma.kalkulationLvImport.findFirst({
    orderBy: { createdAt: "desc" },
    where: { isFinalCalculation: false, projectNumber, sourceFormat: "RIB_KALKULATION" },
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
