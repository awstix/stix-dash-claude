import * as XLSX from "xlsx";

/** Small set of shared cell-value parsers for Excel bulk imports (trimming,
 * German decimal commas, German dd.mm.yyyy dates, yes/no flags). */

export type ExcelRow = Record<string, unknown>;

/** Looks up a cell by header name, trying each alias in order (for headers
 * that have been renamed across template versions). */
export function rowValue(row: ExcelRow, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim()) {
      return row[key];
    }
  }

  return null;
}

export function text(value: unknown) {
  const stringValue = String(value ?? "").trim();
  return stringValue.length > 0 ? stringValue : null;
}

export function lower(value: unknown) {
  return text(value)?.toLowerCase() ?? "";
}

export function bool(value: unknown) {
  const normalized = lower(value);
  return ["1", "ja", "j", "true", "wahr", "x"].includes(normalized);
}

export function intValue(value: unknown) {
  const normalized = text(value)?.replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function floatValue(value: unknown) {
  const normalized = text(value)?.replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function moneyCents(value: unknown) {
  const number = floatValue(value);
  return number === null ? null : Math.round(number * 100);
}

export function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }

  const raw = text(value);
  if (!raw) return null;

  const germanDate = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanDate) {
    const day = Number(germanDate[1]);
    const month = Number(germanDate[2]);
    const year =
      germanDate[3].length === 2
        ? Number(`20${germanDate[3]}`)
        : Number(germanDate[3]);

    return new Date(Date.UTC(year, month - 1, day));
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
