import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getProjectScopeForUser } from "@/lib/portal-permissions";
import { PersonalZeitenEditDialog } from "@/app/personal/zeiten/PersonalZeitenEditDialog";
import { ApproveButton } from "./ApproveButton";
import { EditEntryDialog } from "./EditEntryDialog";
import { MoveEmployeeControl } from "./MoveEmployeeControl";
import { MoveProjectControl } from "./MoveProjectControl";

type EntryWithDetails = Prisma.CrewTimeEntryGetPayload<{
  include: { employees: true; revisions: true };
}>;
type ProjectOption = { id: string; name: string; projectNumber: string };

function statusLabel(status: string) {
  if (status === "APPROVED") return "Freigegeben";
  if (status === "SUBMITTED") return "Zur Freigabe";
  return "Entwurf";
}

export default async function CrewTimekeepingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? String(params.date)
    : new Date().toISOString().slice(0, 10);
  const day = new Date(`${dateKey}T00:00:00.000Z`);

  const user = await prisma.user.findUnique({
    include: { projectAccesses: { where: { canViewProjectData: true } } },
    where: { id: session.user.id },
  });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const admin = roles.includes("admin");
  const canApprove =
    admin ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);

  if (!canApprove) {
    return (
      <AppShell title="Stundenkontrolle" description="Freigabe der gebuchten Kolonnen-Zeiten.">
        <div className="rounded-2xl border border-gray-400 bg-white p-8 text-center font-black text-gray-950">
          Nur Bauleitung oder Admin kann Arbeitszeiten freigeben.
        </div>
      </AppShell>
    );
  }

  const projectIds = (user?.projectAccesses ?? []).map((access) => access.projectId);
  const projectScope = admin ? "all" : await getProjectScopeForUser(user?.role, "kolonnen_zeiterfassung");
  const projectOptions = await prisma.project.findMany({
    orderBy: [{ projectNumber: "asc" }],
    select: { id: true, name: true, projectNumber: true },
    where: projectScope === "all" ? { status: "ACTIVE" } : { id: { in: projectIds }, status: "ACTIVE" },
  });

  const entries = await prisma.crewTimeEntry.findMany({
    include: { employees: true, revisions: { orderBy: [{ version: "asc" }] } },
    orderBy: [{ status: "asc" }, { projectNumber: "asc" }, { crewName: "asc" }],
    where: {
      status: { in: ["SUBMITTED", "APPROVED"] },
      workDate: day,
      ...(admin ? {} : { projectId: { in: projectIds } }),
    },
  });

  const submitted = entries.filter((entry) => entry.status === "SUBMITTED");
  const approved = entries.filter((entry) => entry.status === "APPROVED");

  return (
    <AppShell title="Stundenkontrolle" description="Gebuchte Kolonnen-Zeiten prüfen und freigeben.">
      <div className="text-gray-950">
        <form className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-400 bg-white p-4">
          <label className="font-black text-gray-950">
            Arbeitstag
            <input
              className="mt-1 block rounded-lg border border-gray-500 bg-white px-3 py-2 font-bold text-gray-950"
              defaultValue={dateKey}
              name="date"
              type="date"
            />
          </label>
          <button className="rounded-lg bg-gray-950 px-4 py-2 font-black text-white">Tag anzeigen</button>
        </form>

        <h2 className="mb-3 text-lg font-black">Zur Freigabe ({submitted.length})</h2>
        <div className="space-y-4">
          {submitted.length === 0 ? (
            <div className="rounded-2xl border border-gray-300 bg-white p-6 text-center font-bold text-gray-600">
              Keine Einträge zur Freigabe.
            </div>
          ) : (
            submitted.map((entry) => <EntryCard entry={entry} key={entry.id} projectOptions={projectOptions} />)
          )}
        </div>

        {approved.length > 0 ? (
          <>
            <h2 className="mt-8 mb-3 text-lg font-black">Bereits freigegeben ({approved.length})</h2>
            <div className="space-y-4">
              {approved.map((entry) => (
                <EntryCard entry={entry} key={entry.id} projectOptions={projectOptions} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function revisionDetail(revision: EntryWithDetails["revisions"][number]) {
  if (revision.changeKind === "KORREKTUR") {
    try {
      const snapshot = JSON.parse(revision.snapshotJson) as { type?: string; note?: string } & Record<string, unknown>;
      if (snapshot.type === "PROJECT_MOVE") {
        return `Baustelle geändert: ${snapshot.fromProjectNumber} ${snapshot.fromProjectName} → ${snapshot.toProjectNumber} ${snapshot.toProjectName}`;
      }
      if (snapshot.type === "EMPLOYEE_MOVE" && snapshot.note) {
        return snapshot.note;
      }
    } catch {
      // kein bekannter Korrektur-Snapshot, generische Beschreibung unten
    }
    return "Zeiten/Angaben korrigiert";
  }
  return "Nachträglich erfasst (Nacherfassung)";
}

function EntryCard({ entry, projectOptions }: { entry: EntryWithDetails; projectOptions: ProjectOption[] }) {
  const changeRevisions = entry.revisions.filter((revision) => revision.changeKind !== "LIVE");
  const hasBackdated = changeRevisions.some((revision) => revision.changeKind === "NACHERFASSUNG");
  const hasCorrection = changeRevisions.some((revision) => revision.changeKind === "KORREKTUR");

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-400 bg-white shadow-sm">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b p-4 ${
          entry.status === "APPROVED" ? "border-green-800 bg-green-50" : "border-gray-400 bg-gray-100"
        }`}
      >
        <div>
          <h3 className="text-lg font-black">
            {entry.projectNumber} · {entry.projectName}
          </h3>
          <p className="font-bold text-gray-700">
            {entry.crewName} · {entry.activityLabel ?? "—"} · {statusLabel(entry.status)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasBackdated ? (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-900">
              ⚠ Enthält Nacherfassung
            </span>
          ) : null}
          {hasCorrection ? (
            <span className="rounded-full bg-blue-200 px-3 py-1 text-xs font-black text-blue-900">
              ✎ Manuell korrigiert
            </span>
          ) : null}
          <EditEntryDialog entryId={entry.id} />
          <MoveProjectControl entryId={entry.id} projectId={entry.projectId} projectOptions={projectOptions} />
          {entry.status === "SUBMITTED" ? <ApproveButton entryId={entry.id} /> : null}
          {entry.approvedByName ? (
            <span className="rounded-lg bg-green-800 px-3 py-2 text-sm font-black text-white">
              Freigegeben durch {entry.approvedByName}
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="p-2">Mitarbeiter</th>
              <th className="p-2">Beginn</th>
              <th className="p-2">Ende</th>
              <th className="p-2">Pause 1</th>
              <th className="p-2">Pause 2</th>
              <th className="p-2">Std.</th>
              <th className="p-2">Bemerkung</th>
              <th className="p-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {entry.employees.map((employee) => (
              <tr className="border-b border-gray-100" key={employee.id}>
                <td className="p-2 font-bold">
                  {employee.employeeName}
                  <div className="text-xs font-normal text-gray-600">{employee.roleLabel}</div>
                </td>
                <td className="p-2">{employee.startTime}</td>
                <td className="p-2">{employee.endTime}</td>
                <td className="p-2">
                  {employee.break1From && employee.break1To ? `${employee.break1From}–${employee.break1To}` : "—"}
                </td>
                <td className="p-2">
                  {employee.break2From && employee.break2To ? `${employee.break2From}–${employee.break2To}` : "—"}
                </td>
                <td className="p-2 font-bold">{employee.netHours.toLocaleString("de-DE")}</td>
                <td className="p-2 text-xs">{employee.notes ?? ""}</td>
                <td className="p-2">
                  <div className="flex flex-col items-start gap-1">
                    <PersonalZeitenEditDialog
                      employeeId={employee.employeeId}
                      entryId={entry.id}
                      trigger="Bearbeiten"
                    />
                    <MoveEmployeeControl
                      employeeId={employee.employeeId}
                      entryId={entry.id}
                      projectId={entry.projectId}
                      projectOptions={projectOptions}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {changeRevisions.length > 0 ? (
        <details className="border-t border-gray-200 p-4">
          <summary className="cursor-pointer text-xs font-black text-blue-900">Änderungsprotokoll</summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-700">
            {changeRevisions.map((revision) => (
              <li key={revision.id}>
                {new Date(revision.createdAt).toLocaleString("de-DE")} · {revision.changedByName ?? "unbekannt"} ·{" "}
                {revisionDetail(revision)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {entry.notes ? (
        <div className="border-t border-gray-200 p-4 text-sm">
          <span className="font-black">Bemerkung Kolonne: </span>
          {entry.notes}
        </div>
      ) : null}
    </section>
  );
}

