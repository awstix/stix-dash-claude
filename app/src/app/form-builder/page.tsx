import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import {
  parseFormEmailRecipients,
  parseProjectFormFields,
} from "@/app/projects/projectFormTypes";
import {
  ensureWorkshopRepairOrderTemplate,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "@/app/workshop/repairOrderTemplate";
import {
  UniversalFormTemplateBuilder,
  type UniversalFormTemplate,
} from "./UniversalFormTemplateBuilder";

type TemplateRow = {
  category: string | null;
  description: string | null;
  emailRecipientsJson: string | null;
  fieldsJson: string;
  id: string;
  name: string;
  paperOrientation: string;
  paperSize: string;
  sortOrder: number;
};

export default async function UniversalFormBuilderPage({
  searchParams,
}: {
  searchParams?: Promise<{ scope?: string; templateId?: string }>;
}) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const initialScope =
    params.scope === "WORKSHOP" || params.scope === "SAFETY"
      ? params.scope
      : "PROJECT";

  await ensureWorkshopRepairOrderTemplate();

  const [projectTemplates, workshopTemplates, safetyTemplates] =
    await Promise.all([
      prisma.$queryRawUnsafe<TemplateRow[]>(
        `SELECT id, name, category, description, fieldsJson, emailRecipientsJson,
                paperSize, paperOrientation, sortOrder
         FROM ProjectFormTemplate
         WHERE isActive = 1
         ORDER BY sortOrder ASC, name ASC`,
      ),
      prisma.$queryRawUnsafe<TemplateRow[]>(
        `SELECT id, name, category, description, fieldsJson, emailRecipientsJson,
                paperSize, paperOrientation, sortOrder
         FROM WorkshopFormTemplate
         WHERE isActive = 1
         ORDER BY sortOrder ASC, name ASC`,
      ),
      prisma.$queryRawUnsafe<TemplateRow[]>(
        `SELECT id, name, category, description, fieldsJson, emailRecipientsJson,
                paperSize, paperOrientation, sortOrder
         FROM SafetyFormTemplate
         WHERE isActive = 1
         ORDER BY sortOrder ASC, name ASC`,
      ),
    ]);

  const templates: UniversalFormTemplate[] = [
    ...projectTemplates.map((template) => toTemplate(template, "PROJECT")),
    ...workshopTemplates.map((template) => ({
      ...toTemplate(template, "WORKSHOP"),
      isSystemTemplate: template.id === WORKSHOP_REPAIR_TEMPLATE_ID,
    })),
    ...safetyTemplates.map((template) => toTemplate(template, "SAFETY")),
  ];

  return (
    <AppShell
      title="Formularbuilder"
      description="Ein gemeinsamer Builder für Projektformulare, Werkstattformulare und Arbeitssicherheit."
    >
      <UniversalFormTemplateBuilder
        initialTemplateId={params.templateId}
        initialScope={initialScope}
        templates={templates}
      />
    </AppShell>
  );
}

function toTemplate(
  template: TemplateRow,
  scope: UniversalFormTemplate["scope"],
): UniversalFormTemplate {
  return {
    category: template.category,
    description: template.description,
    emailRecipients: parseFormEmailRecipients(template.emailRecipientsJson),
    fields: parseProjectFormFields(template.fieldsJson),
    id: template.id,
    name: template.name,
    paperOrientation: template.paperOrientation,
    paperSize: template.paperSize,
    scope,
  };
}
