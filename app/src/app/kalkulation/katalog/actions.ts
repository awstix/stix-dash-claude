"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function createPosition(formData: FormData) {
  await requireSession();

  const title = text(formData, "title");
  const unit = text(formData, "unit");
  if (!title || !unit) {
    throw new Error("Bezeichnung und Einheit sind Pflichtfelder.");
  }

  await prisma.kalkulationPosition.create({
    data: {
      categoryId: text(formData, "categoryId") || null,
      code: text(formData, "code") || null,
      description: text(formData, "description") || null,
      title,
      unit,
    },
  });

  revalidatePath("/kalkulation/katalog");
}

export async function updatePosition(formData: FormData) {
  await requireSession();

  const id = text(formData, "id");
  const title = text(formData, "title");
  const unit = text(formData, "unit");
  if (!id || !title || !unit) {
    throw new Error("Bezeichnung und Einheit sind Pflichtfelder.");
  }

  await prisma.kalkulationPosition.update({
    data: {
      categoryId: text(formData, "categoryId") || null,
      code: text(formData, "code") || null,
      description: text(formData, "description") || null,
      title,
      unit,
    },
    where: { id },
  });

  revalidatePath("/kalkulation/katalog");
}

export async function archivePosition(formData: FormData) {
  await requireSession();
  const id = text(formData, "id");
  if (!id) throw new Error("Position fehlt.");

  await prisma.kalkulationPosition.update({
    data: { isActive: false },
    where: { id },
  });

  revalidatePath("/kalkulation/katalog");
}

export async function createCategory(formData: FormData) {
  await requireSession();

  const name = text(formData, "name");
  if (!name) throw new Error("Name ist ein Pflichtfeld.");

  await prisma.kalkulationPositionCategory.create({
    data: {
      name,
      parentCategoryId: text(formData, "parentCategoryId") || null,
    },
  });

  revalidatePath("/kalkulation/katalog");
}
