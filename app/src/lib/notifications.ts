import { prisma } from "@/lib/prisma";
import { getEmployeeDispositionType } from "@/app/employee-dispatch/disposition-types";

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aStartMin = timeToMinutes(aStart);
  const aEndMin = timeToMinutes(aEnd);
  const bStartMin = timeToMinutes(bStart);
  const bEndMin = timeToMinutes(bEnd);
  if (aStartMin === null || aEndMin === null || bStartMin === null || bEndMin === null) {
    return false;
  }
  return aStartMin < bEndMin && bStartMin < aEndMin;
}

async function createConflictNotification({
  employeeId,
  employeeName,
  erfasserName,
  erfasserUserId,
  message,
}: {
  employeeId: string;
  employeeName: string;
  erfasserName: string;
  erfasserUserId: string;
  message: string;
}) {
  const existing = await prisma.notification.findFirst({
    select: { id: true },
    where: { employeeId, message, read: false },
  });
  if (existing) return;

  await prisma.notification.create({
    data: {
      employeeId,
      employeeName,
      erfasserName,
      erfasserUserId,
      message,
      type: "Fehler",
    },
  });
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function detectCrewTimeConflicts({
  employees,
  entryId,
  erfasserName,
  erfasserUserId,
  workDate,
}: {
  employees: {
    employeeId: string;
    employeeName: string;
    endTime: string;
    isPresent: boolean;
    startTime: string;
  }[];
  entryId: string;
  erfasserName: string;
  erfasserUserId: string;
  workDate: Date;
}) {
  const presentEmployees = employees.filter((employee) => employee.isPresent);
  if (!presentEmployees.length) return;

  const employeeIds = presentEmployees.map((employee) => employee.employeeId);
  const dateLabel = formatDateLabel(workDate);

  const [otherTimeEntries, dispositionEntries] = await Promise.all([
    prisma.crewTimeEmployee.findMany({
      select: {
        employeeId: true,
        endTime: true,
        entryId: true,
        isPresent: true,
        startTime: true,
      },
      where: {
        employeeId: { in: employeeIds },
        entry: { workDate },
      },
    }),
    prisma.employeeDispositionEntry.findMany({
      select: {
        employeeId: true,
        endTime: true,
        startTime: true,
        typeValue: true,
      },
      where: {
        employeeId: { in: employeeIds },
        startDate: { lte: workDate },
        endDate: { gte: workDate },
      },
    }),
  ]);

  for (const employee of presentEmployees) {
    const conflictingTimeEntries = otherTimeEntries.filter(
      (other) =>
        other.employeeId === employee.employeeId &&
        other.entryId !== entryId &&
        other.isPresent &&
        rangesOverlap(employee.startTime, employee.endTime, other.startTime, other.endTime),
    );
    for (const conflict of conflictingTimeEntries) {
      await createConflictNotification({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        erfasserName,
        erfasserUserId,
        message: `[${dateLabel}] Personalzeiteintrag (${employee.startTime}-${employee.endTime}) wurde erstellt. Überschneidung mit Personalzeiteintrag (${conflict.startTime}-${conflict.endTime}).`,
      });
    }

    const conflictingDispositions = dispositionEntries.filter(
      (dispo) =>
        dispo.employeeId === employee.employeeId &&
        rangesOverlap(employee.startTime, employee.endTime, dispo.startTime, dispo.endTime),
    );
    for (const conflict of conflictingDispositions) {
      const type = getEmployeeDispositionType(conflict.typeValue);
      await createConflictNotification({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        erfasserName,
        erfasserUserId,
        message: `[${dateLabel}] Personalzeiteintrag (${employee.startTime}-${employee.endTime}) wurde erstellt. Überschneidung mit ${type.label} (${conflict.startTime}-${conflict.endTime}).`,
      });
    }
  }
}
