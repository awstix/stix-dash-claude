"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeMixNumber(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

export async function createAsphaltType(formData: FormData) {
  const mixNumber = normalizeMixNumber(formData.get("mixNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "t").trim();

  if (!mixNumber || !name || !unit) {
    throw new Error("Sortennummer, Bezeichnung und Einheit sind Pflichtfelder.");
  }

  const existingType = await prisma.asphaltMixType.findUnique({
    where: {
      mixNumber,
    },
  });

  if (existingType) {
    throw new Error(`Die Sortennummer "${mixNumber}" ist bereits vergeben.`);
  }

  await prisma.asphaltMixType.create({
    data: {
      mixNumber,
      name,
      shortName: optionalString(formData.get("shortName")),
      unit,
      category: optionalString(formData.get("category")),
      plant: optionalString(formData.get("plant")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/asphalt-types");
}

export async function updateAsphaltType(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const mixNumber = normalizeMixNumber(formData.get("mixNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "t").trim();

  if (!id) {
    throw new Error("Asphalt-ID fehlt.");
  }

  if (!mixNumber || !name || !unit) {
    throw new Error("Sortennummer, Bezeichnung und Einheit sind Pflichtfelder.");
  }

  const existingType = await prisma.asphaltMixType.findUnique({
    where: {
      mixNumber,
    },
  });

  if (existingType && existingType.id !== id) {
    throw new Error(`Die Sortennummer "${mixNumber}" ist bereits vergeben.`);
  }

  await prisma.asphaltMixType.update({
    where: {
      id,
    },
    data: {
      mixNumber,
      name,
      shortName: optionalString(formData.get("shortName")),
      unit,
      category: optionalString(formData.get("category")),
      plant: optionalString(formData.get("plant")),
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/asphalt-types");
}

export async function deleteAsphaltType(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Asphalt-ID fehlt.");
  }

  await prisma.asphaltMixType.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/asphalt-types");
}
