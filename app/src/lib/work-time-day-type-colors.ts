export const workTimeDayTypeColorOptions = [
  { badgeClass: "bg-pink-100 text-pink-900", barClass: "bg-pink-700 text-white", key: "pink", label: "Pink" },
  { badgeClass: "bg-gray-100 text-gray-800", barClass: "bg-gray-500 text-white", key: "gray", label: "Grau" },
  {
    badgeClass: "bg-orange-100 text-orange-900",
    barClass: "bg-orange-600 text-white",
    key: "orange",
    label: "Orange",
  },
  { badgeClass: "bg-green-100 text-green-900", barClass: "bg-green-600 text-white", key: "green", label: "Grün" },
  {
    badgeClass: "bg-slate-100 text-slate-900",
    barClass: "bg-slate-600 text-white",
    key: "slate",
    label: "Dunkelgrau",
  },
  { badgeClass: "bg-teal-100 text-teal-900", barClass: "bg-teal-600 text-white", key: "teal", label: "Türkis" },
  { badgeClass: "bg-red-100 text-red-900", barClass: "bg-red-600 text-white", key: "red", label: "Rot" },
  { badgeClass: "bg-blue-100 text-blue-900", barClass: "bg-blue-600 text-white", key: "blue", label: "Blau" },
  {
    badgeClass: "bg-amber-100 text-amber-950",
    barClass: "bg-amber-500 text-gray-950",
    key: "amber",
    label: "Gelb",
  },
  {
    badgeClass: "bg-violet-100 text-violet-900",
    barClass: "bg-violet-600 text-white",
    key: "violet",
    label: "Violett",
  },
] as const;

export type WorkTimeDayTypeColorKey = (typeof workTimeDayTypeColorOptions)[number]["key"];

export function getWorkTimeDayTypeColor(colorKey: string) {
  return (
    workTimeDayTypeColorOptions.find((option) => option.key === colorKey) ?? workTimeDayTypeColorOptions[1]
  );
}
