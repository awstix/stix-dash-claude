import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectFormManager } from "../ProjectFormManager";
import { ProjectNavigation } from "../ProjectNavigation";
import {
  parseProjectFormFields,
  parseFormEmailRecipients,
  parseProjectFormSnapshotFields,
  parseProjectFormSnapshotSettings,
  parseProjectFormValues,
} from "../projectFormTypes";
import { getAccessibleProjectIds } from "@/lib/auth-access";

export default async function ProjectFormsPage({
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
  const [projects, templates, submissions, companyInfo] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
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
      where: contentWhere,
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
    prisma.companyInfo.findUnique({
      where: { id: "default" },
    }),
  ]);

  return (
    <AppShell
      title="Projekte Formulare"
      description="Formularvorlagen erstellen, projektbezogen ausfüllen und gespeicherte Formulare in der Projektakte sammeln."
    >
      <ProjectNavigation active="forms" />

      <ProjectFormManager
        companyInfo={getCompanyInfo(companyInfo)}
        initialProjectId={initialProjectId}
        projects={projects.map((project) => ({
          id: project.id,
          label: `${project.projectNumber} · ${project.name}`,
        }))}
        submissions={submissions.map((submission) => {
          const fallbackFields = parseProjectFormFields(
            submission.template?.fieldsJson,
          );
          const snapshotSettings = parseProjectFormSnapshotSettings(
            submission.templateSnapshotJson,
            submission.template,
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
            paperOrientation: snapshotSettings.paperOrientation,
            paperSize: snapshotSettings.paperSize,
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
          emailRecipients: parseFormEmailRecipients(template.emailRecipientsJson),
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          isActive: template.isActive,
          name: template.name,
          paperOrientation:
            template.paperOrientation === "LANDSCAPE"
              ? "LANDSCAPE"
              : "PORTRAIT",
          paperSize: template.paperSize === "A5" ? "A5" : "A4",
          sortOrder: template.sortOrder,
        }))}
      />
    </AppShell>
  );
}

function getCompanyInfo(
  company: Awaited<ReturnType<typeof prisma.companyInfo.findUnique>>,
) {
  return {
    city: company?.city ?? "Niedernberg",
    companyName: company?.companyName ?? "Josef Stix GmbH & Co. KG",
    country: company?.country ?? "Deutschland",
    email: company?.email ?? "info@stix-bau.de",
    facebookUrl: company?.facebookUrl ?? null,
    instagramUrl: company?.instagramUrl ?? null,
    legalName: company?.legalName ?? null,
    linkedinUrl: company?.linkedinUrl ?? null,
    logoPublicUrl: company?.logoPublicUrl ?? null,
    mobile: company?.mobile ?? null,
    phone: company?.phone ?? "06028 4076000",
    postalCode: company?.postalCode ?? "63843",
    street: company?.street ?? "Depotstraße 2",
    tiktokUrl: company?.tiktokUrl ?? null,
    website: company?.website ?? "https://www.stix-bau.de",
    youtubeUrl: company?.youtubeUrl ?? null,
  };
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
