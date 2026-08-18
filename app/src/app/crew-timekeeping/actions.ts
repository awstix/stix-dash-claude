"use server";
import type { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { detectCrewTimeConflicts } from "@/lib/notifications";
import { getProjectScopeForUser } from "@/lib/portal-permissions";

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
  activityLabel: string | null;
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

export type ChangeKind = "LIVE" | "NACHERFASSUNG" | "KORREKTUR";

export async function saveCrewTimeEntry(input: CrewTimeEntryInput, changeKind: ChangeKind = "LIVE") {
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
  const resolvedStatus = resolveEntryStatus(employees, autoApprove);

  const savedEntry = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
            activityLabel: input.activityLabel,
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
            activityLabel: input.activityLabel,
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
        changeKind,
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
    activityLabel: entry.activityLabel ?? null,
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

  return {
    input,
    lastChangedAt: entry.updatedAt.toISOString(),
    lastChangedByName: entry.recordedByName,
    locked,
    status: entry.status,
  };
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

/** Schreibt einen bestehenden Kolonnen-Eintrag komplett auf eine andere
 * Baustelle um (Korrektur durch Bauleitung/Admin in der Stundenkontrolle –
 * "war fälschlich auf Baustelle A gebucht, gehört auf Baustelle B"). Ändert
 * die Baustelle am selben Eintrag (gleiche id), damit die komplette
 * Revisions-Historie erhalten bleibt, und protokolliert den Wechsel als
 * eigene Revision (changeKind "KORREKTUR"). */
export async function moveEntryToProject(input: { entryId: string; toProjectId: string }) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canCorrect =
    roles.includes("admin") ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  if (!canCorrect) {
    throw new Error("Nur Bauleitung oder Admin darf Buchungen auf eine andere Baustelle umschreiben.");
  }

  const entry = await prisma.crewTimeEntry.findUnique({ where: { id: input.entryId } });
  if (!entry) throw new Error("Zeiterfassung wurde nicht gefunden.");
  if (entry.projectId === input.toProjectId) {
    throw new Error("Die Buchung ist bereits auf dieser Baustelle.");
  }
  await assertProjectAccess(session.user.id, entry.projectId);
  await assertProjectAccess(session.user.id, input.toProjectId);

  const toProject = await prisma.project.findUnique({
    select: { id: true, name: true, projectNumber: true },
    where: { id: input.toProjectId },
  });
  if (!toProject) throw new Error("Zielbaustelle wurde nicht gefunden.");

  const conflict = await prisma.crewTimeEntry.findUnique({
    where: {
      projectId_crewId_workDate: {
        crewId: entry.crewId,
        projectId: input.toProjectId,
        workDate: entry.workDate,
      },
    },
  });
  if (conflict) {
    throw new Error(
      "Für diese Kolonne existiert an diesem Tag bereits eine Buchung auf der Zielbaustelle. Bitte die beiden Buchungen manuell zusammenführen.",
    );
  }

  const actorName = session.user.name || session.user.email;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.crewTimeEntry.update({
      data: {
        projectId: toProject.id,
        projectName: toProject.name,
        projectNumber: toProject.projectNumber,
      },
      where: { id: entry.id },
    });
    const version = await tx.crewTimeEntryRevision.count({ where: { entryId: entry.id } });
    await tx.crewTimeEntryRevision.create({
      data: {
        changeKind: "KORREKTUR",
        changedByName: actorName,
        changedByUserId: session.user.id,
        entryId: entry.id,
        snapshotJson: JSON.stringify({
          fromProjectName: entry.projectName,
          fromProjectNumber: entry.projectNumber,
          toProjectId: toProject.id,
          toProjectName: toProject.name,
          toProjectNumber: toProject.projectNumber,
          type: "PROJECT_MOVE",
        }),
        version: version + 1,
      },
    });
  });

  revalidateCrewTimes();
}

/** Bucht einzelne Mitglieder einer Kolonnenbuchung nachträglich auf eine
 * andere Baustelle um (Korrektur in der Stundenkontrolle) – ohne Zeiten zu
 * verändern, nur die Zuordnung. Die übrigen Mitarbeiter des Ursprungs-
 * Eintrags bleiben unberührt. Existiert am Ziel-Eintrag bereits einer der
 * gewählten Mitarbeiter, bricht die Aktion mit einer Fehlermeldung ab statt
 * Daten stillschweigend zu überschreiben. */
