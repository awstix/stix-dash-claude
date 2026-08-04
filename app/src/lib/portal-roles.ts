import { prisma } from "@/lib/prisma";

export type PortalRole = {
  description: string | null;
  id: string;
  isBuiltIn: boolean;
  key: string;
  label: string;
  sortOrder: number;
};

/** Die elf ursprünglichen Rollen – nur zum einmaligen Befüllen der Tabelle beim
 * ersten Aufruf, danach ist die Datenbank die Quelle der Wahrheit. */
const builtInPortalRoles: { key: string; label: string }[] = [
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
];

export async function ensurePortalRolesSeeded() {
  const count = await prisma.portalRole.count();

  if (count > 0) {
    return;
  }

  await prisma.portalRole.createMany({
    data: builtInPortalRoles.map((role, index) => ({
      isBuiltIn: true,
      key: role.key,
      label: role.label,
      sortOrder: (index + 1) * 10,
    })),
  });
}

export async function getPortalRoles(): Promise<PortalRole[]> {
  await ensurePortalRolesSeeded();
  return prisma.portalRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function getPortalRoleKeys(): Promise<Set<string>> {
  const roles = await getPortalRoles();
  return new Set(roles.map((role) => role.key));
}

export async function parsePortalRoles(value: string | null | undefined) {
  const validKeys = await getPortalRoleKeys();
  return String(value ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter((role) => validKeys.has(role));
}

export async function portalRoleLabels(value: string | null | undefined) {
  const roles = await getPortalRoles();
  const selected = new Set(await parsePortalRoles(value));
  return roles.filter((role) => selected.has(role.key)).map((role) => role.label);
}
