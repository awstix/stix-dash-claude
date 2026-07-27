import { readFile } from "fs/promises";
import path from "path";

import AdmZip from "adm-zip";

import {
  HAZARD_REGISTER_TEMPLATE,
  HAZARD_SYMBOLS,
} from "@/lib/hazard-register-constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Substance = Awaited<
  ReturnType<typeof prisma.safetyHazardousSubstance.findMany>
>[number];

function xml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let result = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    result = String.fromCharCode(65 + ((value - 1) % 26)) + result;
  }
  return result;
}

function excelDate(date: Date | null) {
  if (!date) return null;
  return (
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(1899, 11, 30)) /
    86_400_000
  );
}

function styleForCell(sourceRowXml: string, column: string, sourceRow: number) {
  const match = sourceRowXml.match(
    new RegExp(`<c\\b[^>]*\\br="${column}${sourceRow}"[^>]*>`),
  );
  return match?.[0].match(/\bs="(\d+)"/)?.[1] ?? null;
}

function cellXml({
  column,
  row,
  sourceRow,
  sourceRowXml,
  value,
}: {
  column: number;
  row: number;
  sourceRow: number;
  sourceRowXml: string;
  value: string | number | Date | null;
}) {
  const columnLetter = columnName(column);
  const style = styleForCell(sourceRowXml, columnLetter, sourceRow);
  const attributes = `r="${columnLetter}${row}"${style ? ` s="${style}"` : ""}`;

  if (value instanceof Date) {
    return `<c ${attributes} t="n"><v>${excelDate(value)}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c ${attributes} t="n"><v>${value}</v></c>`;
  }
  if (value === null || value === "") {
    return `<c ${attributes}/>`;
  }
  return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${xml(
    value,
  )}</t></is></c>`;
}

function rowValues(substance: Substance, includeUsageArea: boolean) {
  const selectedSymbols = new Set(
    String(substance.hazardSymbols ?? "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean),
  );
  return [
    ...HAZARD_SYMBOLS.map(([code]) => (selectedSymbols.has(code) ? "X" : null)),
    substance.category,
    substance.sequentialNumber,
    substance.manufacturer,
    substance.name,
    substance.substanceType,
    substance.safetyDataSheetPresent ? "X" : null,
    substance.safetyDataSheetDate,
    substance.operatingInstructionPresent ? "X" : null,
    substance.packageUnit,
    substance.quantity,
    substance.repeatYears,
    substance.repeatMonths,
    substance.repeatDays,
    substance.nextReviewDate,
    ...(includeUsageArea ? [substance.usageArea] : []),
  ];
}

function appendRows(
  worksheetXml: string,
  substances: Substance[],
  includeUsageArea: boolean,
) {
  if (substances.length === 0) return worksheetXml;

  const dimension = worksheetXml.match(/<dimension ref="([A-Z]+)1:([A-Z]+)(\d+)"\/>/);
  if (!dimension) {
    throw new Error("Der Tabellenbereich der Excel-Vorlage wurde nicht gefunden.");
  }
  const sourceRow = Number(dimension[3]);
  const sourceRowMatch = worksheetXml.match(
    new RegExp(`<row\\b[^>]*\\br="${sourceRow}"[^>]*>[\\s\\S]*?<\\/row>`),
  );
  if (!sourceRowMatch) {
    throw new Error("Die Formatvorlage für neue Gefahrstoffzeilen fehlt.");
  }
  const sourceRowXml = sourceRowMatch[0];
  const rowStyle = sourceRowXml.match(/\bs="(\d+)"/)?.[1];
  const rowHeight = sourceRowXml.match(/\bht="([^"]+)"/)?.[1];
  const columnCount = includeUsageArea ? 24 : 23;
  const newRows = substances
    .map((substance, offset) => {
      const row = sourceRow + offset + 1;
      const attributes = [
        `r="${row}"`,
        rowStyle ? `s="${rowStyle}"` : "",
        rowStyle ? 'customFormat="1"' : "",
        rowHeight ? `ht="${rowHeight}"` : "",
        rowHeight ? 'customHeight="1"' : "",
      ]
        .filter(Boolean)
        .join(" ");
      const values = rowValues(substance, includeUsageArea);
      const cells = Array.from({ length: columnCount }, (_, column) =>
        cellXml({
          column,
          row,
          sourceRow,
          sourceRowXml,
          value: values[column] ?? null,
        }),
      ).join("");
      return `<row ${attributes}>${cells}</row>`;
    })
    .join("");
  const newLastRow = sourceRow + substances.length;

  return worksheetXml
    .replace(
      dimension[0],
      `<dimension ref="${dimension[1]}1:${dimension[2]}${newLastRow}"/>`,
    )
    .replace("</sheetData>", `${newRows}</sheetData>`);
}

function appendRuleRows(
  worksheetXml: string,
  rules: Awaited<ReturnType<typeof prisma.safetyHazardRule.findMany>>,
) {
  if (rules.length === 0) return worksheetXml;

  const dimension = worksheetXml.match(/<dimension ref="([A-Z]+)1:([A-Z]+)(\d+)"\/>/);
  if (!dimension) {
    throw new Error("Der Regelwerke-Bereich der Excel-Vorlage wurde nicht gefunden.");
  }
  const sourceRow = Number(dimension[3]);
  const sourceRowMatch = worksheetXml.match(
    new RegExp(`<row\\b[^>]*\\br="${sourceRow}"[^>]*>[\\s\\S]*?<\\/row>`),
  );
  if (!sourceRowMatch) {
    throw new Error("Die Formatvorlage für neue Regelwerkzeilen fehlt.");
  }
  const sourceRowXml = sourceRowMatch[0];
  const rowStyle = sourceRowXml.match(/\bs="(\d+)"/)?.[1];
  const rowHeight = sourceRowXml.match(/\bht="([^"]+)"/)?.[1];
  const newRows = rules
    .map((rule, offset) => {
      const row = sourceRow + offset + 1;
      const attributes = [
        `r="${row}"`,
        rowStyle ? `s="${rowStyle}"` : "",
        rowStyle ? 'customFormat="1"' : "",
        rowHeight ? `ht="${rowHeight}"` : "",
        rowHeight ? 'customHeight="1"' : "",
      ]
        .filter(Boolean)
        .join(" ");
      const values = [
        rule.topic,
        rule.source,
        rule.section,
        rule.text,
        rule.implementation,
      ];
      const cells = values
        .map((value, column) =>
          cellXml({
            column,
            row,
            sourceRow,
            sourceRowXml,
            value,
          }),
        )
        .join("");
      return `<row ${attributes}>${cells}</row>`;
    })
    .join("");
  const newLastRow = sourceRow + rules.length;

  return worksheetXml
    .replace(
      dimension[0],
      `<dimension ref="${dimension[1]}1:${dimension[2]}${newLastRow}"/>`,
    )
    .replace("</sheetData>", `${newRows}</sheetData>`);
}

export async function GET() {
  const template = await readFile(
    path.join(process.cwd(), "public", "templates", HAZARD_REGISTER_TEMPLATE),
  );
  const zip = new AdmZip(template);
  const [substances, rules] = await Promise.all([
    prisma.safetyHazardousSubstance.findMany({
      orderBy: [{ createdAt: "asc" }],
      where: { isActive: true },
    }),
    prisma.safetyHazardRule.findMany({
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);
  const sheets = [
    {
      includeUsageArea: true,
      path: "xl/worksheets/sheet1.xml",
      substances: substances.filter(
        (entry) => entry.registerSection !== "WITHOUT_BA",
      ),
    },
    {
      includeUsageArea: false,
      path: "xl/worksheets/sheet2.xml",
      substances: substances.filter(
        (entry) => entry.registerSection === "WITHOUT_BA",
      ),
    },
  ];

  for (const sheet of sheets) {
    const entry = zip.getEntry(sheet.path);
    if (!entry) throw new Error(`Excel-Reiter fehlt: ${sheet.path}`);
    const updated = appendRows(
      entry.getData().toString("utf8"),
      sheet.substances,
      sheet.includeUsageArea,
    );
    zip.updateFile(sheet.path, Buffer.from(updated, "utf8"));
  }
  const rulesEntry = zip.getEntry("xl/worksheets/sheet3.xml");
  if (!rulesEntry) throw new Error("Excel-Regelwerke-Reiter fehlt.");
  zip.updateFile(
    "xl/worksheets/sheet3.xml",
    Buffer.from(
      appendRuleRows(rulesEntry.getData().toString("utf8"), rules),
      "utf8",
    ),
  );

  const output = zip.toBuffer();
  const filename = `A-30-19-01.1-Gefahrstoffkataster-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(output), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
