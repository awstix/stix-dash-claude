"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  await requireAdmin();
  await prisma.notification.update({
    data: { read: true, readAt: new Date() },
    where: { id },
  });
  revalidatePath("/notifications");
}

export async function markNotificationUnread(id: string) {
  await requireAdmin();
  await prisma.notification.update({
    data: { read: false, readAt: null },
    where: { id },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  await requireAdmin();
  await prisma.notification.updateMany({
    data: { read: true, readAt: new Date() },
    where: { read: false },
  });
  revalidatePath("/notifications");
}
