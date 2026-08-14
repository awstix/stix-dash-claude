import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { parseConstructionManagersJson } from "@/lib/construction-managers";
import { patchWorkbookDropdowns } from "@/lib/xlsx-dropdowns";
import { PROJECT_IMPORT_HEADERS } from "../projectImportHeaders";
import { appendProjectDropdownSheet, projectDropdownValidations } from "../projectDropdowns";

export const runtime = "nodejs";

function money(cents: number | null) {
  return cents === null ? "" : cents / 100;
}

function bool(value: boolean) {
  return value ? "Ja" : "Nein";
}

function statusLabel(value: string) {
  if (value === "ACTIVE") return "aktiv";
  if (value === "PAUSED") return "ruht";
  if (value === "FINISHED") return "beendet";
  if (value === "CANCELLED") return "storniert";
  return "noch nicht begonnen";
}

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { projectNumber: "asc" },
  });

  const rows = projects.map((project) => {
    const managers = parseConstructionManagersJson(project.constructionManagersJson);

    return {
      Projektnummer: project.projectNumber,
      Name: project.name,
      Auftraggeber: project.client ?? "",
      "Bauleiter 1": managers[0]?.name ?? "",
      "Bauleiter 2": managers[1]?.name ?? "",
      "Bauleiter 3": managers[2]?.name ?? "",
      Status: statusLabel(project.status),
      "Geplanter Start": project.plannedStart ?? "",
      "Geplantes Ende": project.plannedEnd ?? "",
      "Tatsächlicher Start": project.actualStart ?? "",
      "Tatsächliches Ende": project.actualEnd ?? "",
      "Verbleibende Bauzeit": project.remainingConstructionTime ?? "",
      Baustellenadresse: project.siteAddress ?? "",
      DVGW: bool(project.dvgw),
      "Gütezeichen Kanalbau": bool(project.guetezeichenKanalbau),
      Lieferscheine: bool(project.lieferscheine),
      "Auftragssumme netto EUR": money(project.contractValueNet),
      "Nachträge netto EUR": money(project.changeOrdersNet),
      "Fortschritt %": project.progressPercent,
      "Zahlungen netto EUR": money(project.paymentsNet),
      "Schlussrechnung erstellt": bool(project.finalInvoiceCreated),
      Schlussrechnungsnummer: project.finalInvoiceNumber ?? "",
      "Schlussrechnung netto EUR": money(project.finalInvoiceNet),
      Notizen: project.notes ?? "",
    };
  });

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [...PROJECT_IMPORT_HEADERS],
  });
  sheet["!cols"] = PROJECT_IMPORT_HEADERS.map((header) => ({
    wch: Math.max(16, Math.min(32, header.length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Projektexport");
  const dropdownsRowCount = appendProjectDropdownSheet(workbook);

  const rawBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;

  const validations = projectDropdownValidations(
    [...PROJECT_IMPORT_HEADERS],
    dropdownsRowCount,
  );
  const buffer = patchWorkbookDropdowns(rawBuffer, validations, 2);

  const dateStamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Disposition": `attachment; filename="projekte-export-${dateStamp}.xlsx"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
