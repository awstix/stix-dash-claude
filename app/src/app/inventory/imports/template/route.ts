import * as XLSX from "xlsx";
import { inflateRawSync } from "node:zlib";
import { prisma } from "@/lib/prisma";
import { createZipArchive } from "@/lib/zip";
import { INVENTORY_IMPORT_HEADERS } from "../inventoryImportHeaders";

export const runtime = "nodejs";

const headers = [...INVENTORY_IMPORT_HEADERS];

type ZipEntry = {
  bytes: Uint8Array;
  fileName: string;
};

function formatObjectNumber(value: number | null) {
  return value === null ? "" : String(value).padStart(6, "0");
}

function columnLetter(index: number) {
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
) {
  const validationXml = `<dataValidations count="${validations.length}">${validations
    .map(
      (validation) =>
        `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${validation.column}2:${validation.column}1000"><formula1>${xmlEscape(
          validation.formula,
        )}</formula1></dataValidation>`,
    )
    .join("")}</dataValidations>`;

  if (xml.includes("<dataValidations")) {
    return xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, validationXml);
  }

  const insertionMarkers = [
    "<mergeCells",
    "<phoneticPr",
    "<dataValidations",
    "<ignoredErrors",
    "<pageMargins",
  ];
  const marker = insertionMarkers.find((candidate) => xml.includes(candidate));

  if (marker) {
    return xml.replace(marker, `${validationXml}${marker}`);
  }

  return xml.replace("</worksheet>", `${validationXml}</worksheet>`);
}

function patchInventoryTemplateDropdowns(
  workbookBuffer: Buffer,
  validations: {
    column: string;
    formula: string;
  }[],
) {
  const entries = readZipEntries(workbookBuffer);
  const patchedEntries = entries.map((entry) => {
    if (entry.fileName !== "xl/worksheets/sheet1.xml") {
      return entry;
    }

    return {
      ...entry,
      bytes: Buffer.from(
        addDropdownValidationsToSheetXml(
          Buffer.from(entry.bytes).toString("utf8"),
          validations,
        ),
        "utf8",
      ),
    };
  });

  return createZipArchive(patchedEntries);
}

