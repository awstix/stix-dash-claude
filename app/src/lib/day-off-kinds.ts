export type DayOffKindStyle = {
  badgeClass: string;
  barClass: string;
  label: string;
  ringClass: string;
};

export const dayOffKindStyles: Record<string, DayOffKindStyle> = {
  PUBLIC_HOLIDAY: {
    badgeClass: "bg-gray-100 text-gray-800",
    barClass: "bg-gray-400 text-white",
    label: "Feiertag",
    ringClass: "ring-2 ring-gray-500",
  },
  BRIDGE_DAY: {
    badgeClass: "bg-violet-100 text-violet-900",
    barClass: "bg-violet-500 text-white",
    label: "Brückentag",
    ringClass: "ring-2 ring-violet-600",
  },
  COMPANY_HOLIDAY: {
    badgeClass: "bg-indigo-100 text-indigo-900",
    barClass: "bg-indigo-500 text-white",
    label: "Betriebsurlaub",
    ringClass: "ring-2 ring-indigo-600",
  },
  COMPANY: {
    badgeClass: "bg-amber-100 text-amber-950",
    barClass: "bg-amber-400 text-gray-950",
    label: "Betriebsfreier Tag",
    ringClass: "ring-2 ring-amber-500",
  },
  OTHER: {
    badgeClass: "bg-slate-100 text-slate-900",
    barClass: "bg-slate-400 text-white",
    label: "Sonstiger Tag",
    ringClass: "ring-2 ring-slate-500",
  },
};

/** Diese Arten arbeitsfreier Tage werden Mitarbeitern vom Urlaubskontingent abgezogen
 * (Brückentag, Betriebsurlaub) – echte gesetzliche Feiertage und sonstige arbeitsfreie
 * Tage bewusst nicht. */
export const vacationDeductingDayOffKinds = new Set(["BRIDGE_DAY", "COMPANY_HOLIDAY"]);

export function getDayOffKindStyle(kind: string) {
  return dayOffKindStyles[kind] ?? dayOffKindStyles.OTHER;
}
