"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  PROJECT_FORM_FIELD_TYPES,
  type ProjectFormFieldDefinition,
  type ProjectFormFieldType,
} from "@/app/projects/projectFormTypes";
import {
  BUILT_IN_WORKSHOP_FORMS,
  type WorkshopFormKind,
} from "./workshopFormTypes";
import { WORKSHOP_REPAIR_TEMPLATE_ID } from "./repairOrderTemplate";

type TemplateInput = {
  category: string;
  description: string;
  fields: Array<{
    description?: string;
    id?: string;
    label: string;
    options?: string[];
    required?: boolean;
    type: ProjectFormFieldType;
    width?: number;
  }>;
  id?: string;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

type SubmissionInput = {
  createdByName: string;
  formDate: string;
  id?: string;
  priority: string;
  templateId: string;
  title: string;
  values: Record<string, boolean | string>;
  vehicleId: string;
};

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

function cleanPriority(value: string) {
  return ["LOW", "NORMAL", "HIGH", "URGENT"].includes(value)
    ? value
    : "NORMAL";
}

function cleanFields(fields: TemplateInput["fields"]): ProjectFormFieldDefinition[] {
  return fields
    .map((field, index) => ({
      description: cleanText(field.description, 500),
      id:
        cleanText(field.id, 100) ||
        `field-${Date.now().toString(36)}-${index + 1}`,
      label: cleanText(field.label, 120),
      options: (field.options ?? []).map((value) => cleanText(value, 100)).filter(Boolean),
      required: Boolean(field.required),
      type: PROJECT_FORM_FIELD_TYPES.includes(field.type) ? field.type : "text",
      width:
        Number.isInteger(field.width) && Number(field.width) >= 1 && Number(field.width) <= 6
          ? Number(field.width)
          : 6,
    }))
    .filter((field) => field.label);
}

function refresh() {
  revalidatePath("/workshop");
  revalidatePath("/workshop/forms");
}

export async function saveWorkshopFormTemplate(input: TemplateInput) {
  const name = cleanText(input.name, 120);
  const fields = cleanFields(input.fields);
  if (!name) throw new Error("Bitte einen Namen für die Vorlage eintragen.");
  if (fields.length === 0) throw new Error("Bitte mindestens ein Feld anlegen.");

  const data = {
    category: cleanText(input.category, 80) || null,
    description: cleanText(input.description, 500) || null,
    fieldsJson: JSON.stringify(fields),
    name,
    paperOrientation: input.paperOrientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT",
    paperSize: input.paperSize === "A5" ? "A5" : "A4",
  };

  if (input.id) {
    await prisma.workshopFormTemplate.update({ where: { id: input.id }, data });
  } else {
    const max = await prisma.workshopFormTemplate.aggregate({ _max: { sortOrder: true } });
    await prisma.workshopFormTemplate.create({
      data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 10 },
    });
  }
  refresh();
}

export async function deleteWorkshopFormTemplate(id: string) {
  if (!id) return;
  if (id === WORKSHOP_REPAIR_TEMPLATE_ID) {
    throw new Error("Die Reparaturvorlage kann bearbeitet, aber nicht gelöscht werden.");
  }
  await prisma.workshopFormTemplate.delete({ where: { id } });
  refresh();
}

export async function saveWorkshopFormSubmission(input: SubmissionInput) {
  const builtIn = BUILT_IN_WORKSHOP_FORMS.find((item) => item.id === input.templateId);
  const custom = builtIn
    ? null
    : await prisma.workshopFormTemplate.findFirst({
        where: { id: input.templateId, isActive: true },
      });
  if (!builtIn && !custom) throw new Error("Formularvorlage wurde nicht gefunden.");

  const kind: WorkshopFormKind = builtIn?.kind ?? "CUSTOM";
  const title = cleanText(input.title, 140) || builtIn?.name || custom?.name || "Werkstattformular";
  const snapshot = builtIn
    ? { fields: [], kind, name: builtIn.name, paperOrientation: "PORTRAIT", paperSize: "A4" }
    : {
        fields: JSON.parse(custom!.fieldsJson),
        kind,
        name: custom!.name,
        paperOrientation: custom!.paperOrientation,
        paperSize: custom!.paperSize,
      };
  const data = {
    createdByName: cleanText(input.createdByName, 120) || null,
    formDate: cleanDate(input.formDate),
    priority: cleanPriority(input.priority),
    templateId: custom?.id ?? null,
    templateKind: kind,
    templateSnapshotJson: JSON.stringify(snapshot),
    title,
    valuesJson: JSON.stringify(input.values),
    vehicleId: cleanText(input.vehicleId, 100) || null,
  };

  if (input.id) {
    await prisma.workshopFormSubmission.update({ where: { id: input.id }, data });
  } else {
    await prisma.workshopFormSubmission.create({ data });
  }
  refresh();
}

export async function deleteWorkshopFormSubmission(id: string) {
  if (!id) return;
  await prisma.workshopFormSubmission.delete({ where: { id } });
  refresh();
}
