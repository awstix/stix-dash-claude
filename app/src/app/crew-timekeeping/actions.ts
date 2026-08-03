"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { detectCrewTimeConflicts } from "@/lib/notifications";

export type CrewTimeEmployeeInput = {
  attendanceStatus: "NOT_CHECKED_IN" | "CHECKED_IN" | "BREAK" | "CHECKED_OUT";
  break1From: string;
  break1To: string;
  break2From: string;
  break2To: string;
  employeeId: string;
  employeeName: string;
  endTime: string;
  isPresent: boolean;
  notes: string;
  roleLabel: string;
  startTime: string;
};

export type CrewTimeEntryInput = {
  crewId: string;
  crewName: string;
  defaultBreak1From: string;
  defaultBreak1To: string;
  defaultBreak2From: string;
  defaultBreak2To: string;
  defaultEndTime: string;
  defaultStartTime: string;
  employees: CrewTimeEmployeeInput[];
  notes: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  workDate: string;
};

const AUTO_APPROVED_LABEL = "Automatisch freigegeben (Kolonnen-Einstellung)";

export async function saveCrewTimeEntry(input: CrewTimeEntryInput) {
  const session = await requireSession();
  await assertProjectAccess(session.user.id, input.projectId);
  const [actor, crew, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.crew.findUnique({
      select: { autoApproveTimeEntries: true },
      where: { id: input.crewId },
    }),
    prisma.project.findUnique({
      select: { autoApproveTimeEntriesOverride: true },
      where: { id: input.projectId },
    }),
  ]);
  const actorRoles = String(actor?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const mayCorrectApproved =
    actorRoles.includes("admin") ||
    actorRoles.includes("construction_manager") ||
    actorRoles.includes("construction_management") ||
    Boolean(actor?.canApproveLeaveRequests);
  const workDate = dateValue(input.workDate);
  const actorName = session.user.name || session.user.email;
  const employees = input.employees.map((employee) => ({
    ...employee,
    attendanceStatus: employee.isPresent
      ? employee.attendanceStatus
      : "NOT_CHECKED_IN",
    break1From: optionalTime(employee.break1From),
    break1To: optionalTime(employee.break1To),
    break2From: optionalTime(employee.break2From),
    break2To: optionalTime(employee.break2To),
    endTime: requiredTime(employee.endTime, "Arbeitsende"),
    netHours: employee.isPresent ? netHours(employee) : 0,
    notes: employee.notes.trim() || null,
    roleLabel: employee.roleLabel.trim() || null,
    startTime: requiredTime(employee.startTime, "Arbeitsbeginn"),
  }));

  const autoApprove =
    project?.autoApproveTimeEntriesOverride ?? crew?.autoApproveTimeEntries ?? false;
  const presentEmployees = employees.filter((employee) => employee.isPresent);
  const dayComplete =
    presentEmployees.length > 0 &&
    presentEmployees.every((employee) => employee.attendanceStatus === "CHECKED_OUT");
  const resolvedStatus: "DRAFT" | "SUBMITTED" | "APPROVED" = !dayComplete
    ? "DRAFT"
    : autoApprove
      ? "APPROVED"
      : "SUBMITTED";

  const savedEntry = await prisma.$transaction(async (tx) => {
    const existing = await tx.crewTimeEntry.findUnique({
      include: { employees: true },
      where: {
        projectId_crewId_workDate: {
          crewId: input.crewId,
          projectId: input.projectId,
          workDate,
        },
      },
    });
    if (existing?.status === "APPROVED" && !mayCorrectApproved) {
      throw new Error(
        "Freigegebene Arbeitszeiten sind gesperrt und können nur durch Bauleitung oder Admin korrigiert werden.",
      );
    }
    const approvalData =
      resolvedStatus === "APPROVED"
        ? {
            approvedAt: new Date(),
            approvedByName: AUTO_APPROVED_LABEL,
            approvedByUserId: null,
          }
        : {
            approvedAt: null,
            approvedByName: null,
            approvedByUserId: null,
          };
    const entry = existing
      ? await tx.crewTimeEntry.update({
          data: {
            ...approvalData,
            crewName: input.crewName,
            defaultBreak1From: optionalTime(input.defaultBreak1From),
            defaultBreak1To: optionalTime(input.defaultBreak1To),
            defaultBreak2From: optionalTime(input.defaultBreak2From),
            defaultBreak2To: optionalTime(input.defaultBreak2To),
            defaultEndTime: requiredTime(input.defaultEndTime, "Arbeitsende"),
            defaultStartTime: requiredTime(input.defaultStartTime, "Arbeitsbeginn"),
            notes: input.notes.trim() || null,
            projectName: input.projectName,
            projectNumber: input.projectNumber,
            recordedByName: actorName,
            recordedByUserId: session.user.id,
            status: resolvedStatus,
            submittedAt: resolvedStatus !== "DRAFT" ? new Date() : null,
          },
          where: { id: existing.id },
        })
      : await tx.crewTimeEntry.create({
          data: {
            ...approvalData,
            crewId: input.crewId,
            crewName: input.crewName,
            defaultBreak1From: optionalTime(input.defaultBreak1From),
            defaultBreak1To: optionalTime(input.defaultBreak1To),
            defaultBreak2From: optionalTime(input.defaultBreak2From),
            defaultBreak2To: optionalTime(input.defaultBreak2To),
            defaultEndTime: requiredTime(input.defaultEndTime, "Arbeitsende"),
            defaultStartTime: requiredTime(input.defaultStartTime, "Arbeitsbeginn"),
            notes: input.notes.trim() || null,
            projectId: input.projectId,
            projectName: input.projectName,
            projectNumber: input.projectNumber,
            recordedByName: actorName,
            recordedByUserId: session.user.id,
            status: resolvedStatus,
            submittedAt: resolvedStatus !== "DRAFT" ? new Date() : null,
            workDate,
          },
        });
    await tx.crewTimeEmployee.deleteMany({ where: { entryId: entry.id } });
    if (employees.length) {
      await tx.crewTimeEmployee.createMany({
        data: employees.map((employee) => ({ ...employee, entryId: entry.id })),
      });
    }
    const version = await tx.crewTimeEntryRevision.count({
      where: { entryId: entry.id },
    });
    await tx.crewTimeEntryRevision.create({
      data: {
        changedByName: actorName,
        changedByUserId: session.user.id,
        entryId: entry.id,
        snapshotJson: JSON.stringify({ ...input, employees, status: resolvedStatus }),
        version: version + 1,
      },
    });
    return entry;
  });
  revalidateCrewTimes();
  await detectCrewTimeConflicts({
    employees,
    entryId: savedEntry.id,
    erfasserName: actorName,
    erfasserUserId: session.user.id,
    workDate,
  });
  return {
    approvedByName: savedEntry.approvedByName ?? "",
    id: savedEntry.id,
    status: savedEntry.status,
  };
}

