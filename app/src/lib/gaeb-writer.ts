/** Schreibt GAEB DA XML (X83, gepreist) - dieselbe Schema-Variante, die
 * gaeb-parser.ts liest (xmlns=".../DA83/3.3"), damit ein exportiertes LV
 * z.B. in iTWO als vorkalkuliertes Angebot wieder eingelesen werden kann.
 * Bewusst schlicht gehalten: eine flache Titel-Ebene pro TITLE-Eintrag,
 * keine tiefe Verschachtelung - GAEB erlaubt das, auch wenn "echte"
 * LVs oft tiefer verschachtelt sind. */

export type GaebExportEntry = {
  entryType: "ITEM" | "TITLE" | "REMARK";
  positionNumber: string | null;
  shortText: string | null;
  rawText: string;
  unit: string | null;
  quantity: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  /** Herkunfts-Hinweis für übernommene Preise ("Info: aus Projekt ...
   * importiert - Übereinstimmung XX%.") - landet als erster Absatz im
   * Langtext, damit er beim Wiedereinlesen (z.B. in iTWO) direkt sichtbar
   * ist, ohne die eigentliche Positionsbeschreibung zu verändern. */
  infoLine?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatGermanNumber(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

function itemXml(entry: GaebExportEntry, index: number): string {
  const oz = entry.positionNumber ?? String(index + 1).padStart(4, "0");
  const qty = entry.quantity != null ? formatGermanNumber(entry.quantity, 3) : "";
  const up = entry.unitPriceCents != null ? formatGermanNumber(entry.unitPriceCents / 100, 2) : "";
  const it = entry.totalPriceCents != null ? formatGermanNumber(entry.totalPriceCents / 100, 2) : "";
  const shortText = entry.shortText ? escapeXml(entry.shortText) : "";
  const longText = escapeXml(entry.rawText);
  const infoParagraph = entry.infoLine ? `<p>${escapeXml(entry.infoLine)}</p>\n                      ` : "";

  return `            <Item RNoPart="${escapeXml(oz)}">
              <Qty>${qty}</Qty>
              <QU>${escapeXml(entry.unit ?? "")}</QU>
              <UP>${up}</UP>
              <IT>${it}</IT>
              <Description>
                <CompleteText>
                  <DetailTxt>
                    <Text>
                      ${infoParagraph}<p>${longText}</p>
                    </Text>
                  </DetailTxt>
                  ${
                    shortText
                      ? `<OutlineText>
                    <OutlTxt>
                      <TextOutlTxt>
                        <p>${shortText}</p>
                      </TextOutlTxt>
                    </OutlTxt>
                  </OutlineText>`
                      : ""
                  }
                </CompleteText>
              </Description>
            </Item>`;
}

/** Baut aus der flachen, geordneten Eintragsliste (TITLE/REMARK/ITEM)
 * verschachtelte `<BoQCtgy>`-Blöcke - jeder TITLE eröffnet einen neuen
 * Block, alle folgenden REMARK/ITEM-Einträge landen darin, bis der
 * nächste TITLE beginnt. Einträge vor dem ersten TITLE landen in einem
 * namenlosen Sammel-Block. */
function buildCategoryBlocks(entries: GaebExportEntry[]): string {
  const blocks: { title: string | null; items: { entry: GaebExportEntry; index: number }[] }[] = [];
  let current: (typeof blocks)[number] = { title: null, items: [] };
  blocks.push(current);

  entries.forEach((entry, index) => {
    if (entry.entryType === "TITLE") {
      current = { title: entry.rawText, items: [] };
      blocks.push(current);
      return;
    }
    current.items.push({ entry, index });
  });

  return blocks
    .filter((block) => block.items.length > 0)
    .map((block, blockIndex) => {
      const remarkXml = block.items
        .filter(({ entry }) => entry.entryType === "REMARK")
        .map(
          ({ entry }) => `          <Remark>
            <Description>
              <CompleteText>
                <DetailTxt>
                  <Text>
                    <p>${escapeXml(entry.rawText)}</p>
                  </Text>
                </DetailTxt>
              </CompleteText>
            </Description>
          </Remark>`,
        )
        .join("\n");

      const itemXmlBlocks = block.items
        .filter(({ entry }) => entry.entryType === "ITEM")
        .map(({ entry, index }) => itemXml(entry, index))
        .join("\n");

      return `        <BoQCtgy RNoPart="${blockIndex + 1}">
          ${
            block.title
              ? `<LblTx>
            <p>${escapeXml(block.title)}</p>
          </LblTx>`
              : ""
          }
          <BoQBody>
            <Itemlist>
${remarkXml}
${itemXmlBlocks}
            </Itemlist>
          </BoQBody>
        </BoQCtgy>`;
    })
    .join("\n");
}

export function writeGaebXml(
  entries: GaebExportEntry[],
  meta: { projectName: string | null; date: Date },
): string {
  const dateStr = meta.date.toISOString().slice(0, 10);
  const timeStr = meta.date.toISOString().slice(11, 19);

  return `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/DA83/3.3">
  <GAEBInfo>
    <Version>3.3</Version>
    <VersDate>2021-05</VersDate>
    <Date>${dateStr}</Date>
    <Time>${timeStr}</Time>
    <ProgSystem>STIX Kalkulation</ProgSystem>
    <ProgName>STIX Kalkulation Export</ProgName>
  </GAEBInfo>
  <PrjInfo>
    <NamePrj>${escapeXml(meta.projectName ?? "")}</NamePrj>
    <LblPrj>
      <p>${escapeXml(meta.projectName ?? "")}</p>
    </LblPrj>
  </PrjInfo>
  <Award>
    <BoQ>
      <BoQInfo>
        <Currency>EUR</Currency>
      </BoQInfo>
      <BoQBody>
${buildCategoryBlocks(entries)}
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>
`;
}
