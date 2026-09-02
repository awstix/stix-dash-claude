import iconv from "iconv-lite";

/** Liest das alte GAEB-90-Format (DIN-Datenaustausch, kein XML - feste
 * Satzlänge von 80 Zeichen + 6-stellige laufende Nummer, "Satzart" als
 * Code am Zeilenanfang). Anhand einer echten Beispieldatei
 * reverse-engineered (siehe Konstanten unten) - andere Erstell-Software
 * könnte in Details abweichen, die Grundstruktur (00-09 Kopf, 11/12 Titel,
 * 21 Position mit Menge/Einheit, 25 Kurztext, 26 Langtext) ist aber der
 * standardisierte GAEB-90-Satzarten-Aufbau.
 *
 * Kodierung: alte DOS-Codepage CP850 (deutsche Umlaute), nicht UTF-8. */

export type Gaeb90Entry = {
  entryType: "ITEM" | "TITLE" | "REMARK";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
  unit: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
};

export type ParsedGaeb90 = {
  isPriced: boolean;
  entries: Gaeb90Entry[];
};

const RECORD_TYPE_TITLE_TEXT = "12";
const RECORD_TYPE_POSITION = "21";
const RECORD_TYPE_SHORT_TEXT = "25";
const RECORD_TYPE_LONG_TEXT = "26";
const TITLE_RECORD_TYPES = new Set(["11", "12"]);

/** Erkennt eine GAEB-90-Datei grob an ihrer Zeilenstruktur (80 Zeichen +
 * 6-stellige Zeilennummer je Zeile), ohne auf die Dateiendung angewiesen
 * zu sein. */
export function looksLikeGaeb90(buffer: Buffer): boolean {
  const sample = iconv.decode(buffer.subarray(0, 4000), "cp850");
  const lines = sample.split(/\r?\n/).filter(Boolean).slice(0, 20);
  if (lines.length < 3) return false;
  const matching = lines.filter((line) => /^.{74}\d{6}$/.test(line)).length;
  return matching >= lines.length - 1;
}

function formatOz(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 2)}.${trimmed.slice(2, 4)}.${trimmed.slice(4)}`;
}

export function parseGaeb90(buffer: Buffer): ParsedGaeb90 {
  const text = iconv.decode(buffer, "cp850");
  const lines = text.split(/\r?\n/);

  const entries: Gaeb90Entry[] = [];
  let currentItem: Gaeb90Entry | null = null;
  // Vorbemerkung (26-Zeilen) VOR der ersten Position eines Titels - wird
  // gesammelt und als eigener REMARK-Eintrag ausgegeben, statt verworfen
  // zu werden.
  let pendingRemarkLines: string[] = [];
  const anyPriceFound = false;

  function flushItem() {
    if (currentItem && (currentItem.shortText || currentItem.rawText)) {
      entries.push(currentItem);
    }
    currentItem = null;
  }

  function flushRemark() {
    const text = pendingRemarkLines.join(" ").trim();
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
    pendingRemarkLines = [];
  }

  for (const rawLine of lines) {
    if (rawLine.length < 2) continue;
    const recordType = rawLine.slice(0, 2);
    const content = rawLine.slice(2, 74);

    if (recordType === RECORD_TYPE_TITLE_TEXT) {
      // Neuer Titel beendet sowohl eine laufende Position als auch eine
      // noch offene Vorbemerkung des vorigen Titels.
      flushItem();
      flushRemark();
      const titleText = content.trim();
      if (titleText) {
        entries.push({
          entryType: "TITLE",
          positionNumber: null,
          shortText: null,
          rawText: titleText,
          unit: null,
          quantity: null,
          unitPriceCents: null,
          totalPriceCents: null,
        });
      }
      continue;
    }

    if (recordType === RECORD_TYPE_POSITION) {
      flushItem();
      flushRemark();
      const oz = content.slice(0, 8);
      const quantityRaw = content.slice(21, 32);
      const unitRaw = content.slice(32, 38).trim();
      const quantity = /^\d+$/.test(quantityRaw) ? Number.parseInt(quantityRaw, 10) / 1000 : null;

      currentItem = {
        entryType: "ITEM",
        positionNumber: oz.trim() ? formatOz(oz) : null,
        shortText: null,
        rawText: "",
        unit: unitRaw || null,
        quantity,
        unitPriceCents: null,
        totalPriceCents: null,
      };
      continue;
    }

    if (recordType === RECORD_TYPE_SHORT_TEXT && currentItem) {
      const value = content.trim();
      if (value) currentItem.shortText = currentItem.shortText ? `${currentItem.shortText} ${value}` : value;
      continue;
    }

    if (recordType === RECORD_TYPE_LONG_TEXT) {
      const value = content.trim();
      if (currentItem) {
        if (value) currentItem.rawText = currentItem.rawText ? `${currentItem.rawText} ${value}` : value;
      } else {
        // Kein offenes Item -> das sind Vorbemerkungs-Zeilen zum aktuellen Titel.
        if (value) pendingRemarkLines.push(value);
      }
      continue;
    }

    if (TITLE_RECORD_TYPES.has(recordType) && recordType !== RECORD_TYPE_TITLE_TEXT) {
      // "11"-Zeilen (Titel-Hierarchie-Code ohne Klartext) tragen keinen
      // eigenen Text, nichts zu tun.
      continue;
    }
  }

  flushItem();
  flushRemark();

  return { isPriced: anyPriceFound, entries };
}
