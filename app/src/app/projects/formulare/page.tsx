import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectFormManager } from "../ProjectFormManager";
import { ProjectNavigation } from "../ProjectNavigation";
import {
  parseProjectFormFields,
  parseProjectFormSnapshotFields,
  parseProjectFormValues,
} from "../projectFormTypes";

export default async function ProjectFormsPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string }>;
}) {
  const initialProjectId = (await searchParams)?.projectId ?? "";
  const [projects, templates, submissions] = await Promise.all([
    prisma.project.findMany({
      orderBy: [{ projectNumber: "asc" }],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.projectFormTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.projectFormSubmission.findMany({
      include: {
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
        template: true,
      },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);

  return (
    <AppShell
      title="Projekte Formulare"
      description="Formularvorlagen erstellen, projektbezogen ausfüllen und gespeicherte Formulare in der Projektakte sammeln."
    >
      <ProjectNavigation active="forms" />

      <ProjectFormManager
        initialProjectId={initialProjectId}
        projects={projects.map((project) => ({
          id: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        }))}
        submissions={submissions.map((submission) => {
          const fallbackFields = parseProjectFormFields(
            submission.template?.fieldsJson,
          );

          return {
            createdAt: submission.createdAt.toISOString(),
            createdByName: submission.createdByName,
            fields: parseProjectFormSnapshotFields(
              submission.templateSnapshotJson,
              fallbackFields,
            ),
            formDate: submission.formDate?.toISOString() ?? null,
            id: submission.id,
            projectId: submission.projectId,
            projectLabel: `${submission.project.projectNumber} · ${submission.project.name}`,
            templateId: submission.templateId,
            templateName:
              submission.template?.name ??
              getSnapshotTemplateName(submission.templateSnapshotJson),
            title: submission.title,
            values: parseProjectFormValues(submission.valuesJson),
          };
        })}
        templates={templates.map((template) => ({
          category: template.category,
          description: template.description,
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          isActive: template.isActive,
          name: template.name,
          sortOrder: template.sortOrder,
        }))}
      />
    </AppShell>
  );
}

function getSnapshotTemplateName(snapshotJson: string | null) {
  if (!snapshotJson) {
    return "Vorlage entfernt";
  }

  try {
    const parsed = JSON.parse(snapshotJson) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name
      : "Vorlage entfernt";
  } catch {
    return "Vorlage entfernt";
  }
}
