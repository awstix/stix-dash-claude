/** Parser für RIB iTWO's "Urkalkulation"-Textformat (Dateiendung meist
 * .D31, ISO-8859-1, Tag-Syntax `#begin[Section]...#end[Section]` /
 * `[Feld]Wert[end]`, generiert z.B. von der "GAEB Toolbox"). Das ist KEIN
 * Standard-GAEB (weder DA XML noch das alte 80-Spalten-GAEB-90), sondern
 * RIB-proprietäre Kalkulationsdaten - erkennbar an den `_RIB_*`-Feldern.
 *
 * Die Datei enthält KEINEN fertig berechneten Einheitspreis je Position,
 * nur die Kalkulationsansätze (Geräte-/Personal-Bausteine über Formeln
 * wie "4*0,5" sowie Kostenarten mit direktem Satz). Ein Teil der
 * referenzierten Bausteine (z.B. Baustein-Nr. "2154") hat keinen Satz in
 * dieser Datei - der liegt in RIBs interner Stammdatenbank und wird hier
 * nicht mitgeliefert. Diese Funktion übernimmt die Ansätze deshalb nur
 * als lesbaren Referenztext je Position (rawText) - ohne Anspruch auf
 * einen berechneten Gesamtpreis. */

import { escapeXmlText, formatOzForItwo } from "@/lib/kalkulation-estimate-xml-parser";

type RibNode = {
  name: string;
  fields: Map<string, string[]>;
  children: RibNode[];
  // Unveränderter Original-Textblock dieses Knotens (inkl. #begin/#end-
  // Zeilen) - wird nur für den D31-Re-Export gebraucht (siehe
  // buildD31Block unten), deshalb erst beim Schließen des Knotens befüllt.
  raw?: string;
};

function parseTree(text: string): RibNode {
  const root: RibNode = { name: "ROOT", fields: new Map(), children: [] };
  const stack: RibNode[] = [root];
  const startLineStack: number[] = [];

  const beginRe = /^#begin\[(\w+)\]$/;
  const endRe = /^#end\[(\w+)\]$/;
  const fieldRe = /^\[(\w+)\](.*)\[end\]$/;

  const lines = text.split(/\r\n|\n/);

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const beginMatch = beginRe.exec(line);
    if (beginMatch) {
      const node: RibNode = { name: beginMatch[1], fields: new Map(), children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      startLineStack.push(index);
      return;
    }

    if (endRe.test(line)) {
      if (stack.length > 1) {
        const node = stack.pop()!;
        const startLine = startLineStack.pop()!;
        node.raw = lines.slice(startLine, index + 1).join("\r\n");
      }
      return;
    }

    const fieldMatch = fieldRe.exec(line);
    if (fieldMatch) {
      const [, key, value] = fieldMatch;
      const current = stack[stack.length - 1];
      const existing = current.fields.get(key) ?? [];
      existing.push(value);
      current.fields.set(key, existing);
    }
  });

  return root;
}

function field(node: RibNode, key: string): string | null {
  const value = node.fields.get(key)?.[0]?.trim();
  return value || null;
}

function children(node: RibNode, name: string): RibNode[] {
  return node.children.filter((child) => child.name === name);
}

function findFirst(node: RibNode, name: string): RibNode | undefined {
  for (const child of node.children) {
    if (child.name === name) return child;
    const found = findFirst(child, name);
    if (found) return found;
  }
  return undefined;
}

/** " 1.  .   1. " -> "1.1" - entfernt das feste Spalten-Padding und
 * verschmilzt die dadurch entstehenden Mehrfachpunkte. */
function normalizeOz(raw: string): string | null {
  const cleaned = raw
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return cleaned || null;
}

