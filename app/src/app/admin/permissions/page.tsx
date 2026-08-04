import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { portalModules } from "@/lib/portal-features";
import { getPortalRoles } from "@/lib/portal-roles";
import { getPermissionsForRole } from "./actions";
import { PermissionMatrixEditor } from "./PermissionMatrixEditor";
import { RoleSidebar } from "./RoleSidebar";

export default async function PortalRolesPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const portalRoles = await getPortalRoles();
  const nonAdminRoles = portalRoles.filter((role) => role.key !== "admin");
  const selectedRole =
    portalRoles.find((role) => role.key === params.role) ?? nonAdminRoles[0] ?? portalRoles[0];

  if (!selectedRole) {
    throw new Error("Keine Rollen vorhanden.");
  }

  const permissionMap = await getPermissionsForRole(selectedRole.key);
  const initialPermissions = Object.fromEntries(permissionMap);
  const featureCount = portalModules.reduce((sum, module) => sum + module.features.length, 0);

  return (
    <AppShell
      title="Nutzerrollen"
      description={`Rechte je Portal-Rolle festlegen: Lesen, Erstellen, Bearbeiten, Löschen und Projekt-Scope für alle ${featureCount} Menüpunkte.`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/admin"
        >
          Zurück zu Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <RoleSidebar roles={portalRoles} selectedRoleKey={selectedRole.key} />

        <PermissionMatrixEditor
          initialPermissions={initialPermissions}
          key={selectedRole.key}
          roleKey={selectedRole.key}
          roleLabel={selectedRole.label}
        />
      </div>
    </AppShell>
  );
}
