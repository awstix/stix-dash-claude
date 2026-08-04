export type DayOffKindStyle = {
  badgeClass: string;
  barClass: string;
  label: string;
  ringClass: string;
};

// Farben bewusst außerhalb der in employeeDispositionTypes verwendeten Töne
// (emerald/fuchsia/red/rose/pink/orange/amber/indigo/cyan/slate/violet/stone/sky/zinc)
// gewählt, damit sich die Legende auf dem Jahreskalender klar unterscheiden lässt.
export const dayOffKindStyles: Record<string, DayOffKindStyle> = {
  PUBLIC_HOLIDAY: {
    badgeClass: "bg-yellow-100 text-yellow-900",
    barClass: "bg-yellow-500 text-gray-950",
    label: "Feiertag",
    ringClass: "ring-2 ring-yellow-600",
  },
  BRIDGE_DAY: {
    badgeClass: "bg-teal-100 text-teal-900",
    barClass: "bg-teal-600 text-white",
    label: "Brückentag",
    ringClass: "ring-2 ring-teal-600",
  },
  COMPANY_HOLIDAY: {
    badgeClass: "bg-purple-100 text-purple-900",
    barClass: "bg-purple-600 text-white",
    label: "Betriebsurlaub",
    ringClass: "ring-2 ring-purple-600",
  },
  COMPANY: {
    badgeClass: "bg-lime-100 text-lime-900",
    barClass: "bg-lime-500 text-gray-950",
    label: "Betriebsfreier Tag",
    ringClass: "ring-2 ring-lime-600",
  },
  OTHER: {
    badgeClass: "bg-gray-100 text-gray-900",
    barClass: "bg-gray-500 text-white",
    label: "Sonstiger Tag",
    ringClass: "ring-2 ring-gray-500",
  },
};

/** Diese Arten arbeitsfreier Tage werden Mitarbeitern vom Urlaubskontingent abgezogen
 * (Brückentag, Betriebsurlaub) – echte gesetzliche Feiertage und sonstige arbeitsfreie
 * Tage bewusst nicht. */
export const vacationDeductingDayOffKinds = new Set(["BRIDGE_DAY", "COMPANY_HOLIDAY"]);

export function getDayOffKindStyle(kind: string) {
  return dayOffKindStyles[kind] ?? dayOffKindStyles.OTHER;
}
