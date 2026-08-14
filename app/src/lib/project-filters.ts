export type TriStateFilter = "" | "ja" | "nein";
export type PercentOperator = "" | "gt" | "lt";

export function getTriStateFilter(value: string | undefined): TriStateFilter {
  return value === "ja" || value === "nein" ? value : "";
}

export function getPercentOperator(value: string | undefined): PercentOperator {
  return value === "gt" || value === "lt" ? value : "";
}

export function getPercentValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProjectSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}
