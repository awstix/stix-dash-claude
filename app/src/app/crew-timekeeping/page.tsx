import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getProjectScopeForUser } from "@/lib/portal-permissions";
import { getCrewTimeActivities } from "@/lib/crew-time-activities";
import { CrewTimekeepingClient } from "./CrewTimekeepingClient";

export default async function CrewTimekeepingPage({
  searchParams,
}: {
  searchParams: Promise<{ crew?: string; date?: string }>;
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
  const canPickAnyCrew =
    admin ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);

  const [ownCrews, allCrews, switchTargetProjects, activities] = await Promise.all([
    user?.employeeId
      ? prisma.crew.findMany({
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true },
          where: { isActive: true, members: { some: { employeeId: user.employeeId, isActive: true } } },
        })
      : [],
    canPickAnyCrew
      ? prisma.crew.findMany({
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true },
          where: { isActive: true },
        })
      : [],
    (async () => {
      const projectIds = [
        ...new Set((user?.projectAccesses ?? []).map((access) => access.projectId)),
      ];
      const scope = admin ? "all" : await getProjectScopeForUser(user?.role, "kolonnen_zeiterfassung");
      return prisma.project.findMany({
        orderBy: [{ projectNumber: "asc" }],
        select: { id: true, name: true, projectNumber: true },
        where: scope === "all" ? { status: "ACTIVE" } : { id: { in: projectIds }, status: "ACTIVE" },
      });
    })(),
    getCrewTimeActivities(),
  ]);

  const crewOptions = canPickAnyCrew ? allCrews : ownCrews;
  const allowedCrewIds = new Set(crewOptions.map((crew) => crew.id));
  const requestedCrewId = params.crew && allowedCrewIds.has(params.crew) ? params.crew : null;
  const selectedCrewId = requestedCrewId ?? crewOptions[0]?.id ?? null;
  const selectedCrew = crewOptions.find((crew) => crew.id === selectedCrewId) ?? null;

  const entries = selectedCrewId
    ? await prisma.crewTimeEntry.findMany({
        include: { employees: true },
        orderBy: [{ defaultStartTime: "asc" }],
        where: { crewId: selectedCrewId, workDate: day },
      })
    : [];

  const bookings = entries.map((entry) => ({
    activityLabel: entry.activityLabel,
    approvedByName: entry.approvedByName ?? "",
    crewId: entry.crewId,
    crewName: entry.crewName,
    defaultBreak1From: entry.defaultBreak1From ?? "",
    defaultBreak1To: entry.defaultBreak1To ?? "",
    defaultBreak2From: entry.defaultBreak2From ?? "",
    defaultBreak2To: entry.defaultBreak2To ?? "",
    defaultEndTime: entry.defaultEndTime,
    defaultStartTime: entry.defaultStartTime,
    employees: entry.employees.map((employee) => ({
      attendanceStatus: employee.attendanceStatus as
        | "NOT_CHECKED_IN"
        | "CHECKED_IN"
        | "BREAK"
        | "CHECKED_OUT",
      break1From: employee.break1From ?? "",
      break1To: employee.break1To ?? "",
      break2From: employee.break2From ?? "",
      break2To: employee.break2To ?? "",
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      endTime: employee.endTime,
      isPresent: employee.isPresent,
      notes: employee.notes ?? "",
      roleLabel: employee.roleLabel ?? "",
      startTime: employee.startTime,
    })),
    id: entry.id,
    notes: entry.notes ?? "",
    projectId: entry.projectId,
    projectName: entry.projectName,
    projectNumber: entry.projectNumber,
    status: entry.status,
    workDate: dateKey,
  }));

  return (
    <AppShell
      title="Kolonnen-Zeiterfassung"
      description="Baustelle wählen, Tätigkeit wählen, Start/Pause/Feierabend – für dich selbst oder deine Kolonne."
    >
      <CrewTimekeepingClient
        activities={activities.map((activity) => ({ id: activity.id, label: activity.label }))}
        bookings={bookings}
        crewOptions={crewOptions}
        myEmployeeId={user?.employeeId ?? null}
        selectedCrew={selectedCrew}
        switchTargetProjects={switchTargetProjects}
        workDate={dateKey}
      />
    </AppShell>
  );
}
