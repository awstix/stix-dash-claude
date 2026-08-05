import { prisma } from "@/lib/prisma";

/** Sichtbare Feature-Keys eines Nutzers (Vereinigung über alle seine Rollen).
 * "all" bedeutet uneingeschränkt sichtbar – das gilt für Admins und für jeden
 * Nutzer, der (auch) eine Rolle hat, deren Rechte-Matrix noch nie gespeichert
 * wurde (keine Zeilen in PortalPermission). So bleibt das Menü unverändert
 * offen, bis eine Rolle bewusst über Admin > Nutzerrollen konfiguriert wird –
 * kein versehentliches Aussperren durch unkonfigurierte Rollen.
 *
 * Serverseitig gehalten (nutzt prisma direkt), damit diese Datei niemals
 * versehentlich in ein Client-Bundle gerät – siehe portal-features.ts. */
export async function getVisibleFeatureKeysForUser(
  roleValue: string | null | undefined,
): Promise<Set<string> | "all"> {
  const roleKeys = String(roleValue ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (roleKeys.length === 0 || roleKeys.includes("admin")) {
    return "all";
  }

  const rows = await prisma.portalPermission.findMany({
    select: { canRead: true, featureKey: true, roleKey: true },
    where: { roleKey: { in: roleKeys } },
  });
  const configuredRoleKeys = new Set(rows.map((row) => row.roleKey));
  const hasUnconfiguredRole = roleKeys.some((roleKey) => !configuredRoleKeys.has(roleKey));

  if (hasUnconfiguredRole) {
    return "all";
  }

  return new Set(rows.filter((row) => row.canRead).map((row) => row.featureKey));
}

/** Projekt-Scope eines Nutzers für ein einzelnes Feature (z. B. Kolonnen-
 * Zeiterfassung): "all" = alle aktiven Baustellen wählbar, "own" = nur die
 * dem Nutzer zugeordneten. Vereinigung über alle Rollen – sobald eine Rolle
 * "all" erlaubt (oder unkonfiguriert ist), gilt "all" für den Nutzer, analog
 * zu getVisibleFeatureKeysForUser. */
export async function getProjectScopeForUser(
  roleValue: string | null | undefined,
  featureKey: string,
): Promise<"all" | "own"> {
  const roleKeys = String(roleValue ?? "")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);

  if (roleKeys.length === 0 || roleKeys.includes("admin")) {
    return "all";
  }

  const rows = await prisma.portalPermission.findMany({
    select: { projectScope: true, roleKey: true },
    where: { featureKey, roleKey: { in: roleKeys } },
  });
  const configuredRoleKeys = new Set(rows.map((row) => row.roleKey));
  const hasUnconfiguredRole = roleKeys.some((roleKey) => !configuredRoleKeys.has(roleKey));

  if (hasUnconfiguredRole || rows.some((row) => row.projectScope === "all")) {
    return "all";
  }

  return "own";
}
