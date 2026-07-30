export const portalRoles = [
  { key: "admin", label: "Administrator" },
  { key: "foreman", label: "Polier" },
  { key: "accounting", label: "Buchhaltung" },
  { key: "hr", label: "Personalabteilung" },
  { key: "dispatch", label: "Disposition" },
  { key: "mixing_plant", label: "Mischanlage" },
  { key: "employee", label: "Mitarbeiter" },
  { key: "construction_manager", label: "Bauleiter" },
  { key: "mixing_plant_management", label: "Leitung Mischanlage" },
  { key: "construction_management", label: "Leitung Bauleitung" },
  { key: "estimating_management", label: "Leitung Kalkulation" },
] as const;

export const portalRoleKeys = new Set<string>(
  portalRoles.map((role) => role.key),
);

export function parsePortalRoles(value: string | null | undefined) {
  return String(value ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter((role) => portalRoleKeys.has(role));
}

export function portalRoleLabels(value: string | null | undefined) {
  const selected = new Set(parsePortalRoles(value));
  return portalRoles
    .filter((role) => selected.has(role.key))
    .map((role) => role.label);
}
