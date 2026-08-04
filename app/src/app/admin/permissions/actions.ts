"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import { portalModules } from "@/lib/portal-features";
import { getPortalRoleKeys } from "@/lib/portal-roles";

export type FeaturePermission = {
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canRead: boolean;
  projectScope: "all" | "own";
};

function fieldName(moduleKey: string, featureKey: string, field: string) {
  return `perm__${moduleKey}__${featureKey}__${field}`;
}

/** Lädt die gespeicherte Rechte-Matrix einer Rolle als Map, Schlüssel
 * "moduleKey::featureKey". Fehlende Einträge bedeuten "kein Zugriff". */
export async function getPermissionsForRole(roleKey: string): Promise<Map<string, FeaturePermission>> {
  await requireAdmin();
  const rows = await prisma.portalPermission.findMany({ where: { roleKey } });
  const byKey = new Map<string, FeaturePermission>();

  for (const row of rows) {
    byKey.set(`${row.moduleKey}::${row.featureKey}`, {
      canCreate: row.canCreate,
      canDelete: row.canDelete,
      canEdit: row.canEdit,
      canRead: row.canRead,
      projectScope: row.projectScope === "own" ? "own" : "all",
    });
  }

  return byKey;
}

export type SavePermissionsState = {
  error: string | null;
  errorKey: number;
};

export async function savePermissionsForRoleAction(
  state: SavePermissionsState,
  formData: FormData,
): Promise<SavePermissionsState> {
  await requireAdmin();

  try {
    const roleKey = String(formData.get("roleKey") ?? "").trim();
    const validRoleKeys = await getPortalRoleKeys();

    if (!validRoleKeys.has(roleKey)) {
      throw new Error("Unbekannte Rolle.");
    }

    // Bewusst wird für JEDES Feature eine Zeile geschrieben (auch ohne jedes Häkchen) statt
    // leere Zeilen zu löschen: so lässt sich "Rolle hat noch nie gespeicherte Rechte" (= gar
    // keine Zeilen vorhanden, Menü bleibt offen) von "Rolle wurde konfiguriert und hat hier
    // bewusst keinen Zugriff" (= Zeile mit canRead: false) unterscheiden. Siehe
    // getVisibleFeatureKeysForUser in portal-permissions.ts.
    const toUpsert: { featureKey: string; moduleKey: string; value: FeaturePermission }[] = [];

    for (const portalModule of portalModules) {
      for (const feature of portalModule.features) {
        const value: FeaturePermission = {
          canCreate: formData.get(fieldName(portalModule.key, feature.key, "create")) === "on",
          canDelete: formData.get(fieldName(portalModule.key, feature.key, "delete")) === "on",
          canEdit: formData.get(fieldName(portalModule.key, feature.key, "edit")) === "on",
          canRead: formData.get(fieldName(portalModule.key, feature.key, "read")) === "on",
          projectScope: formData.get(fieldName(portalModule.key, feature.key, "scope")) === "own" ? "own" : "all",
        };
        toUpsert.push({ featureKey: feature.key, moduleKey: portalModule.key, value });
      }
    }

    await prisma.$transaction(
      toUpsert.map(({ featureKey, moduleKey, value }) =>
        prisma.portalPermission.upsert({
          create: {
            canCreate: value.canCreate,
            canDelete: value.canDelete,
            canEdit: value.canEdit,
            canRead: value.canRead,
            featureKey,
            moduleKey,
            projectScope: value.projectScope,
            roleKey,
          },
          update: {
            canCreate: value.canCreate,
            canDelete: value.canDelete,
            canEdit: value.canEdit,
            canRead: value.canRead,
            projectScope: value.projectScope,
          },
          where: { roleKey_featureKey: { featureKey, roleKey } },
        }),
      ),
    );

    revalidatePath("/admin/permissions");
    revalidatePath("/", "layout");

    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rechte konnten nicht gespeichert werden.",
      errorKey: state.errorKey + 1,
    };
  }
}

export type RoleActionState = {
  error: string | null;
  errorKey: number;
};

function slugifyRoleKey(label: string) {
  return label
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function uniqueRoleKey(label: string) {
  const base = slugifyRoleKey(label) || "rolle";
  let key = base;
  let suffix = 2;

  while (await prisma.portalRole.findUnique({ select: { id: true }, where: { key } })) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }

  return key;
}

export async function createPortalRoleAction(
  state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireAdmin();

  try {
    const label = String(formData.get("label") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!label) {
      throw new Error("Bitte einen Namen für die Rolle eingeben.");
    }

    const key = await uniqueRoleKey(label);
    const maxSortOrder = await prisma.portalRole.aggregate({ _max: { sortOrder: true } });

    await prisma.portalRole.create({
      data: {
        description: description || null,
        isBuiltIn: false,
        key,
        label,
        sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      },
    });

    revalidatePath("/admin/permissions");
    revalidatePath("/admin/users");

    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht angelegt werden.",
      errorKey: state.errorKey + 1,
    };
  }
}

export async function renamePortalRoleAction(
  state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireAdmin();

  try {
    const id = String(formData.get("id") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!id) throw new Error("Rolle wurde nicht gefunden.");
    if (!label) throw new Error("Bitte einen Namen für die Rolle eingeben.");

    await prisma.portalRole.update({
      data: { description: description || null, label },
      where: { id },
    });

    revalidatePath("/admin/permissions");
    revalidatePath("/admin/users");

    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht umbenannt werden.",
      errorKey: state.errorKey + 1,
    };
  }
}

export async function deletePortalRoleAction(
  state: RoleActionState,
  formData: FormData,
): Promise<RoleActionState> {
  await requireAdmin();

  try {
    const id = String(formData.get("id") ?? "").trim();
    const role = await prisma.portalRole.findUnique({ where: { id } });

    if (!role) throw new Error("Rolle wurde nicht gefunden.");
    if (role.isBuiltIn) {
      throw new Error("Diese Rolle ist im Portal fest verankert und kann nicht gelöscht werden.");
    }

    const usersWithRole = await prisma.user.findMany({
      select: { id: true, role: true },
      where: { role: { contains: role.key } },
    });

    await prisma.$transaction([
      prisma.portalPermission.deleteMany({ where: { roleKey: role.key } }),
      ...usersWithRole
        .filter((user) => String(user.role ?? "").split(",").map((r) => r.trim()).includes(role.key))
        .map((user) => {
          const remaining = String(user.role ?? "")
            .split(",")
            .map((r) => r.trim())
            .filter((r) => r && r !== role.key);
          return prisma.user.update({
            data: { role: remaining.join(",") || "employee" },
            where: { id: user.id },
          });
        }),
      prisma.portalRole.delete({ where: { id } }),
    ]);

    revalidatePath("/admin/permissions");
    revalidatePath("/admin/users");

    return { error: null, errorKey: state.errorKey };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht gelöscht werden.",
      errorKey: state.errorKey + 1,
    };
  }
}