export async function moveEmployeesToProject(input: {
  employeeIds: string[];
  entryId: string;
  toProjectId: string;
}) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canCorrect =
    roles.includes("admin") ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  if (!canCorrect) {
    throw new Error("Nur Bauleitung oder Admin darf Mitarbeiter auf eine andere Baustelle umbuchen.");
  }
  if (!input.employeeIds.length) {
    throw new Error("Kein Mitarbeiter ausgewählt.");
  }

  const entry = await prisma.crewTimeEntry.findUnique({
    include: { employees: true },
    where: { id: input.entryId },
  });
  if (!entry) throw new Error("Zeiterfassung wurde nicht gefunden.");
  if (entry.projectId === input.toProjectId) {
    throw new Error("Die Zielbaustelle entspricht der aktuellen Baustelle.");
  }
  await assertProjectAccess(session.user.id, entry.projectId);
  await assertProjectAccess(session.user.id, input.toProjectId);

  const movedEmployees = entry.employees.filter((employee) => input.employeeIds.includes(employee.employeeId));
  if (!movedEmployees.length) {
    throw new Error("Die ausgewählten Mitarbeiter gehören nicht zu diesem Eintrag.");
  }

  const toProject = await prisma.project.findUnique({
    select: { id: true, name: true, projectNumber: true },
    where: { id: input.toProjectId },
  });
  if (!toProject) throw new Error("Zielbaustelle wurde nicht gefunden.");

  const actorName = session.user.name || session.user.email;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const toEntryExisting = await tx.crewTimeEntry.findUnique({
      include: { employees: true },
      where: {
        projectId_crewId_workDate: {
          crewId: entry.crewId,
          projectId: input.toProjectId,
          workDate: entry.workDate,
        },
      },
    });
    const existingToEmployeeIds = new Set(
      (toEntryExisting?.employees ?? []).map((employee) => employee.employeeId),
    );
    const alreadyThere = movedEmployees.filter((employee) => existingToEmployeeIds.has(employee.employeeId));
    if (alreadyThere.length) {
      throw new Error(
        `${alreadyThere.map((employee) => employee.employeeName).join(", ")} ${
          alreadyThere.length === 1 ? "ist" : "sind"
        } auf der Zielbaustelle an diesem Tag bereits erfasst.`,
      );
    }

    const toEntry =
      toEntryExisting ??
      (await tx.crewTimeEntry.create({
        data: {
          crewId: entry.crewId,
          crewName: entry.crewName,
          defaultBreak1From: entry.defaultBreak1From,
          defaultBreak1To: entry.defaultBreak1To,
          defaultBreak2From: entry.defaultBreak2From,
          defaultBreak2To: entry.defaultBreak2To,
          defaultEndTime: entry.defaultEndTime,
          defaultStartTime: entry.defaultStartTime,
          projectId: toProject.id,
          projectName: toProject.name,
          projectNumber: toProject.projectNumber,
          recordedByName: actorName,
          recordedByUserId: session.user.id,
          status: "DRAFT",
          workDate: entry.workDate,
        },
      }));

    for (const employee of movedEmployees) {
      await tx.crewTimeEmployee.create({
        data: {
          attendanceStatus: employee.attendanceStatus,
          break1From: employee.break1From,
          break1To: employee.break1To,
          break2From: employee.break2From,
          break2To: employee.break2To,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          endTime: employee.endTime,
          entryId: toEntry.id,
          isPresent: employee.isPresent,
          netHours: employee.netHours,
          notes: employee.notes,
          roleLabel: employee.roleLabel,
          startTime: employee.startTime,
        },
      });
      await tx.crewTimeEmployee.delete({ where: { id: employee.id } });
    }

    if (toEntryExisting && toEntryExisting.status !== "DRAFT") {
      await tx.crewTimeEntry.update({
        data: { status: "DRAFT", submittedAt: null },
        where: { id: toEntry.id },
      });
    }

    const movedNames = movedEmployees.map((employee) => employee.employeeName).join(", ");
    for (const [affectedEntryId, note] of [
      [entry.id, `Mitarbeiter umgebucht zu ${toProject.projectNumber} ${toProject.name}: ${movedNames}`],
      [toEntry.id, `Mitarbeiter übernommen von ${entry.projectNumber} ${entry.projectName}: ${movedNames}`],
    ] as const) {
      const version = await tx.crewTimeEntryRevision.count({ where: { entryId: affectedEntryId } });
      await tx.crewTimeEntryRevision.create({
        data: {
          changeKind: "KORREKTUR",
          changedByName: actorName,
          changedByUserId: session.user.id,
          entryId: affectedEntryId,
          snapshotJson: JSON.stringify({
            employeeIds: input.employeeIds,
            fromProjectId: entry.projectId,
            note,
            toProjectId: toProject.id,
            type: "EMPLOYEE_MOVE",
          }),
          version: version + 1,
        },
      });
    }
  });

  revalidateCrewTimes();
}

