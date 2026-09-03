import { XMLParser } from "fast-xml-parser";

/** Liest GAEB-DA-XML-Dateien (die heute übliche GAEB-Variante) ein:
 * X81/D81 = Leistungsverzeichnis ohne Preise (Ausschreibung, vor der
 * Kalkulation), X83/D83 = Angebot mit Preisen (nach der Kalkulation),
 * X84/D84 = Zuschlag/Auftrag (wie X83 behandelt). Die grobe Struktur
 * (Award/BoQ/BoQBody/BoQCtgy/Item/Description/Qty/QU/UP/IT) ist über
 * GAEB-Versionen hinweg stabil, Detailabweichungen bei Tag-Namen sind
 * möglich - deshalb wird hier bewusst generisch/rekursiv statt über einen
 * starren Pfad gesucht.
 *
 * Die BoQCtgy-Hierarchie wird als geordnete Liste aus TITLE- (LblTx eines
 * BoQCtgy bzw. PerfLbl eines PerfDescr), REMARK- (Remark-Elemente,
 * Vorbemerkungen) und ITEM-Einträgen (die eigentlichen Positionen)
 * zurückgegeben - in Dokumentreihenfolge, damit die Review-Ansicht die LV-
 * Gliederung nachbilden kann statt nur eine flache Positionsliste zu
 * zeigen. */

export type GaebDocType = "81" | "83" | "84" | null;

export type GaebEntry = {
  entryType: "ITEM" | "TITLE" | "REMARK";
  positionNumber: string | null;
  shortText: string | null;
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
  entries: GaebEntry[];
};

