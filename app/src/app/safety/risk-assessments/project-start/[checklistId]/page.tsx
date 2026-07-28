import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectStartChecklistForm } from "../ProjectStartChecklistForm";

const iso = (date: Date | null) => date?.toISOString().slice(0, 10) ?? "";
export default async function EditProjectStartChecklistPage({ params }: { params: Promise<{ checklistId: string }> }) {
  const { checklistId } = await params;
  const [item, projects, employees] = await Promise.all([
    prisma.projectStartChecklist.findUnique({ include: { participants: true }, where: { id: checklistId } }),
    prisma.project.findMany({ orderBy: { projectNumber: "asc" } }),
    prisma.employee.findMany({
      include: { positions: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      where: { statusValue: "active" },
    }),
  ]);
  if (!item) notFound();
  return <AppShell title="Projektstart-Checkliste bearbeiten" description={`${item.templateCode} · Rev. ${item.templateRevision}`}>
    <div className="mb-4 flex justify-end"><a className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-black" href={`/safety/risk-assessments/project-start/${item.id}/pdf`}>PDF exportieren</a></div>
    <ProjectStartChecklistForm
      employees={employees.map((e) => ({ companyDepartment: [e.companyLabel, e.departmentLabel].filter(Boolean).join(" / "), id: e.id, label: `${e.lastName}, ${e.firstName}` }))}
      initial={{ activities: JSON.parse(item.activitiesJson), assessments: JSON.parse(item.assessmentsJson), checklistDate: iso(item.checklistDate), endDate: iso(item.endDate), id: item.id, instructionTopics: item.instructionTopics ?? "", otherActivities: item.otherActivities ?? "", participantDates: Object.fromEntries(item.participants.map((p) => [p.employeeId, iso(p.instructionDate)])), participantIds: item.participants.map((p) => p.employeeId), participantSignatures: Object.fromEntries(item.participants.map((p) => [p.employeeId, p.signatureDataUrl ?? ""])), presenterName: item.presenterName ?? "", presenterSignatureDataUrl: item.presenterSignatureDataUrl ?? "", projectId: item.projectId, responsibleManager: item.responsibleManager ?? "", responsibleMobile: item.responsibleMobile ?? "", responsiblePhone: item.responsiblePhone ?? "", sitePostalCity: item.sitePostalCity ?? "", siteStreet: item.siteStreet ?? "", startDate: iso(item.startDate), validityMonths: item.validityMonths }}
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