function buildApproachText(kalkPos: RibNode): string {
  const lines = [
    "Kalkulationsansätze (aus RIB-Urkalkulation, ohne berechneten Gesamtpreis):",
  ];

  for (const baustein of children(kalkPos, "_RIB_BstnA")) {
    const eleNr = field(baustein, "_RIB_EleNr") ?? "?";
    const menge = field(baustein, "_RIB_Menge");
    const ansatz = field(baustein, "_RIB_Ansatz");
    lines.push(`- Baustein ${eleNr}: ${menge ?? "-"}${ansatz ? ` (Ansatz: ${ansatz})` : ""}`);
  }

  for (const kostenart of children(kalkPos, "_RIB_KoaA")) {
    const bez = field(kostenart, "_RIB_Bez") ?? field(kostenart, "_RIB_EleNr") ?? "?";
    const menge = field(kostenart, "_RIB_Menge");
    const einheit = field(kostenart, "_RIB_WE");
    const satz = field(kostenart, "_RIB_VS");
    lines.push(`- ${bez}: ${menge ?? "-"}${einheit ? ` ${einheit}` : ""}${satz ? ` × ${satz} €` : ""}`);
  }

  const notes = children(kalkPos, "_RIB_Text")
    .map((textNode) => field(textNode, "_RIB_Textzeile"))
    .filter((value): value is string => Boolean(value));
  if (notes.length > 0) {
    lines.push(`Notizen: ${notes.join(" / ")}`);
  }

  return lines.join("\n");
}

export type RibKalkulationRow = {
  entryType: "ITEM";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
  unit: null;
  quantity: null;
  unitPriceCents: null;
  totalPriceCents: null;
  ribRawBlock: string | null;
  ribRawBlockXml: string | null;
};

/** Baut aus einer D31-Position ein `<WBSItem>`-XML-Fragment im selben
 * Format wie kalkulation-estimate-xml-parser.ts (Pendant zu
 * buildApproachText, nur als XML statt lesbarem Text) - Best-effort: die
 * D31 selbst enthält keinen Positionstext (siehe Dateikommentar oben),
 * OutlineSpecs bleibt deshalb ein Platzhalter. Zahlenformate (Komma statt
 * Punkt) werden unverändert übernommen, keine Konvertierung. */
function buildSyntheticWbsItemXml(kalkPos: RibNode, oz: string): string {
  const lines: string[] = [
    "<WBSItem>",
    `<NameWBSItem>${escapeXmlText(formatOzForItwo(oz))}</NameWBSItem>`,
    "<OutlineSpecs>Kalkulationsansatz aus D31 (kein Positionstext in der Quelldatei enthalten)</OutlineSpecs>",
    "<EstDetails>",
  ];

  for (const textNode of children(kalkPos, "_RIB_Text")) {
    const text = field(textNode, "_RIB_Textzeile");
    if (!text) continue;
    lines.push("<EstTextElement>", `<Text>${escapeXmlText(text)}</Text>`, "<BoolIntern>1</BoolIntern>", "</EstTextElement>");
  }

  for (const baustein of children(kalkPos, "_RIB_BstnA")) {
    const eleNr = field(baustein, "_RIB_EleNr");
    if (!eleNr) continue;
    const menge = field(baustein, "_RIB_Menge");
    const ansatz = field(baustein, "_RIB_Ansatz");
    lines.push("<AssemblyDetail>", `<NameAssembly>${escapeXmlText(eleNr)}</NameAssembly>`);
    if (menge) lines.push(`<Quantity>${escapeXmlText(menge)}</Quantity>`);
    if (ansatz) lines.push(`<QuantityDetail>${escapeXmlText(ansatz)}</QuantityDetail>`);
    lines.push("</AssemblyDetail>");
  }

  for (const kostenart of children(kalkPos, "_RIB_KoaA")) {
    const eleNr = field(kostenart, "_RIB_EleNr");
    if (!eleNr) continue;
    const bez = field(kostenart, "_RIB_Bez");
    const menge = field(kostenart, "_RIB_Menge");
    const satz = field(kostenart, "_RIB_VS");
    const ansatz = field(kostenart, "_RIB_Ansatz");
    lines.push("<CoCDetail>", `<NameCoC>${escapeXmlText(eleNr)}</NameCoC>`);
    if (bez) lines.push(`<DescrCoC>${escapeXmlText(bez)}</DescrCoC>`);
    if (menge) lines.push(`<Quantity>${escapeXmlText(menge)}</Quantity>`);
    if (satz) lines.push(`<URValue>${escapeXmlText(satz)}</URValue>`);
    if (ansatz) lines.push(`<QuantityDetail>${escapeXmlText(ansatz)}</QuantityDetail>`);
    lines.push("</CoCDetail>");
  }

  lines.push("</EstDetails>", "</WBSItem>");
  return lines.join("\n");
}

