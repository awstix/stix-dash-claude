/** Baut aus gespeicherten `_RIB_KalkPos`-Rohblöcken (siehe
 * rib-kalkulation-parser.ts) wieder eine vollständige, in iTWO einlesbare
 * D31-Datei zusammen. Die Blöcke selbst werden unverändert übernommen -
 * nur der äußere GAEB/PrjInfo/_RIB_Kalkulation-Rahmen wird neu geschrieben,
 * exakt nach dem Muster echter RIB-Exporte (siehe Kommentare im Parser). */

function escapeGaebText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function buildRibKalkulationFile(args: {
  projectNumber: string;
  tenderTitle: string | null;
  rawBlocks: string[];
}): string {
  const { projectNumber, tenderTitle, rawBlocks } = args;
  const now = new Date();
  const datum = new Intl.DateTimeFormat("de-DE").format(now);
  const uhrzeit = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(now);

  const lines: string[] = [];
  lines.push("#begin[GAEB]");
  lines.push(" #begin[GAEBInfo]");
  lines.push("  [Version]1.2[end]");
  lines.push("  [VersMon]3[end]");
  lines.push("  [VersJahr]2002[end]");
  lines.push(`  [Datum]${datum}[end]`);
  lines.push(`  [Uhrzeit]${uhrzeit}[end]`);
  lines.push("  [ProgSystem]STIX Dashboard - Kalkulationsansätze-Export[end]");
  lines.push(" #end[GAEBInfo]");
  lines.push(" #begin[PrjInfo]");
  lines.push(`  [Name]${escapeGaebText(projectNumber)}[end]`);
  if (tenderTitle) lines.push(`  [Bez]${escapeGaebText(tenderTitle)}[end]`);
  lines.push("  [Wae]EUR[end]");
  lines.push("  [WaeBez]Euro[end]");
  lines.push(" #end[PrjInfo]");
  lines.push(" #begin[_RIB_Kalkulation]");
  lines.push("  #begin[_RIB_KalkLV]");
  for (const block of rawBlocks) {
    // Jeder Block ist bereits vollständig (inkl. eigener #begin/#end-
    // Zeilen und Einrückung aus dem Original) - einfach unverändert
    // einfügen.
    lines.push(block);
  }
  lines.push("  #end[_RIB_KalkLV]");
  lines.push(" #end[_RIB_Kalkulation]");
  lines.push("#end[GAEB]");

  return lines.join("\r\n");
}
