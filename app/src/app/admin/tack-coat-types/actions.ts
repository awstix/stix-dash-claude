"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const TACK_COAT_CATEGORY = "Anspritzmittel";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeMaterialNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text.length > 0 ? text : null;
}

function revalidateTackCoatConsumers() {
  revalidatePath("/admin/tack-coat-types");
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/crew-dispatch");
}

export async function createTackCoatType(formData: FormData) {
  const materialNumber = normalizeMaterialNumber(formData.get("materialNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "l").trim() || "l";

  if (!name) {
    throw new Error("Bezeichnung ist ein Pflichtfeld.");
  }

  if (materialNumber) {
    const existingMaterial = await prisma.materialType.findUnique({
      where: {
        materialNumber,
      },
    });

    if (existingMaterial) {
      throw new Error(`Die Nummer "${materialNumber}" ist bereits vergeben.`);
    }
  }

  await prisma.materialType.create({
    data: {
      materialNumber,
      name,
      category: TACK_COAT_CATEGORY,
      unit,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateTackCoatConsumers();
}

export async function updateTackCoatType(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const materialNumber = normalizeMaterialNumber(formData.get("materialNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "l").trim() || "l";

  if (!id) {
    throw new Error("Anspritzmittel-ID fehlt.");
  }

  if (!name) {
    throw new Error("Bezeichnung ist ein Pflichtfeld.");
  }

  if (materialNumber) {
    const existingMaterial = await prisma.materialType.findUnique({
      where: {
        materialNumber,
      },
    });

    if (existingMaterial && existingMaterial.id !== id) {
      throw new Error(`Die Nummer "${materialNumber}" ist bereits vergeben.`);
    }
  }

  await prisma.materialType.update({
    where: {
      id,
    },
    data: {
      materialNumber,
      name,
      category: TACK_COAT_CATEGORY,
      unit,
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateTackCoatConsumers();
}

export async function deleteTackCoatType(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Anspritzmittel-ID fehlt.");
  }

  await prisma.materialType.delete({
    where: {
      id,
    },
  });

  revalidateTackCoatConsumers();
}
