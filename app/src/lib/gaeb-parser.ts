import { XMLParser } from "fast-xml-parser";

/** Liest GAEB-DA-XML-Dateien (die heute übliche GAEB-Variante) ein:
 * X81/D81 = Leistungsverzeichnis ohne Preise (Ausschreibung, vor der
 * Kalkulation), X83/D83 = Angebot mit Preisen (nach der Kalkulation),
 * X84/D84 = Zuschlag/Auftrag (wie X83 behandelt). Die grobe Struktur
 * (Award/BoQ/BoQBody/BoQCtgy/Item/Description/Qty/QU/UP/IT) ist über
 * GAEB-Versionen hinweg stabil, Detailabweichungen bei Tag-Namen sind
 * möglich - deshalb wird hier bewusst generisch/rekursiv statt über einen
 * starren Pfad gesucht. Sollte an einer echten Beispieldatei nachjustiert
 * werden, sobald eine vorliegt (siehe Plan-Verifikation). */

export type GaebDocType = "81" | "83" | "84" | null;

export type GaebLineItem = {
  positionNumber: string | null;
  rawText: string;
  unit: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
};

export type ParsedGaeb = {
  docType: GaebDocType;
  isPriced: boolean;
  tenderTitle: string | null;
  customerName: string | null;
  lineItems: GaebLineItem[];
};

const REPEATING_TAGS = new Set([
  "BoQCtgy",
  "Item",
  "Itemlist",
  "TextOutlTx",
  "TextComplTx",
  "p",
  "span",
  "OutlTxt",
  "DetailTxt",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (tagName) => REPEATING_TAGS.has(tagName),
  trimValues: true,
  // Zahlen/Preise werden selbst geparst (parseGermanNumber) - automatisches
  // Parsen hier würde führende Nullen aus Positionsnummern wie "01.01"
  // verschlucken (fast-xml-parser macht daraus sonst die Zahl 1).
  parseTagValue: false,
  parseAttributeValue: false,
});

export function docTypeFromFileName(fileName: string): GaebDocType {
  const match = fileName.toLowerCase().match(/\.[xd](81|83|84)$/);
  if (!match) return null;
  return match[1] as GaebDocType;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const BINARY_TAG_NAMES = new Set(["image", "bitmap", "picture", "ole", "attachment", "graphic"]);

/** Sammelt rekursiv alle String-Blattwerte unter einem Knoten ein - GAEB
 * verschachtelt Langtexte je nach Version/Editor unterschiedlich tief
 * (CompleteText > DetailTxt > p > span o.ä.), ein starrer Pfad wäre
 * brüchig. Attribut-Werte (Schlüssel beginnt mit "@_") werden ignoriert. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null) return out;
  if (typeof node === "string") {
    const trimmed = node.trim();
    if (trimmed) out.push(trimmed);
    return out;
  }
  if (typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const entry of node) collectText(entry, out);
    return out;
  }
  if (isPlainObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("@_")) continue;
      // Manche LVs betten Fotos/Pläne direkt als Base64 in den Beschreibungstext
      // ein (z.B. <image Type="image/jpeg">...</image>) - das gehört nicht in
      // den Positionstext und würde sonst jeden Abgleich/jede KI-Anfrage mit
      // hunderten KB Bilddaten überfluten.
      if (BINARY_TAG_NAMES.has(key.toLowerCase())) continue;
      collectText(value, out);
    }
  }
  return out;
}

function parseGermanNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value).trim().replace(/\./g, "").replace(",", ".");
  const asPlain = String(value).trim();
  const normalized = /,/.test(asPlain) ? text : asPlain;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCents(value: unknown): number | null {
  const parsed = parseGermanNumber(value);
  if (parsed == null) return null;
  return Math.round(parsed * 100);
}

function extractPositionNumber(item: Record<string, unknown>): string | null {
  // Häufigster Fall in echten GAEB-DA-XML-Dateien: RNoPart ist ein Attribut
  // direkt am <Item>-Tag (<Item ID="..." RNoPart="10">), nicht ein
  // verschachteltes Element.
  const rNoPartAttr = item["@_RNoPart"];
  if (typeof rNoPartAttr === "string" && rNoPartAttr.trim()) return rNoPartAttr.trim();

  // Andere GAEB-Varianten verschachteln die Positionsnummer stattdessen in
  // Teilstücken (<RNoPart><RNoPart1>01</RNoPart1><RNoPart2>01</RNoPart2></RNoPart>).
  const rNoPart = item["RNoPart"];
  if (isPlainObject(rNoPart)) {
    const parts = Object.entries(rNoPart)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, value]) => String(value ?? "").trim())
      .filter(Boolean);
    if (parts.length) return parts.join(".");
  }
  const itemtag = item["@_Itemtag"] ?? item["Itemtag"];
  if (itemtag) return String(itemtag);
  return null;
}

/** Läuft den BoQ-Baum rekursiv ab und sammelt jeden gefundenen `Item`-Knoten
 * ein (unabhängig davon, unter wie vielen `BoQCtgy`-Titelebenen er liegt). */
function collectItems(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const entry of node) collectItems(entry, out);
    return out;
  }
  if (!isPlainObject(node)) return out;

  if (Array.isArray(node["Item"])) {
    for (const item of node["Item"] as unknown[]) {
      if (isPlainObject(item)) out.push(item);
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "Item") continue;
    collectItems(value, out);
  }

  return out;
}

