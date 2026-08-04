import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getHolidayDetailsByDate } from "@/lib/time-accounts";
import { getNetWorkHoursForDay } from "@/lib/work-time";
import { getWorkTimeDayTypeColor } from "@/lib/work-time-day-type-colors";
import { getDayOffKindStyle } from "@/lib/day-off-kinds";
import { deleteWorkTimeCalendar } from "../actions";
import type { WorkTimeCalendarAssignmentGroup } from "./WorkTimeCalendarAssignmentsForm";
import { WorkTimeCalendarEditor } from "./WorkTimeCalendarEditor";

const ohneAbteilungLabel = "Ohne Abteilung";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function WorkTimeCalendarEditorPage({
  params,
}: {
  params: Promise<{ calendarId: string }>;
}) {
  await requireAdmin();
  const { calendarId } = await params;

  const [calendar, dayTypes, employees, assignments, holidayDetails] = await Promise.all([
    prisma.workTimeCalendar.findUnique({
      include: { days: true },
      where: { id: calendarId },
    }),
    prisma.workTimeDayType.findMany({ orderBy: [{ number: "asc" }] }),
    prisma.employee.findMany({
      orderBy: [{ departmentLabel: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: { departmentLabel: true, firstName: true, id: true, lastName: true },
      where: { statusValue: "active" },
    }),
    prisma.workTimeCalendarAssignment.findMany({
      select: { employeeId: true },
      where: { calendarId },
    }),
    getHolidayDetailsByDate(),
  ]);

  if (!calendar) notFound();

  const holidayOverlay: Record<string, { kind: string; label: string; ringClass: string }> = {};
  for (const [dateKey, detail] of holidayDetails) {
    if (!dateKey.startsWith(String(calendar.year))) continue;
    const style = getDayOffKindStyle(detail.kind);
    holidayOverlay[dateKey] = { kind: detail.kind, label: `${style.label}: ${detail.name}`, ringClass: style.ringClass };
  }

  const initialDays: Record<string, string> = {};
  for (const day of calendar.days) {
    if (day.dayTypeId) initialDays[isoDate(day.date)] = day.dayTypeId;
  }

  const gridDayTypes = dayTypes.map((type) => ({
    barClass: getWorkTimeDayTypeColor(type.colorKey).barClass,
    hours: getNetWorkHoursForDay({
      breakfastEnd: type.breakfastEnd ?? "",
      breakfastStart: type.breakfastStart ?? "",
      endTime: type.endTime ?? "",
      lunchEnd: type.lunchEnd ?? "",
      lunchStart: type.lunchStart ?? "",
      startTime: type.startTime ?? "",
    }),
    id: type.id,
    number: type.number,
  }));

  const assignedEmployeeIds = assignments.map((assignment) => assignment.employeeId);

  const departmentGroupsMap = new Map<string, WorkTimeCalendarAssignmentGroup["employees"]>();
  for (const employee of employees) {
    const key = employee.departmentLabel?.trim() || ohneAbteilungLabel;
    const entry = { id: employee.id, label: `${employee.lastName}, ${employee.firstName}` };
    const existing = departmentGroupsMap.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      departmentGroupsMap.set(key, [entry]);
    }
  }
  const departmentGroups: WorkTimeCalendarAssignmentGroup[] = Array.from(departmentGroupsMap.entries())
    .sort(([a], [b]) => {
      if (a === ohneAbteilungLabel) return 1;
      if (b === ohneAbteilungLabel) return -1;
      return a.localeCompare(b, "de-DE");
    })
    .map(([name, groupEmployees]) => ({ employees: groupEmployees, name }));

  return (
    <AppShell
      title={`Jahreskalender ${calendar.year} · ${calendar.name}`}
      description="Tage anklicken oder ziehen, um sie mit der gewählten Planzeit zu füllen."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/working-time/kalender"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Alle Kalender
          </Link>
          <Link
            href="/admin/working-time/planzeiten"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Planzeiten
          </Link>
        </div>
        <form action={deleteWorkTimeCalendar}>
          <input name="id" type="hidden" value={calendar.id} />
          <button
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            type="submit"
          >
            Kalender löschen
          </button>
        </form>
      </div>

      <WorkTimeCalendarEditor
        calendarId={calendar.id}
        dayTypes={gridDayTypes}
        departmentGroups={departmentGroups}
        holidayOverlay={holidayOverlay}
        initialAssignedIds={assignedEmployeeIds}
        initialDays={initialDays}
        year={calendar.year}
      />
    </AppShell>
  );
}
