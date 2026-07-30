import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { CrewTimekeepingClient } from "./CrewTimekeepingClient";

export default async function CrewTimekeepingPage({
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
  const admin = String(user?.role ?? "").split(",").includes("admin");
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canApprove =
    admin ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  const assignedProjects = user?.employeeId
    ? await prisma.crewPlanningAssignment.findMany({
        select: { row: { select: { projectId: true } } },
        where: {
          OR: [
            { crew: { members: { some: { employeeId: user.employeeId, isActive: true } } } },
            { extraEmployees: { some: { employeeId: user.employeeId, mode: { not: "EXCLUDE" } } } },
          ],
        },
      })
    : [];
  const projectIds = [...new Set([
    ...(user?.projectAccesses.map((access) => access.projectId) ?? []),
    ...assignedProjects.flatMap((assignment) => assignment.row.projectId ? [assignment.row.projectId] : []),
  ])];
  const assignments = await prisma.crewPlanningAssignment.findMany({
    include: {
      crew: {
        include: {
          members: {
            include: {
              employee: { include: { positions: true } },
            },
            where: { isActive: true },
          },
        },
      },
      extraEmployees: {
        include: { employee: { include: { positions: true } } },
      },
      row: { include: { project: true } },
    },
    orderBy: [{ row: { projectNumber: "asc" } }, { crewName: "asc" }],
    where: {
      endDate: { gte: day },
      startDate: { lte: day },
      row: { projectId: admin ? { not: null } : { in: projectIds } },
    },
  });
  const existing = await prisma.crewTimeEntry.findMany({
    include: { employees: true },
    where: {
      workDate: day,
      ...(admin ? {} : { projectId: { in: projectIds } }),
    },
  });
  const existingByKey = new Map(existing.map((entry) => [`${entry.projectId}:${entry.crewId}`, entry]));
  const entries = assignments.flatMap((assignment) => {
    const project = assignment.row.project;
    const crew = assignment.crew;
    if (!project || !crew) return [];
    const stored = existingByKey.get(`${project.id}:${crew.id}`);
    const excluded = new Set(assignment.extraEmployees.filter((item) => item.mode === "EXCLUDE").map((item) => item.employeeId));
    const employeeMap = new Map(
      crew.members
        .filter((member) => !excluded.has(member.employeeId))
        .map((member) => [member.employeeId, {
          employeeId: member.employeeId,
          employeeName: `${member.employee.lastName}, ${member.employee.firstName}`,
          roleLabel: member.roleText || member.employee.positions[0]?.positionLabel || "",
        }]),
    );
    assignment.extraEmployees.filter((item) => item.mode !== "EXCLUDE").forEach((item) =>
      employeeMap.set(item.employeeId, {
        employeeId: item.employeeId,
        employeeName: `${item.employee.lastName}, ${item.employee.firstName}`,
        roleLabel: item.employee.positions[0]?.positionLabel || "",
      }),
    );
    const storedEmployees = new Map(stored?.employees.map((employee) => [employee.employeeId, employee]) ?? []);
    return [{
      approvedByName: stored?.approvedByName ?? "",
      crewId: crew.id,
      crewName: crew.name,
      defaultBreak1From: stored?.defaultBreak1From ?? "09:00",
      defaultBreak1To: stored?.defaultBreak1To ?? "09:15",
      defaultBreak2From: stored?.defaultBreak2From ?? "12:00",
      defaultBreak2To: stored?.defaultBreak2To ?? "12:30",
      defaultEndTime: stored?.defaultEndTime ?? assignment.endTime,
      defaultStartTime: stored?.defaultStartTime ?? assignment.startTime,
      employees: [...employeeMap.values()].map((employee) => {
        const saved = storedEmployees.get(employee.employeeId);
        return {
          ...employee,
          attendanceStatus:
            (saved?.attendanceStatus as
              | "NOT_CHECKED_IN"
              | "CHECKED_IN"
              | "BREAK"
              | "CHECKED_OUT"
              | undefined) ?? "NOT_CHECKED_IN",
          break1From: saved?.break1From ?? stored?.defaultBreak1From ?? "09:00",
          break1To: saved?.break1To ?? stored?.defaultBreak1To ?? "09:15",
          break2From: saved?.break2From ?? stored?.defaultBreak2From ?? "12:00",
          break2To: saved?.break2To ?? stored?.defaultBreak2To ?? "12:30",
          endTime: saved?.endTime ?? stored?.defaultEndTime ?? assignment.endTime,
          isPresent: saved?.isPresent ?? true,
          notes: saved?.notes ?? "",
          startTime: saved?.startTime ?? stored?.defaultStartTime ?? assignment.startTime,
        };
      }),
      id: stored?.id ?? null,
      notes: stored?.notes ?? "",
      projectId: project.id,
      projectName: project.name,
      projectNumber: project.projectNumber,
      status: stored?.status ?? "DRAFT",
      workDate: dateKey,
    }];
  });

  return (
    <AppShell title="Kolonnen-Zeiterfassung" description="Arbeitsbeginn, Arbeitsende und Pausen tablet-tauglich je Kolonne erfassen und durch die Bauleitung freigeben.">
      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-400 bg-white p-4">
        <label className="font-black text-gray-950">Arbeitstag
          <input className="mt-1 block rounded-lg border border-gray-500 bg-white px-3 py-2 font-bold text-gray-950" defaultValue={dateKey} name="date" type="date" />
        </label>
        <button className="rounded-lg bg-gray-950 px-4 py-2 font-black text-white">Tag anzeigen</button>
      </form>
      <CrewTimekeepingClient canApprove={canApprove} entries={entries} />
    </AppShell>
  );
}
