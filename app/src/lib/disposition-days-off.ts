import { prisma } from "@/lib/prisma";

export const BAVARIA_HOLIDAY_SOURCE = {
  label: "Bayerisches Feiertagsgesetz (FTG)",
  url: "https://www.gesetze-bayern.de/Content/Document/BayFTG-1",
};

export const ASSUMPTION_SOURCE = {
  label: "Bayerisches Landesamt für Statistik – Mariä Himmelfahrt",
  url: "https://www.statistik.bayern.de/statistik/gebiet_bevoelkerung/zensus/himmelfahrt/",
};

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

export type AutomaticHoliday = {
  date: Date;
  name: string;
  scopeLabel: string;
  sourceLabel: string;
  sourceUrl: string;
};

export function bavariaHolidays(year: number): AutomaticHoliday[] {
  const easter = easterSunday(year);
  const statewide = (name: string, date: Date): AutomaticHoliday => ({
    date,
    name,
    scopeLabel: "Bayern",
    sourceLabel: BAVARIA_HOLIDAY_SOURCE.label,
    sourceUrl: BAVARIA_HOLIDAY_SOURCE.url,
  });

  return [
    statewide("Neujahr", utcDate(year, 1, 1)),
    statewide("Heilige Drei Könige", utcDate(year, 1, 6)),
    statewide("Karfreitag", addUtcDays(easter, -2)),
    statewide("Ostermontag", addUtcDays(easter, 1)),
    statewide("Tag der Arbeit", utcDate(year, 5, 1)),
    statewide("Christi Himmelfahrt", addUtcDays(easter, 39)),
    statewide("Pfingstmontag", addUtcDays(easter, 50)),
    statewide("Fronleichnam", addUtcDays(easter, 60)),
    {
      ...statewide("Augsburger Friedensfest", utcDate(year, 8, 8)),
      scopeLabel: "Nur Stadt Augsburg",
    },
    {
      date: utcDate(year, 8, 15),
      name: "Mariä Himmelfahrt",
      scopeLabel: "Nur Gemeinden mit gesetzlicher Geltung",
      sourceLabel: ASSUMPTION_SOURCE.label,
      sourceUrl: ASSUMPTION_SOURCE.url,
    },
    statewide("Tag der Deutschen Einheit", utcDate(year, 10, 3)),
    statewide("Allerheiligen", utcDate(year, 11, 1)),
    statewide("1. Weihnachtstag", utcDate(year, 12, 25)),
    statewide("2. Weihnachtstag", utcDate(year, 12, 26)),
  ].sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function activeDispositionDaysOff(from: Date, to: Date) {
  const entries = await prisma.dispositionDayOff.findMany({
    where: {
      date: { lte: to },
      OR: [{ endDate: null }, { endDate: { gte: from } }],
      isDayOff: true,
    },
    orderBy: [{ date: "asc" }, { name: "asc" }],
  });

  return entries.flatMap((entry) => {
    // Ohne endDate ist der Eintrag ein Einzeltag (Ende = eigenes Datum), nicht das
    // Ende des abgefragten Zeitraums – sonst würde z. B. ein einzelner Feiertag
    // fälschlich bis zum Ende des sichtbaren Kalenderausschnitts "arbeitsfrei" markieren.
    const entryEnd = entry.endDate ?? entry.date;
    const first = entry.date < from ? from : entry.date;
    const last = entryEnd > to ? to : entryEnd;

    if (last < first) return [];

    const days = [];

    for (
      let current = new Date(first);
      current <= last;
      current = addUtcDays(current, 1)
    ) {
      days.push({ ...entry, date: current });
    }

    return days;
  });
}
