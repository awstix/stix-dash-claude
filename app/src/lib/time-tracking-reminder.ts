import { prisma } from "@/lib/prisma";
import { parseConstructionManagersJson } from "@/lib/construction-managers";
import { workTimeDayKeys, type WorkTimeDayKey } from "@/lib/work-time";

export type ReminderConfig = {
  enabled: boolean;
  intervalWeeks: number;
  weekdays: WorkTimeDayKey[];
};

const WEEK_ANCHOR = Date.UTC(2024, 0, 1); // Monday, used as a stable reference for the N-week cadence
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function parseWeekdaysJson(value: string | null | undefined): WorkTimeDayKey[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((day): day is WorkTimeDayKey =>
      workTimeDayKeys.includes(day as WorkTimeDayKey),
    );
  } catch {
    return [];
  }
}

export function resolveProjectReminderConfig(
  project: {
    timeReminderEnabledOverride: boolean | null;
    timeReminderIntervalWeeks: number | null;
    timeReminderWeekdaysJson: string | null;
  },
  global: {
    reminderEnabled: boolean;
    reminderIntervalWeeks: number;
    reminderWeekdaysJson: string;
  },
): ReminderConfig {
  return {
    enabled: project.timeReminderEnabledOverride ?? global.reminderEnabled,
    intervalWeeks: project.timeReminderIntervalWeeks ?? global.reminderIntervalWeeks,
    weekdays:
      project.timeReminderWeekdaysJson != null
        ? parseWeekdaysJson(project.timeReminderWeekdaysJson)
        : parseWeekdaysJson(global.reminderWeekdaysJson),
  };
}

function weekdayKeyForDate(date: Date): WorkTimeDayKey {
  return workTimeDayKeys[(date.getUTCDay() + 6) % 7];
}

export function isReminderDueOn(date: Date, config: Pick<ReminderConfig, "intervalWeeks" | "weekdays">) {
  if (!config.weekdays.includes(weekdayKeyForDate(date))) return false;
  const intervalWeeks = Math.max(1, config.intervalWeeks);
  if (intervalWeeks === 1) return true;
  const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const weeksSinceAnchor = Math.floor((startOfDay - WEEK_ANCHOR) / WEEK_MS / 7);
  return ((weeksSinceAnchor % intervalWeeks) + intervalWeeks) % intervalWeeks === 0;
}

async function getEmployeeEmailByName(name: string): Promise<string | null> {
  const cleanName = name.trim();
  if (!cleanName) return null;
  const employees = await prisma.employee.findMany({
    select: { email: true, firstName: true, lastName: true },
    where: { statusValue: "active" },
  });
  const match = employees.find(
    (employee) => `${employee.firstName} ${employee.lastName}`.trim().toLowerCase() === cleanName.toLowerCase(),
  );
  const email = match?.email?.trim();
  return email || null;
}

export type ResolvedConstructionManager = {
  email: string | null;
  name: string;
};

export async function getConstructionManagerEmails(project: {
  constructionManager: string | null;
  constructionManagersJson: string | null;
}): Promise<ResolvedConstructionManager[]> {
  const entries = parseConstructionManagersJson(project.constructionManagersJson);

  if (entries.length === 0) {
    // Legacy fallback for projects saved before multiple construction managers were supported.
    const legacyName = project.constructionManager?.trim();
    if (!legacyName) return [];
    return [{ email: await getEmployeeEmailByName(legacyName), name: legacyName }];
  }

  const employeeIds = entries
    .filter((entry) => entry.employeeId)
    .map((entry) => entry.employeeId as string);
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        select: { email: true, id: true },
        where: { id: { in: employeeIds } },
      })
    : [];
  const emailByEmployeeId = new Map(employees.map((employee) => [employee.id, employee.email?.trim() || null]));

  const resolved: ResolvedConstructionManager[] = [];
  for (const entry of entries) {
    const email = entry.employeeId
      ? emailByEmployeeId.get(entry.employeeId) ?? null
      : await getEmployeeEmailByName(entry.name);
    resolved.push({ email, name: entry.name });
  }
  return resolved;
}

export type PendingApprovalReminder = {
  constructionManagers: ResolvedConstructionManager[];
  extraRecipients: string[];
  pendingEntryCount: number;
  projectId: string;
  projectLabel: string;
  recipients: string[];
};

export async function collectDueApprovalReminders(referenceDate: Date): Promise<PendingApprovalReminder[]> {
  const [projects, globalSettings] = await Promise.all([
    prisma.project.findMany({
      select: {
        constructionManager: true,
        constructionManagersJson: true,
        id: true,
        name: true,
        projectNumber: true,
        timeReminderEnabledOverride: true,
        timeReminderExtraRecipientsJson: true,
        timeReminderIntervalWeeks: true,
        timeReminderWeekdaysJson: true,
      },
    }),
    getGlobalTimeTrackingSettings(),
  ]);

  const dueProjects = projects.filter((project) => {
    const config = resolveProjectReminderConfig(project, globalSettings);
    return config.enabled && config.weekdays.length > 0 && isReminderDueOn(referenceDate, config);
  });

  if (!dueProjects.length) return [];

  const pendingCounts = await prisma.crewTimeEntry.groupBy({
    _count: { _all: true },
    by: ["projectId"],
    where: {
      projectId: { in: dueProjects.map((project) => project.id) },
      status: "SUBMITTED",
    },
  });
  const pendingByProject = new Map(pendingCounts.map((row) => [row.projectId, row._count._all]));

  const reminders: PendingApprovalReminder[] = [];
  for (const project of dueProjects) {
    const pendingEntryCount = pendingByProject.get(project.id) ?? 0;
    if (pendingEntryCount === 0) continue;
    const constructionManagers = await getConstructionManagerEmails(project);
    const extraRecipients = parseRecipientsJson(project.timeReminderExtraRecipientsJson);
    const recipients = Array.from(
      new Set([
        ...constructionManagers.flatMap((manager) => (manager.email ? [manager.email] : [])),
        ...extraRecipients,
      ]),
    );
    if (!recipients.length) continue;
    reminders.push({
      constructionManagers,
      extraRecipients,
      pendingEntryCount,
      projectId: project.id,
      projectLabel: `${project.projectNumber} · ${project.name}`,
      recipients,
    });
  }
  return reminders;
}

export function parseRecipientsJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.includes("@"));
  } catch {
    return [];
  }
}

export async function getGlobalTimeTrackingSettings() {
  const settings = await prisma.timeTrackingSettings.findUnique({ where: { id: "default" } });
  if (settings) return settings;
  return prisma.timeTrackingSettings.create({ data: { id: "default" } });
}
