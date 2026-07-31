export type ConstructionManagerEntry = {
  employeeId: string | null;
  name: string;
};

export function parseConstructionManagersJson(
  value: string | null | undefined,
): ConstructionManagerEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        employeeId: typeof entry.employeeId === "string" ? entry.employeeId : null,
        name: String(entry.name ?? "").trim(),
      }))
      .filter((entry) => entry.name.length > 0);
  } catch {
    return [];
  }
}

export function joinConstructionManagerNames(entries: ConstructionManagerEntry[]) {
  return entries.map((entry) => entry.name).join(", ");
}

/** The single name shown in forms/PDFs/tables that still only expect one contact. */
export function primaryConstructionManagerName(entries: ConstructionManagerEntry[]) {
  return entries[0]?.name ?? "";
}
