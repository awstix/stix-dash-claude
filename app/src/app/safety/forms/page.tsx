import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  parseFormEmailRecipients,
  parseProjectFormFields,
  parseProjectFormValues,
} from "@/app/projects/projectFormTypes";
import { SafetyFormCenter } from "./SafetyFormCenter";
import { SafetyTemplateBuilder } from "./SafetyTemplateBuilder";

function formatDateInput(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function SafetyFormsPage() {
  const [templates, submissions, employees, projects] = await Promise.all([
    prisma.safetyFormTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.safetyFormSubmission.findMany({
      include: { template: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { firstName: true, id: true, lastName: true },
    }),
    prisma.project.findMany({
      orderBy: [{ projectNumber: "desc" }],
      select: { id: true, name: true, projectNumber: true },
    }),
  ]);

  const activeTemplates = templates.filter((template) => template.isActive);

  return (
    <AppShell
      title="Arbeitssicherheit · Formularvorlagen"
      description="Formulare für Unfallmeldungen, Unterweisungen, Beauftragungen und Gefahrstoffe zentral erstellen."
    >
      <div className="mb-5">
        <Link
          href="/safety"
          className="text-sm font-semibold text-gray-700 hover:text-black"
        >
          ← Zurück zur Arbeitssicherheit
        </Link>
      </div>
      <SafetyFormCenter
        employees={employees.map((employee) => ({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
        }))}
        projects={projects}
        submissions={submissions.map((submission) => ({
          completedAt: formatDateInput(submission.completedAt),
          completedByName: submission.completedByName,
          createdByName: submission.createdByName,
          formDate: formatDateInput(submission.formDate),
          id: submission.id,
          projectId: submission.projectId ?? "",
          templateId: submission.templateId ?? "",
          templateName: submission.template?.name ?? "Formular",
          title: submission.title,
          values: parseProjectFormValues(submission.valuesJson),
        }))}
        templates={activeTemplates.map((template) => ({
          category: template.category,
          description: template.description,
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          name: template.name,
        }))}
      />
      <SafetyTemplateBuilder
        templates={templates.map((template) => ({
          category: template.category,
          description: template.description,
          emailRecipients: parseFormEmailRecipients(template.emailRecipientsJson),
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          name: template.name,
          paperOrientation: template.paperOrientation,
          paperSize: template.paperSize,
        }))}
      />
    </AppShell>
  );
}
