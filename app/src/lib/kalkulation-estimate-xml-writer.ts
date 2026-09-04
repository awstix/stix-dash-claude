/** Baut aus gespeicherten `<WBSItem>`-Rohblöcken (siehe
 * kalkulation-estimate-xml-parser.ts) wieder eine vollständige, in iTWO
 * einlesbare Kalkulations-XML-Datei ("EstimateRoot") zusammen - Pendant zu
 * rib-kalkulation-writer.ts, nur im XML- statt D31-Format. Die Blöcke
 * selbst werden unverändert übernommen, nur der äußere PrjInfo/Estimate/
 * WBS-Rahmen wird neu geschrieben. */

import { escapeXmlText } from "@/lib/kalkulation-estimate-xml-parser";

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
  lines.push("\t\t<WBS>");
  lines.push(`\t\t\t<NameWBS>${escapeXmlText(projectNumber)}</NameWBS>`);
  if (tenderTitle) lines.push(`\t\t\t<DescrWBS>${escapeXmlText(tenderTitle)}</DescrWBS>`);
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
