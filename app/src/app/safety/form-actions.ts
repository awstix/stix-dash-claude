"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

type SubmissionInput = {
  completedAt?: string;
  completedByName?: string;
  createdByName: string;
  formDate: string;
  id?: string;
  projectId?: string;
  templateId: string;
  title: string;
  values: Record<string, boolean | string>;
};

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : null;
}

function refresh() {
  revalidatePath("/safety");
  revalidatePath("/safety/forms");
}

export async function saveSafetyFormSubmission(input: SubmissionInput) {
  await requireSession();

  const template = await prisma.safetyFormTemplate.findFirst({
    where: { id: input.templateId, isActive: true },
  });
  if (!template) throw new Error("Formularvorlage wurde nicht gefunden.");

  const title = cleanText(input.title, 140) || template.name;
  const snapshot = {
    fields: JSON.parse(template.fieldsJson),
    name: template.name,
    paperOrientation: template.paperOrientation,
    paperSize: template.paperSize,
  };
  const completedAt = cleanDate(input.completedAt ?? "");
  const projectId = cleanText(input.projectId, 100) || null;
  const data = {
    completedAt,
    completedByName: completedAt
      ? cleanText(input.completedByName, 120) || null
      : null,
    createdByName: cleanText(input.createdByName, 120) || null,
    formDate: cleanDate(input.formDate),
    projectId,
    templateId: template.id,
    templateSnapshotJson: JSON.stringify(snapshot),
    title,
    valuesJson: JSON.stringify(input.values),
  };

  if (input.id) {
    await prisma.safetyFormSubmission.update({ where: { id: input.id }, data });
  } else {
    await prisma.safetyFormSubmission.create({ data });
  }

  refresh();
}

export async function deleteSafetyFormSubmission(id: string) {
  await requireSession();
  const submissionId = cleanText(id, 100);
  if (!submissionId) return;

  await prisma.safetyFormSubmission.delete({ where: { id: submissionId } });
  refresh();
}
