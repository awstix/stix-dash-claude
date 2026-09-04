import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { dashboardWidgets } from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";
import { getPortalRoles, parsePortalRoles } from "@/lib/portal-roles";
import { AdminSetPasswordForm } from "./AdminSetPasswordForm";
import { saveUserAccess } from "./actions";

export default async function UserAccessPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const [user, projects, portalRoles] = await Promise.all([
    prisma.user.findUnique({
      include: { featureAccesses: true, projectAccesses: true },
      where: { id: userId },
    }),
    prisma.project.findMany({
      orderBy: [{ projectNumber: "asc" }, { name: "asc" }],
      select: { id: true, name: true, projectNumber: true, status: true },
    }),
    getPortalRoles(),
  ]);
  if (!user) throw new Error("Portalkonto wurde nicht gefunden.");
  const features = new Set(
    user.featureAccesses.filter((entry) => entry.canView).map((entry) => entry.featureKey),
  );
  const assignedProjects = new Set(user.projectAccesses.map((entry) => entry.projectId));
  const assignedRoles = new Set(await parsePortalRoles(user.role));

  return (
    <AppShell
      title={`Zugriffe · ${user.name}`}
      description="Der Admin legt fest, welche Bereiche und Baustellen dieses Konto sehen und bearbeiten darf."
    >
      <p className="mb-6 font-semibold text-gray-700">
        Benutzername: <span className="font-black text-gray-950">{user.displayUsername ?? user.username ?? "—"}</span>
      </p>

      <section className="mb-6 rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
        <h2 className="text-xl font-black">Passwort</h2>
        <p className="mt-1 font-medium text-gray-700">
          Setzt sofort ein neues Passwort für dieses Konto, ohne E-Mail-Link
          - z. B. wenn der Nutzer sein Passwort nicht mehr weiß und der
          E-Mail-Versand nicht eingerichtet ist.
        </p>
        <AdminSetPasswordForm userId={user.id} />
      </section>

      <form action={saveUserAccess} className="space-y-6">
        <input name="userId" type="hidden" value={user.id} />
        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
          <h2 className="text-xl font-black">Funktionsrollen</h2>
          <p className="mt-1 font-semibold text-gray-950">
            Mehrere Rollen können kombiniert werden. Die einzelnen Bereiche
            und Baustellen werden darunter weiterhin exakt festgelegt.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {portalRoles.map((role) => (
              <label className="flex items-center gap-3 rounded-xl border border-gray-400 p-4 font-black" key={role.key}>
                <input
                  className="h-5 w-5 accent-gray-950"
                  defaultChecked={assignedRoles.has(role.key)}
                  name="role"
                  type="checkbox"
                  value={role.key}
                />
                {role.label}
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
          <h2 className="text-xl font-black">Kacheln und Bereiche</h2>
          <p className="mt-1 font-medium text-gray-700">
            Nur freigegebene Bereiche erscheinen auf dem persönlichen Dashboard.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboardWidgets.map((widget) => (
              <label className="flex gap-3 rounded-xl border border-gray-300 p-4" key={widget.key}>
                <input className="mt-1 h-5 w-5 accent-gray-950" defaultChecked={features.has(widget.key)} name="featureKey" type="checkbox" value={widget.key} />
                <span><span className="block font-black">{widget.title}</span><span className="text-sm font-medium text-gray-700">{widget.description}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
          <h2 className="text-xl font-black">Baustellenzugriff</h2>
          <p className="mt-1 font-medium text-gray-700">
            Urlaubsanträge sieht die Bauleitung nur von Mitarbeitern, die im beantragten Zeitraum auf einer dieser Baustellen eingeplant sind.
          </p>
          <label className="mt-5 flex gap-3 rounded-xl border-2 border-gray-700 p-4 font-black">
            <input className="h-5 w-5 accent-gray-950" defaultChecked={user.canApproveLeaveRequests} name="canApproveLeaveRequests" type="checkbox" />
            Globale Urlaubsfreigabe für alle Mitarbeiter (z. B. Disposition)
          </label>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {projects.map((project) => (
              <label className="flex gap-3 rounded-xl border border-gray-300 p-3 font-bold" key={project.id}>
                <input className="h-5 w-5 accent-gray-950" defaultChecked={assignedProjects.has(project.id)} name="projectId" type="checkbox" value={project.id} />
                <span>{project.projectNumber ? `${project.projectNumber} · ` : ""}{project.name}{project.status !== "ACTIVE" ? " (nicht aktiv)" : ""}</span>
              </label>
            ))}
          </div>
        </section>
        <div className="flex flex-wrap gap-3">
          <button className="rounded-xl bg-gray-950 px-5 py-3 font-black text-white">Zugriffe speichern</button>
          <Link className="rounded-xl border border-gray-500 bg-white px-5 py-3 font-black text-gray-950" href="/admin/users">Zurück</Link>
        </div>
      </form>
    </AppShell>
  );
}
