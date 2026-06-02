"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeTypeNumber(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

export async function createConcreteType(formData: FormData) {
  const typeNumber = normalizeTypeNumber(formData.get("typeNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "m³").trim();

  if (!typeNumber || !name || !unit) {
    throw new Error("Sortennummer, Bezeichnung und Einheit sind Pflichtfelder.");
  }

  const existingType = await prisma.concreteType.findUnique({
    where: {
      typeNumber,
    },
  });

  if (existingType) {
    throw new Error(`Die Betonsorte "${typeNumber}" ist bereits vergeben.`);
  }

  await prisma.concreteType.create({
    data: {
      typeNumber,
      name,
      strengthClass: optionalString(formData.get("strengthClass")),
      exposureClass: optionalString(formData.get("exposureClass")),
      aggregate: optionalString(formData.get("aggregate")),
      consistency: optionalString(formData.get("consistency")),
      unit,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/concrete-types");
}

export async function updateConcreteType(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const typeNumber = normalizeTypeNumber(formData.get("typeNumber"));
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "m³").trim();

  if (!id) {
    throw new Error("Beton-ID fehlt.");
  }

  if (!typeNumber || !name || !unit) {
    throw new Error("Sortennummer, Bezeichnung und Einheit sind Pflichtfelder.");
  }

  const existingType = await prisma.concreteType.findUnique({
    where: {
      typeNumber,
    },
  });

  if (existingType && existingType.id !== id) {
    throw new Error(`Die Betonsorte "${typeNumber}" ist bereits vergeben.`);
  }

  await prisma.concreteType.update({
    where: {
      id,
    },
    data: {
      typeNumber,
      name,
      strengthClass: optionalString(formData.get("strengthClass")),
      exposureClass: optionalString(formData.get("exposureClass")),
      aggregate: optionalString(formData.get("aggregate")),
      consistency: optionalString(formData.get("consistency")),
      unit,
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/concrete-types");
}

export async function deleteConcreteType(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Beton-ID fehlt.");
  }

  await prisma.concreteType.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/concrete-types");
}
