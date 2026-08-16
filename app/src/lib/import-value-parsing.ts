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

// Excel cells with genuine numeric type arrive as JS numbers (or as their
// plain `toString()`, e.g. "298512.4" - a period there is a decimal point,
// never a thousands separator). Cells typed/pasted as German-formatted text
// (e.g. "289.512,40") arrive as strings with a comma - there, "." is a
// thousands separator and must be stripped before swapping "," for ".".
// The comma's presence is what disambiguates the two cases; without it we
// leave periods alone so plain CSV decimals ("298512.4") keep working.
function normalizeNumberString(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  const raw = text(value);
  if (!raw) return null;

  if (raw.includes(",")) {
    return raw.replaceAll(".", "").replace(",", ".");
  }

  // No comma: a "." is normally a decimal point (plain CSV/JS-stringified
  // numbers like "298512.4"). The one unambiguous exception is a whole
  // number grouped strictly into 3-digit blocks ("120.000" km, "1.234.567")
  // - real EUR-cent decimals never have exactly 3 digits after the point,
  // so this can't misfire on money values.
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    return raw.replaceAll(".", "");
  }

  return raw;
}

export function intValue(value: unknown) {
  const normalized = normalizeNumberString(value);
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function floatValue(value: unknown) {
  const normalized = normalizeNumberString(value);
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

/** True for "Baujahr/Datum"-style cells that are just a bare year number
 * (e.g. 2005), as opposed to a genuine date. Used to tell apart "the user
 * only knows/cares about the year" from "the user entered a precise date"
 * - callers that also track a separate year field should only fill it in
 * for the former, so a real date's day/month isn't hidden behind a
 * year-only display later. */
export function isBareYearValue(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  const currentYear = new Date().getUTCFullYear();
  return value >= 1800 && value <= currentYear + 1;
}

/** For "Baujahr/Datum"-style columns where a bare number almost always means
 * the user just typed the year: dateValue() treats any number as an Excel
 * date serial (days since 1899-12-30), so typing e.g. "2005" as a plain
 * number cell silently becomes 1905-06-27 - a real Baujahr year (1800..next
 * year) is nowhere near a plausible serial for a real recent date, so it's
 * unambiguous which one the user meant. Date-formatted cells (already a JS
 * Date via cellDates) and dd.mm.yyyy text still go through dateValue(). */
export function yearOrDateValue(value: unknown) {
  if (isBareYearValue(value)) {
    return new Date(Date.UTC(value, 0, 1));
  }

  return dateValue(value);
}
