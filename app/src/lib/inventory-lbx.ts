import {
  calculateInventoryLabelLength,
  getEffectiveInventoryLabelBlockWidth,
  getInventoryLabelBlockMeta,
  getInventoryLabelColumnWidthsMm,
  getInventoryLabelValue,
  isInventoryLabelSpacerBlock,
  type InventoryLabelBlock,
  type InventoryLabelItem,
} from "@/lib/inventory-labels";

type LbxTemplate = {
  blocksJson: string;
  codeType: string;
  columnCount: number;
  gapMm: number;
  labelLengthOverrideMm: number | null;
  name: string;
  orientation: string;
  rowCount: number;
  tapeWidthMm: number;
};

const POINTS_PER_MM = 2.8346456693;
const LIVE_PREVIEW_PIXELS_PER_MM = 3.4;

export function createInventoryLabelLbx(input: {
  blocks: InventoryLabelBlock[];
  companyName?: string | null;
  item: InventoryLabelItem & { id: string; name: string };
  template: LbxTemplate;
}) {
  const automaticLabelLengthMm = calculateInventoryLabelLength(
    input.blocks,
    input.item,
    input.template.columnCount,
    input.template.tapeWidthMm,
    input.template.rowCount,
  );
  const labelLengthMm = input.template.labelLengthOverrideMm ?? automaticLabelLengthMm;
  const labelXml = createLabelXml({
    blocks: input.blocks.filter((block) => block.enabled),
    codeType: input.template.codeType,
    columnCount: input.template.columnCount,
    companyName: input.companyName,
    gapMm: input.template.gapMm,
    item: input.item,
    labelLengthMm,
    rowCount: input.template.rowCount,
    tapeWidthMm: input.template.tapeWidthMm,
  });
  const propXml = createPropXml();

  return createZip([
    {
      data: Buffer.from(labelXml, "utf8"),
      name: "label.xml",
    },
    {
      data: Buffer.from(propXml, "utf8"),
      name: "prop.xml",
    },
  ]);
}

