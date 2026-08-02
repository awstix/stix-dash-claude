export const employeeDispositionTypes = [
  {
    value: "betrieb",
    label: "Baustelle",
    barClass: "bg-emerald-700 text-white",
    badgeClass: "bg-emerald-100 text-emerald-900",
  },
  {
    value: "innung",
    label: "Innung",
    barClass: "bg-fuchsia-700 text-white",
    badgeClass: "bg-fuchsia-100 text-fuchsia-900",
  },
  {
    value: "krank",
    label: "Krank",
    barClass: "bg-red-700 text-white",
    badgeClass: "bg-red-100 text-red-900",
  },
  {
    value: "krank_ab_6_wochen",
    label: "Krank ab 6 Wochen (Krankengeld)",
    barClass: "bg-rose-800 text-white",
    badgeClass: "bg-rose-100 text-rose-900",
  },
  {
    value: "krankstunden_schlechtwetter",
    label: "Krankstunden Schlechtwetter",
    barClass: "bg-pink-700 text-white",
    badgeClass: "bg-pink-100 text-pink-900",
  },
  {
    value: "mischanlage_niedernberg",
    label: "Mischanlage Niedernberg",
    barClass: "bg-orange-700 text-white",
    badgeClass: "bg-orange-100 text-orange-900",
  },
  {
    value: "mischanlage_roellfeld",
    label: "Mischanlage Röllfeld",
    barClass: "bg-amber-600 text-gray-950",
    badgeClass: "bg-amber-100 text-amber-950",
  },
  {
    value: "schulung",
    label: "Schulung",
    barClass: "bg-indigo-700 text-white",
    badgeClass: "bg-indigo-100 text-indigo-900",
  },
  {
    value: "schule",
    label: "Schule",
    barClass: "bg-cyan-700 text-white",
    badgeClass: "bg-cyan-100 text-cyan-900",
  },
  {
    value: "schlechtwetter",
    label: "Schlechtwetter",
    barClass: "bg-slate-600 text-white",
    badgeClass: "bg-slate-100 text-slate-900",
  },
  {
    value: "sonderurlaub_stunden",
    label: "Sonderurlaub Stunden",
    barClass: "bg-violet-700 text-white",
    badgeClass: "bg-violet-100 text-violet-900",
  },
  {
    value: "unbezahlter_urlaub",
    label: "Unbezahlter Urlaub",
    barClass: "bg-stone-600 text-white",
    badgeClass: "bg-stone-100 text-stone-900",
  },
  {
    value: "urlaub",
    label: "Urlaub",
    barClass: "bg-sky-700 text-white",
    badgeClass: "bg-sky-100 text-sky-900",
  },
  {
    value: "werkstatt",
    label: "Werkstatt",
    barClass: "bg-zinc-700 text-white",
    badgeClass: "bg-zinc-100 text-zinc-900",
  },
] as const;

export type EmployeeDispositionTypeValue =
  (typeof employeeDispositionTypes)[number]["value"];

export function getEmployeeDispositionType(value: string) {
  return (
    employeeDispositionTypes.find((type) => type.value === value) ??
    employeeDispositionTypes[0]
  );
}
