import { prisma } from "@/lib/prisma";
import { employeeDispositionTypes } from "@/app/employee-dispatch/disposition-types";
import { vacationDeductingDayOffKinds } from "@/lib/day-off-kinds";
import {
  getDefaultWorkTime,
  getNetWorkHoursForDay,
  getWorkTimeForDate,
  type WorkTimeDaySettings,
} from "@/lib/work-time";

export type DayCategory = {
  badgeClass: string;
  barClass: string;
  label: string;
  value: string;
};

function breakHoursForDay(settings: {
  break1From: string | null;
  break1To: string | null;
  break2From: string | null;
  break2To: string | null;
}) {
  const timeToMinutes = (value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const rangeMinutes = (from: string | null, to: string | null) => {
    if (!from || !to) return 0;
    const start = timeToMinutes(from);
    const end = timeToMinutes(to);
    if (start === null || end === null || end <= start) return 0;
    return end - start;
  };
  const minutes =
    rangeMinutes(settings.break1From, settings.break1To) +
    rangeMinutes(settings.break2From, settings.break2To);
  return minutes / 60;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export async function getHolidayDateSet(): Promise<Set<string>> {
  const holidays = await prisma.dispositionDayOff.findMany({
    select: { date: true, endDate: true },
    where: { isDayOff: true },
  });
  const dates = new Set<string>();
  for (const holiday of holidays) {
    const end = holiday.endDate ?? holiday.date;
    for (let d = new Date(holiday.date); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.add(isoDate(d));
    }
  }
  return dates;
}

export type HolidayDetail = { kind: string; name: string };

/** Wie getHolidayDateSet, aber inkl. Art (Feiertag/Brückentag/Betriebsurlaub/...) und
 * Bezeichnung je Tag, für die farbliche Darstellung im Jahreskalender. */
export async function getHolidayDetailsByDate(): Promise<Map<string, HolidayDetail>> {
  const holidays = await prisma.dispositionDayOff.findMany({
    select: { date: true, endDate: true, kind: true, name: true },
    where: { isDayOff: true },
  });
  const details = new Map<string, HolidayDetail>();
  for (const holiday of holidays) {
    const end = holiday.endDate ?? holiday.date;
    for (let d = new Date(holiday.date); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      details.set(isoDate(d), { kind: holiday.kind, name: holiday.name });
    }
  }
  return details;
}

export type FlexTimeBalance = {
  balanceHours: number;
  istHours: number;
  sollHours: number;
};

/** Ist (tatsächlich erfasste Stunden plus angerechnete Dispo-Kategorien wie Krank/
 * Schule/Innung/Sonderurlaub Stunden) minus Soll (Standard-Arbeitszeit an Werktagen,
 * abzüglich genehmigter Urlaub/Zeitausgleich und Feiertage) für alle übergebenen
 * Mitarbeiter im angegebenen Zeitraum. Nutzt dieselbe Tagesberechnung wie der Monats-/
 * Jahreskalender (getEmployeeDayDetails), damit die Salden konsistent sind. */
export async function calculateFlexTimeBalances({
  employeeIds,
  fromDate,
  toDate,
}: {
  employeeIds: string[];
  fromDate: Date;
  toDate: Date;
}): Promise<Map<string, FlexTimeBalance>> {
  if (!employeeIds.length) return new Map();

  const entries = await Promise.all(
    employeeIds.map(async (employeeId) => {
      const days = await getEmployeeDayDetails({ employeeId, fromDate, toDate });
      const istHours = days.reduce((sum, day) => sum + day.istHours, 0);
      const sollHours = days.reduce((sum, day) => sum + day.sollHours, 0);
      const balance: FlexTimeBalance = {
        balanceHours: Math.round((istHours - sollHours) * 100) / 100,
        istHours: Math.round(istHours * 100) / 100,
        sollHours: Math.round(sollHours * 100) / 100,
      };
      return [employeeId, balance] as const;
    }),
  );

  return new Map(entries);
}

export type VacationBalance = {
  entitlementDays: number;
  remainingDays: number;
  takenDays: number;
};

/** Genommene Urlaubstage im angegebenen Jahr (genehmigte Anträge mit Art "Urlaub",
 * ohne Wochenenden und Feiertage) gegen das Jahreskontingent der Mitarbeiterakte. */
export async function calculateVacationBalances({
  employeeIds,
  year,
}: {
  employeeIds: string[];
  year: number;
}): Promise<Map<string, VacationBalance>> {
  if (!employeeIds.length) return new Map();

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const [employees, holidayDetails, approvedVacation] = await Promise.all([
    prisma.employee.findMany({
      select: { annualVacationDays: true, id: true },
      where: { id: { in: employeeIds } },
    }),
    getHolidayDetailsByDate(),
    prisma.leaveRequest.findMany({
      select: { dayPortion: true, employeeId: true, endDate: true, startDate: true },
      where: {
        absenceType: "VACATION",
        employeeId: { in: employeeIds },
        endDate: { gte: yearStart },
        startDate: { lte: yearEnd },
        status: "APPROVED",
      },
    }),
  ]);

  const entitlementByEmployeeId = new Map(employees.map((employee) => [employee.id, employee.annualVacationDays]));
  const takenByEmployeeId = new Map<string, number>();

  for (const leave of approvedVacation) {
    const start = leave.startDate < yearStart ? yearStart : leave.startDate;
    const end = leave.endDate > yearEnd ? yearEnd : leave.endDate;
    const fraction = leave.dayPortion === "FULL" ? 1 : 0.5;
    let taken = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (isWeekend(d) || holidayDetails.has(isoDate(d))) continue;
      taken += fraction;
    }
    takenByEmployeeId.set(leave.employeeId, (takenByEmployeeId.get(leave.employeeId) ?? 0) + taken);
  }

  // Brückentage/Betriebsurlaub gelten betriebsweit für alle und werden zusätzlich vom
  // Urlaubskontingent abgezogen – anders als echte Feiertage oder sonstige arbeitsfreie Tage.
  let vacationDeductingDayCount = 0;
  for (let d = new Date(yearStart); d <= yearEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWeekend(d)) continue;
    const detail = holidayDetails.get(isoDate(d));
    if (detail && vacationDeductingDayOffKinds.has(detail.kind)) {
      vacationDeductingDayCount += 1;
    }
  }
  if (vacationDeductingDayCount > 0) {
    for (const employeeId of employeeIds) {
      takenByEmployeeId.set(employeeId, (takenByEmployeeId.get(employeeId) ?? 0) + vacationDeductingDayCount);
    }
  }

  const result = new Map<string, VacationBalance>();
  for (const employeeId of employeeIds) {
    const entitlementDays = entitlementByEmployeeId.get(employeeId) ?? 30;
    const takenDays = Math.round((takenByEmployeeId.get(employeeId) ?? 0) * 100) / 100;
    result.set(employeeId, {
      entitlementDays,
      remainingDays: Math.round((entitlementDays - takenDays) * 100) / 100,
      takenDays,
    });
  }
  return result;
}