function createLabelXml(input: {
  blocks: InventoryLabelBlock[];
  codeType: string;
  columnCount: number;
  companyName?: string | null;
  gapMm: number;
  item: InventoryLabelItem & { id: string; name: string };
  labelLengthMm: number;
  rowCount: number;
  tapeWidthMm: number;
}) {
  const marginMm = 2;
  const gapMm = Math.max(0, input.gapMm);
  const innerWidthMm = Math.max(
    8,
    input.labelLengthMm - marginMm * 2 - gapMm * Math.max(0, input.columnCount - 1),
  );
  const innerHeightMm = Math.max(
    6,
    input.tapeWidthMm - marginMm * 2 - gapMm * Math.max(0, input.rowCount - 1),
  );
  const cellHeightMm = innerHeightMm / Math.max(1, input.rowCount);
  // Columns pinned via a block's "Breite cm" (widthMm) get their exact
  // width; the remaining space is split evenly among the flexible
  // columns, mirroring the same math used in the editor, print page and
  // PNG export.
  const columnWidthsMm = getInventoryLabelColumnWidthsMm(
    input.blocks,
    input.columnCount,
  );
  const fixedWidthMmTotal = columnWidthsMm.reduce(
    (total: number, widthMm) => total + (widthMm ?? 0),
    0,
  );
  const flexColumnCount = columnWidthsMm.filter((widthMm) => widthMm === null).length;
  const flexColumnWidthMm =
    flexColumnCount > 0
      ? Math.max(0, innerWidthMm - fixedWidthMmTotal) / flexColumnCount
      : 0;
  const resolvedColumnWidthsMm = columnWidthsMm.map((widthMm) =>
    widthMm !== null ? widthMm : flexColumnWidthMm,
  );
  const columnOffsetsMm: number[] = [];
  let columnCursorMm = marginMm;
  for (const columnWidthMm of resolvedColumnWidthsMm) {
    columnOffsetsMm.push(columnCursorMm);
    columnCursorMm += columnWidthMm + gapMm;
  }
  const getColumnSpanWidthMm = (col: number, span: number) => {
    let total = 0;
    for (let index = 0; index < span; index += 1) {
      total += resolvedColumnWidthsMm[col - 1 + index] ?? flexColumnWidthMm;
    }
    return total + Math.max(0, span - 1) * gapMm;
  };
  const objects = input.blocks
    .map((block, index) => {
      if (isInventoryLabelSpacerBlock(block.key)) return "";

      const width = getEffectiveInventoryLabelBlockWidth(
        block,
        input.columnCount,
      );
      const box = {
        height: Math.max(2, block.height * cellHeightMm),
        width: Math.max(2, getColumnSpanWidthMm(block.col, width)),
        x: columnOffsetsMm[block.col - 1] ?? marginMm,
        y: marginMm + (block.row - 1) * (cellHeightMm + gapMm),
      };

      if (block.key === "code") {
        const size = Math.min(box.width, box.height);
        return barcodeObject({
          angle: block.rotation,
          codeType: input.codeType,
          data:
            input.item.objectNumber ??
            input.item.inventoryNumber ??
            input.item.stixId ??
            input.item.id,
          height: size,
          index,
          width: size,
          x: box.x + (box.width - size) / 2,
          y: box.y + (box.height - size) / 2,
        });
      }

      if (block.key === "companyLogo") {
        return textObject({
          align: "CENTER",
          angle: block.rotation,
          bold: true,
          data: getCompactCompanyName(input.companyName),
          fontSizePt: Math.max(6, Math.min(18, mmToPt(box.height) * 0.52)),
          height: box.height,
          index,
          italic: false,
          label: null,
          underline: false,
          width: box.width,
          x: box.x,
          y: box.y,
        });
      }

      const value = getInventoryLabelValue(input.item, block.key);
      const meta = getInventoryLabelBlockMeta(block.key);

      if (!value) return "";

      return textObject({
        align: block.align,
        angle: block.rotation,
        bold: block.bold,
        data: [block.labelVisible ? meta?.label : null, value]
          .filter(Boolean)
          .join(": "),
        fontSizePt: getFontSizePt(block.size, box.height),
        height: box.height,
        index,
        italic: block.italic,
        label: meta?.label ?? null,
        underline: block.underline,
        width: block.widthMm && block.widthMm > 0 ? block.widthMm : box.width,
        x: box.x,
        y: box.y,
      });
    })
    .join("");
  const paperWidthPt = mmToPt(input.tapeWidthMm);
  const paperHeightPt = mmToPt(Math.max(input.labelLengthMm, 30));

  return `<?xml version="1.0" encoding="UTF-8"?>
<pt:document xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable" version="1.10" generator="STIX Dash"><pt:body currentSheet="Blatt 1" direction="LTR"><style:sheet name="Blatt 1"><style:paper media="0" width="${formatPt(paperWidthPt)}" height="${formatPt(paperHeightPt)}" marginLeft="5.6pt" marginTop="5.6pt" marginRight="5.6pt" marginBottom="5.6pt" orientation="landscape" autoLength="true" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="261" backgroundTheme="0" printerID="31792" printerName="Brother PT-D610BT"></style:paper><style:cutLine regularCut="0pt" freeCut=""></style:cutLine><style:backGround x="0pt" y="0pt" width="${formatPt(paperHeightPt)}" height="${formatPt(paperWidthPt)}" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"></style:backGround><pt:objects>${objects}</pt:objects></style:sheet></pt:body></pt:document>`;
}

function barcodeObject(input: {
  angle: number;
  codeType: string;
  data: string;
  height: number;
  index: number;
  width: number;
  x: number;
  y: number;
}) {
  const protocol = input.codeType === "QR" ? "QRCODE" : "DATAMATRIX";
  const specificStyle =
    protocol === "DATAMATRIX"
      ? '<barcode:datamatrixStyle model="square" cellSize="2.4pt" macro="none" fnc01="false" joint="1"></barcode:datamatrixStyle>'
      : '<barcode:qrcodeStyle model="model2" cellSize="2.4pt" eccLevel="M" mask="auto" connection="none"></barcode:qrcodeStyle>';

  return `<barcode:barcode><pt:objectStyle x="${mmToPtString(input.x)}" y="${mmToPtString(input.y)}" width="${mmToPtString(input.width)}" height="${mmToPtString(input.height)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="${input.angle}" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"></pt:pen><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"></pt:brush><pt:expanded objectName="Barcode${input.index + 1}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" allowOutOfBoundsTransfer="false" linkStatus="NONE" linkID="0"></pt:expanded></pt:objectStyle><barcode:barcodeStyle protocol="${protocol}" lengths="48" zeroFill="false" barWidth="1.2pt" barRatio="1:3" humanReadable="false" humanReadableAlignment="LEFT" checkDigit="false" autoLengths="true" margin="true" sameLengthBar="false" bearerBar="false"></barcode:barcodeStyle>${specificStyle}<pt:data>${escapeXml(input.data)}</pt:data></barcode:barcode>`;
}

