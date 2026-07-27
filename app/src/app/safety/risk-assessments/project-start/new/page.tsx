import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectStartChecklistForm } from "../ProjectStartChecklistForm";

export default async function NewProjectStartChecklistPage() {
  const [projects, employees] = await Promise.all([
    prisma.project.findMany({ orderBy: { projectNumber: "asc" } }),
    prisma.employee.findMany({
      include: { positions: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      where: { statusValue: "active" },
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return <AppShell title="Projektstart Tiefbau ausfüllen" description="A-30-30-001 · Rev. 00">
    <ProjectStartChecklistForm
      employees={employees.map((e) => ({ companyDepartment: [e.companyLabel, e.departmentLabel].filter(Boolean).join(" / "), id: e.id, label: `${e.lastName}, ${e.firstName}` }))}
      initial={{ activities: [], assessments: {}, checklistDate: today, endDate: "", instructionTopics: "", otherActivities: "", participantDates: {}, participantIds: [], participantSignatures: {}, presenterName: "", presenterSignatureDataUrl: "", projectId: "", responsibleManager: "", responsibleMobile: "", responsiblePhone: "", sitePostalCity: "", siteStreet: "", startDate: today }}
      managerOptions={employees
        .filter((employee) =>
          employee.positions.some((position) =>
            position.positionLabel.toLocaleLowerCase("de").includes("bauleit"),
          ),
        )
        .map((employee) => `${employee.lastName}, ${employee.firstName}`)}
      projects={projects.map((p) => ({
        constructionManager: p.constructionManager ?? "",
        id: p.id,
        label: `${p.projectNumber} · ${p.name}`,
      }))}
    />
  </AppShell>;
}
