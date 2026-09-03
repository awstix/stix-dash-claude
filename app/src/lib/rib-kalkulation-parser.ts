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

type RibNode = {
  name: string;
  fields: Map<string, string[]>;
  children: RibNode[];
};

function parseTree(text: string): RibNode {
  const root: RibNode = { name: "ROOT", fields: new Map(), children: [] };
  const stack: RibNode[] = [root];

  const beginRe = /^#begin\[(\w+)\]$/;
  const endRe = /^#end\[(\w+)\]$/;
  const fieldRe = /^\[(\w+)\](.*)\[end\]$/;

  for (const rawLine of text.split(/\r\n|\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const beginMatch = beginRe.exec(line);
    if (beginMatch) {
      const node: RibNode = { name: beginMatch[1], fields: new Map(), children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    if (endRe.test(line)) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const fieldMatch = fieldRe.exec(line);
    if (fieldMatch) {
      const [, key, value] = fieldMatch;
      const current = stack[stack.length - 1];
      const existing = current.fields.get(key) ?? [];
      existing.push(value);
      current.fields.set(key, existing);
    }
  }

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
};

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
    };
  });

  return { entries, tenderTitle };
}