export async function getCrewTimeEntryForEdit(entryId: string) {
  const session = await requireSession();
  const entry = await prisma.crewTimeEntry.findUnique({
    include: { employees: true },
    where: { id: entryId },
  });
  if (!entry) throw new Error("Zeiterfassung wurde nicht gefunden.");
  await assertProjectAccess(session.user.id, entry.projectId);

  const actor = await prisma.user.findUnique({ where: { id: session.user.id } });
  const actorRoles = String(actor?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const mayCorrectApproved =
    actorRoles.includes("admin") ||
    actorRoles.includes("construction_manager") ||
    actorRoles.includes("construction_management") ||
    Boolean(actor?.canApproveLeaveRequests);
  const locked = entry.status === "APPROVED" && !mayCorrectApproved;

  const input: CrewTimeEntryInput = {
    crewId: entry.crewId,
    crewName: entry.crewName,
    defaultBreak1From: entry.defaultBreak1From ?? "",
    defaultBreak1To: entry.defaultBreak1To ?? "",
    defaultBreak2From: entry.defaultBreak2From ?? "",
    defaultBreak2To: entry.defaultBreak2To ?? "",
    defaultEndTime: entry.defaultEndTime,
    defaultStartTime: entry.defaultStartTime,
    employees: entry.employees.map((employee) => ({
      attendanceStatus: employee.attendanceStatus as CrewTimeEmployeeInput["attendanceStatus"],
      break1From: employee.break1From ?? "",
      break1To: employee.break1To ?? "",
      break2From: employee.break2From ?? "",
      break2To: employee.break2To ?? "",
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      endTime: employee.endTime,
      isPresent: employee.isPresent,
      notes: employee.notes ?? "",
      roleLabel: employee.roleLabel ?? "",
      startTime: employee.startTime,
    })),
    notes: entry.notes ?? "",
    projectId: entry.projectId,
    projectName: entry.projectName,
    projectNumber: entry.projectNumber,
    workDate: entry.workDate.toISOString().slice(0, 10),
  };

  return { input, locked, status: entry.status };
}

export async function approveCrewTimeEntry(entryId: string) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canApprove =
    roles.includes("admin") ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  if (!canApprove) {
    throw new Error("Nur Bauleitung oder Admin darf Arbeitszeiten freigeben.");
  }
  const entry = await prisma.crewTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Zeiterfassung wurde nicht gefunden.");
  await assertProjectAccess(session.user.id, entry.projectId);
  const approved = await prisma.crewTimeEntry.update({
    data: {
      approvedAt: new Date(),
      approvedByName: session.user.name || session.user.email,
      approvedByUserId: session.user.id,
      status: "APPROVED",
    },
    where: { id: entryId },
  });
  revalidateCrewTimes();
  return {
    approvedByName: approved.approvedByName ?? "",
    id: approved.id,
    status: approved.status,
  };
}

