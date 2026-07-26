"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createInventoryCategory } from "./actions";

type ImportRow = Record<string, unknown>;

export type CategoryImportState = {
  errors: string[];
  imported: number;
  message: string | null;
};

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function isYes(value: unknown) {
  return ["1", "ja", "j", "true", "wahr", "x"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function value(row: ImportRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && String(row[key]).trim()) {
      return row[key];
    }
  }

  return null;
}

function toFormData(row: ImportRow, parentCategoryId: string | null) {
  const formData = new FormData();
  const dailyReportSection = String(value(row, "BTB-Bereich") ?? "NONE")
    .trim()
    .toLowerCase();
  const dailyReportSectionValue =
    dailyReportSection === "material"
      ? "MATERIAL"
      : ["maschinen", "maschinen und geräte", "maschine/gerät"].includes(
            dailyReportSection,
          )
        ? "MACHINES"
        : dailyReportSection === "sonstiges"
          ? "OTHER"
          : dailyReportSection === "other"
            ? "OTHER"
            : dailyReportSection === "machines"
              ? "MACHINES"
              : dailyReportSection === "material"
                ? "MATERIAL"
                : "NONE";
  const asphaltUsage = String(
    value(row, "Asphalt-Verwendung") ?? "NONE",
  )
    .trim()
    .toLowerCase();
  const asphaltUsageValue =
    asphaltUsage === "asphaltsorte" || asphaltUsage === "asphalt_mix"
      ? "ASPHALT_MIX"
      : asphaltUsage === "anspritzmittel" || asphaltUsage === "tack_coat"
        ? "TACK_COAT"
        : "NONE";
  const mappings: [string, unknown][] = [
    ["name", value(row, "Kategorie", "Name")],
    ["description", value(row, "Beschreibung")],
    ["colorClass", value(row, "Farbe/Klasse", "Farbe")],
    ["objectNumberStart", value(row, "Nummernkreis von", "Von")],
    ["objectNumberEnd", value(row, "Nummernkreis bis", "Bis")],
    ["nextObjectNumber", value(row, "Nächste Objekt-ID", "Nächste ID")],
    ["sortOrder", value(row, "Sortierung")],
    ["dailyReportSection", dailyReportSectionValue],
    ["dailyReportMachineLabel", value(row, "Zuordnung im BTB", "BTB-Zuordnung")],
    ["asphaltDispositionUsage", asphaltUsageValue],
  ];

  for (const [key, rawValue] of mappings) {
    const parsed = text(rawValue);
    if (parsed) formData.set(key, parsed);
  }

  formData.set("parentCategoryId", parentCategoryId ?? "__none");

  if (!["nein", "0", "false"].includes(String(value(row, "Aktiv") ?? "ja").toLowerCase())) {
    formData.set("isActive", "on");
  }
  if (isYes(value(row, "LKW-Dispo Material"))) {
    formData.set("useInTruckDispatchMaterial", "on");
  }
  if (isYes(value(row, "LKW-Dispo Gerät/Objekt"))) {
    formData.set("useInTruckDispatchObject", "on");
  }
  if (isYes(value(row, "Im Bautagesbericht", "Im BTB"))) {
    formData.set("useInDailyReports", "on");
  }
  if (isYes(value(row, "Sonderfahrzeug-Disposition", "Sonderfahrzeug"))) {
    formData.set("useInSpecialVehicleDisposition", "on");
  }
  if (isYes(value(row, "Teams-Verwaltung", "In Teams-Verwaltung wählbar"))) {
    formData.set("useInTeamManagement", "on");
  }
  if (isYes(value(row, "In Personalakte listen", "Personalakte"))) {
    formData.set("useInEmployeeFile", "on");
  }
  if (
    isYes(
      value(
        row,
        "Fahrer-Fahrzeug-Zuordnung",
        "In Fahrer-Fahrzeug-Zuordnung wählbar",
        "LKW-Einteilung",
        "In LKW-Einteilung wählbar",
      ),
    )
  ) {
    formData.set("useInTruckDispatchSelection", "on");
  }

  return formData;
}

export async function importInventoryCategories(
  _previousState: CategoryImportState,
  formData: FormData,
): Promise<CategoryImportState> {
  const file = formData.get("categoryFile");

  if (!(file instanceof File) || file.size === 0) {
    return {
      errors: ["Bitte zuerst eine ausgefüllte Excel-Datei auswählen."],
      imported: 0,
      message: null,
    };
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      cellDates: true,
      type: "array",
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ImportRow>(worksheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return {
        errors: ["Die Excel-Datei enthält keine Kategorien."],
        imported: 0,
        message: null,
      };
    }

    const rootRows = rows.filter(
      (row) => !text(value(row, "Übergeordnete Kategorie", "Hauptkategorie")),
    );
    const childRows = rows.filter((row) =>
      text(value(row, "Übergeordnete Kategorie", "Hauptkategorie")),
    );
    const errors: string[] = [];
    let imported = 0;

    for (const [index, row] of [...rootRows, ...childRows].entries()) {
      const name = text(value(row, "Kategorie", "Name"));
      const parentName = text(
        value(row, "Übergeordnete Kategorie", "Hauptkategorie"),
      );
      const excelRow = rows.indexOf(row) + 2;

      if (!name) {
        errors.push(`Zeile ${excelRow}: Kategoriename fehlt.`);
        continue;
      }

      const existing = await prisma.inventoryCategory.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existing) {
        errors.push(`Zeile ${excelRow}: Kategorie „${name}“ existiert bereits.`);
        continue;
      }

      let parentCategoryId: string | null = null;
      if (parentName) {
        const parent = await prisma.inventoryCategory.findFirst({
          where: {
            isActive: true,
            name: parentName,
            parentCategoryId: null,
          },
          select: { id: true },
        });

        if (!parent) {
          errors.push(
            `Zeile ${excelRow}: Übergeordnete Kategorie „${parentName}“ wurde nicht gefunden.`,
          );
          continue;
        }
        parentCategoryId = parent.id;
      }

      const result = await createInventoryCategory(
        {
          error: null,
          errorKey: index,
          success: false,
          successKey: 0,
        },
        toFormData(row, parentCategoryId),
      );

      if (result.error) {
        errors.push(`Zeile ${excelRow} · ${name}: ${result.error}`);
      } else {
        imported += 1;
      }
    }

    revalidatePath("/admin/inventory-categories");

    return {
      errors,
      imported,
      message:
        imported > 0
          ? `${imported} ${imported === 1 ? "Kategorie wurde" : "Kategorien wurden"} importiert.`
          : "Es wurden keine Kategorien importiert.",
    };
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : "Die Excel-Datei konnte nicht verarbeitet werden.",
      ],
      imported: 0,
      message: null,
    };
  }
}
