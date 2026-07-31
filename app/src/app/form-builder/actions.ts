"use server";

import { requireSession } from "@/lib/auth-access";

import { revalidatePath } from "next/cache";

import {
  createProjectFormTemplate,
  deleteProjectFormTemplate,
  updateProjectFormTemplate,
} from "@/app/projects/actions";
import type { ProjectFormFieldDefinition } from "@/app/projects/projectFormTypes";
import {
  deleteSafetyFormTemplate,
  saveSafetyFormTemplate,
} from "@/app/safety/actions";
import {
  deleteWorkshopFormTemplate,
  saveWorkshopFormTemplate,
} from "@/app/workshop/form-actions";
import { WORKSHOP_REPAIR_TEMPLATE_ID } from "@/app/workshop/repairOrderTemplate";

export type UniversalFormScope = "PROJECT" | "WORKSHOP" | "SAFETY";

export type UniversalFormTemplateInput = {
  category: string;
  description: string;
  emailRecipients?: string[];
  fields: ProjectFormFieldDefinition[];
  id?: string;
  name: string;
  paperOrientation: string;
  paperSize: string;
  scope: UniversalFormScope;
};

function assertScope(value: string): UniversalFormScope {
  if (value === "PROJECT" || value === "WORKSHOP" || value === "SAFETY") {
    return value;
  }

  throw new Error("Unbekannter Formularbereich.");
}

function revalidateUniversalBuilder() {
  revalidatePath("/form-builder");
  revalidatePath("/projects/formulare");
  revalidatePath("/workshop/forms");
  revalidatePath("/safety/forms");
}

export async function saveUniversalFormTemplate(
  input: UniversalFormTemplateInput,
) {
  await requireSession();
  const scope = assertScope(input.scope);

  if (scope === "PROJECT") {
    if (input.id) {
      await updateProjectFormTemplate({
        ...input,
        id: input.id,
      });
    } else {
      await createProjectFormTemplate(input);
    }
  } else if (scope === "WORKSHOP") {
    await saveWorkshopFormTemplate({
      category: input.category,
      description: input.description,
      emailRecipients: input.emailRecipients,
      fields: input.fields,
      id: input.id,
      name: input.name,
      paperOrientation: input.paperOrientation,
      paperSize: input.paperSize,
    });
  } else {
    await saveSafetyFormTemplate({
      category: input.category,
      description: input.description,
      emailRecipients: input.emailRecipients,
      fields: input.fields,
      id: input.id,
      name: input.name,
      paperOrientation: input.paperOrientation,
      paperSize: input.paperSize,
    });
  }

  revalidateUniversalBuilder();
}

export async function deleteUniversalFormTemplate(
  scopeValue: UniversalFormScope,
  id: string,
) {
  await requireSession();
  const scope = assertScope(scopeValue);
  const templateId = id.trim();

  if (!templateId) return;

  if (scope === "PROJECT") {
    await deleteProjectFormTemplate({ id: templateId });
  } else if (scope === "WORKSHOP") {
    if (templateId === WORKSHOP_REPAIR_TEMPLATE_ID) {
      throw new Error(
        "Die Reparaturvorlage kann bearbeitet, aber nicht gelöscht werden.",
      );
    }
    await deleteWorkshopFormTemplate(templateId);
  } else {
    await deleteSafetyFormTemplate(templateId);
  }

  revalidateUniversalBuilder();
}
