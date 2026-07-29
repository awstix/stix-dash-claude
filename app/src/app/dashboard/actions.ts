"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-access";
import { dashboardWidgets } from "@/lib/dashboard-widgets";
import { prisma } from "@/lib/prisma";

export async function saveDashboardWidgets(formData: FormData) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    include: { featureAccesses: { where: { canView: true } } },
    where: { id: session.user.id },
  });
  const admin = String(user?.role ?? "").split(",").includes("admin");
  const granted = new Set(user?.featureAccesses.map((access) => access.featureKey));
  const allowed = new Set(
    dashboardWidgets
      .filter((widget) => admin || granted.has(widget.key))
      .map((widget) => widget.key),
  );
  let layout: Array<{ key: string; width?: number; height?: number }> = [];
  try {
    layout = JSON.parse(String(formData.get("widgetLayout") ?? "[]"));
  } catch {
    layout = [];
  }
  const selected = layout.filter((item) => allowed.has(item.key as never));

  await prisma.$transaction([
    prisma.dashboardWidgetPreference.deleteMany({
      where: { userId: session.user.id },
    }),
    ...selected.map((item, sortOrder) =>
      prisma.dashboardWidgetPreference.create({
        data: {
          height: Math.min(6, Math.max(1, Number(item.height) || 2)),
          sortOrder,
          userId: session.user.id,
          widgetKey: item.key,
          width: Math.min(8, Math.max(1, Number(item.width) || 2)),
        },
      }),
    ),
  ]);
  revalidatePath("/dashboard");
}
