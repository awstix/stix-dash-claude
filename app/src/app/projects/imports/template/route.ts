import * as XLSX from "xlsx";
import { patchWorkbookDropdowns } from "@/lib/xlsx-dropdowns";
import { getConstructionManagerCandidateNames } from "../constructionManagerCandidates";
import { PROJECT_IMPORT_HEADERS } from "../projectImportHeaders";
import { appendProjectDropdownSheet, projectDropdownValidations } from "../projectDropdowns";

export const runtime = "nodejs";

const headers: string[] = [...PROJECT_IMPORT_HEADERS];

const exampleRow: Record<string, string> = {
  "Auftragssumme netto EUR": "125000,50",
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
  const employeeNames = await getConstructionManagerCandidateNames();

  const dataRow = headers.map((header) => exampleRow[header] ?? "");
  const projectSheet = XLSX.utils.aoa_to_sheet([headers, dataRow]);
  projectSheet["!cols"] = headers.map((header) => ({
    wch: Math.max(16, Math.min(32, header.length + 4)),
  }));

  const hintSheet = XLSX.utils.aoa_to_sheet([
    ["Hinweis"],
    [
      "Zeile 1 sind die Spaltennamen, ab Zeile 2 stehen die Daten.",
    ],
    [
      "Projektnummer ist der eindeutige Schlüssel: Ist die Projektnummer schon vorhanden, wird das bestehende Projekt aktualisiert, sonst neu angelegt.",
    ],
    [
      "Bauleiter 1–3: per Dropdown aus den Mitarbeitern wählen, dann wird automatisch verknüpft. Freier Text geht auch, wird dann aber nur als Name gespeichert (ohne Verknüpfung zum Mitarbeiter). Alle drei Spalten dürfen leer bleiben.",
    ],
    [
      "Status: noch nicht begonnen, aktiv, ruht, beendet, storniert. Ja/Nein-Felder: Ja, Nein, X oder leer (= Nein).",
    ],
    [
      "Datum am besten als TT.MM.JJJJ eintragen. Geldbeträge netto in EUR, Cent-Beträge mit Komma, z. B. 12500,50.",
    ],
    [
      "Schlussrechnung netto EUR wird nur übernommen, wenn „Schlussrechnung erstellt“ auf Ja steht.",
    ],
  ]);
  hintSheet["!cols"] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, projectSheet, "Projektimport");
  const dropdownsRowCount = appendProjectDropdownSheet(workbook, employeeNames);
  XLSX.utils.book_append_sheet(workbook, hintSheet, "Hinweise");

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;

  const validations = projectDropdownValidations(headers, dropdownsRowCount);
  const buffer = patchWorkbookDropdowns(rawBuffer, validations, 2);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": 'attachment; filename="projekt-importvorlage.xlsx"',
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
