import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const roles = String(session.user.role ?? "")
    .split(",")
    .map((role) => role.trim());
  if (!roles.includes("admin")) redirect("/dashboard");
  return session;
}

export async function denyRoleUnlessAdmin(role: string) {
  const session = await requireSession();
  const roles = String(session.user.role ?? "")
    .split(",")
    .map((entry) => entry.trim());
  if (roles.includes(role) && !roles.includes("admin")) redirect("/dashboard");
  return session;
}

export async function getAccessibleProjectIds() {
  const session = await requireSession();
  const roles = String(session.user.role ?? "")
    .split(",")
    .map((role) => role.trim());
  if (roles.includes("admin")) return null;
  const accesses = await prisma.userProjectAccess.findMany({
    select: { projectId: true },
    where: {
      canViewProjectData: true,
      userId: session.user.id,
    },
  });
  return accesses.map((access) => access.projectId);
}

export async function requireProjectAccess(projectId: string) {
  const ids = await getAccessibleProjectIds();
  if (ids !== null && !ids.includes(projectId)) {
    throw new Error("Kein Zugriff auf dieses Projekt.");
  }
}

export async function requireProjectContentDeleteOwnership(
  _ownerUserId: string | null | undefined,
) {
  return requireSession();
}