async function assertProjectAccess(userId: string, projectId: string) {
  const user = await prisma.user.findUnique({
    include: { projectAccesses: true },
    where: { id: userId },
  });
  const admin = String(user?.role ?? "").split(",").includes("admin");
  if (
    !admin &&
    !(
      user?.projectAccesses.some(
        (access) => access.projectId === projectId && access.canViewProjectData,
      ) ||
      (user?.employeeId &&
        (await prisma.crewPlanningAssignment.count({
          where: {
            row: { projectId },
            OR: [
              {
                crew: {
                  members: {
                    some: { employeeId: user.employeeId, isActive: true },
                  },
                },
              },
              {
                extraEmployees: {
                  some: {
                    employeeId: user.employeeId,
                    mode: { not: "EXCLUDE" },
                  },
                },
              },
            ],
          },
        })) > 0)
    )
  ) {
    throw new Error("Kein Zugriff auf diese Baustelle.");
  }
}

function requiredTime(value: string, label: string) {
  const time = optionalTime(value);
  if (!time) throw new Error(`${label} fehlt.`);
  return time;
}

function optionalTime(value: string) {
  const clean = value.trim();
  return /^\d{2}:\d{2}$/.test(clean) ? clean : null;
}

function minutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function netHours(employee: CrewTimeEmployeeInput) {
  const start = requiredTime(employee.startTime, "Arbeitsbeginn");
  const end = requiredTime(employee.endTime, "Arbeitsende");
  let total = minutes(end) - minutes(start);
  for (const [from, to] of [
    [employee.break1From, employee.break1To],
    [employee.break2From, employee.break2To],
  ]) {
    const cleanFrom = optionalTime(from);
    const cleanTo = optionalTime(to);
    if (cleanFrom && cleanTo) total -= Math.max(0, minutes(cleanTo) - minutes(cleanFrom));
  }
  if (total < 0) throw new Error(`Arbeitsende liegt bei ${employee.employeeName} vor dem Beginn.`);
  return Math.round((total / 60) * 100) / 100;
}

function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Datum ist ungültig.");
  return new Date(`${value}T00:00:00.000Z`);
}

function revalidateCrewTimes() {
  revalidatePath("/crew-timekeeping");
  revalidatePath("/dashboard");
  revalidatePath("/projects/bautagesberichte");
  revalidatePath("/personal/zeiten");
  revalidatePath("/personal/monatskalender");
  revalidatePath("/personal/jahreskalender");
  revalidatePath("/personal/konten");
}