function textObject(input: {
  align: InventoryLabelBlock["align"];
  angle: number;
  bold: boolean;
  data: string;
  fontSizePt: number;
  height: number;
  index: number;
  italic: boolean;
  label: string | null;
  underline: boolean;
  width: number;
  x: number;
  y: number;
}) {
  const weight = input.bold ? 700 : 400;
  const italic = input.italic ? "true" : "false";
  const underline = input.underline ? "1" : "0";
  const horizontalAlignment =
    input.align === "CENTER" || input.align === "RIGHT" ? input.align : "LEFT";

  return `<text:text><pt:objectStyle x="${mmToPtString(input.x)}" y="${mmToPtString(input.y)}" width="${mmToPtString(input.width)}" height="${mmToPtString(input.height)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="${input.angle}" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"></pt:pen><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"></pt:brush><pt:expanded objectName="Text${input.index + 1}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" allowOutOfBoundsTransfer="false" linkStatus="NONE" linkID="0"></pt:expanded></pt:objectStyle><text:ptFontInfo><text:logFont name="Montserrat" width="0" italic="${italic}" weight="${weight}" charSet="0" pitchAndFamily="2"></text:logFont><text:fontExt effect="NOEFFECT" underline="${underline}" strikeout="0" size="${formatPt(input.fontSizePt)}" orgSize="${formatPt(input.fontSizePt)}" textColor="#000000" textPrintColorNumber="1"></text:fontExt></text:ptFontInfo><text:textControl control="AUTOLEN" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"></text:textControl><text:textAlign horizontalAlignment="${horizontalAlignment}" verticalAlignment="CENTER" inLineAlignment="BASELINE"></text:textAlign><text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="${formatPt(input.fontSizePt)}" combinedChars="false"></text:textStyle><text:transferSettings editOnPrintFormat="" editOnPrintOrder="0"></text:transferSettings><pt:data>${escapeXml(input.data)}</pt:data><text:stringItem charLen="${input.data.length}"><text:ptFontInfo><text:logFont name="Montserrat" width="0" italic="${italic}" weight="${weight}" charSet="0" pitchAndFamily="2"></text:logFont><text:fontExt effect="NOEFFECT" underline="${underline}" strikeout="0" size="${formatPt(input.fontSizePt)}" orgSize="${formatPt(input.fontSizePt)}" textColor="#000000" textPrintColorNumber="1"></text:fontExt></text:ptFontInfo></text:stringItem></text:text>`;
}

function createPropXml() {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  return `<?xml version="1.0" encoding="UTF-8"?>
<meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><meta:appName>STIX Dash</meta:appName><dc:title></dc:title><dc:subject></dc:subject><dc:creator></dc:creator><meta:keyword></meta:keyword><dc:description></dc:description><meta:template></meta:template><dcterms:created>${now}</dcterms:created><dcterms:modified>${now}</dcterms:modified><meta:lastPrinted></meta:lastPrinted><meta:modifiedBy></meta:modifiedBy><meta:revision>1</meta:revision><meta:editTime>1</meta:editTime><meta:numPages>1</meta:numPages><meta:numWords>0</meta:numWords><meta:numChars>0</meta:numChars><meta:security>0</meta:security><meta:transferScript></meta:transferScript></meta:properties>`;
}

function createZip(entries: { data: Buffer; name: string }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localFiles = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localFiles, centralDirectory, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function getCompactCompanyName(companyName?: string | null) {
  if (!companyName) return "STIX";
  if (companyName.toLowerCase().includes("stix")) return "STIX";
  return companyName;
}

function getFontSizePt(size: InventoryLabelBlock["size"], heightMm: number) {
  const liveCssPixels = size === "LARGE" ? 14 : size === "SMALL" ? 10 : 12;
  const previewMillimeters = liveCssPixels / LIVE_PREVIEW_PIXELS_PER_MM;
  const exportPoints = mmToPt(previewMillimeters);
  const maxByHeight = mmToPt(heightMm) * 0.72;

  return Math.max(5, Math.min(exportPoints, maxByHeight));
}

function mmToPt(value: number) {
  return value * POINTS_PER_MM;
}

function mmToPtString(value: number) {
  return formatPt(mmToPt(value));
}

function formatPt(value: number) {
  return `${Number(value.toFixed(1))}pt`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
