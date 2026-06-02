import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectManager } from "./ProjectManager";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  const mappedProjects = projects.map((project) => ({
    id: project.id,
    projectNumber: project.projectNumber,
    name: project.name,
    constructionManager: project.constructionManager ?? "",
    plannedStart: project.plannedStart?.toISOString().slice(0, 10) ?? "",
    plannedEnd: project.plannedEnd?.toISOString().slice(0, 10) ?? "",
    actualStart: project.actualStart?.toISOString().slice(0, 10) ?? "",
    actualEnd: project.actualEnd?.toISOString().slice(0, 10) ?? "",
    status: project.status,
    contractValueNet: project.contractValueNet,
    changeOrdersNet: project.changeOrdersNet,
    progressPercent: project.progressPercent,
    paymentsNet: project.paymentsNet,
    notes: project.notes ?? "",
  }));

  return (
    <AppShell
      title="Projekte"
      description="Baustellen, Bauleiter, Status, Auftragssummen und Leistungsstände verwalten."
    >
      <ProjectManager projects={mappedProjects} />
    </AppShell>
  );
}
