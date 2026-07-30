import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { portalRoleLabels, portalRoles } from "@/lib/portal-roles";
import {
  approvePortalUser,
  createPortalUser,
  updateLeaveApprovalPermission,
} from "./actions";

export default async function PortalUsersPage() {
  await requireAdmin();
  const [users, employees] = await Promise.all([
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
  ]);
  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950";

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
          <form action={createPortalUser} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">
              Mitarbeiter
              <select className={inputClass} name="employeeId" required>
                <option value="">Mitarbeiter auswählen …</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.lastName}, {employee.firstName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 pt-7 text-sm font-bold">
              <input
                className="h-5 w-5 accent-gray-950"
                name="canApproveLeaveRequests"
                type="checkbox"
              />
              Darf Urlaubsanträge freigeben
            </label>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-bold">Rollen (kombinierbar)</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {portalRoles.map((role) => (
                  <label className="flex items-center gap-2 rounded-xl border border-gray-400 p-3 font-bold text-gray-950" key={role.key}>
                    <input
                      className="h-5 w-5 accent-gray-950"
                      defaultChecked={role.key === "employee"}
                      name="role"
                      type="checkbox"
                      value={role.key}
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-bold">
              E-Mail (optional)
              <input className={inputClass} name="email" type="email" />
            </label>
            <label className="text-sm font-bold">
              Startpasswort
              <input className={inputClass} minLength={10} name="password" required type="password" />
            </label>
            <p className="text-sm font-semibold text-gray-700 md:col-span-2">
              Der Benutzername entsteht automatisch aus Nachname und den ersten
              drei Buchstaben des Vornamens.
            </p>
            <button className="w-fit rounded-xl bg-gray-950 px-4 py-2.5 font-bold text-white">
              Konto anlegen
            </button>
          </form>
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
                  {portalRoleLabels(user.role).join(", ") || "Mitarbeiter"}
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
                    <span className="font-bold text-red-800">Gesperrt</span>
                  ) : (
                    <span className="font-bold text-green-800">Freigegeben</span>
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
