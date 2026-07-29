"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-access";
import { dashboardWidgets } from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";

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

  await prisma.$transaction([
    prisma.user.update({
      data: {
        canApproveLeaveRequests:
          formData.get("canApproveLeaveRequests") === "on",
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