/** Entfernt einen einzelnen fälschlich gebuchten Mitarbeiter aus einem
 * Kolonnen-Zeiteintrag (Stundenkontrolle) - z.B. wenn jemand versehentlich
 * mitgebucht wurde. Löscht nur die Zeile für diesen Mitarbeiter, der
 * restliche Eintrag bleibt bestehen. */
export async function deleteCrewTimeEmployee(input: { employeeId: string; entryId: string }) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canCorrect =
    roles.includes("admin") ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  if (!canCorrect) {
    throw new Error("Nur Bauleitung oder Admin darf gebuchte Stunden löschen.");
  }

  const employee = await prisma.crewTimeEmployee.findUnique({
    include: { entry: true },
    where: { id: input.employeeId },
  });
  if (!employee || employee.entryId !== input.entryId) {
    throw new Error("Der Mitarbeiter-Eintrag wurde nicht gefunden.");
  }
  await assertProjectAccess(session.user.id, employee.entry.projectId);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.crewTimeEmployee.delete({ where: { id: employee.id } });

    const version = await tx.crewTimeEntryRevision.count({ where: { entryId: input.entryId } });
    await tx.crewTimeEntryRevision.create({
      data: {
        changeKind: "KORREKTUR",
        changedByName: session.user.name || session.user.email,
        changedByUserId: session.user.id,
        entryId: input.entryId,
        snapshotJson: JSON.stringify({
          employeeName: employee.employeeName,
          note: `Buchung gelöscht: ${employee.employeeName} (${employee.startTime}–${employee.endTime})`,
          type: "EMPLOYEE_DELETE",
        }),
        version: version + 1,
      },
    });
  });

  revalidateCrewTimes();
}

/** Löscht einen kompletten Kolonnen-Zeiteintrag (alle Mitarbeiter des Tages
 * für diese Kolonne/Baustelle) - z.B. wenn eine ganze Buchung fälschlich
 * angelegt wurde. Unwiderruflich, daher nur Bauleitung/Admin. */
export async function deleteCrewTimeEntry(entryId: string) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const roles = String(user?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const canCorrect =
    roles.includes("admin") ||
    roles.includes("construction_manager") ||
    roles.includes("construction_management") ||
    Boolean(user?.canApproveLeaveRequests);
  if (!canCorrect) {
    throw new Error("Nur Bauleitung oder Admin darf gebuchte Stunden löschen.");
  }

  const entry = await prisma.crewTimeEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new Error("Zeiterfassung wurde nicht gefunden.");
  await assertProjectAccess(session.user.id, entry.projectId);

  await prisma.crewTimeEntry.delete({ where: { id: entryId } });

  revalidateCrewTimes();
}

export type BookableEmployee = {
  bookedElsewhere: boolean;
  employeeId: string;
  employeeName: string;
  roleLabel: string;
  selected: boolean;
};

/** Liefert die für eine Kolonnen-Buchung wählbaren Mitarbeiter, getrennt in
 * "eigene Kolonne" (oben) und "freie Mitarbeiter" (unten) – vorausgewählt
 * ist entweder die gemerkte Team-Zusammenstellung (CrewTeamPreference) oder,
 * falls keine gespeichert ist, die reguläre Kolonnen-Besetzung. Mitarbeiter,
 * die heute in einer ANDEREN Kolonne bereits angemeldet/in Pause sind,
 * werden als bookedElsewhere markiert (in der UI ausgegraut). */
