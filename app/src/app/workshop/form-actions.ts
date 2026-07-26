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
  emailRecipients?: string[];
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
  completedAt?: string;
  completedByName?: string;
  createdByName: string;
  formDate: string;
  id?: string;
  inventoryItemId?: string;
  priority: string;
  templateId: string;
  title: string;
  values: Record<string, boolean | string>;
  vehicleId: string;
};

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanEmailRecipients(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .flatMap((value) => String(value ?? "").split(/[\n,;]/))
        .map((value) => cleanText(value, 180).toLowerCase())
        .filter(Boolean),
    ),
  );
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

async function getInventoryStatusAfterWorkshopFormChange(
  inventoryItemId: string,
) {
  const [openOrders, openForms] = await Promise.all([
    prisma.workshopRepairOrder.count({
      where: {
        inventoryItemId,
        status: {
          notIn: ["DONE", "CANCELLED"],
        },
      },
    }),
    prisma.workshopFormSubmission.count({
      where: {
        completedAt: null,
        inventoryItemId,
      },
    }),
  ]);

  return openOrders > 0 || openForms > 0 ? "DEFECT" : "ACTIVE";
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
    emailRecipientsJson: JSON.stringify(cleanEmailRecipients(input.emailRecipients)),
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
  const inventoryItemId = cleanText(input.inventoryItemId, 100) || null;
  const completedAt = cleanDate(input.completedAt ?? "");
  const data = {
    completedAt,
    completedByName: completedAt
      ? cleanText(input.completedByName, 120) || null
      : null,
    createdByName: cleanText(input.createdByName, 120) || null,
    formDate: cleanDate(input.formDate),
    inventoryItemId,
    priority: cleanPriority(input.priority),
    templateId: custom?.id ?? null,
    templateKind: kind,
    templateSnapshotJson: JSON.stringify(snapshot),
    title,
    valuesJson: JSON.stringify(input.values),
    vehicleId: cleanText(input.vehicleId, 100) || null,
  };

  if (input.id) {
    const previousSubmission = await prisma.workshopFormSubmission.findUnique({
      where: {
        id: input.id,
      },
      select: {
        inventoryItemId: true,
      },
    });

    await prisma.workshopFormSubmission.update({ where: { id: input.id }, data });

    const affectedInventoryIds = new Set(
      [previousSubmission?.inventoryItemId, inventoryItemId].filter(Boolean) as string[],
    );

    for (const affectedInventoryId of affectedInventoryIds) {
      await prisma.inventoryItem.update({
        where: {
          id: affectedInventoryId,
        },
        data: {
          status: await getInventoryStatusAfterWorkshopFormChange(affectedInventoryId),
        },
      });
    }
  } else {
    const submission = await prisma.workshopFormSubmission.create({ data });
    if (inventoryItemId) {
      await prisma.inventoryItem.update({
        where: {
          id: inventoryItemId,
        },
        data: {
          status: await getInventoryStatusAfterWorkshopFormChange(inventoryItemId),
        },
      });

      await prisma.inventoryUsageHistory.create({
        data: {
          eventType: "WORKSHOP_FORM",
          itemId: inventoryItemId,
          notes: `Werkstattformular erstellt: ${submission.title}`,
        },
      });
    }
  }
  refresh();
  if (inventoryItemId) {
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${inventoryItemId}`);
  }
}

export async function deleteWorkshopFormSubmission(id: string) {
  if (!id) return;
  const submission = await prisma.workshopFormSubmission.findUnique({
    where: {
      id,
    },
    select: {
      inventoryItemId: true,
    },
  });

  await prisma.workshopFormSubmission.delete({ where: { id } });

  if (submission?.inventoryItemId) {
    await prisma.inventoryItem.update({
      where: {
        id: submission.inventoryItemId,
      },
      data: {
        status: await getInventoryStatusAfterWorkshopFormChange(
          submission.inventoryItemId,
        ),
      },
    });
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${submission.inventoryItemId}`);
  }
  refresh();
}
