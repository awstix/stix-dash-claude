/** Liest RIB iTWO's Kalkulations-XML-Export ("EstimateRoot", z.B. beim
 * Speichern/Export einer Angebotskalkulation) ein - im Gegensatz zur alten
 * D31 (siehe rib-kalkulation-parser.ts) trägt hier JEDE Position (WBSItem)
 * ihren eigenen Beschreibungstext direkt (OutlineSpecs), kein Umweg über
 * ein separat hochgeladenes LV nötig, um den Positionstext zu kennen.
 *
 * Struktur ist flach: EstimateRoot > Estimate > WBS > ITEMS > WBSItem[],
 * je WBSItem eine EstDetails-Liste aus AssemblyDetail (~Baustein-Ansatz),
 * CoCDetail (~Kostenart-Ansatz) und EstTextElement (Notiz), optional
 * verschachtelt unter SubItem.
 *
 * Damit der bestehende D31-Export unverändert weiterfunktioniert, wird je
 * Position zusätzlich ein synthetischer `_RIB_KalkPos`-Rohblock im selben
 * Tag-Format wie eine echte D31 gebaut (siehe buildSyntheticKalkPosBlock) -
 * der Rest der Pipeline (Pool, Matching, Export) muss dadurch nicht
 * wissen, aus welchem Format eine Kalkulation ursprünglich stammt. */

import { XMLParser } from "fast-xml-parser";

const REPEATING_TAGS = new Set(["WBSItem", "CoCDetail", "AssemblyDetail", "EstTextElement", "SubItem"]);

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (tagName) => REPEATING_TAGS.has(tagName),
  parseTagValue: false,
  trimValues: false,
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string | null {
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "number") return String(node);
  return null;
}

/** " 1. 1.  10. " -> "1.1.10" - dieselbe Normalisierung wie beim D31-OZ
 * (siehe normalizeOz in rib-kalkulation-parser.ts), hier lokal dupliziert,
 * da beide Parser sonst voneinander importieren müssten. */
function normalizeOz(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return cleaned || null;
}

/** Ersetzt die `<NameWBSItem>`-Zeile in einem gespeicherten Rohblock durch
 * eine andere Positionsnummer - Pendant zu rewriteOzInRawBlock im
 * D31-Parser, für den Fall, dass ein Ansatz aus einem fremden Projekt mit
 * anderer OZ übernommen wird. */
export function rewriteOzInXmlBlock(xmlBlock: string, newOz: string): string {
  return xmlBlock.replace(/<NameWBSItem>[\s\S]*?<\/NameWBSItem>/, `<NameWBSItem>${escapeXmlText(newOz)}</NameWBSItem>`);
}

export function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function looksLikeEstimateXml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 2000).toString("utf8");
  return head.includes("<EstimateRoot>") || head.includes("<EstimateRoot ");
}

/** Schneidet jeden `<WBSItem>...</WBSItem>`-Abschnitt unverändert aus dem
 * Original-XML-Text - Struktur ist flach (kein WBSItem verschachtelt sich
 * in ein anderes), deshalb reicht ein einfacher globaler Regex statt eines
 * eigenen Positions-Trackers wie beim D31-Parser. Reihenfolge entspricht
 * der Dokumentreihenfolge, genau wie beim strukturierten Parsen mit
 * fast-xml-parser (isArray für WBSItem) - beide Listen lassen sich daher
 * 1:1 per Index zusammenführen. */
function extractRawWbsItemBlocks(xml: string): string[] {
  const blocks: string[] = [];
  const regex = /<WBSItem(?:\s[^>]*)?>[\s\S]*?<\/WBSItem>/g;
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match !== null) {
    blocks.push(match[0]);
    match = regex.exec(xml);
  }
  return blocks;
}

type DetailBucket = {
  texts: string[];
  assemblies: Array<{ name: string; descr: string | null; quantity: string | null; quantityDetail: string | null }>;
  costTypes: Array<{
    name: string;
    bez: string | null;
    quantity: string | null;
    quantityDetail: string | null;
    unitRate: string | null;
  }>;
};

/** Sammelt EstTextElement/AssemblyDetail/CoCDetail rekursiv - auch die,
 * die unter einem SubItem eine Ebene tiefer verschachtelt sind. */
function collectDetails(estDetails: unknown, bucket: DetailBucket): void {
  if (!isPlainObject(estDetails)) return;

  for (const el of asArray(estDetails.EstTextElement)) {
    if (!isPlainObject(el)) continue;
    const text = textOf(el.Text);
    if (text) bucket.texts.push(text);
  }

  for (const el of asArray(estDetails.AssemblyDetail)) {
    if (!isPlainObject(el)) continue;
    const name = textOf(el.NameAssembly);
    if (!name) continue;
    bucket.assemblies.push({
      descr: textOf(el.DescrAssembly),
      name,
      quantity: textOf(el.Quantity),
      quantityDetail: textOf(el.QuantityDetail),
    });
  }

  for (const el of asArray(estDetails.CoCDetail)) {
    if (!isPlainObject(el)) continue;
    const name = textOf(el.NameCoC);
    if (!name) continue;
    bucket.costTypes.push({
      bez: textOf(el.DescrCoC) ?? textOf(el.Description),
      name,
      quantity: textOf(el.Quantity),
      quantityDetail: textOf(el.QuantityDetail),
      unitRate: textOf(el.URValue),
    });
  }

  for (const sub of asArray(estDetails.SubItem)) {
    if (!isPlainObject(sub)) continue;
    const subText = textOf(sub.Text);
    if (subText) bucket.texts.push(subText);
    collectDetails(sub.EstDetails, bucket);
  }
}

