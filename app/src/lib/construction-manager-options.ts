import { prisma } from "@/lib/prisma";

export type ConstructionManagerOption = {
  employeeId: string;
  label: string;
  positionsLabel: string;
  value: string;
};

export type SiteContactOption = {
  category: string;
  employeeId: string;
  name: string;
  positionsLabel: string;
};

/** Active employees with a Bauleiter position, in the shape the
 * construction-manager pickers (create/edit dialog, filters) need. Single
 * source of truth for "who counts as a Bauleiter" - matched by position
 * text containing "bauleit", same as the safety risk-assessment pages. */
export async function getConstructionManagerOptions(): Promise<
  ConstructionManagerOption[]
> {
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
    .flatMap((employee) => {
      const positionsLabel = employee.positions
        .map((position) => position.positionLabel)
        .join(", ");
      const searchablePositionText = employee.positions
        .map((position) => `${position.positionLabel} ${position.positionValue}`)
        .join(" ")
        .toLowerCase();

      if (!searchablePositionText.includes("bauleit")) {
        return [];
      }

      return [
        {
          employeeId: employee.id,
          label: `${employee.firstName} ${employee.lastName}`,
          positionsLabel,
          value: `${employee.firstName} ${employee.lastName}`,
        },
      ];
    })
    .sort((a, b) => a.label.localeCompare(b.label, "de-DE"));
}

/** All active employees, one entry each, grouped by department ("Kategorie")
 * - the picker for site "Kontaktpersonen" lets you narrow by category first,
 * then pick the employee, or search by name directly across all of them. */
export async function getSiteContactOptions(): Promise<SiteContactOption[]> {
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
    .map((employee) => ({
      category: employee.departmentLabel || "Ohne Kategorie",
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      positionsLabel: employee.positions
        .map((position) => position.positionLabel)
        .join(", "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de-DE"));
}