export async function getBookableEmployees(input: { crewId: string; workDate: string }) {
  await requireSession();
  const workDate = dateValue(input.workDate);
  const crew = await prisma.crew.findUnique({
    include: {
      members: {
        include: { employee: { include: { positions: true } } },
        where: { isActive: true },
      },
      teamPreference: { include: { members: true } },
    },
    where: { id: input.crewId },
  });
  if (!crew) throw new Error("Kolonne wurde nicht gefunden.");

  const preferredIds = crew.teamPreference
    ? new Set(crew.teamPreference.members.map((member) => member.employeeId))
    : null;
  const crewMemberIds = new Set(crew.members.map((member) => member.employeeId));
  const roleLabelByEmployeeId = new Map(
    crew.members.map((member) => [member.employeeId, member.roleText || ""]),
  );

  const allActiveEmployees = await prisma.employee.findMany({
    include: { positions: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    where: { statusValue: "active" },
  });
  const bookedElsewhere = await bookedElsewhereSet(
    allActiveEmployees.map((employee) => employee.id),
    workDate,
    crew.id,
  );

  function toOption(employee: (typeof allActiveEmployees)[number]): BookableEmployee {
    return {
      bookedElsewhere: bookedElsewhere.has(employee.id),
      employeeId: employee.id,
      employeeName: `${employee.lastName}, ${employee.firstName}`,
      roleLabel: roleLabelByEmployeeId.get(employee.id) || employee.positions[0]?.positionLabel || "",
      selected: preferredIds ? preferredIds.has(employee.id) : crewMemberIds.has(employee.id),
    };
  }

  return {
    crewMembers: allActiveEmployees.filter((employee) => crewMemberIds.has(employee.id)).map(toOption),
    otherEmployees: allActiveEmployees.filter((employee) => !crewMemberIds.has(employee.id)).map(toOption),
  };
}

async function bookedElsewhereSet(employeeIds: string[], workDate: Date, excludeCrewId: string) {
  if (!employeeIds.length) return new Set<string>();
  const rows = await prisma.crewTimeEmployee.findMany({
    select: { employeeId: true },
    where: {
      attendanceStatus: { in: ["CHECKED_IN", "BREAK"] },
      employeeId: { in: employeeIds },
      entry: { crewId: { not: excludeCrewId }, workDate },
      isPresent: true,
    },
  });
  return new Set(rows.map((row) => row.employeeId));
}

/** Speichert die vom Polier selbst zusammengestellte Kolonnen-Besetzung
 * ("Team zusammenstellen") dauerhaft für künftige Buchungen dieser Kolonne. */
export async function saveCrewTeamPreference(input: { crewId: string; employeeIds: string[] }) {
  await requireSession();
  const crew = await prisma.crew.findUnique({ select: { id: true }, where: { id: input.crewId } });
  if (!crew) throw new Error("Kolonne wurde nicht gefunden.");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const preference = await tx.crewTeamPreference.upsert({
      create: { crewId: input.crewId },
      update: {},
      where: { crewId: input.crewId },
    });
    await tx.crewTeamPreferenceMember.deleteMany({ where: { preferenceId: preference.id } });
    if (input.employeeIds.length) {
      await tx.crewTeamPreferenceMember.createMany({
        data: input.employeeIds.map((employeeId) => ({ employeeId, preferenceId: preference.id })),
      });
    }
  });

  revalidatePath("/crew-timekeeping");
}

/** Bucht eine Kolonne (oder eine Auswahl daraus, z. B. nur den Polier
 * selbst) auf eine frei gewählte Baustelle + Tätigkeit. Ergänzt eine
 * eventuell bereits laufende Buchung derselben Kolonne/Baustelle/Tag statt
 * sie zu überschreiben. Im Modus "NACHERFASSUNG" wird ein abgeschlossener
 * Zeitraum (Von/Bis) statt einer laufenden Buchung eingetragen. */
