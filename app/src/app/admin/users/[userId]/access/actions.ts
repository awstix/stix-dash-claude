"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";
import { dashboardWidgets } from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";
import { getPortalRoleKeys } from "@/lib/portal-roles";

export async function saveUserAccess(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Portalkonto wurde nicht gefunden.");

  const validFeatures = new Set(dashboardWidgets.map((widget) => widget.key));
  const featureKeys = formData
    .getAll("featureKey")
    .map(String)
    .filter((key) => validFeatures.has(key as never));
  const validProjects = new Set(
    (await prisma.project.findMany({ select: { id: true } })).map(
      (project) => project.id,
    ),
  );
  const projectIds = formData
    .getAll("projectId")
    .map(String)
    .filter((id) => validProjects.has(id));
  const validRoleKeys = await getPortalRoleKeys();
  const roles = formData
    .getAll("role")
    .map(String)
    .filter((role) => validRoleKeys.has(role));

  await prisma.$transaction([
    prisma.user.update({
      data: {
        canApproveLeaveRequests:
          formData.get("canApproveLeaveRequests") === "on",
        role: roles.length ? roles.join(",") : "employee",
      },
      where: { id: userId },
    }),
    prisma.userFeatureAccess.deleteMany({ where: { userId } }),
    prisma.userProjectAccess.deleteMany({ where: { userId } }),
    ...featureKeys.map((featureKey) =>
      prisma.userFeatureAccess.create({
        data: { canView: true, featureKey, userId },
      }),
    ),
    ...projectIds.map((projectId) =>
      prisma.userProjectAccess.create({
        data: {
          canApproveLeaveRequests: true,
          canViewProjectData: true,
          projectId,
          userId,
        },
      }),
    ),
  ]);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}/access`);
  revalidatePath("/dashboard");
  revalidatePath("/leave-requests");
}

/** Directly sets a new password for an existing account, bypassing the
 * email-reset-link flow entirely - for when email isn't configured, or an
 * admin just needs to hand a user a new password on the spot. Called
 * directly from the client component (not via <form action>) so the
 * caller can get the result back without a page navigation; nothing here
 * ever reads a user's own existing password (impossible anyway - only
 * the hash is stored), it only ever sets a new one the admin chose or
 * generated. */
export async function adminSetUserPassword(userId: string, newPassword: string) {
  await requireAdmin();
  if (newPassword.length < 10) {
    return { error: "Das Passwort muss mindestens 10 Zeichen lang sein." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "Portalkonto wurde nicht gefunden." };
  }

  try {
    await auth.api.setUserPassword({
      body: { newPassword, userId },
    });
  } catch {
    return { error: "Passwort konnte nicht gesetzt werden." };
  }

  return { error: null };
}