function buildReadableSummary(bucket: DetailBucket): string {
  const lines = ["Kalkulationsansätze:"];
  for (const a of bucket.assemblies) {
    lines.push(`- Baustein ${a.name}${a.descr ? ` (${a.descr})` : ""}: ${a.quantity ?? "-"}${a.quantityDetail ? ` (Ansatz: ${a.quantityDetail})` : ""}`);
  }
  for (const c of bucket.costTypes) {
    lines.push(
      `- ${c.bez ?? c.name}: ${c.quantity ?? "-"}${c.unitRate ? ` × ${c.unitRate} €` : ""}${c.quantityDetail ? ` (Ansatz: ${c.quantityDetail})` : ""}`,
    );
  }
  if (bucket.texts.length > 0) lines.push(`Notizen: ${bucket.texts.join(" / ")}`);
  return lines.join("\n");
}

/** Baut aus den geparsten XML-Daten einen `_RIB_KalkPos`-Block im selben
 * Tag-Format wie eine echte D31 (siehe rib-kalkulation-parser.ts) - damit
 * bleibt der D31-Export (rewriteOzInRawBlock/buildRibKalkulationFile)
 * unverändert nutzbar, egal ob eine Kalkulation ursprünglich als D31 oder
 * als XML hochgeladen wurde. */
function buildSyntheticKalkPosBlock(oz: string, bucket: DetailBucket): string {
  const lines = ["   #begin[_RIB_KalkPos]", `    [_RIB_OZ]${oz}[end]`];

  for (const text of bucket.texts) {
    lines.push(
      "    #begin[_RIB_Text]",
      `     [_RIB_Textzeile]${text}[end]`,
      "     [_RIB_TextIsIntern]1[end]",
      "    #end[_RIB_Text]",
    );
  }

  for (const a of bucket.assemblies) {
    lines.push(
      "    #begin[_RIB_BstnA]",
      `     [_RIB_EleNr]${a.name}[end]`,
      `     [_RIB_Menge]${a.quantity ?? ""}[end]`,
      `     [_RIB_Ansatz]${a.quantityDetail ?? ""}[end]`,
      "    #end[_RIB_BstnA]",
    );
  }

  for (const c of bucket.costTypes) {
    lines.push(
      "    #begin[_RIB_KoaA]",
      `     [_RIB_EleNr]${c.name}[end]`,
      `     [_RIB_Bez]${c.bez ?? ""}[end]`,
      "     [_RIB_WE]EUR[end]",
      `     [_RIB_Menge]${c.quantity ?? ""}[end]`,
      `     [_RIB_VS]${c.unitRate ?? ""}[end]`,
      `     [_RIB_Ansatz]${c.quantityDetail ?? ""}[end]`,
      "    #end[_RIB_KoaA]",
    );
  }

  lines.push("   #end[_RIB_KalkPos]");
  return lines.join("\r\n");
}

export type EstimateXmlRow = {
  entryType: "ITEM";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
  unit: null;
  quantity: null;
  unitPriceCents: null;
  totalPriceCents: null;
  ribRawBlock: string;
  ribRawBlockXml: string | null;
};

export function parseEstimateXml(buffer: Buffer): { entries: EstimateXmlRow[]; tenderTitle: string | null } {
  const xml = buffer.toString("utf8");
  const root = parser.parse(xml) as Record<string, unknown>;
  const rawWbsItemBlocks = extractRawWbsItemBlocks(xml);

  const estimateRoot = isPlainObject(root.EstimateRoot) ? root.EstimateRoot : {};
  const prjInfo = isPlainObject(estimateRoot.PrjInfo) ? estimateRoot.PrjInfo : {};
  const tenderTitle = textOf(prjInfo.DescrPrj) ?? textOf(prjInfo.PAName);

  const estimate = isPlainObject(estimateRoot.Estimate) ? estimateRoot.Estimate : {};
  const wbs = isPlainObject(estimate.WBS) ? estimate.WBS : {};
  const items = isPlainObject(wbs.ITEMS) ? wbs.ITEMS : {};
  const wbsItems = asArray(items.WBSItem);

  const entries: EstimateXmlRow[] = [];
  wbsItems.forEach((wbsItem, index) => {
    if (!isPlainObject(wbsItem)) return;
    const ozRaw = textOf(wbsItem.NameWBSItem);
    const oz = ozRaw ? normalizeOz(ozRaw) : null;

    const outlineSpecs = textOf(wbsItem.OutlineSpecs);
    const specLines = (outlineSpecs ?? "").split(/\r\n|\n/).map((line) => line.trim()).filter(Boolean);
    const shortText = specLines[0] ?? null;
    const fullSpecText = specLines.join(" ") || null;

    const bucket: DetailBucket = { assemblies: [], costTypes: [], texts: [] };
    collectDetails(wbsItem.EstDetails, bucket);

    const summary = buildReadableSummary(bucket);
    const rawText = fullSpecText ? `${fullSpecText}\n\n${summary}` : summary;

    entries.push({
      entryType: "ITEM",
      positionNumber: oz,
      quantity: null,
      rawText,
      ribRawBlock: buildSyntheticKalkPosBlock(oz ?? String(index + 1), bucket),
      ribRawBlockXml: rawWbsItemBlocks[index] ?? null,
      shortText,
      totalPriceCents: null,
      unit: null,
      unitPriceCents: null,
    });
  });

  return { entries, tenderTitle };
}