export type EmployeeDayDetail = {
  absenceLabel: string | null;
  breakHours: number;
  category: DayCategory | null;
  /** Für Auswertungen (Jahreskalender): Stunden, die dieser Tag insgesamt "zählt" —
   * inkl. genehmigtem Urlaub/Zeitausgleich mit der normalen Tages-Soll-Zeit. Für die
   * Zeitkonto-Saldo-Berechnung (Gutstunden/Minusstunden) weiterhin istHours/sollHours
   * verwenden, nicht dieses Feld. */
  creditedHours: number;
  date: string;
  holidayKind: string | null;
  holidayName: string | null;
  isHoliday: boolean;
  isWeekend: boolean;
  istHours: number;
  sollHours: number;
};

const absenceLabels: Record<string, string> = {
  TIME_ACCOUNT: "Zeitausgleich",
  VACATION: "Urlaub",
};

/** Tagesgenaue Aufstellung von Soll/Ist/Pause/Abwesenheit für einen Mitarbeiter
 * über einen beliebigen Zeitraum. Grundlage für Monats- und Jahreskalender. */
export async function getEmployeeDayDetails({
  employeeId,
  fromDate,
  toDate,
}: {
  employeeId: string;
  fromDate: Date;
  toDate: Date;
}): Promise<EmployeeDayDetail[]> {
  const [
    workTime,
    holidayDetails,
    timeEntries,
    approvedLeave,
    allLeave,
    dispositionEntries,
    creditSettings,
    timeTrackingSettings,
    calendarAssignments,
  ] = await Promise.all([
    getDefaultWorkTime(),
    getHolidayDetailsByDate(),
    prisma.crewTimeEmployee.findMany({
      include: { entry: { select: { workDate: true } } },
      where: {
        employeeId,
        isPresent: true,
        entry: { workDate: { gte: fromDate, lte: toDate } },
      },
    }),
    prisma.leaveRequest.findMany({
      select: { absenceType: true, dayPortion: true, endDate: true, startDate: true },
      where: {
        employeeId,
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
        status: "APPROVED",
      },
    }),
    prisma.leaveRequest.findMany({
      select: { absenceType: true, endDate: true, startDate: true, status: true },
      where: {
        employeeId,
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
        status: { in: ["APPROVED", "PENDING"] },
      },
    }),
    prisma.employeeDispositionEntry.findMany({
      select: { endDate: true, hours: true, startDate: true, typeLabel: true, typeValue: true },
      where: {
        employeeId,
        endDate: { gte: fromDate },
        startDate: { lte: toDate },
      },
    }),
    prisma.dispositionCategoryCredit.findMany({
      select: { creditedHours: true, typeValue: true },
    }),
    prisma.timeTrackingSettings.findUnique({
      select: { workTimeCalendarEffectiveFrom: true },
      where: { id: "default" },
    }),
    prisma.workTimeCalendarAssignment.findMany({
      select: {
        calendar: {
          select: {
            days: {
              select: { date: true, dayType: true },
              where: { date: { gte: fromDate, lte: toDate } },
            },
            year: true,
          },
        },
      },
      where: {
        employeeId,
        calendar: {
          year: { gte: fromDate.getUTCFullYear(), lte: toDate.getUTCFullYear() },
        },
      },
    }),
  ]);
  const creditedHoursByTypeValue = new Map(
    creditSettings.map((setting) => [setting.typeValue, setting.creditedHours]),
  );

  // Kalender-Soll: nur für Tage mit eingetragener Planzeit und nur ab dem globalen
  // Umstellungs-Stichtag. Ohne Eintrag für einen konkreten Tag bleibt es bei
  // Sommer-/Winterzeit für diesen Tag (keine Lücken durch unvollständige Kalender).
  const effectiveFrom = timeTrackingSettings?.workTimeCalendarEffectiveFrom ?? null;
  const calendarSollByDate = new Map<string, number>();
  if (effectiveFrom) {
    for (const assignment of calendarAssignments) {
      for (const day of assignment.calendar.days) {
        if (day.date < effectiveFrom) continue;
        const hours = day.dayType
          ? getNetWorkHoursForDay({
              breakfastEnd: day.dayType.breakfastEnd ?? "",
              breakfastStart: day.dayType.breakfastStart ?? "",
              endTime: day.dayType.endTime ?? "",
              lunchEnd: day.dayType.lunchEnd ?? "",
              lunchStart: day.dayType.lunchStart ?? "",
              startTime: day.dayType.startTime ?? "",
            })
          : 0;
        calendarSollByDate.set(isoDate(day.date), hours);
      }
    }
  }

  const istByDate = new Map<string, number>();
  const breakByDate = new Map<string, number>();
  for (const entry of timeEntries) {
    const iso = isoDate(entry.entry.workDate);
    istByDate.set(iso, (istByDate.get(iso) ?? 0) + entry.netHours);
    breakByDate.set(iso, (breakByDate.get(iso) ?? 0) + breakHoursForDay(entry));
  }

  const absenceByDate = new Map<string, string>();
  const absenceFractionByDate = new Map<string, number>();
  for (const leave of approvedLeave) {
    const start = leave.startDate < fromDate ? fromDate : leave.startDate;
    const end = leave.endDate > toDate ? toDate : leave.endDate;
    const label = absenceLabels[leave.absenceType] ?? leave.absenceType;
    const fraction = leave.dayPortion === "FULL" ? 1 : 0.5;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (isWeekend(d)) continue;
      const iso = isoDate(d);
      absenceByDate.set(iso, fraction === 1 ? label : `${label} (halb)`);
      absenceFractionByDate.set(iso, fraction);
    }
  }

  // Kategorie je Tag, wie in der Mitarbeiterdisposition: manuelle Dispo-Einträge
  // (Krank/Schule/Innung/Schulung/Werkstatt/Mischanlage/Baustelle) haben Vorrang,
  // danach Urlaub (genehmigt oder beantragt).
  const categoryByDate = new Map<string, DayCategory>();
  for (const leave of allLeave) {
    const start = leave.startDate < fromDate ? fromDate : leave.startDate;
    const end = leave.endDate > toDate ? toDate : leave.endDate;
    const timeAccount = leave.absenceType === "TIME_ACCOUNT";
    const category: DayCategory =
      leave.status === "APPROVED"
        ? {
            badgeClass: "bg-sky-100 text-sky-900",
            barClass: "bg-sky-700 text-white",
            label: timeAccount ? "Zeitausgleich" : "Urlaub",
            value: timeAccount ? "zeitausgleich" : "urlaub",
          }
        : {
            badgeClass: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200",
            barClass: "border-2 border-dashed border-sky-700 bg-sky-100 text-sky-950",
            label: "Urlaub beantragt",
            value: "urlaub_beantragt",
          };
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      categoryByDate.set(isoDate(d), category);
    }
  }
  const dispositionTypeValueByDate = new Map<string, string>();
  const dispositionHoursByDate = new Map<string, number>();
  for (const entry of dispositionEntries) {
    const start = entry.startDate < fromDate ? fromDate : entry.startDate;
    const end = entry.endDate > toDate ? toDate : entry.endDate;
    const type = employeeDispositionTypes.find((candidate) => candidate.value === entry.typeValue);
    const category: DayCategory = {
      badgeClass: type?.badgeClass ?? "bg-gray-100 text-gray-800",
      barClass: type?.barClass ?? "bg-gray-600 text-white",
      label: type?.label ?? entry.typeLabel,
      value: entry.typeValue,
    };
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = isoDate(d);
      categoryByDate.set(iso, category);
      dispositionTypeValueByDate.set(iso, entry.typeValue);
      if (entry.hours !== null) {
        dispositionHoursByDate.set(iso, entry.hours);
      }
    }
  }

  const days: EmployeeDayDetail[] = [];
  for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = isoDate(d);
    const weekend = isWeekend(d);
    const holidayDetail = holidayDetails.get(iso) ?? null;
    const holiday = holidayDetail !== null;
    const dayWorkTime: WorkTimeDaySettings = getWorkTimeForDate(workTime, d);
    const calendarDayHours = calendarSollByDate.get(iso);
    const baseSollHours =
      calendarDayHours !== undefined
        ? calendarDayHours
        : weekend || holiday
          ? 0
          : getNetWorkHoursForDay(dayWorkTime);
    const sollHours =
      Math.round(baseSollHours * (1 - (absenceFractionByDate.get(iso) ?? 0)) * 100) / 100;

    // Dispo-Kategorien (Krank/Schule/Innung/Schulung/Werkstatt/Mischanlage/Baustelle) zählen
    // als Ausgleich an: pro Kategorie fest hinterlegte Stunden (Admin > Zeiterfassung),
    // ohne Einstellung die normale Tages-Soll-Zeit — sofern an dem Tag keine echten
    // Ist-Stunden erfasst wurden (sonst würde doppelt angerechnet).
    const dispositionTypeValue = dispositionTypeValueByDate.get(iso);
    const clockedIstHours = istByDate.get(iso) ?? 0;
    const creditedDispositionHours =
      dispositionTypeValue && !weekend && !holiday && clockedIstHours === 0
        ? (dispositionHoursByDate.get(iso) ?? creditedHoursByTypeValue.get(dispositionTypeValue) ?? sollHours)
        : null;

    // Für die Std.-Auswertung im Jahreskalender zählt genehmigter Urlaub/Zeitausgleich mit
    // der normalen Tages-Soll-Zeit — beeinflusst aber bewusst nicht istHours/sollHours,
    // damit der Zeitkonto-Saldo für Abwesenheitstage weiterhin neutral (0) bleibt.
    const leaveFraction = absenceFractionByDate.get(iso) ?? 0;
    const creditedLeaveHours =
      !weekend && !holiday && clockedIstHours === 0 && leaveFraction > 0
        ? getNetWorkHoursForDay(dayWorkTime) * leaveFraction
        : null;

    days.push({
      absenceLabel: absenceByDate.get(iso) ?? null,
      breakHours: Math.round((breakByDate.get(iso) ?? 0) * 100) / 100,
      category: categoryByDate.get(iso) ?? null,
      creditedHours:
        Math.round((creditedDispositionHours ?? creditedLeaveHours ?? clockedIstHours) * 100) / 100,
      date: iso,
      holidayKind: holidayDetail?.kind ?? null,
      holidayName: holidayDetail?.name ?? null,
      isHoliday: holiday,
      isWeekend: weekend,
      istHours:
        creditedDispositionHours !== null
          ? Math.round(creditedDispositionHours * 100) / 100
          : Math.round(clockedIstHours * 100) / 100,
      sollHours,
    });
  }
  return days;
}

