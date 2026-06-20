import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { parseProjectFormFields } from "@/app/projects/projectFormTypes";
import { WorkshopTemplateBuilder } from "./WorkshopTemplateBuilder";
import {
  ensureWorkshopRepairOrderTemplate,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "../repairOrderTemplate";

export default async function WorkshopFormsPage() {
  await ensureWorkshopRepairOrderTemplate();
  const templates = await prisma.workshopFormTemplate.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell
      title="Werkstatt · Formularvorlagen"
      description="Eigene Werkstattformulare erstellen und die Felder per Ziehen anordnen."
    >
      <div className="mb-5">
        <Link href="/workshop" className="text-sm font-semibold text-gray-700 hover:text-black">
          ← Zurück zur Werkstatt
        </Link>
      </div>
      <WorkshopTemplateBuilder
        templates={templates.map((template) => ({
          category: template.category,
          description: template.description,
          fields: parseProjectFormFields(template.fieldsJson),
          id: template.id,
          isRepairTemplate: template.id === WORKSHOP_REPAIR_TEMPLATE_ID,
          name: template.name,
          paperOrientation: template.paperOrientation,
          paperSize: template.paperSize,
        }))}
      />
    </AppShell>
  );
}
