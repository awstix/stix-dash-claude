import { prisma } from "@/lib/prisma";

export type ConstructionManagerOption = {
  employeeId: string;
  label: string;
  positionsLabel: string;
  value: string;
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

/** Active employees with a Vorarbeiter/Polier position - same pattern as
 * getConstructionManagerOptions, matched by position text containing
 * "vorarbeit" or "polier". */
export async function getForemanOptions(): Promise<ConstructionManagerOption[]> {
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

      if (
        !searchablePositionText.includes("vorarbeit") &&
        !searchablePositionText.includes("polier")
      ) {
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