const REPEATING_TAGS = new Set([
  "BoQCtgy",
  "Item",
  "Itemlist",
  "Remark",
  "PerfDescr",
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

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
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

function textOf(node: unknown): string {
  return collectText(node).join(" ").trim();
}

/** Zieht Kurztext (OutlineText) und Langtext (DetailTxt) getrennt aus einem
 * `<Description>`-Knoten - beide Zweige können je nach Version
 * unterschiedlich tief verschachtelt sein, deshalb wird jeweils generisch
 * unter dem passenden Ast gesammelt statt über einen starren Pfad. */
function extractShortAndLongText(description: unknown): { shortText: string | null; longText: string } {
  if (!isPlainObject(description)) return { shortText: null, longText: "" };
  const completeText = description["CompleteText"];
  const source = isPlainObject(completeText) ? completeText : description;

  const detail = isPlainObject(source) ? source["DetailTxt"] : null;
  const outline = isPlainObject(source) ? source["OutlineText"] : null;

  const longText = detail != null ? textOf(detail) : "";
  const shortText = outline != null ? textOf(outline) : "";

  if (longText || shortText) {
    return { shortText: shortText || null, longText: longText || shortText };
  }

  // Unbekannte Struktur - alles zusammen als Langtext übernehmen, besser
  // als eine leere Position.
  return { shortText: null, longText: textOf(description) };
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

/** Die eigene RNoPart eines BoQCtgy ist nur der Titel-Nummernteil auf
 * dieser Ebene (z.B. "1"), nicht schon die volle OZ. */
function extractCategoryNumber(ctgy: Record<string, unknown>): string | null {
  const rNoPartAttr = ctgy["@_RNoPart"];
  if (typeof rNoPartAttr === "string" && rNoPartAttr.trim()) return rNoPartAttr.trim();
  return null;
}

function buildItemEntry(item: Record<string, unknown>, onPriceFound: () => void, ozPrefix: string[]): GaebEntry {
  const { shortText, longText } = extractShortAndLongText(item["Description"]);

  const unit = item["QU"] != null ? String(item["QU"]).trim() : null;
  const quantity = parseGermanNumber(item["Qty"]);
  const unitPriceCents = toCents(item["UP"]);
  const totalPriceCents = toCents(item["IT"]);

  if (unitPriceCents != null && unitPriceCents > 0) onPriceFound();

  // RNoPart am Item ist nur der Teil auf dieser Ebene (z.B. "3") - die
  // vollständige, LV-gemäße OZ (z.B. "1.1.3") ergibt sich erst zusammen mit
  // den RNoParts aller übergeordneten BoQCtgy-Titel.
  const ownNumber = extractPositionNumber(item);
  const positionNumber =
    ownNumber != null ? [...ozPrefix, ownNumber].join(".") : ozPrefix.length > 0 ? ozPrefix.join(".") : null;

  return {
    entryType: "ITEM",
    positionNumber,
    shortText,
    rawText: longText,
    unit,
    quantity,
    unitPriceCents,
    totalPriceCents,
  };
}

/** Läuft die BoQCtgy-Hierarchie in Dokumentreihenfolge ab und sammelt
 * TITLE-, REMARK- und ITEM-Einträge - rekursiv über verschachtelte
 * Unter-Titel hinweg. `ozPrefix` sammelt dabei die RNoPart-Nummern aller
 * bereits durchlaufenen übergeordneten Titel auf, damit Items ihre volle,
 * LV-gemäße OZ (z.B. "1.1.3" statt nur "3") bekommen. */
function walkCategory(ctgy: unknown, entries: GaebEntry[], onPriceFound: () => void, ozPrefix: string[]) {
  if (!isPlainObject(ctgy)) return;

  const categoryNumber = extractCategoryNumber(ctgy);
  const nextPrefix = categoryNumber != null ? [...ozPrefix, categoryNumber] : ozPrefix;

  const label = textOf(ctgy["LblTx"]);
  if (label) {
    entries.push({
      entryType: "TITLE",
      positionNumber: null,
      shortText: null,
      rawText: label,
      unit: null,
      quantity: null,
      unitPriceCents: null,
      totalPriceCents: null,
    });
  }

  const body = ctgy["BoQBody"];
  if (!isPlainObject(body)) return;

  for (const child of asArray(body["BoQCtgy"])) {
    walkCategory(child, entries, onPriceFound, nextPrefix);
  }

  // "Itemlist" ist selbst über REPEATING_TAGS zu einem Array gezwungen
  // (auch wenn pro Kategorie normalerweise nur eine vorkommt) - deshalb
  // hier iterieren statt direkt als Objekt zu behandeln.
  for (const itemlist of asArray(body["Itemlist"])) {
    if (!isPlainObject(itemlist)) continue;

    for (const remark of asArray(itemlist["Remark"])) {
      if (!isPlainObject(remark)) continue;
      const text = textOf(remark["Description"]);
      if (text) {
        entries.push({
          entryType: "REMARK",
          positionNumber: null,
          shortText: null,
          rawText: text,
          unit: null,
          quantity: null,
          unitPriceCents: null,
          totalPriceCents: null,
        });
      }
    }

    for (const perfDescr of asArray(itemlist["PerfDescr"])) {
      if (!isPlainObject(perfDescr)) continue;
      const label = textOf(perfDescr["PerfLbl"]);
      if (label) {
        entries.push({
          entryType: "TITLE",
          positionNumber: null,
          shortText: null,
          rawText: label,
          unit: null,
          quantity: null,
          unitPriceCents: null,
          totalPriceCents: null,
        });
      }
    }

    for (const item of asArray(itemlist["Item"])) {
      if (!isPlainObject(item)) continue;
      entries.push(buildItemEntry(item, onPriceFound, nextPrefix));
    }
  }
}

export function parseGaebXml(buffer: Buffer, fileName: string): ParsedGaeb {
  const xml = buffer.toString("utf8");

  // Das alte GAEB-90-Format (feste Satzlänge, kein XML - z.B. Zeilen wie
  // "T1Ausschreibungs- und Vertragsunterlagen ... 000003") wird separat in
  // gaeb90-parser.ts behandelt. Ohne diese Prüfung würde der XML-Parser mit
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

  const entries: GaebEntry[] = [];
  let anyPriceFound = false;
  const markPriceFound = () => {
    anyPriceFound = true;
  };

  const award = findFirst(root, ["Award"]);
  const boQ = isPlainObject(award) ? award["BoQ"] : null;
  const boQBody = isPlainObject(boQ) ? boQ["BoQBody"] : null;
  for (const topCtgy of asArray(isPlainObject(boQBody) ? boQBody["BoQCtgy"] : null)) {
    walkCategory(topCtgy, entries, markPriceFound, []);
  }

  // Der Dateityp (X81/X83/X84) ist nur ein Hinweis, kein Beweis: in der
  // Praxis werden Ausschreibungs-LVs teils als "X83"-Datei mit komplett
  // leeren Preisfeldern verschickt (Bieter füllt die Preise erst noch aus).
  // Ob ein LV tatsächlich schon kalkuliert ist, entscheidet deshalb primär,
  // ob überhaupt ein Einheitspreis > 0 in der Datei steht.
  const isPriced = anyPriceFound;

  return {
    docType,
    isPriced,
    tenderTitle: tenderTitleRaw != null ? textOf(tenderTitleRaw) || null : null,
    customerName: customerNameRaw != null ? textOf(customerNameRaw) || null : null,
    entries,
  };
}
