import * as XLSX from "xlsx";
import { columnLetter } from "@/lib/xlsx-dropdowns";

export const PROJECT_STATUS_LABELS = [
  "noch nicht begonnen",
  "aktiv",
  "ruht",
  "beendet",
  "storniert",
];

export const YES_NO_LABELS = ["Ja", "Nein"];

/** Appends the "Dropdowns" list sheet (Status + Ja/Nein values) that the
 * data validations below reference, and returns the row count needed to
 * build the `Dropdowns!$X$2:$X$n` formula ranges. Shared between the blank
 * template and the "current projects" export so both offer the same
 * pick-lists instead of free text. */
export function appendProjectDropdownSheet(workbook: XLSX.WorkBook) {
  const listRowCount = Math.max(
    PROJECT_STATUS_LABELS.length,
    YES_NO_LABELS.length,
  );
  const listRows = Array.from({ length: listRowCount }).map((_, index) => ({
    JaNein: YES_NO_LABELS[index] ?? "",
    Status: PROJECT_STATUS_LABELS[index] ?? "",
  }));
  const listSheet = XLSX.utils.json_to_sheet(listRows);
  listSheet["!cols"] = [{ wch: 20 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(workbook, listSheet, "Dropdowns");

  return listRows.length + 1;
}

export function projectDropdownValidations(
  headers: readonly string[],
  dropdownsRowCount: number,
) {
  const validationByHeader: Record<string, string> = {
    DVGW: `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    "Gütezeichen Kanalbau": `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    Lieferscheine: `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    "Schlussrechnung erstellt": `Dropdowns!$A$2:$A$${dropdownsRowCount}`,
    Status: `Dropdowns!$B$2:$B$${dropdownsRowCount}`,
  };

  return headers
    .map((header, index) => ({
      column: columnLetter(index),
      formula: validationByHeader[header],
    }))
    .filter(
      (validation): validation is { column: string; formula: string } =>
        Boolean(validation.formula),
    );
}
