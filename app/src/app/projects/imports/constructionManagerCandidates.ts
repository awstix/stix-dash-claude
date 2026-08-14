import { prisma } from "@/lib/prisma";

/** Same "active employee with a Bauleiter position" filter used by the
 * construction-manager picker on the project create/edit forms
 * (src/app/projects/page.tsx, src/app/projects/[projectId]/page.tsx) - so
 * the import/export dropdown offers exactly the same people, not every
 * employee in the company. */
export async function getConstructionManagerCandidateNames() {
  const employees = await prisma.employee.findMany({
    include: {
      positions: {
        orderBy: [{ sortOrder: "asc" }, { positionLabel: "asc" }],
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    where: {
      statusValue: "active",
    },
  });

  return employees
    .filter((employee) => {
      const searchablePositionText = employee.positions
        .map((position) => `${position.positionLabel} ${position.positionValue}`)
        .join(" ")
        .toLowerCase();
      return searchablePositionText.includes("bauleit");
    })
    .map((employee) => `${employee.firstName} ${employee.lastName}`)
    .sort((a, b) => a.localeCompare(b, "de-DE"));
}
