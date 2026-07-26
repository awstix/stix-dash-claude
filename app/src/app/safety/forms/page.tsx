import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  parseFormEmailRecipients,
  parseProjectFormFields,
} from "@/app/projects/projectFormTypes";
import { SafetyTemplateBuilder } from "./SafetyTemplateBuilder";

type SafetyTemplateRow = {
  category: string | null;
  description: string | null;
  emailRecipientsJson: string | null;
  fieldsJson: string;
  id: string;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

export default async function SafetyFormsPage() {
  const templates = await prisma.$queryRawUnsafe<SafetyTemplateRow[]>(
    `SELECT id, name, category, description, fieldsJson, emailRecipientsJson, paperSize, paperOrientation
     FROM SafetyFormTemplate
     ORDER BY sortOrder ASC, name ASC`,
  );

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
