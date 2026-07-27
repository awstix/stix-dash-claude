import { prisma } from "@/lib/prisma";

export async function getGeneralRiskAssessmentFormOptions() {
  const [projects, employees] = await Promise.all([
    prisma.project.findMany({ orderBy: { projectNumber: "asc" } }),
    prisma.employee.findMany({
      include: { positions: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      where: { statusValue: "active" },
    }),
  ]);
  return {
    employees: employees.map((employee) => ({
      companyDepartment: [
        employee.companyLabel,
        employee.departmentLabel,
      ]
        .filter(Boolean)
        .join(" / "),
      id: employee.id,
      label: `${employee.lastName}, ${employee.firstName}`,
    })),
    managerOptions: employees
      .filter((employee) =>
        employee.positions.some((position) =>
          position.positionLabel.toLocaleLowerCase("de").includes("bauleit"),
        ),
      )
      .map((employee) => `${employee.lastName}, ${employee.firstName}`),
    projects: projects.map((project) => ({
      constructionManager: project.constructionManager ?? "",
      id: project.id,
      label: `${project.projectNumber} · ${project.name}`,
    })),
  };
}

export function iso(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? "";
}
