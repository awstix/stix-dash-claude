"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSession, resolveActorName } from "@/lib/auth-access";
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

// Per-user "seen" state (ChangelogEntryRead) - every logged-in user marks
// entries read/unread for themselves only, unlike the admin-only,
// portal-wide Notification.read above.

export async function markChangelogEntryRead(id: string) {
  const session = await requireSession();
  await prisma.changelogEntryRead.upsert({
    create: { entryId: id, userId: session.user.id },
    update: { readAt: new Date() },
    where: { entryId_userId: { entryId: id, userId: session.user.id } },
  });
  revalidatePath("/notifications");
}

export async function markChangelogEntryUnread(id: string) {
  const session = await requireSession();
  await prisma.changelogEntryRead
    .delete({
      where: { entryId_userId: { entryId: id, userId: session.user.id } },
    })
    .catch(() => undefined);
  revalidatePath("/notifications");
}

export async function markAllChangelogEntriesRead() {
  const session = await requireSession();
  const unreadEntries = await prisma.changelogEntry.findMany({
    select: { id: true },
    where: { reads: { none: { userId: session.user.id } } },
  });

  await prisma.changelogEntryRead.createMany({
    data: unreadEntries.map((entry) => ({
      entryId: entry.id,
      userId: session.user.id,
    })),
  });
  revalidatePath("/notifications");
}
