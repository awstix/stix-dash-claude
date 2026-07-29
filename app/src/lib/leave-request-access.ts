import { prisma } from "@/lib/prisma";

export async function leaveApprovalScope(userId: string) {
  const user = await prisma.user.findUnique({
    include: {
      projectAccesses: {
        select: { projectId: true },
        where: { canApproveLeaveRequests: true },
      },
    },
    where: { id: userId },
  });
  if (!user) return { canApproveAll: false, projectIds: [] as string[] };
  const roles = String(user.role ?? "").split(",").map((role) => role.trim());
  return {
    canApproveAll: roles.includes("admin") || user.canApproveLeaveRequests,
    projectIds: user.projectAccesses.map((access) => access.projectId),
  };
}

export async function leaveRequestIdsInProjectScope(
  projectIds: string[],
  requests: Array<{
    id: string;
    employeeId: string;
    startDate: Date;
    endDate: Date;
  }>,
) {
  if (projectIds.length === 0 || requests.length === 0) return new Set<string>();
  const assignments = await prisma.crewPlanningAssignment.findMany({
    include: {
      crew: {
        include: {
          members: {
            select: { employeeId: true },
            where: { isActive: true },
          },
        },
      },
      extraEmployees: { select: { employeeId: true, mode: true } },
    },
    where: { row: { projectId: { in: projectIds } } },
  });
  const allowed = new Set<string>();
  for (const request of requests) {
    for (const assignment of assignments) {
      if (
        assignment.startDate > request.endDate ||
        assignment.endDate < request.startDate
      ) continue;
      const regular = assignment.crew?.members.some(
        (member) => member.employeeId === request.employeeId,
      );
      const explicit = assignment.extraEmployees.some(
        (entry) =>
          entry.employeeId === request.employeeId &&
          entry.mode.toUpperCase() !== "EXCLUDE",
      );
      const excluded = assignment.extraEmployees.some(
        (entry) =>
          entry.employeeId === request.employeeId &&
          entry.mode.toUpperCase() === "EXCLUDE",
      );
      if ((regular && !excluded) || explicit) {
        allowed.add(request.id);
        break;
      }
    }
  }
  return allowed;
}

export async function canApproveLeaveRequest(userId: string, requestId: string) {
  const scope = await leaveApprovalScope(userId);
  if (scope.canApproveAll) return true;
  const request = await prisma.leaveRequest.findUnique({
    select: { employeeId: true, endDate: true, id: true, startDate: true },
    where: { id: requestId },
  });
  if (!request) return false;
  const allowed = await leaveRequestIdsInProjectScope(scope.projectIds, [request]);
  return allowed.has(request.id);
}
