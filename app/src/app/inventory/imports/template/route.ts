import * as XLSX from "xlsx";
import { patchWorkbookDropdowns } from "@/lib/xlsx-dropdowns";
import {
  INVENTORY_IMPORT_COLUMN_GROUPS,
  INVENTORY_IMPORT_HEADERS,
} from "../inventoryImportHeaders";
import {
  appendInventoryDropdownSheets,
  fetchInventoryDropdownData,
  inventoryDropdownValidations,
} from "../inventoryDropdowns";

export const runtime = "nodejs";

const headers: string[] = [...INVENTORY_IMPORT_HEADERS];

export async function GET() {
  const dropdownData = await fetchInventoryDropdownData();
  const { sortedCategories } = dropdownData;

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
    Kategorie:
      sortedCategories.find((category) => !category.parentCategory)?.name ??
      "",
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
  const groupTitleRow: string[] = new Array(headers.length).fill("");
  const groupMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] =
    [];
  const columnGroupLevelByHeader = new Map<string, number>();
  for (const group of INVENTORY_IMPORT_COLUMN_GROUPS) {
    const fromIndex = headers.indexOf(group.from);
    const toIndex = headers.indexOf(group.to);
    groupTitleRow[fromIndex] = group.label;
    if (toIndex > fromIndex) {
      groupMerges.push({
        e: { c: toIndex, r: 0 },
        s: { c: fromIndex, r: 0 },
      });
    }
    for (let i = fromIndex; i <= toIndex; i += 1) {
      columnGroupLevelByHeader.set(headers[i], 1);
    }
  }

  const dataRow = headers.map(
    (header) => (exampleRow as Record<string, string>)[header] ?? "",
  );
  const inventorySheet = XLSX.utils.aoa_to_sheet([
    groupTitleRow,
    headers,
    dataRow,
  ]);
  inventorySheet["!merges"] = groupMerges;
  inventorySheet["!cols"] = headers.map((header) => ({
    level: columnGroupLevelByHeader.get(header) ?? 0,
    wch: Math.max(14, Math.min(32, header.length + 4)),
  }));

  const hintSheet = XLSX.utils.aoa_to_sheet([
    ["Hinweis"],
    [
      "Zeile 1 gruppiert die Spalten zu Themenbereichen (wie im Formular). Zeile 2 sind die eigentlichen Spaltennamen, ab Zeile 3 stehen die Daten. Über den Spaltenbuchstaben lassen sich einzelne Bereiche mit den +/- Symbolen ein-/ausklappen.",
    ],
    [
      "Kategorie und Unterkategorie müssen exakt zu den in Dashboard gepflegten Inventarkategorien passen.",
    ],
    [
      "„Verantwortlich Typ“ muss nicht ausgefüllt werden, wenn Mitarbeiter Vorname/Nachname oder Kolonne eingetragen sind – das System erkennt den Typ dann automatisch. Nur bei Bedarf zur Klarstellung ausfüllen.",
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
    [
      "Baujahr/Datum: entweder ein volles Datum (TT.MM.JJJJ) oder nur die Jahreszahl (z. B. 2018) eintragen - beides wird korrekt erkannt.",
    ],
  ]);
  hintSheet["!cols"] = [{ wch: 120 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, inventorySheet, "Inventarimport");
  const dropdownsRowCount = appendInventoryDropdownSheets(
    workbook,
    dropdownData,
  );
  XLSX.utils.book_append_sheet(workbook, hintSheet, "Hinweise");

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
  const validations = inventoryDropdownValidations(headers, dropdownsRowCount);
  const buffer = patchWorkbookDropdowns(rawBuffer, validations, 3);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="inventar-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
