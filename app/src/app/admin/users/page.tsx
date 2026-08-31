import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getPortalRoles } from "@/lib/portal-roles";
import { getEmailSettings, isEmailConfigured } from "@/lib/mailer";
import {
  approvePortalUser,
  setPortalUserBanned,
  updateLeaveApprovalPermission,
} from "./actions";
import { CreatePortalUserForm } from "./CreatePortalUserForm";

export default async function PortalUsersPage() {
  await requireAdmin();
  const [users, employees, portalRoles, emailSettings] = await Promise.all([
    prisma.user.findMany({
      include: { employee: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      where: {
        portalUser: null,
        statusValue: "active",
      },
    }),
    getPortalRoles(),
    getEmailSettings(),
  ]);
  const emailConfigured = isEmailConfigured(emailSettings);
  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950";

  function labelsForRoleValue(value: string | null | undefined) {
    const keys = new Set(String(value ?? "").split(",").map((role) => role.trim()));
    return portalRoles.filter((role) => keys.has(role.key)).map((role) => role.label);
  }

  return (
    <AppShell
      title="Portalbenutzer"
      description="Konten mit Mitarbeiterakten verknüpfen und Zugriffsrollen vergeben."
    >
      <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
        <details>
          <summary className="inline-flex cursor-pointer list-none rounded-xl bg-gray-950 px-4 py-2 font-bold text-white">
            + Portalkonto anlegen
          </summary>
          {!emailConfigured ? (
            <p className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
              E-Mail-Versand ist noch nicht eingerichtet - Konten bekommen
              aktuell ein von dir vergebenes Startpasswort statt einer
              Einladung.{" "}
              <Link className="underline" href="/admin/email-settings">
                Jetzt einrichten
              </Link>
            </p>
          ) : null}
          <CreatePortalUserForm
            emailConfigured={emailConfigured}
            employees={employees}
            inputClass={inputClass}
            portalRoles={portalRoles}
          />
        </details>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-300 bg-white text-gray-950 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-200 text-gray-950">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Benutzername</th>
              <th className="p-3">E-Mail</th>
              <th className="p-3">Rolle</th>
              <th className="p-3">Mitarbeiterakte</th>
              <th className="p-3">Urlaubsfreigabe</th>
              <th className="p-3">Zugriffe</th>
              <th className="p-3">Kontostatus</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="border-t border-gray-300" key={user.id}>
                <td className="p-3 font-bold">{user.name}</td>
                <td className="p-3">{user.displayUsername ?? user.username ?? "—"}</td>
                <td className="p-3">
                  {user.email.endsWith("@accounts.stix.invalid") ? "Keine E-Mail" : user.email}
                </td>
                <td className="p-3">
                  <Link className="inline-flex rounded-lg bg-gray-950 px-3 py-2 font-bold text-white" href={`/admin/users/${user.id}/access`}>
                    Verwalten
                  </Link>
                </td>
                <td className="p-3 font-bold">
                  {labelsForRoleValue(user.role).join(", ") || "Mitarbeiter"}
                </td>
                <td className="p-3">
                  {user.employee
                    ? `${user.employee.lastName}, ${user.employee.firstName}`
                    : "Nicht verknüpft"}
                </td>
                <td className="p-3">
                  <form action={updateLeaveApprovalPermission}>
                    <input name="id" type="hidden" value={user.id} />
                    <label className="flex items-center gap-2 font-bold">
                      <input
                        className="h-5 w-5 accent-gray-950"
                        defaultChecked={user.canApproveLeaveRequests}
                        name="canApproveLeaveRequests"
                        type="checkbox"
                      />
                      Freigeben
                    </label>
                    <button className="mt-2 rounded-lg border border-gray-500 bg-white px-3 py-1.5 text-xs font-bold">
                      Speichern
                    </button>
                  </form>
                </td>
                <td className="p-3">
                  {user.banned && user.banReason === "REGISTRATION_PENDING" ? (
                    <form action={approvePortalUser}>
                      <input name="id" type="hidden" value={user.id} />
                      <div className="font-bold text-amber-950">
                        Freigabe ausstehend
                      </div>
                      <button className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white">
                        Konto freigeben
                      </button>
                    </form>
                  ) : user.banned ? (
                    <form action={setPortalUserBanned}>
                      <input name="id" type="hidden" value={user.id} />
                      <input name="banned" type="hidden" value="false" />
                      <div className="font-bold text-red-800">Gesperrt</div>
                      <button className="mt-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white">
                        Entsperren
                      </button>
                    </form>
                  ) : (
                    <form action={setPortalUserBanned}>
                      <input name="id" type="hidden" value={user.id} />
                      <input name="banned" type="hidden" value="true" />
                      <div className="font-bold text-green-800">Freigegeben</div>
                      <button className="mt-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">
                        Sperren
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
