export type WorkTimeDayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const workTimeDayKeys: WorkTimeDayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const workTimeDayLabels: Record<WorkTimeDayKey, string> = {
  friday: "Fr",
  monday: "Mo",
  saturday: "Sa",
  sunday: "So",
  thursday: "Do",
  tuesday: "Di",
  wednesday: "Mi",
};
