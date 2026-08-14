"use server";
import type { Prisma } from "@prisma/client";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth-access";
import { canApproveLeaveRequest } from "@/lib/leave-request-access";
import { prisma } from "@/lib/prisma";

function dateValue(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label} fehlt oder ist ungültig.`);
  }
  return new Date(`${text}T00:00:00.000Z`);
}

function absenceValues(formData: FormData) {
  const absenceType =
    String(formData.get("absenceType") ?? "VACATION") === "TIME_ACCOUNT"
      ? "TIME_ACCOUNT"
      : "VACATION";
  const timeHours =
    absenceType === "TIME_ACCOUNT"
      ? Number(String(formData.get("timeHours") ?? "").replace(/\./g, "").replace(",", "."))
      : null;
  if (absenceType === "TIME_ACCOUNT" && (!timeHours || timeHours <= 0)) {
    throw new Error("Beim Zeitkonto müssen positive Stunden eingetragen werden.");
  }
  return { absenceType, timeHours };
}

export async function createLeaveRequest(formData: FormData) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.employeeId) {
    throw new Error("Das Portalkonto ist noch nicht mit einer Mitarbeiterakte verknüpft.");
  }
  const startDate = dateValue(formData.get("startDate"), "Startdatum");
  const endDate = dateValue(formData.get("endDate"), "Enddatum");
  if (endDate < startDate) {
    redirect("/leave-requests?error=end-before-start");
  }
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: user.employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) throw new Error("Für diesen Zeitraum besteht bereits ein Urlaubsantrag.");
  const dayPortion = String(formData.get("dayPortion") ?? "FULL");
  const { absenceType, timeHours } = absenceValues(formData);
  await prisma.leaveRequest.create({
    data: {
      absenceType,
      dayPortion: ["FULL", "FIRST_HALF", "SECOND_HALF"].includes(dayPortion)
        ? dayPortion
        : "FULL",
      employeeId: user.employeeId,
      endDate,
      reason: String(formData.get("reason") ?? "").trim() || null,
      requesterUserId: user.id,
      startDate,
      timeHours,
    },
  });
  revalidatePath("/leave-requests");
}

export async function changeLeaveRequest(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (
    !request ||
    request.requesterUserId !== session.user.id ||
    !["PENDING", "APPROVED"].includes(request.status) ||
    request.requestType !== "NEW"
  ) {
    throw new Error("Dieser Urlaubsantrag kann nicht bearbeitet werden.");
  }
  const startDate = dateValue(formData.get("startDate"), "Startdatum");
  const endDate = dateValue(formData.get("endDate"), "Enddatum");
  if (endDate < startDate) redirect("/leave-requests?error=end-before-start");
  const dayPortion = String(formData.get("dayPortion") ?? "FULL");
  const { absenceType, timeHours } = absenceValues(formData);

  if (request.status === "PENDING") {
    await prisma.leaveRequest.update({
      data: {
        absenceType,
        dayPortion: ["FULL", "FIRST_HALF", "SECOND_HALF"].includes(dayPortion)
          ? dayPortion
          : "FULL",
        endDate,
        reason: String(formData.get("reason") ?? "").trim() || null,
        startDate,
        timeHours,
      },
      where: { id },
    });
  } else {
    const existingChange = await prisma.leaveRequest.findFirst({
      where: { originalRequestId: id, status: "PENDING" },
    });
    if (existingChange) {
      throw new Error("Für diesen Urlaub läuft bereits eine Änderung oder Rücknahme.");
    }
    await prisma.leaveRequest.create({
      data: {
        absenceType,
        dayPortion: ["FULL", "FIRST_HALF", "SECOND_HALF"].includes(dayPortion)
          ? dayPortion
          : "FULL",
        employeeId: request.employeeId,
        endDate,
        originalRequestId: id,
        reason: String(formData.get("reason") ?? "").trim() || null,
        requesterUserId: session.user.id,
        requestType: "CHANGE",
        startDate,
        timeHours,
      },
    });
  }
  revalidatePath("/leave-requests");
  revalidatePath("/employee-dispatch");
  revalidatePath("/crew-dispatch");
}

export async function requestLeaveCancellation(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (
    !request ||
    request.requesterUserId !== session.user.id ||
    !["PENDING", "APPROVED"].includes(request.status) ||
    request.requestType !== "NEW"
  ) {
    throw new Error("Dieser Urlaubsantrag kann nicht zurückgerufen werden.");
  }
  if (request.status === "PENDING") {
    await prisma.leaveRequest.update({
      data: { requestType: "CANCEL", status: "PENDING" },
      where: { id },
    });
  } else {
    const existingChange = await prisma.leaveRequest.findFirst({
      where: { originalRequestId: id, status: "PENDING" },
    });
    if (existingChange) {
      throw new Error("Für diesen Urlaub läuft bereits eine Änderung oder Rücknahme.");
    }
    await prisma.leaveRequest.create({
      data: {
        absenceType: request.absenceType,
        dayPortion: request.dayPortion,
        employeeId: request.employeeId,
        endDate: request.endDate,
        originalRequestId: id,
        reason: String(formData.get("reason") ?? "").trim() || "Rücknahme beantragt",
        requesterUserId: session.user.id,
        requestType: "CANCEL",
        startDate: request.startDate,
        timeHours: request.timeHours,
      },
    });
  }
  revalidatePath("/leave-requests");
  revalidatePath("/employee-dispatch");
  revalidatePath("/crew-dispatch");
}

export async function decideLeaveRequest(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  if (!(await canApproveLeaveRequest(session.user.id, id))) {
    throw new Error("Keine Berechtigung zur Urlaubsfreigabe für diese Baustelle.");
  }
  const decision = String(formData.get("decision") ?? "");
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request || request.status !== "PENDING") {
    throw new Error("Der Antrag ist nicht mehr offen.");
  }
  const decisionNote = String(formData.get("decisionNote") ?? "").trim() || null;
  if (decision === "APPROVED") {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (request.requestType === "CANCEL") {
        const original = request.originalRequestId
          ? await tx.leaveRequest.findUnique({ where: { id: request.originalRequestId } })
          : request;
        if (original?.dispositionEntryId) {
          await tx.employeeDispositionEntry.delete({
            where: { id: original.dispositionEntryId },
          });
        }
        if (request.originalRequestId) {
          await tx.leaveRequest.update({
            data: { status: "CANCELED" },
            where: { id: request.originalRequestId },
          });
        }
        await tx.leaveRequest.update({
          data: {
            decidedAt: new Date(),
            decidedByUserId: session.user.id,
            decisionNote,
            status: "APPROVED",
          },
          where: { id },
        });
        return;
      }
      if (request.requestType === "CHANGE" && request.originalRequestId) {
        const original = await tx.leaveRequest.findUnique({
          where: { id: request.originalRequestId },
        });
        if (original?.dispositionEntryId) {
          await tx.employeeDispositionEntry.delete({
            where: { id: original.dispositionEntryId },
          });
        }
        await tx.leaveRequest.update({
          data: { status: "SUPERSEDED" },
          where: { id: request.originalRequestId },
        });
      }
      const entry = await tx.employeeDispositionEntry.create({
        data: {
          employeeId: request.employeeId,
          endDate: request.endDate,
          notes: `Genehmigter ${request.absenceType === "TIME_ACCOUNT" ? "Zeitausgleich" : "Urlaubsantrag"} ${request.id}`,
          startDate: request.startDate,
          typeLabel: request.absenceType === "TIME_ACCOUNT" ? "Zeitausgleich" : "Urlaub",
          typeValue: request.absenceType === "TIME_ACCOUNT" ? "zeitausgleich" : "urlaub",
        },
      });
      await tx.leaveRequest.update({
        data: {
          decidedAt: new Date(),
          decidedByUserId: session.user.id,
          decisionNote,
          dispositionEntryId: entry.id,
          status: "APPROVED",
        },
        where: { id },
      });
    });
  } else if (decision === "REJECTED") {
    await prisma.leaveRequest.update({
      data: {
        decidedAt: new Date(),
        decidedByUserId: session.user.id,
        decisionNote,
        status: "REJECTED",
      },
      where: { id },
    });
  } else {
    throw new Error("Ungültige Entscheidung.");
  }
  revalidatePath("/leave-requests");
  revalidatePath("/employee-dispatch");
  revalidatePath("/crew-dispatch");
}

export async function cancelLeaveRequest(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request || request.requesterUserId !== session.user.id || request.status !== "PENDING") {
    throw new Error("Dieser Antrag kann nicht zurückgezogen werden.");
  }
  await prisma.leaveRequest.update({
    data: { status: "CANCELED" },
    where: { id },
  });
  revalidatePath("/leave-requests");
}