function findFirst(node: unknown, tagNames: string[]): unknown {
  if (!isPlainObject(node) && !Array.isArray(node)) return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findFirst(entry, tagNames);
      if (found != null) return found;
    }
    return null;
  }
  for (const tag of tagNames) {
    if (node[tag] != null) return node[tag];
  }
  for (const value of Object.values(node)) {
    const found = findFirst(value, tagNames);
    if (found != null) return found;
  }
  return null;
}

export function parseGaebXml(buffer: Buffer, fileName: string): ParsedGaeb {
  const xml = buffer.toString("utf8");

  // Das alte GAEB-90-Format (feste Satzlänge, kein XML - z.B. Zeilen wie
  // "T1Ausschreibungs- und Vertragsunterlagen ... 000003") wird hier
  // (noch) nicht unterstützt. Ohne diese Prüfung würde der XML-Parser mit
  // einer kryptischen Fehlermeldung mittendrin abbrechen statt klar zu sagen,
  // woran es liegt.
  if (!/^﻿?\s*<\?xml|^﻿?\s*<GAEB/i.test(xml)) {
    throw new Error(
      "Diese Datei sieht nach dem alten GAEB-90-Format aus (kein XML) - das wird aktuell noch nicht unterstützt. Unterstützt wird GAEB DA XML (Dateien, die mit \"<?xml\" bzw. \"<GAEB\" beginnen).",
    );
  }

  const parsed = parser.parse(xml);

  const docType = docTypeFromFileName(fileName);

  const root = parsed?.["GAEB"] ?? parsed;
  const tenderTitleRaw = findFirst(root, ["LblPrj", "Prj"]);
  const customerNameRaw = findFirst(root, ["NamePrj", "AwardName", "Name"]);

  const rawItems = collectItems(root);

  let anyPriceFound = false;
  const lineItems: GaebLineItem[] = rawItems.map((item) => {
    const description = item["Description"];
    const rawText = collectText(description).join(" ").trim() || collectText(item).join(" ").trim();

    const unit = item["QU"] != null ? String(item["QU"]).trim() : null;
    const quantity = parseGermanNumber(item["Qty"]);
    const unitPriceCents = toCents(item["UP"]);
    const totalPriceCents = toCents(item["IT"]);

    if (unitPriceCents != null && unitPriceCents > 0) anyPriceFound = true;

    return {
      positionNumber: extractPositionNumber(item),
      rawText,
      unit,
      quantity,
      unitPriceCents,
      totalPriceCents,
    };
  });

  // Der Dateityp (X81/X83/X84) ist nur ein Hinweis, kein Beweis: in der
  // Praxis werden Ausschreibungs-LVs teils als "X83"-Datei mit komplett
  // leeren Preisfeldern verschickt (Bieter füllt die Preise erst noch aus).
  // Ob ein LV tatsächlich schon kalkuliert ist, entscheidet deshalb primär,
  // ob überhaupt ein Einheitspreis > 0 in der Datei steht.
  const isPriced = anyPriceFound;

  return {
    docType,
    isPriced,
    tenderTitle: tenderTitleRaw != null ? String(collectText(tenderTitleRaw).join(" ")).trim() || null : null,
    customerName: customerNameRaw != null ? String(collectText(customerNameRaw).join(" ")).trim() || null : null,
    lineItems,
  };
}
