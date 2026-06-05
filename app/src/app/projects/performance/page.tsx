import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectNavigation } from "../ProjectNavigation";
import { ProjectManager } from "../ProjectManager";

export default async function ProjectPerformancePage() {
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
      title="Projekte Leistung"
      description="Auftragssummen, Nachträge, Leistungsstand, Abrechnung und Über-/Unterdeckung verwalten."
    >
      <ProjectNavigation active="performance" />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/projects"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Projektübersicht
        </Link>
      </div>

      <ProjectManager projects={mappedProjects} />
    </AppShell>
  );
}