export async function startBooking(input: {
  activityId: string;
  crewId: string;
  employeeIds: string[];
  endTime?: string;
  mode: "LIVE" | "NACHERFASSUNG";
  projectId: string;
  startTime: string;
  workDate: string;
}) {
  const session = await requireSession();
  await assertSwitchTargetAccess(session.user.id, input.projectId);
  if (!input.employeeIds.length) {
    throw new Error("Kein Mitarbeiter ausgewählt.");
  }

  const [crew, project, activity] = await Promise.all([
    prisma.crew.findUnique({
      include: { members: { include: { employee: { include: { positions: true } } } } },
      where: { id: input.crewId },
    }),
    prisma.project.findUnique({
      select: { id: true, name: true, projectNumber: true },
      where: { id: input.projectId },
    }),
    prisma.crewTimeActivity.findUnique({ where: { id: input.activityId } }),
  ]);
  if (!crew) throw new Error("Kolonne wurde nicht gefunden.");
  if (!project) throw new Error("Baustelle wurde nicht gefunden.");

  const isBackdated = input.mode === "NACHERFASSUNG";
  const startTime = requiredTime(input.startTime, "Beginn");
  const endTime = isBackdated ? requiredTime(input.endTime ?? "", "Ende") : "17:00";
  if (isBackdated && minutes(endTime) <= minutes(startTime)) {
    throw new Error("Ende muss nach dem Beginn liegen.");
  }

  const memberByEmployeeId = new Map(crew.members.map((member) => [member.employeeId, member]));
  const missingEmployeeIds = input.employeeIds.filter((id) => !memberByEmployeeId.has(id));
  const extraEmployees = missingEmployeeIds.length
    ? await prisma.employee.findMany({
        include: { positions: true },
        where: { id: { in: missingEmployeeIds } },
      })
    : [];
  const extraByEmployeeId = new Map(extraEmployees.map((employee) => [employee.id, employee]));

  const bookedEmployees: CrewTimeEmployeeInput[] = input.employeeIds.map((employeeId) => {
    const member = memberByEmployeeId.get(employeeId);
    const employee = member?.employee ?? extraByEmployeeId.get(employeeId);
    if (!employee) throw new Error("Mitarbeiter wurde nicht gefunden.");
    return {
      attendanceStatus: isBackdated ? "CHECKED_OUT" : "CHECKED_IN",
      break1From: "",
      break1To: "",
      break2From: "",
      break2To: "",
      employeeId,
      employeeName: `${employee.lastName}, ${employee.firstName}`,
      endTime,
      isPresent: true,
      notes: "",
      roleLabel: member?.roleText || employee.positions[0]?.positionLabel || "",
      startTime,
    };
  });

  // Eine eventuell schon laufende Buchung derselben Kolonne/Baustelle/Tag
  // ergänzen statt überschreiben (saveCrewTimeEntry ersetzt sonst die
  // komplette Mitarbeiterliste des Eintrags).
  const existingEntry = await prisma.crewTimeEntry.findUnique({
    include: { employees: true },
    where: {
      projectId_crewId_workDate: {
        crewId: crew.id,
        projectId: project.id,
        workDate: dateValue(input.workDate),
      },
    },
  });
  const bookedEmployeeIds = new Set(bookedEmployees.map((employee) => employee.employeeId));
  const untouchedEmployees: CrewTimeEmployeeInput[] = (existingEntry?.employees ?? [])
    .filter((employee) => !bookedEmployeeIds.has(employee.employeeId))
    .map((employee) => ({
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
    }));

  return saveCrewTimeEntry(
    {
      activityLabel: activity?.label ?? existingEntry?.activityLabel ?? null,
      crewId: crew.id,
      crewName: crew.name,
      defaultBreak1From: existingEntry?.defaultBreak1From ?? "09:00",
      defaultBreak1To: existingEntry?.defaultBreak1To ?? "09:15",
      defaultBreak2From: existingEntry?.defaultBreak2From ?? "12:00",
      defaultBreak2To: existingEntry?.defaultBreak2To ?? "12:30",
      defaultEndTime: existingEntry?.defaultEndTime ?? endTime,
      defaultStartTime: existingEntry?.defaultStartTime ?? startTime,
      employees: [...untouchedEmployees, ...bookedEmployees],
      notes: existingEntry?.notes ?? "",
      projectId: project.id,
      projectName: project.name,
      projectNumber: project.projectNumber,
      workDate: input.workDate,
    },
    isBackdated ? "NACHERFASSUNG" : "LIVE",
  );
}

