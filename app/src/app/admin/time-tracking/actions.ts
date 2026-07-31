"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { workTimeDayKeys, type WorkTimeDayKey } from "@/lib/work-time";
import { collectDueApprovalReminders } from "@/lib/time-tracking-reminder";

function readWeekdays(formData: FormData): WorkTimeDayKey[] {
  return workTimeDayKeys.filter((day) => formData.get(`weekday_${day}`) === "on");
}

function readIntervalWeeks(formData: FormData) {
  const value = Number(formData.get("intervalWeeks"));
  if (![1, 2, 3, 4].includes(value)) return 1;
  return value;
}

export async function updateTimeTrackingSettings(formData: FormData) {
  await requireAdmin();

  await prisma.timeTrackingSettings.upsert({
    create: {
      id: "default",
      reminderEnabled: formData.get("reminderEnabled") === "on",
      reminderIntervalWeeks: readIntervalWeeks(formData),
      reminderWeekdaysJson: JSON.stringify(readWeekdays(formData)),
    },
    update: {
      reminderEnabled: formData.get("reminderEnabled") === "on",
      reminderIntervalWeeks: readIntervalWeeks(formData),
      reminderWeekdaysJson: JSON.stringify(readWeekdays(formData)),
    },
    where: { id: "default" },
  });

  revalidatePath("/admin/time-tracking");
}

export type ReminderPreviewResult = {
  checkedAt: string;
  reminders: {
    constructionManagers: { email: string | null; name: string }[];
    extraRecipients: string[];
    pendingEntryCount: number;
    projectLabel: string;
    recipients: string[];
  }[];
  smtpConfigured: boolean;
};

export async function previewTimeApprovalReminders(): Promise<ReminderPreviewResult> {
  await requireAdmin();

  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  const reminders = await collectDueApprovalReminders(new Date());

  await prisma.timeTrackingSettings.upsert({
    create: { id: "default", lastReminderRunAt: new Date() },
    update: { lastReminderRunAt: new Date() },
    where: { id: "default" },
  });
  revalidatePath("/admin/time-tracking");

  return {
    checkedAt: new Date().toISOString(),
    reminders: reminders.map((reminder) => ({
      constructionManagers: reminder.constructionManagers,
      extraRecipients: reminder.extraRecipients,
      pendingEntryCount: reminder.pendingEntryCount,
      projectLabel: reminder.projectLabel,
      recipients: reminder.recipients,
    })),
    smtpConfigured,
  };
}
