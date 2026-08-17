import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

/** Same as resolveActorName(), but for callers that already have a session
 * in hand (e.g. Route Handlers that can't use requireSession()'s redirect()
 * - that would turn a JSON API response into a redirect to /login instead
 * of a proper 401). */
export async function resolveActorNameForSession(session: {
  user: { email: string; id: string; name: string };
}) {
  const user = await prisma.user.findUnique({
    select: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      name: true,
    },
    where: { id: session.user.id },
  });
  return (
    (user?.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`
      : user?.name) ||
    session.user.name ||
    session.user.email
  );
}

/** Current user's display name for "who did this" attribution (audit
 * trails, PDF footers, sent-email records) - prefers the linked
 * employee's name, then falls back to the account name/email. */
export async function resolveActorName() {
  const session = await requireSession();
  return resolveActorNameForSession(session);
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
