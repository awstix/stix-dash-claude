import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";

import {
  HAZARD_REGISTER_TEMPLATE,
  HAZARD_SYMBOLS,
} from "@/lib/hazard-register-constants";

export type HazardRegisterRow = {
  dataSheets: Array<{
    displayName: string;
    documentType: string;
    id: string;
    publicUrl: string;
    uploadedAt: Date;
    versionDate: Date | null;
  }>;
  id: string;
  source: "template" | "database";
  registerSection: "HAZARDOUS" | "WITHOUT_BA";
  hazardSymbols: string[];
  category: string | null;
  sequentialNumber: string | null;
  manufacturer: string | null;
  name: string;
  substanceType: string | null;
  safetyDataSheetPresent: boolean;
  safetyDataSheetDate: Date | null;
  operatingInstructionPresent: boolean;
  operatingInstructionTemplateIds: string[];
  packageUnit: string | null;
  quantity: number | null;
  repeatYears: number | null;
  repeatMonths: number | null;
  repeatDays: number | null;
  nextReviewDate: Date | null;
  usageArea: string | null;
};

export type HazardRuleRow = {
  topic: string;
  source: string;
  section: string;
  text: string;
  implementation: string;
};

export function nextHazardSequentialNumber(
  values: Iterable<string | null | undefined>,
) {
  const used = new Set(
    Array.from(values).flatMap((value) => {
      const parsed = Number.parseInt(String(value ?? "").trim(), 10);
      return Number.isInteger(parsed) && parsed > 0 ? [parsed] : [];
    }),
  );

  let next = 1;
  while (used.has(next)) next += 1;
  return String(next);
}

function templatePath() {
  return path.join(process.cwd(), "public", "templates", HAZARD_REGISTER_TEMPLATE);
}

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const valueText = text(value);
  if (!valueText) return null;
  const parsed = Number(valueText.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function excelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  const valueText = text(value);
  if (!valueText) return null;
  const parsed = new Date(valueText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRegisterSheet(
  sheet: XLSX.WorkSheet,
  registerSection: HazardRegisterRow["registerSection"],
) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    defval: null,
    header: 1,
    raw: true,
  });

  return rows.slice(5).flatMap((row, index): HazardRegisterRow[] => {
    const name = text(row[12]);
    const manufacturer = text(row[11]);
    if (!name && !manufacturer) return [];

    return [
      {
        category: text(row[9]),
        dataSheets: [],
        hazardSymbols: HAZARD_SYMBOLS.flatMap(([code], symbolIndex) =>
          text(row[symbolIndex]) ? [code] : [],
        ),
        id: `template-${registerSection}-${index}`,
        manufacturer,
        name: name ?? "Ohne Produktbezeichnung",
        nextReviewDate: excelDate(row[22]),
        operatingInstructionPresent: Boolean(text(row[16])),
        operatingInstructionTemplateIds: [],
        packageUnit: text(row[17]),
        quantity: number(row[18]),
        registerSection,
        repeatDays: number(row[21]),
        repeatMonths: number(row[20]),
        repeatYears: number(row[19]),
        safetyDataSheetDate: excelDate(row[15]),
        safetyDataSheetPresent: Boolean(text(row[14])),
        sequentialNumber: text(row[10]),
        source: "template",
        substanceType: text(row[13]),
        usageArea:
          registerSection === "HAZARDOUS" ? text(row[23]) : null,
      },
    ];
  });
}

export function readHazardRegisterTemplate() {
  const workbook = XLSX.read(readFileSync(templatePath()), {
    cellDates: true,
    cellStyles: true,
    type: "buffer",
  });
  const hazardousSheet = workbook.Sheets["gefährliche Gefahrstoffe"];
  const withoutBaSheet = workbook.Sheets["Gefahrstoffe ohne BA"];
  const rulesSheet = workbook.Sheets["Gef.Stoff - Regelwerke"];

  if (!hazardousSheet || !withoutBaSheet || !rulesSheet) {
    throw new Error("Die Gefahrstoffkataster-Vorlage enthält nicht alle drei Reiter.");
  }

  const ruleRows = XLSX.utils.sheet_to_json<unknown[]>(rulesSheet, {
    defval: null,
    header: 1,
    raw: false,
  });

  const rules = ruleRows.slice(2).flatMap((row): HazardRuleRow[] => {
    if (!text(row[0]) && !text(row[1])) return [];
    return [
      {
        implementation: text(row[4]) ?? "",
        section: text(row[2]) ?? "",
        source: text(row[1]) ?? "",
        text: text(row[3]) ?? "",
        topic: text(row[0]) ?? "",
      },
    ];
  });

  return {
    rows: [
      ...parseRegisterSheet(hazardousSheet, "HAZARDOUS"),
      ...parseRegisterSheet(withoutBaSheet, "WITHOUT_BA"),
    ],
    rules,
  };
}