/** Bucht einzelne oder alle anwesenden Mitarbeiter einer Kolonne ab dem
 * angegebenen Zeitpunkt auf eine andere Baustelle um: der bisherige Eintrag
 * wird ganz normal (wie beim Speichern-Button) angelegt bzw. aktualisiert,
 * wobei die wechselnden Mitarbeiter darin bereits als Feierabend=switchTime
 * eingetragen sind – das funktioniert also auch, wenn die Kolonne für diesen
 * Tag noch nie gespeichert wurde. Im Ziel-Eintrag (gleiche Kolonne, gleicher
 * Tag, neues Projekt) werden sie mit Kommen=switchTime angemeldet; der
 * Ziel-Eintrag wird bei Bedarf neu angelegt – dieselbe Kolonne kann so am
 * selben Tag mehrere Projekt-Einträge haben. */
export async function switchEmployeeProject(input: {
  activityId: string;
  employeeIds: string[];
  entry: CrewTimeEntryInput;
  switchTime: string;
  toProjectId: string;
}) {
  const session = await requireSession();
  if (input.entry.projectId === input.toProjectId) {
    throw new Error("Die Zielbaustelle muss sich von der aktuellen Baustelle unterscheiden.");
  }
  if (!input.employeeIds.length) {
    throw new Error("Kein Mitarbeiter für den Baustellenwechsel ausgewählt.");
  }
  await assertSwitchTargetAccess(session.user.id, input.toProjectId);

  const switching = new Set(input.employeeIds);
  const movedEmployees = input.entry.employees.filter(
    (employee) => switching.has(employee.employeeId) && employee.isPresent,
  );
  if (!movedEmployees.length) {
    throw new Error("Die ausgewählten Mitarbeiter sind auf der aktuellen Baustelle nicht angemeldet.");
  }

  const [toProject, activity] = await Promise.all([
    prisma.project.findUnique({
      select: { id: true, name: true, projectNumber: true },
      where: { id: input.toProjectId },
    }),
    prisma.crewTimeActivity.findUnique({ where: { id: input.activityId } }),
  ]);
  if (!toProject) throw new Error("Zielbaustelle wurde nicht gefunden.");

  const switchTime = requiredTime(input.switchTime, "Wechselzeitpunkt");
  const switchNoteToTarget = `→ Wechsel zu ${toProject.projectNumber} ${toProject.name} (${switchTime} Uhr)`;
  const switchNoteFromSource = `← Übernommen von ${input.entry.projectNumber} ${input.entry.projectName} (${switchTime} Uhr)`;

  const savedFromEntry = await saveCrewTimeEntry({
    ...input.entry,
    employees: input.entry.employees.map((employee) =>
      switching.has(employee.employeeId) && employee.isPresent
        ? {
            ...employee,
            attendanceStatus: "CHECKED_OUT",
            endTime: switchTime,
            notes: appendNote(employee.notes, switchNoteToTarget),
          }
        : employee,
    ),
  });

  const actor = await prisma.user.findUnique({ where: { id: session.user.id } });
  const actorName = session.user.name || session.user.email;
  const actorRoles = String(actor?.role ?? "")
    .split(",")
    .map((role) => role.trim());
  const mayCorrectApproved =
    actorRoles.includes("admin") ||
    actorRoles.includes("construction_manager") ||
    actorRoles.includes("construction_management") ||
    Boolean(actor?.canApproveLeaveRequests);
  const workDate = dateValue(input.entry.workDate);
  const defaultEndTime = requiredTime(input.entry.defaultEndTime, "Arbeitsende");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const toEntryExisting = await tx.crewTimeEntry.findUnique({
      include: { employees: true },
      where: {
        projectId_crewId_workDate: {
          crewId: input.entry.crewId,
          projectId: input.toProjectId,
          workDate,
        },
      },
    });
    if (toEntryExisting?.status === "APPROVED" && !mayCorrectApproved) {
      throw new Error("Die Zeiten auf der Zielbaustelle sind für diesen Tag bereits freigegeben.");
    }

    const toEntry =
      toEntryExisting ??
      (await tx.crewTimeEntry.create({
        data: {
          activityLabel: activity?.label ?? null,
          crewId: input.entry.crewId,
          crewName: input.entry.crewName,
          defaultBreak1From: optionalTime(input.entry.defaultBreak1From),
          defaultBreak1To: optionalTime(input.entry.defaultBreak1To),
          defaultBreak2From: optionalTime(input.entry.defaultBreak2From),
          defaultBreak2To: optionalTime(input.entry.defaultBreak2To),
          defaultEndTime,
          defaultStartTime: switchTime,
          projectId: toProject.id,
          projectName: toProject.name,
          projectNumber: toProject.projectNumber,
          recordedByName: actorName,
          recordedByUserId: session.user.id,
          status: "DRAFT",
          workDate,
        },
      }));
    if (toEntryExisting && activity) {
      await tx.crewTimeEntry.update({
        data: { activityLabel: activity.label },
        where: { id: toEntry.id },
      });
    }
    const existingToEmployees = new Map(
      (toEntryExisting?.employees ?? []).map((employee) => [employee.employeeId, employee]),
    );
    for (const employee of movedEmployees) {
      const existingToEmployee = existingToEmployees.get(employee.employeeId);
      if (existingToEmployee) {
        await tx.crewTimeEmployee.update({
          data: {
            attendanceStatus: "CHECKED_IN",
            break1From: null,
            break1To: null,
            break2From: null,
            break2To: null,
            endTime: defaultEndTime,
            isPresent: true,
            netHours: 0,
            notes: appendNote(existingToEmployee.notes, switchNoteFromSource),
            startTime: switchTime,
          },
          where: { id: existingToEmployee.id },
        });
      } else {
        await tx.crewTimeEmployee.create({
          data: {
            attendanceStatus: "CHECKED_IN",
            employeeId: employee.employeeId,
            employeeName: employee.employeeName,
            endTime: defaultEndTime,
            entryId: toEntry.id,
            isPresent: true,
            netHours: 0,
            notes: switchNoteFromSource,
            roleLabel: employee.roleLabel.trim() || null,
            startTime: switchTime,
          },
        });
      }
    }
    if (toEntryExisting && toEntryExisting.status !== "DRAFT") {
      await tx.crewTimeEntry.update({
        data: { status: "DRAFT", submittedAt: null },
        where: { id: toEntry.id },
      });
    }
  });

  revalidateCrewTimes();
  return savedFromEntry;
}

