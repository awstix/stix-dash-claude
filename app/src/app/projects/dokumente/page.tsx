import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectDocumentManager } from "../ProjectDocumentManager";
import { ProjectNavigation } from "../ProjectNavigation";
import { getAccessibleProjectIds } from "@/lib/auth-access";

export default async function ProjectDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const initialProjectId = (await searchParams)?.projectId ?? "";
  const accessibleProjectIds = await getAccessibleProjectIds();
  const projectWhere =
    accessibleProjectIds === null ? undefined : { id: { in: accessibleProjectIds } };
  const contentWhere =
    accessibleProjectIds === null
      ? undefined
      : { projectId: { in: accessibleProjectIds } };
  const [projects, folders, documents] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: [{ projectNumber: "asc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.projectDocumentFolder.findMany({
      where: contentWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.projectDocument.findMany({
      where: contentWhere,
      include: {
        folder: true,
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: [{ uploadedAt: "desc" }],
    }),
  ]);

  return (
    <AppShell
      title="Projekte Dokumente"
      description="Projektdateien hochladen, in Ordner legen, filtern, verschieben, herunterladen und als Detailvorschau prüfen."
    >
      <ProjectNavigation active="documents" />

      <ProjectDocumentManager
        documents={documents.map((document) => ({
          displayName: document.displayName,
          fileSizeBytes: document.fileSizeBytes,
          folderId: document.folderId,
          folderName: document.folder?.name ?? null,
          id: document.id,
          mimeType: document.mimeType,
          originalFileName: document.originalFileName,
          projectId: document.projectId,
          projectName: document.project.name,
          projectNumber: document.project.projectNumber,
          publicUrl: document.publicUrl,
          uploadedAt: document.uploadedAt.toISOString(),
          uploadedByName: document.uploadedByName,
          uploadedByUserId: document.uploadedByUserId,
        }))}
        folders={folders.map((folder) => ({
          id: folder.id,
          name: folder.name,
          projectId: folder.projectId,
          sortOrder: folder.sortOrder,
        }))}
        initialProjectId={initialProjectId}
        projects={projects.map((project) => ({
          id: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        }))}
      />
    </AppShell>
  );
}
