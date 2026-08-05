import { prisma } from "@/lib/prisma";

/** Sät einen Standard-Eintrag "Arbeiten", falls noch keine Tätigkeit angelegt wurde. */
export async function ensureCrewTimeActivitiesSeeded() {
  const count = await prisma.crewTimeActivity.count();
  if (count > 0) return;
  await prisma.crewTimeActivity.create({
    data: { label: "Arbeiten", sortOrder: 10 },
  });
}

export async function getCrewTimeActivities() {
  await ensureCrewTimeActivitiesSeeded();
  return prisma.crewTimeActivity.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}
