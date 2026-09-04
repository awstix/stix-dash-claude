/** Baut aus gespeicherten `<WBSItem>`-Rohblöcken (siehe
 * kalkulation-estimate-xml-parser.ts) wieder eine vollständige, in iTWO
 * einlesbare Kalkulations-XML-Datei ("EstimateRoot") zusammen - Pendant zu
 * rib-kalkulation-writer.ts, nur im XML- statt D31-Format. Die Blöcke
 * selbst werden unverändert übernommen, nur der äußere PrjInfo/Estimate/
 * WBS-Rahmen wird neu geschrieben. */

import { escapeXmlText } from "@/lib/kalkulation-estimate-xml-parser";

/** Best-effort-Rahmen für Fälle ohne Original-Datei (z.B. ein aus
 * Cross-Projekt-Vorschlägen zusammengestellter Kalkulation-Import ohne
 * eigenen Datei-Upload) - inkl. der von iTWO offenbar zwingend geprüften
 * Estimate-Flags (u.a. IsDomesticEstimate: fehlte hier bisher komplett,
 * hat den Import mit "Inlandsprojekt stimmt nicht überein" abgebrochen).
 * Wo möglich wird stattdessen spliceWbsItemsIntoOriginalXml verwendet -
 * das erhält den echten, von iTWO selbst exportierten Rahmen 1:1, statt
 * ihn hier nachzubauen und dabei ggf. wieder Felder zu vergessen. */
export function buildEstimateXmlFile(args: {
  projectNumber: string;
  tenderTitle: string | null;
  wbsItemBlocks: string[];
}): string {
  const { projectNumber, tenderTitle, wbsItemBlocks } = args;

  const lines: string[] = ['<?xml version="1.0"?>', "<EstimateRoot>", "\t<PrjInfo>"];
  lines.push(`\t\t<NamePrj>${escapeXmlText(projectNumber)}</NamePrj>`);
  if (tenderTitle) lines.push(`\t\t<DescrPrj>${escapeXmlText(tenderTitle)}</DescrPrj>`);
  lines.push(`\t\t<PACode>${escapeXmlText(projectNumber)}</PACode>`);
  if (tenderTitle) lines.push(`\t\t<PAName>${escapeXmlText(tenderTitle)}</PAName>`);
  lines.push("\t</PrjInfo>");
  lines.push("\t<Estimate>");
  lines.push("\t\t<Name>Angebotskalkulation</Name>");
  lines.push("\t\t<Currency>EUR</Currency>");
  lines.push("\t\t<ByAdvancedAllocation>1</ByAdvancedAllocation>");
  lines.push("\t\t<ByManualCharge>1</ByManualCharge>");
  lines.push("\t\t<ByUPFromDetailPricePortions>0</ByUPFromDetailPricePortions>");
  lines.push("\t\t<IsDomesticEstimate>1</IsDomesticEstimate>");
  lines.push("\t\t<WBS>");
  lines.push(`\t\t\t<NameWBS>${escapeXmlText(projectNumber)}</NameWBS>`);
  if (tenderTitle) lines.push(`\t\t\t<DescrWBS>${escapeXmlText(tenderTitle)}</DescrWBS>`);
  lines.push("\t\t\t<WBSType>MajorWBS</WBSType>");
  lines.push("\t\t\t<ITEMS>");
  for (const block of wbsItemBlocks) {
    // Jeder Block ist bereits vollständig (eigenes <WBSItem>...</WBSItem>)
    // - einfach unverändert einfügen.
    lines.push(block);
  }
  lines.push("\t\t\t</ITEMS>");
  lines.push("\t\t</WBS>");
  lines.push("\t</Estimate>");
  lines.push("</EstimateRoot>");

  return lines.join("\n");
}

/** Setzt die Positionsliste eines ECHTEN, von iTWO selbst exportierten
 * XML-Originals neu zusammen - alles außerhalb von `<ITEMS>...</ITEMS>`
 * (PrjInfo, alle Estimate-/WBS-Einstellungen, Kodierung) bleibt exakt so,
 * wie iTWO es selbst geschrieben hat. Das ist die verlässlichste Variante,
 * weil dabei kein Feld vergessen werden kann - anders als beim Nachbauen
 * des Rahmens von Hand (buildEstimateXmlFile). Gibt null zurück, wenn die
 * `<ITEMS>`-Marker nicht gefunden werden (dann buildEstimateXmlFile als
 * Fallback verwenden). */
export function spliceWbsItemsIntoOriginalXml(originalXml: string, wbsItemBlocks: string[]): string | null {
  const openTag = "<ITEMS>";
  const closeTag = "</ITEMS>";
  const openIndex = originalXml.indexOf(openTag);
  const closeIndex = originalXml.indexOf(closeTag);
  if (openIndex === -1 || closeIndex === -1 || closeIndex < openIndex) return null;

  const before = originalXml.slice(0, openIndex + openTag.length);
  const after = originalXml.slice(closeIndex);
  return `${before}\n${wbsItemBlocks.join("\n")}\n${after}`;
}