/** Ersetzt die `[_RIB_OZ]`-Zeile in einem gespeicherten `_RIB_KalkPos`-Block
 * durch eine andere Positionsnummer - gebraucht, wenn ein Ansatz aus einem
 * fremden Projekt für eine Position mit anderer OZ übernommen wird, damit
 * der D31-Export beim Wiedereinlesen in iTWO zur richtigen LV-Position
 * passt. Best-effort: übernimmt die Ziel-OZ unformatiert (kein
 * Spalten-Padding wie im Original), das genügt der Tag-Syntax. */
export function rewriteOzInRawBlock(rawBlock: string, newOz: string): string {
  return rawBlock.replace(/\[_RIB_OZ\].*?\[end\]/, `[_RIB_OZ]${newOz}[end]`);
}

/** Baut das XML-Pendant (ribRawBlockXml) nachträglich aus einem bereits
 * gespeicherten D31-Rohblock (ribRawBlock) - für Positionen, die vor
 * Einführung des XML-Exports importiert wurden, ohne dass die Original-
 * D31-Datei erneut hochgeladen werden muss: der gespeicherte Block ist
 * selbst schon ein gültiger `#begin[_RIB_KalkPos]...#end[_RIB_KalkPos]`-
 * Ausschnitt und lässt sich direkt erneut parsen. */
export function synthesizeXmlFromStoredRawBlock(rawBlock: string): string | null {
  const root = parseTree(rawBlock);
  const kalkPos = children(root, "_RIB_KalkPos")[0];
  if (!kalkPos) return null;
  const ozRaw = field(kalkPos, "_RIB_OZ");
  const oz = ozRaw ? normalizeOz(ozRaw) : null;
  return buildSyntheticWbsItemXml(kalkPos, oz ?? "");
}

/** Erkennt das Format anhand der ersten Zeilen - zuverlässiger als die
 * Dateiendung allein, da ".D31" kein offizieller GAEB-Standard ist und
 * je nach AVA-Software abweichen kann. */
export function looksLikeRibKalkulation(buffer: Buffer): boolean {
  // "_RIB_Kalkulation" kann - je nach Umfang der PrjInfo-Merkmale davor -
  // erst nach einigen Tausend Byte auftauchen, daher ein großzügigeres
  // Fenster als bei anderen Format-Erkennungen in diesem Projekt.
  const head = buffer.subarray(0, 50_000).toString("latin1");
  return head.includes("#begin[GAEB]") && head.includes("_RIB_Kalkulation");
}

export function parseRibKalkulation(buffer: Buffer): {
  entries: RibKalkulationRow[];
  tenderTitle: string | null;
} {
  const text = buffer.toString("latin1");
  const root = parseTree(text);

  const prjInfo = findFirst(root, "PrjInfo");
  const tenderTitle = prjInfo ? field(prjInfo, "Bez") : null;

  const kalkPosNodes: RibNode[] = [];
  const kalkulation = findFirst(root, "_RIB_Kalkulation");
  if (kalkulation) {
    for (const kalkLv of children(kalkulation, "_RIB_KalkLV")) {
      kalkPosNodes.push(...children(kalkLv, "_RIB_KalkPos"));
    }
  }

  const entries: RibKalkulationRow[] = kalkPosNodes.map((kalkPos, index) => {
    const ozRaw = field(kalkPos, "_RIB_OZ");
    const oz = ozRaw ? normalizeOz(ozRaw) : null;

    return {
      entryType: "ITEM",
      positionNumber: oz,
      shortText: `Kalkulation OZ ${oz ?? index + 1}`,
      rawText: buildApproachText(kalkPos),
      unit: null,
      quantity: null,
      unitPriceCents: null,
      totalPriceCents: null,
      ribRawBlock: kalkPos.raw ?? null,
      ribRawBlockXml: buildSyntheticWbsItemXml(kalkPos, oz ?? String(index + 1)),
    };
  });

  return { entries, tenderTitle };
}
