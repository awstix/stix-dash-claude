"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function dateKeyToDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export async function createWorkTimeCalendar(formData: FormData) {
  await requireAdmin();
  const year = Number(text(formData.get("year")));
  const name = text(formData.get("name"));

  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error("Bitte ein gültiges Jahr angeben.");
  }
  if (!name) {
    throw new Error("Bitte einen Namen angeben.");
  }

  const calendar = await prisma.workTimeCalendar.create({
    data: { name, year },
  });

  revalidatePath("/admin/working-time/kalender");
  redirect(`/admin/working-time/kalender/${calendar.id}`);
}

export async function deleteWorkTimeCalendar(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (!id) {
    throw new Error("Kalender fehlt.");
  }

  await prisma.workTimeCalendar.delete({ where: { id } });

  revalidatePath("/admin/working-time/kalender");
  redirect("/admin/working-time/kalender");
}

export type SetWorkTimeCalendarDaysInput = {
  calendarId: string;
  dates: string[];
  dayTypeId: string | null;
};

export async function setWorkTimeCalendarDays(input: SetWorkTimeCalendarDaysInput) {
  await requireAdmin();
  if (!input.calendarId || input.dates.length === 0) return;

  if (input.dayTypeId) {
    const dayTypeId = input.dayTypeId;
    await prisma.$transaction(
      input.dates.map((dateKey) =>
        prisma.workTimeCalendarDay.upsert({
          create: {
            calendarId: input.calendarId,
            date: dateKeyToDate(dateKey),
            dayTypeId,
          },
          update: { dayTypeId },
          where: {
            calendarId_date: {
              calendarId: input.calendarId,
              date: dateKeyToDate(dateKey),
            },
          },
        }),
      ),
    );
  } else {
    await prisma.workTimeCalendarDay.deleteMany({
      where: {
        calendarId: input.calendarId,
        date: { in: input.dates.map(dateKeyToDate) },
      },
    });
  }

  revalidatePath(`/admin/working-time/kalender/${input.calendarId}`);
}

export type SyncWorkTimeCalendarAssignmentsInput = {
  calendarId: string;
  employeeIds: string[];
};

/** Ersetzt die komplette Mitarbeiter-Zuweisung dieses Kalenders durch die übergebene
 * Auswahl (ein Aufruf pro Klick auf "Speichern" statt Einzel-Toggles). */
export async function syncWorkTimeCalendarAssignments(input: SyncWorkTimeCalendarAssignmentsInput) {
  await requireAdmin();
  const employeeIds = Array.from(new Set(input.employeeIds));

  const calendar = await prisma.workTimeCalendar.findUnique({
    select: { year: true },
    where: { id: input.calendarId },
  });
  if (!calendar) {
    throw new Error("Kalender wurde nicht gefunden.");
  }

  if (employeeIds.length === 0) {
    await prisma.workTimeCalendarAssignment.deleteMany({
      where: { calendarId: input.calendarId },
    });
  } else {
    await prisma.workTimeCalendarAssignment.deleteMany({
      where: { calendarId: input.calendarId, employeeId: { notIn: employeeIds } },
    });
    await prisma.workTimeCalendarAssignment.deleteMany({
      where: {
        calendar: { year: calendar.year },
        calendarId: { not: input.calendarId },
        employeeId: { in: employeeIds },
      },
    });
    await prisma.$transaction(
      employeeIds.map((employeeId) =>
        prisma.workTimeCalendarAssignment.upsert({
          create: { calendarId: input.calendarId, employeeId },
          update: {},
          where: {
            employeeId_calendarId: {
              calendarId: input.calendarId,
              employeeId,
            },
          },
        }),
      ),
    );
  }

  revalidatePath(`/admin/working-time/kalender/${input.calendarId}`);
}