function appendNote(existing: string | null | undefined, addition: string) {
  const trimmed = (existing ?? "").trim();
  return trimmed ? `${trimmed} · ${addition}` : addition;
}

function resolveEntryStatus(
  employees: { attendanceStatus: CrewTimeEmployeeInput["attendanceStatus"]; isPresent: boolean }[],
  autoApprove: boolean,
): "DRAFT" | "SUBMITTED" | "APPROVED" {
  const presentEmployees = employees.filter((employee) => employee.isPresent);
  const dayComplete =
    presentEmployees.length > 0 &&
    presentEmployees.every((employee) => employee.attendanceStatus === "CHECKED_OUT");
  if (!dayComplete) return "DRAFT";
  return autoApprove ? "APPROVED" : "SUBMITTED";
}

/** Prüft Zugriff auf eine Ziel-Baustelle beim Buchen/Baustellenwechsel: bei
 * Projekt-Scope "alle aktiven" (siehe Nutzerrollen-Rechte-Matrix) genügt
 * eine aktive Baustelle, sonst gilt dieselbe Zugriffsprüfung wie sonst auch. */
async function assertSwitchTargetAccess(userId: string, projectId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const admin = String(user?.role ?? "").split(",").includes("admin");
  if (admin) return;
  const scope = await getProjectScopeForUser(user?.role, "kolonnen_zeiterfassung");
  if (scope === "all") {
    const project = await prisma.project.findUnique({ select: { status: true }, where: { id: projectId } });
    if (project?.status !== "ACTIVE") {
      throw new Error("Zielbaustelle ist nicht aktiv.");
    }
    return;
  }
  await assertProjectAccess(userId, projectId);
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
  revalidatePath("/crew-timekeeping/freigabe");
  revalidatePath("/dashboard");
  revalidatePath("/projects/bautagesberichte");
  revalidatePath("/personal/zeiten");
  revalidatePath("/personal/monatskalender");
  revalidatePath("/personal/jahreskalender");
  revalidatePath("/personal/konten");
}
