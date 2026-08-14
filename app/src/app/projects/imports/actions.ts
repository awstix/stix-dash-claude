"use server";

import { Prisma, ProjectStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { putFile, signedUrl } from "@/lib/storage";
import {
  bool,
  dateValue,
  floatValue,
  rowValue,
  text,
  type ExcelRow,
} from "@/lib/import-value-parsing";
import type { ConstructionManagerEntry } from "@/lib/construction-managers";
import { syncUserProjectAccessForConstructionManagers } from "@/lib/project-access-sync";

const STORAGE_BUCKET = "uploads";

// Unlike inventory's *Cents fields, Project.contractValueNet/changeOrdersNet/
// paymentsNet/finalInvoiceNet store whole euros (see formatEuro() usage
// throughout ProjectManager.tsx and controlling/auftraege/page.tsx, which
// never divides by 100) - so money values here are rounded, not ×100'd.
function wholeEuro(value: unknown) {
  const parsed = floatValue(value);
  return parsed === null ? null : Math.round(parsed);
}

function statusValue(value: unknown): ProjectStatus {
  const normalized = text(value)?.toLowerCase() ?? "";
  if (normalized === "aktiv") return ProjectStatus.ACTIVE;
  if (normalized === "ruht") return ProjectStatus.PAUSED;
  if (normalized === "beendet") return ProjectStatus.FINISHED;
  if (normalized === "storniert") return ProjectStatus.CANCELLED;
  return ProjectStatus.NOT_STARTED;
}

type ImportEmployeeRecord = { firstName: string; id: string; lastName: string };

function resolveConstructionManagers(
  row: ExcelRow,
  employees: ImportEmployeeRecord[],
): ConstructionManagerEntry[] {
  const names = [
    text(rowValue(row, "Bauleiter 1")),
    text(rowValue(row, "Bauleiter 2")),
    text(rowValue(row, "Bauleiter 3")),
  ].filter((name): name is string => Boolean(name));

  return names.map((name) => {
    const normalized = name.toLowerCase();
    const match = employees.find((employee) =>
      `${employee.firstName} ${employee.lastName}`.toLowerCase() === normalized,
    );
    return {
      employeeId: match?.id ?? null,
      name,
    };
  });
}

export async function importProjects(formData: FormData) {
  const importRunId = text(formData.get("importRunId"));
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Bitte eine Excel-Datei auswählen.");
  }

  const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
    cellDates: true,
    type: "buffer",
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });

  if (importRunId) {
    await prisma.importProgress.upsert({
      where: { id: importRunId },
      create: { id: importRunId, kind: "project", total: rows.length },
      update: { processed: 0, status: "running", total: rows.length },
    });
  }

  const allEmployees = await prisma.employee.findMany({
    select: {
      firstName: true,
      id: true,
      lastName: true,
    },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorRows: Record<string, unknown>[] = [];
  const resultRows: Record<string, unknown>[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    if (importRunId && rowIndex % 3 === 0) {
      await prisma.importProgress
        .update({
          where: { id: importRunId },
          data: { processed: rowIndex },
        })
        .catch(() => undefined);
    }

    const excelRow = rowIndex + 2;
    const projectNumber = text(rowValue(row, "Projektnummer"));
    const name = text(rowValue(row, "Name"));

    if (!projectNumber || !name) {
      skipped += 1;
      errorRows.push({
        "Excel-Zeile": excelRow,
        Fehler: "Projektnummer / Name fehlt.",
        ...row,
      });
      resultRows.push({
        "Excel-Zeile": excelRow,
        Projektnummer: projectNumber ?? "",
        Name: name ?? "",
        Aktion: "Übersprungen",
        Hinweis: "Projektnummer / Name fehlt.",
      });
      continue;
    }

    try {
      const constructionManagers = resolveConstructionManagers(row, allEmployees);
      const finalInvoiceCreated = bool(rowValue(row, "Schlussrechnung erstellt"));

      const data = {
        actualEnd: dateValue(rowValue(row, "Tatsächliches Ende")),
        actualStart: dateValue(rowValue(row, "Tatsächlicher Start")),
        changeOrdersNet: wholeEuro(rowValue(row, "Nachträge netto EUR")) ?? 0,
        client: text(rowValue(row, "Auftraggeber")),
        constructionManager:
          constructionManagers[0]?.name ?? null,
        constructionManagersJson: JSON.stringify(constructionManagers),
        contractValueNet:
          wholeEuro(rowValue(row, "Auftragssumme netto EUR")) ?? 0,
        dvgw: bool(rowValue(row, "DVGW")),
        finalInvoiceCreated,
        finalInvoiceNet: finalInvoiceCreated
          ? wholeEuro(rowValue(row, "Schlussrechnung netto EUR"))
          : null,
        finalInvoiceNumber: text(rowValue(row, "Schlussrechnungsnummer")),
        guetezeichenKanalbau: bool(rowValue(row, "Gütezeichen Kanalbau")),
        lieferscheine: bool(rowValue(row, "Lieferscheine")),
        name,
        notes: text(rowValue(row, "Notizen")),
        paymentsNet: wholeEuro(rowValue(row, "Zahlungen netto EUR")) ?? 0,
        plannedEnd: dateValue(rowValue(row, "Geplantes Ende")),
        plannedStart: dateValue(rowValue(row, "Geplanter Start")),
        progressPercent: floatValue(rowValue(row, "Fortschritt %")) ?? 0,
        remainingConstructionTime: text(rowValue(row, "Verbleibende Bauzeit")),
        siteAddress: text(rowValue(row, "Baustellenadresse")),
        status: statusValue(rowValue(row, "Status")),
      };

      const existing = await prisma.project.findUnique({
        where: { projectNumber },
        select: { id: true },
      });

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const project = existing
          ? await tx.project.update({
              where: { id: existing.id },
              data,
            })
          : await tx.project.create({
              data: {
                ...data,
                projectNumber,
              },
            });
        await syncUserProjectAccessForConstructionManagers(tx, project.id);
      });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      resultRows.push({
        "Excel-Zeile": excelRow,
        Projektnummer: projectNumber,
        Name: name,
        Aktion: existing ? "Aktualisiert" : "Angelegt",
        Hinweis: "",
      });
    } catch (error) {
      skipped += 1;
      const message =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
          ? `Projektnummer „${projectNumber}“ ist bereits vergeben.`
          : error instanceof Error
            ? error.message
            : "Unbekannter Fehler beim Import.";
      errorRows.push({
        "Excel-Zeile": excelRow,
        Fehler: message,
        ...row,
      });
      resultRows.push({
        "Excel-Zeile": excelRow,
        Projektnummer: projectNumber,
        Name: name,
        Aktion: "Übersprungen",
        Hinweis: message,
      });
    }
  }

  const reportWorkbook = XLSX.utils.book_new();
  if (resultRows.length > 0) {
    const resultSheet = XLSX.utils.json_to_sheet(resultRows);
    resultSheet["!cols"] = Object.keys(resultRows[0]).map((key) => ({
      wch: Math.max(14, Math.min(48, key.length + 4)),
    }));
    XLSX.utils.book_append_sheet(reportWorkbook, resultSheet, "Ergebnis");
  }
  if (errorRows.length > 0) {
    const errorSheet = XLSX.utils.json_to_sheet(errorRows);
    errorSheet["!cols"] = Object.keys(errorRows[0]).map((key) => ({
      wch: Math.max(14, Math.min(48, key.length + 4)),
    }));
    XLSX.utils.book_append_sheet(reportWorkbook, errorSheet, "Importfehler");
  }

  let reportUrl = "";
  let reportStoragePath: string | null = null;
  if (reportWorkbook.SheetNames.length > 0) {
    const reportFileName = `projekt-importbericht-${new Date()
      .toISOString()
      .slice(0, 10)}-${randomUUID().slice(0, 8)}.xlsx`;
    reportStoragePath = `project-import-reports/${reportFileName}`;
    await putFile(
      STORAGE_BUCKET,
      reportStoragePath,
      XLSX.write(reportWorkbook, {
        bookType: "xlsx",
        type: "buffer",
      }),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    reportUrl = await signedUrl(STORAGE_BUCKET, reportStoragePath, 60 * 60);
  }

  if (importRunId) {
    await prisma.importProgress
      .update({
        where: { id: importRunId },
        data: {
          processed: rows.length,
          status: "done",
          created,
          updated,
          skipped,
          reportStoragePath,
        },
      })
      .catch(() => undefined);
  }

  revalidatePath("/projects");
  redirect(
    `/projects/imports?created=${created}&updated=${updated}&skipped=${skipped}${
      reportUrl ? `&report=${encodeURIComponent(reportUrl)}` : ""
    }`,
  );
}