export async function getEmployeeMonthDetail({
  employeeId,
  month,
  year,
}: {
  employeeId: string;
  month: number;
  year: number;
}): Promise<{ days: EmployeeDayDetail[] }> {
  const fromDate = new Date(Date.UTC(year, month - 1, 1));
  const toDate = new Date(Date.UTC(year, month, 0));
  const days = await getEmployeeDayDetails({ employeeId, fromDate, toDate });
  return { days };
}

export type EmployeeMonthOverview = {
  days: EmployeeDayDetail[];
  month: number;
};

/** Alle Tage eines Jahres für einen Mitarbeiter, nach Monat gruppiert. */
export async function getEmployeeYearDetail({
  employeeId,
  year,
}: {
  employeeId: string;
  year: number;
}): Promise<{ months: EmployeeMonthOverview[] }> {
  const fromDate = new Date(Date.UTC(year, 0, 1));
  const toDate = new Date(Date.UTC(year, 11, 31));
  const days = await getEmployeeDayDetails({ employeeId, fromDate, toDate });

  const months: EmployeeMonthOverview[] = Array.from({ length: 12 }, (_, index) => ({
    days: [],
    month: index + 1,
  }));
  for (const day of days) {
    const monthIndex = Number(day.date.slice(5, 7)) - 1;
    months[monthIndex].days.push(day);
  }
  return { months };
}
