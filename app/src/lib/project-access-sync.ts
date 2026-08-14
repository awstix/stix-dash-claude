import type { Prisma } from "@prisma/client";
import { parseConstructionManagersJson } from "@/lib/construction-managers";

/** Grants every construction manager on a project view access to it (if
 * they have a linked portal account), so they see "their" sites without an
 * admin having to remember to also update Zugriffe manually. Only grants -
 * never revokes on its own, since taking access away automatically could
 * strip access an admin granted for an unrelated reason. (Revoking access
 * for a Bauleiter who was just removed is handled separately, by
 * revokeUserProjectAccessForEmployees below, and only when the admin
 * explicitly confirms it in the UI.) Admins already see every project
 * regardless (getAccessibleProjectIds returns null for them), so this only
 * matters for non-admin accounts. */
export async function syncUserProjectAccessForConstructionManagers(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { constructionManagersJson: true },
  });

  if (!project) return;

  const employeeIds = parseConstructionManagersJson(
    project.constructionManagersJson,
  )
    .map((manager) => manager.employeeId)
    .filter((id): id is string => Boolean(id));

  if (employeeIds.length === 0) return;

  const users = await tx.user.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { id: true },
  });

  for (const user of users) {
    await tx.userProjectAccess.upsert({
      where: {
        userId_projectId: {
          projectId,
          userId: user.id,
        },
      },
      create: {
        canViewProjectData: true,
        projectId,
        userId: user.id,
      },
      update: {
        canViewProjectData: true,
      },
    });
  }
}

/** The other direction: when a portal account is created for (or linked
 * to) an employee who is already listed as construction manager on
 * existing projects, grant access to those retroactively - otherwise
 * someone who was a Bauleiter before their account existed would only see
 * new projects assigned to them afterward, not the ones already on their
 * plate. */
export async function syncUserProjectAccessForEmployee(
  tx: Prisma.TransactionClient,
  employeeId: string,
) {
  const user = await tx.user.findUnique({
    where: { employeeId },
    select: { id: true },
  });

  if (!user) return;

  const projects = await tx.project.findMany({
    select: { constructionManagersJson: true, id: true },
  });

  for (const project of projects) {
    const isManager = parseConstructionManagersJson(
      project.constructionManagersJson,
    ).some((manager) => manager.employeeId === employeeId);

    if (!isManager) continue;

    await tx.userProjectAccess.upsert({
      where: {
        userId_projectId: {
          projectId: project.id,
          userId: user.id,
        },
      },
      create: {
        canViewProjectData: true,
        projectId: project.id,
        userId: user.id,
      },
      update: {
        canViewProjectData: true,
      },
    });
  }
}

/** Revokes project access previously granted to specific employees (by
 * their linked portal account, if any). Only called with the employeeIds
 * of Bauleiter that were just removed from the project's construction
 * manager list AND that the admin explicitly confirmed should also lose
 * visibility of the project - see ProjectManager.tsx's save confirmation. */
export async function revokeUserProjectAccessForEmployees(
  tx: Prisma.TransactionClient,
  projectId: string,
  employeeIds: string[],
) {
  if (employeeIds.length === 0) return;

  const users = await tx.user.findMany({
    where: { employeeId: { in: employeeIds } },
    select: { id: true },
  });

  if (users.length === 0) return;

  await tx.userProjectAccess.deleteMany({
    where: {
      projectId,
      userId: { in: users.map((user) => user.id) },
    },
  });
}
