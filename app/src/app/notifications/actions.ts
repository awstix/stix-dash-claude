"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, resolveActorName } from "@/lib/auth-access";
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

export async function createChangelogEntry(input: {
  description: string;
  title: string;
}) {
  const session = await requireAdmin();
  const title = input.title.trim();
  if (!title) {
    throw new Error("Titel ist ein Pflichtfeld.");
  }
  const authorName = await resolveActorName();

  await prisma.changelogEntry.create({
    data: {
      authorName,
      authorUserId: session.user.id,
      description: input.description.trim() || null,
      title,
    },
  });

  revalidatePath("/notifications");
}

export async function deleteChangelogEntry(id: string) {
  await requireAdmin();
  await prisma.changelogEntry.delete({ where: { id } });
  revalidatePath("/notifications");
}

export async function markChangelogEntryRead(id: string) {
  await requireAdmin();
  await prisma.changelogEntry.update({
    data: { read: true, readAt: new Date() },
    where: { id },
  });
  revalidatePath("/notifications");
}

export async function markChangelogEntryUnread(id: string) {
  await requireAdmin();
  await prisma.changelogEntry.update({
    data: { read: false, readAt: null },
    where: { id },
  });
  revalidatePath("/notifications");
}

export async function markAllChangelogEntriesRead() {
  await requireAdmin();
  await prisma.changelogEntry.updateMany({
    data: { read: true, readAt: new Date() },
    where: { read: false },
  });
  revalidatePath("/notifications");
}
