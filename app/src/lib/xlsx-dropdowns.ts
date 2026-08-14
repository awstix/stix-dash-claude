import { inflateRawSync } from "node:zlib";
import { createZipArchive } from "@/lib/zip";

type ZipEntry = {
  bytes: Uint8Array;
  fileName: string;
};

export function columnLetter(index: number) {
  let letter = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }

  return letter;
}

function readZipEntries(bytes: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6);
    const compressionMethod = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const fileName = bytes
      .subarray(offset + 30, offset + 30 + fileNameLength)
      .toString("utf8");
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressedData = bytes.subarray(dataStart, dataEnd);

    if ((flags & 0x08) !== 0) {
      throw new Error("XLSX-Datei nutzt Data Descriptor und kann nicht gepatcht werden.");
    }

    const data =
      compressionMethod === 8
        ? inflateRawSync(compressedData)
        : Buffer.from(compressedData);

    entries.push({
      bytes: data,
      fileName,
    });
    offset = dataEnd;
  }

  return entries;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function addDropdownValidationsToSheetXml(
  xml: string,
  validations: {
    column: string;
    formula: string;
  }[],
  firstDataRow: number,
) {
  const validationXml = `<dataValidations count="${validations.length}">${validations
    .map(
      (validation) =>
        `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${validation.column}${firstDataRow}:${validation.column}1000"><formula1>${xmlEscape(
          validation.formula,
        )}</formula1></dataValidation>`,
    )
    .join("")}</dataValidations>`;

  if (xml.includes("<dataValidations")) {
    return xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, validationXml);
  }

  // The OOXML CT_Worksheet element order is strict: mergeCells must come
  // before dataValidations, so a <mergeCells>…</mergeCells> block (if
  // present) needs the validations inserted right after its closing tag,
  // not before its opening tag like the other markers below.
  const mergeCellsMatch = xml.match(/<mergeCells[\s\S]*?<\/mergeCells>/);
  if (mergeCellsMatch) {
    return xml.replace(mergeCellsMatch[0], `${mergeCellsMatch[0]}${validationXml}`);
  }

  // Every other CT_Worksheet child element that comes after dataValidations
  // in the OOXML schema order, so inserting right before whichever of these
  // appears first keeps the document validly ordered. `ignoredErrors` in
  // particular is written by the `xlsx` library whenever a cell looks like
  // a number stored as text (e.g. "0" in a free-text money column) - a
  // template with none of the other markers but that flag set was falling
  // through to the final "before </worksheet>" fallback below, landing
  // dataValidations after ignoredErrors and corrupting the file.
  const insertionMarkers = [
    "<phoneticPr",
    "<conditionalFormatting",
    "<hyperlinks",
    "<printOptions",
    "<pageMargins",
    "<pageSetup",
    "<headerFooter",
    "<rowBreaks",
    "<colBreaks",
    "<customProperties",
    "<cellWatches",
    "<ignoredErrors",
    "<smartTags",
    "<drawing",
    "<legacyDrawing",
    "<picture",
    "<oleObjects",
    "<controls",
    "<webPublishItems",
    "<tableParts",
    "<extLst",
  ];
  const marker = insertionMarkers.find((candidate) => xml.includes(candidate));

  if (marker) {
    return xml.replace(marker, `${validationXml}${marker}`);
  }

  return xml.replace("</worksheet>", `${validationXml}</worksheet>`);
}

function stripNonStandardColLevelAttribute(xml: string) {
  // The xlsx library writes both `level` and `outlineLevel` on <col>
  // elements for outline grouping, but `level` isn't part of the OOXML
  // CT_Col schema. Excel flags the unrecognized attribute as invalid
  // content and offers to repair the file on open, so strip it here and
  // keep only the valid `outlineLevel` attribute.
  return xml.replace(/(<col\b[^>]*?)\s+level="\d+"([^>]*>)/g, "$1$2");
}

/** Patches dropdown (list) data validations and the column-outline `level`
 * quirk into an xlsx workbook buffer written by the `xlsx` library, which
 * doesn't support writing data validations natively. Targets the first
 * sheet (`xl/worksheets/sheet1.xml`). */
export function patchWorkbookDropdowns(
  workbookBuffer: Buffer,
  validations: {
    column: string;
    formula: string;
  }[],
  firstDataRow: number,
) {
  const entries = readZipEntries(workbookBuffer);
  const patchedEntries = entries.map((entry) => {
    if (entry.fileName !== "xl/worksheets/sheet1.xml") {
      return entry;
    }

    const withValidations = addDropdownValidationsToSheetXml(
      Buffer.from(entry.bytes).toString("utf8"),
      validations,
      firstDataRow,
    );

    return {
      ...entry,
      bytes: Buffer.from(
        stripNonStandardColLevelAttribute(withValidations),
        "utf8",
      ),
    };
  });

  return createZipArchive(patchedEntries);
}
