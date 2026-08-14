import * as XLSX from "xlsx";
import { columnLetter, patchWorkbookDropdowns } from "@/lib/xlsx-dropdowns";
import { PROJECT_IMPORT_HEADERS } from "../projectImportHeaders";

export const runtime = "nodejs";

const headers: string[] = [...PROJECT_IMPORT_HEADERS];

const exampleRow: Record<string, string> = {
  "Auftragssumme netto EUR": "125000",
  Auftraggeber: "Stadtwerke Musterstadt",
  Baustellenadresse: "Musterstraße 1, 12345 Musterstadt",
  "Bauleiter 1": "Max Mustermann",
  "Bauleiter 2": "",
  "Bauleiter 3": "",
  DVGW: "Nein",
  "Fortschritt %": "0",
  "Geplanter Start": "01.03.2026",
  "Geplantes Ende": "30.06.2026",
  "Gütezeichen Kanalbau": "Nein",
  Lieferscheine: "Nein",
  "Nachträge netto EUR": "",
  Name: "Beispielprojekt",
  Notizen: "",
  Projektnummer: "P-2026-001",
  "Schlussrechnung erstellt": "Nein",
  "Schlussrechnung netto EUR": "",
  Schlussrechnungsnummer: "",
  Status: "noch nicht begonnen",
  "Tatsächliches Ende": "",
  "Tatsächlicher Start": "",
  "Verbleibende Bauzeit": "",
  "Zahlungen netto EUR": "",
};

export async function GET() {
  const dataRow = headers.map((header) => exampleRow[header] ?? "");
  const projectSheet = XLSX.utils.aoa_to_sheet([headers, dataRow]);
  projectSheet["!cols"] = headers.map((header) => ({
    wch: Math.max(16, Math.min(32, header.length + 4)),
  }));

  const statusLabels = [
    "noch nicht begonnen",
    "aktiv",
    "ruht",
    "beendet",
    "storniert",
  ];
  const yesNo = ["Ja", "Nein"];
  const listRowCount = Math.max(statusLabels.length, yesNo.length);
  const listRows = Array.from({ length: listRowCount }).map((_, index) => ({
    JaNein: yesNo[index] ?? "",
    Status: statusLabels[index] ?? "",
  }));
  const listSheet = XLSX.utils.json_to_sheet(listRows);
  listSheet["!cols"] = [{ wch: 20 }, { wch: 14 }];

  const hintSheet = XLSX.utils.aoa_to_sheet([
    ["Hinweis"],
    [
      "Zeile 1 sind die Spaltennamen, ab Zeile 2 stehen die Daten.",
    ],
    [
      "Projektnummer ist der eindeutige Schlüssel: Ist die Projektnummer schon vorhanden, wird das bestehende Projekt aktualisiert, sonst neu angelegt.",
    ],
    [
      "Bauleiter 1–3 werden mit Mitarbeitern verknüpft, wenn Vor- und Nachname exakt zu einem Mitarbeiter passen, sonst als freier Text gespeichert. Alle drei Spalten dürfen leer bleiben.",
    ],
    [
      "Status: noch nicht begonnen, aktiv, ruht, beendet, storniert. Ja/Nein-Felder: Ja, Nein, X oder leer (= Nein).",
    ],
    [
      "Datum am besten als TT.MM.JJJJ eintragen. Geldbeträge netto in EUR, z. B. 12500,50.",
    ],
    [
      "Schlussrechnung netto EUR wird nur übernommen, wenn „Schlussrechnung erstellt“ auf Ja steht.",
    ],
  ]);
  hintSheet["!cols"] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, projectSheet, "Projektimport");
  XLSX.utils.book_append_sheet(workbook, listSheet, "Dropdowns");
  XLSX.utils.book_append_sheet(workbook, hintSheet, "Hinweise");

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;

  const dropdownsRowCount = listRows.length + 1;
  const validationByHeader: Record<string, string> = {
    DVGW: `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    "Gütezeichen Kanalbau": `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    Lieferscheine: `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    "Schlussrechnung erstellt": `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    Status: `Dropdowns!$B$2:$B$${dropdownsRowCount}`,
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
  const buffer = patchWorkbookDropdowns(rawBuffer, validations, 2);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="projekt-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
