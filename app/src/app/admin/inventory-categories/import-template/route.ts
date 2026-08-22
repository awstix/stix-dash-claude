import * as XLSX from "xlsx";
import { inflateRawSync } from "node:zlib";
import { requireAdminForRoute } from "@/lib/auth-access";
import { createZipArchive } from "@/lib/zip";

export const runtime = "nodejs";

const headers = [
  "Kategorie",
  "Übergeordnete Kategorie",
  "Beschreibung",
  "Nummernkreis von",
  "Nummernkreis bis",
  "Nächste Objekt-ID",
  "Sortierung",
  "Aktiv",
  "LKW-Dispo Material",
  "LKW-Dispo Gerät/Objekt",
  "Im Bautagesbericht",
  "Sonderfahrzeug-Disposition",
  "Teams-Verwaltung",
  "In Personalakte listen",
  "Fahrer-Fahrzeug-Zuordnung",
  "Asphalt-Verwendung",
  "BTB-Bereich",
  "Zuordnung im BTB",
  "Farbe/Klasse",
];

type ZipEntry = {
  bytes: Uint8Array;
  fileName: string;
};

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
      throw new Error("XLSX-Datei kann nicht um Dropdowns ergänzt werden.");
    }

    entries.push({
      bytes:
        compressionMethod === 8
          ? inflateRawSync(compressedData)
          : Buffer.from(compressedData),
      fileName,
    });
    offset = dataEnd;
  }

  return entries;
}

function addBtbDropdown(workbookBuffer: Buffer) {
  const validation =
    '<dataValidations count="3"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="P2:P1000"><formula1>&quot;Keine,Asphaltsorte,Anspritzmittel&quot;</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="Q2:Q1000"><formula1>&quot;Nicht verwenden,Material,Maschinen und Geräte,Sonstiges&quot;</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="R2:R1000"><formula1>&quot;Mobilbagger,Kettenbagger,LKW 2-Achser,LKW 3-Achser,LKW 4-Achser,LKW Abrollkipper,LKW Sattelzug,Planierraupe,Grader,Erdbauwalze / Walzenzug,Radlader,Kompressor&quot;</formula1></dataValidation></dataValidations>';
  const entries = readZipEntries(workbookBuffer).map((entry) => {
    if (entry.fileName !== "xl/worksheets/sheet1.xml") return entry;

    const xml = Buffer.from(entry.bytes).toString("utf8");
    const marker = [
      "<mergeCells",
      "<phoneticPr",
      "<dataValidations",
      "<ignoredErrors",
      "<pageMargins",
    ].find(
      (candidate) => xml.includes(candidate),
    );
    const patchedXml = marker
      ? xml.replace(marker, `${validation}${marker}`)
      : xml.replace("</worksheet>", `${validation}</worksheet>`);

    return {
      ...entry,
      bytes: Buffer.from(patchedXml, "utf8"),
    };
  });

  return createZipArchive(entries);
}

export async function GET() {
  const auth = await requireAdminForRoute();
  if (auth.response) return auth.response;

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    [
      "Baumaschinen",
      "",
      "Alle Baumaschinen",
      "100000",
      "109999",
      "100000",
      "10",
      "Ja",
      "Nein",
      "Ja",
      "Ja",
      "Nein",
      "Ja",
      "Nein",
      "Nein",
      "Keine",
      "Maschinen und Geräte",
      "",
      "",
    ],
    [
      "Kettenbagger",
      "Baumaschinen",
      "",
      "100000",
      "100499",
      "100000",
      "10",
      "Ja",
      "Nein",
      "Ja",
      "Ja",
      "Nein",
      "Ja",
      "Nein",
      "Nein",
      "Keine",
      "Maschinen und Geräte",
      "Kettenbagger",
      "",
    ],
  ]);
  const notes = XLSX.utils.aoa_to_sheet([
    ["Inventarkategorien – Importhinweise"],
    ["Eine Kategorie pro Zeile. Hauptkategorien haben keine übergeordnete Kategorie."],
    ["Unterkategorien tragen den exakten Namen ihrer Hauptkategorie ein."],
    ["Nummernkreise sind maximal 6-stellig und dürfen sich unter Geschwistern nicht überschneiden."],
    ["Ja/Nein-Felder akzeptieren auch X, 1, Wahr/Falsch."],
    [
      "BTB-Bereich",
      "Per Dropdown: Nicht verwenden, Material, Maschinen und Geräte oder Sonstiges",
    ],
    ["Bereits vorhandene Kategorien werden nicht überschrieben und im Ergebnis gemeldet."],
  ]);

  worksheet["!autofilter"] = { ref: `A1:S1000` };
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 34 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 11 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 26 },
    { wch: 18 },
  ];
  notes["!cols"] = [{ wch: 90 }, { wch: 44 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Kategorien");
  XLSX.utils.book_append_sheet(workbook, notes, "Hinweise");

  const buffer = addBtbDropdown(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    }),
  );

  return new Response(buffer, {
    headers: {
      "Content-Disposition":
        'attachment; filename="inventarkategorien-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
