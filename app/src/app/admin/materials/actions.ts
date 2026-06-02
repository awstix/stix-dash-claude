"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeMaterialNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text.length > 0 ? text : null;
}

export async function createMaterial(formData: FormData) {
  const materialNumber = normalizeMaterialNumber(formData.get("materialNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const category = optionalString(formData.get("category"));
  const unit = String(formData.get("unit") ?? "t").trim();

  if (!name) {
    throw new Error("Materialname ist ein Pflichtfeld.");
  }

  if (materialNumber) {
    const existingMaterial = await prisma.materialType.findUnique({
      where: {
        materialNumber,
      },
    });

    if (existingMaterial) {
      throw new Error(
        `Die Materialnummer "${materialNumber}" ist bereits vergeben.`
      );
    }
  }

  await prisma.materialType.create({
    data: {
      materialNumber,
      name,
      category,
      unit,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/materials");
}

export async function updateMaterial(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const materialNumber = normalizeMaterialNumber(formData.get("materialNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const category = optionalString(formData.get("category"));
  const unit = String(formData.get("unit") ?? "t").trim();

  if (!id) {
    throw new Error("Material-ID fehlt.");
  }

  if (!name) {
    throw new Error("Materialname ist ein Pflichtfeld.");
  }

  if (materialNumber) {
    const existingMaterial = await prisma.materialType.findUnique({
      where: {
        materialNumber,
      },
    });

    if (existingMaterial && existingMaterial.id !== id) {
      throw new Error(
        `Die Materialnummer "${materialNumber}" ist bereits vergeben.`
      );
    }
  }

  await prisma.materialType.update({
    where: {
      id,
    },
    data: {
      materialNumber,
      name,
      category,
      unit,
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/materials");
}

export async function deleteMaterial(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Material-ID fehlt.");
  }

  await prisma.materialType.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/materials");
}