export async function GET() {
  const [
    categories,
    unitOptions,
    fuelTypeOptions,
    insuranceProviderOptions,
    statusOptions,
  ] = await Promise.all([
    prisma.inventoryCategory.findMany({
    where: {
      isActive: true,
    },
    include: {
      parentCategory: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { parentCategoryId: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    }),
    prisma.adminOption.findMany({
      where: {
        groupKey: {
          in: ["material_unit", "quantity_unit", "asphalt_unit", "concrete_unit"],
        },
        isActive: true,
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
      select: {
        label: true,
      },
    }),
    prisma.adminOption.findMany({
      where: {
        groupKey: "vehicle_fuel_type",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        label: true,
      },
    }),
    prisma.adminOption.findMany({
      where: {
        groupKey: "insurance_provider",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        label: true,
      },
    }),
    prisma.adminOption.findMany({
      where: {
        groupKey: "inventory_status",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: {
        label: true,
      },
    }),
  ]);

  const exampleRow = {
    "Ansprechpartner Anrede": "Herr",
    "Ansprechpartner E-Mail": "",
    "Ansprechpartner Firma": "",
    "Ansprechpartner Mobil": "",
    "Ansprechpartner Nachname": "",
    "Ansprechpartner Notizen": "",
    "Ansprechpartner Rolle": "",
    "Ansprechpartner Telefon": "",
    "Ansprechpartner Vorname": "",
    "Ansprechpartner Webseite": "",
    Achsen: "",
    "Aktueller Bestand": "",
    Antrieb: "Kette",
    Aufnahmetyp: "OQ 70/55",
    "Anfangsbestand": "",
    "Baustelle Projektnummer": "",
    "Baujahr/Datum": "01.01.2026",
    Erstzulassung: "",
    Containerobjekt: "Nein",
    Einheit: "Stk.",
    "Erhalten am": "",
    "Gekauft am": "",
    "Gekauft bei": "",
    Hersteller: "Volvo",
    Inventarnummer: "INV-001",
    Kategorie: categories.find((category) => !category.parentCategory)?.name ?? "",
    Kennzeichen: "",
    Kolonne: "",
    "Letzte DGUV": "",
    "Letzte TÜV": "",
    "Letzte HU": "",
    "Letzte Tachoprüfung": "",
    "Letzte SP": "",
    "Letzte ADR": "",
    "Letzter Service Datum": "",
    "Letzter Service H": "",
    "Letzter Service KM": "",
    "Lieferscheinnummer": "",
    "Liegt in Container Objekt-ID": "",
    Lagerobjekt: "Nein",
    "Mitarbeiter Nachname": "",
    "Mitarbeiter Vorname": "",
    "Weiterer Mitarbeiter 1 Vorname": "",
    "Weiterer Mitarbeiter 1 Nachname": "",
    "Weiterer Mitarbeiter 2 Vorname": "",
    "Weiterer Mitarbeiter 2 Nachname": "",
    "Weiterer Mitarbeiter 3 Vorname": "",
    "Weiterer Mitarbeiter 3 Nachname": "",
    "Name": "Beispielobjekt",
    "Notizen": "",
    "Nutzlast t": "",
    "Nächste DGUV": "",
    "Nächste TÜV": "",
    "Nächste HU": "",
    "Nächste Tachoprüfung": "",
    "Nächste SP": "",
    "Nächste ADR": "",
    "Nächster Service Datum": "",
    "Nächster Service H": "",
    "Nächster Service KM": "",
    "Objekt-ID": "",
    Rechnungsnummer: "",
    Seriennummer: "",
    "Fahrzeug-Ident.-Nr.": "",
    Status: "Aktiv",
    "STIX-ID": "STIX-001",
    "Typ/Modell": "EC250",
    Unterkategorie: "",
    "Verantwortlich Typ": "",
    "Verrechnungssatz EUR je Einheit": "",
    "Verrechnungssatz stillgelegt EUR je Einheit": "",
    "Versichert bei": "",
    "Versicherung p.a. netto EUR": "",
    "Kraftstofftank l": "",
    Kraftstoffart: "",
    "Arbeitsmitteltank l": "",
    "Zul. Gesamtmasse (F1) kg": "",
  };
  const rows = [exampleRow];
  const inventorySheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });
  inventorySheet["!cols"] = headers.map((header) => ({
    wch: Math.max(14, Math.min(32, header.length + 4)),
  }));

  const categoryRows = categories.map((category) => ({
    Kategorie: category.parentCategory?.name ?? category.name,
    Nummernkreis: `${formatObjectNumber(
      category.objectNumberStart,
    )} – ${formatObjectNumber(category.objectNumberEnd)}`,
    "Unterkategorie": category.parentCategory ? category.name : "",
    "Verwendung BTB": category.dailyReportSection,
    "Zuordnung im BTB": category.dailyReportMachineLabel ?? "",
    "Verwendung LKW Transportgut": category.useInTruckDispatchMaterial
      ? "Ja"
      : "Nein",
    "Verwendung LKW Objekttransport": category.useInTruckDispatchObject
      ? "Ja"
      : "Nein",
    "Fahrer-Fahrzeug-Zuordnung wählbar": category.useInTruckDispatchSelection
      ? "Ja"
      : "Nein",
    "Sonderfahrzeug-Disposition":
      category.useInSpecialVehicleDisposition ? "Ja" : "Nein",
    "Teams-Verwaltung": category.useInTeamManagement ? "Ja" : "Nein",
    "Asphalt-Verwendung":
      category.asphaltDispositionUsage === "ASPHALT_MIX"
        ? "Asphaltsorte"
        : category.asphaltDispositionUsage === "TACK_COAT"
          ? "Anspritzmittel"
          : "Keine",
  }));
  const categorySheet = XLSX.utils.json_to_sheet(categoryRows);
  categorySheet["!cols"] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 28 },
    { wch: 20 },
    { wch: 26 },
    { wch: 28 },
    { wch: 30 },
    { wch: 28 },
    { wch: 28 },
    { wch: 22 },
    { wch: 24 },
  ];

  const hintSheet = XLSX.utils.aoa_to_sheet([
    ["Hinweis"],
    [
      "Kategorie und Unterkategorie müssen exakt zu den in Dashboard gepflegten Inventarkategorien passen.",
    ],
    [
      "Wenn Objekt-ID leer bleibt, vergibt das System automatisch die nächste freie ID aus dem Nummernkreis der Kategorie/Unterkategorie.",
    ],
    [
      "Die automatische Objekt-ID wird von oben nach unten in Excel-Reihenfolge vergeben. Unterkategorie hat Vorrang vor Hauptkategorie.",
    ],
    [
      "Bis zu 3 weitere Mitarbeiter/Fahrer können mit Vorname/Nachname in den Spalten „Weiterer Mitarbeiter 1–3“ eingetragen werden. Alle Spalten dürfen leer bleiben.",
    ],
    [
      "Status: Aktiv, Defekt, In Wartung, Gesperrt, Gestohlen. Ja/Nein-Felder: Ja, Nein, X oder leer.",
    ],
    [
      "Datum am besten als TT.MM.JJJJ eintragen. Lagerobjekte bekommen Einheit und Bestand.",
    ],
  ]);
  hintSheet["!cols"] = [{ wch: 120 }];

  const categoryNames = Array.from(
    new Set(
      categories
        .filter((category) => !category.parentCategory)
        .map((category) => category.name),
    ),
  );
  const subcategoryNames = Array.from(
    new Set(
      categories
        .filter((category) => category.parentCategory)
        .map((category) => category.name),
    ),
  );
  const units = Array.from(
    new Set([
      ...unitOptions.map((option) => option.label),
      "Stk.",
      "t",
      "kg",
      "m³",
      "m²",
      "l",
      "Std.",
    ]),
  ).filter(Boolean);
  const fuelTypes = Array.from(
    new Set(fuelTypeOptions.map((option) => option.label)),
  ).filter(Boolean);
  const insuranceProviders = Array.from(
    new Set(insuranceProviderOptions.map((option) => option.label)),
  ).filter(Boolean);
  const statusLabels =
    statusOptions.length > 0
      ? Array.from(new Set(statusOptions.map((option) => option.label))).filter(
          Boolean,
        )
      : ["Aktiv", "Defekt", "In Wartung", "Gesperrt", "Gestohlen"];
  const listRows = Array.from({
    length: Math.max(
      categoryNames.length,
      subcategoryNames.length,
      units.length,
      fuelTypes.length,
      insuranceProviders.length,
      statusLabels.length,
      4,
    ),
  }).map((_, index) => ({
    Kategorie: categoryNames[index] ?? "",
    Unterkategorie: subcategoryNames[index] ?? "",
    Einheit: units[index] ?? "",
    JaNein: ["Ja", "Nein"][index] ?? "",
    Status: statusLabels[index] ?? "",
    Verantwortlich: ["Mitarbeiter", "Kolonne"][index] ?? "",
    Antrieb: ["Kette", "Rad", "Rad+Kette", "Anhänger", "Andere"][index] ?? "",
    Anrede: ["Herr", "Frau", "Divers"][index] ?? "",
    Kraftstoffart: fuelTypes[index] ?? "",
    Versicherer: insuranceProviders[index] ?? "",
  }));
  const listSheet = XLSX.utils.json_to_sheet(listRows);
  listSheet["!cols"] = [
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, inventorySheet, "Inventarimport");
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Kategorien");
  XLSX.utils.book_append_sheet(workbook, listSheet, "Dropdowns");
  XLSX.utils.book_append_sheet(workbook, hintSheet, "Hinweise");

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
  const dropdownsRowCount = listRows.length + 1;
  const validationByHeader: Record<string, string> = {
    "Ansprechpartner Anrede": `Dropdowns!$H$2:$H$${dropdownsRowCount}`,
    Antrieb: `Dropdowns!$G$2:$G$${dropdownsRowCount}`,
    Containerobjekt: `Dropdowns!$D$2:$D$${dropdownsRowCount}`,
    Einheit: `Dropdowns!$C$2:$C$${dropdownsRowCount}`,
    Kategorie: `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    Kraftstoffart: `Dropdowns!$I$2:$I$${dropdownsRowCount}`,
    Lagerobjekt: `Dropdowns!$D$2:$D$${dropdownsRowCount}`,
    Status: `Dropdowns!$E$2:$E$${dropdownsRowCount}`,
    Unterkategorie: `Dropdowns!$B$2:$B$${dropdownsRowCount}`,
    "Verantwortlich Typ": `Dropdowns!$F$2:$F$${dropdownsRowCount}`,
    "Versichert bei": `Dropdowns!$J$2:$J$${dropdownsRowCount}`,
  };
  const validations = headers
    .map((header, index) => ({
      column: columnLetter(index),
      formula: validationByHeader[header],
    }))
    .filter(
      (validation): validation is { column: string; formula: string } =>
        Boolean(validation.formula),
    );
  const buffer = patchInventoryTemplateDropdowns(rawBuffer, validations);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="inventar-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
