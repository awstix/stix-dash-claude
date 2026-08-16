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

export type SiteContactEntry = {
  /** null for manually typed-in contacts (no employee record to link to) -
   * phone/role are then taken from the entry itself instead of looked up. */
  employeeId: string | null;
  name: string;
  phone: string | null;
  role: string | null;
};

/** Same JSON-array-of-entries pattern as construction managers, for the
 * project's Baufeld "Kontaktpersonen" (Wegbeschreibung PDF). Supports both
 * employee-linked entries and freely typed-in ones (e.g. a Bauleiter or
 * subcontractor contact without an employee record). */
export function parseSiteContactsJson(
  value: string | null | undefined,
): SiteContactEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        employeeId:
          typeof entry.employeeId === "string" && entry.employeeId.trim()
            ? entry.employeeId.trim()
            : null,
        name: String(entry.name ?? "").trim(),
        phone: String(entry.phone ?? "").trim() || null,
        role: String(entry.role ?? "").trim() || null,
      }))
      .filter((entry) => entry.name.length > 0);
  } catch {
    return [];
  }
}
