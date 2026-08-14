import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { sortInventoryCategoriesForSelect } from "@/lib/inventory-categories";
import { columnLetter } from "@/lib/xlsx-dropdowns";

function formatObjectNumber(value: number | null) {
  return value === null ? "" : String(value).padStart(6, "0");
}

/** Fetches everything the "Kategorien"/"Dropdowns" reference sheets need -
 * shared between the blank template and the "current inventory" export so
 * both offer the same category tree and pick-lists instead of drifting
 * apart (the export used to have neither). */
export async function fetchInventoryDropdownData() {
  const [categories, unitOptions, fuelTypeOptions, insuranceProviderOptions, statusOptions] =
    await Promise.all([
      prisma.inventoryCategory.findMany({
        where: {
          isActive: true,
        },
        include: {
          parentCategory: {
            select: {
              id: true,
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

  const sortedCategories = sortInventoryCategoriesForSelect(categories);
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

  return { fuelTypes, insuranceProviders, sortedCategories, statusLabels, units };
}

export type InventoryDropdownData = Awaited<
  ReturnType<typeof fetchInventoryDropdownData>
>;

/** Appends the "Kategorien" (hierarchical reference) and "Dropdowns"
 * (pick-list) sheets to the given workbook, and returns the row count
 * needed to build `Dropdowns!$X$2:$X$n` formula ranges. */
export function appendInventoryDropdownSheets(
  workbook: XLSX.WorkBook,
  data: InventoryDropdownData,
) {
  const { fuelTypes, insuranceProviders, sortedCategories, statusLabels, units } =
    data;

  const categoryRows = sortedCategories.map((category) => ({
    Kategorie: category.parentCategory?.name ?? category.name,
    Nummernkreis: `${formatObjectNumber(
      category.objectNumberStart,
    )} – ${formatObjectNumber(category.objectNumberEnd)}`,
    Unterkategorie: category.parentCategory ? category.name : "",
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
    "Sonderfahrzeug-Disposition": category.useInSpecialVehicleDisposition
      ? "Ja"
      : "Nein",
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
  XLSX.utils.book_append_sheet(workbook, categorySheet, "Kategorien");

  const categoryNames = Array.from(
    new Set(
      sortedCategories
        .filter((category) => !category.parentCategory)
        .map((category) => category.name),
    ),
  );
  const subcategoryNames = Array.from(
    new Set(
      sortedCategories
        .filter((category) => category.parentCategory)
        .map((category) => category.name),
    ),
  );
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
  XLSX.utils.book_append_sheet(workbook, listSheet, "Dropdowns");

  return listRows.length + 1;
}

export function inventoryDropdownValidations(
  headers: readonly string[],
  dropdownsRowCount: number,
) {
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
