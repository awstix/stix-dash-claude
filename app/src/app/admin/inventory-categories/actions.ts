"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return 0;

  const number = Number.parseInt(text, 10);

  if (!Number.isInteger(number)) {
    throw new Error("Sortierung muss eine ganze Zahl sein.");
  }

  return number;
}

function revalidateInventoryCategoryViews() {
  revalidatePath("/admin/inventory-categories");
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
}

export async function createInventoryCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Kategoriename ist ein Pflichtfeld.");
  }

  await prisma.inventoryCategory.create({
    data: {
      colorClass: optionalString(formData.get("colorClass")),
      description: optionalString(formData.get("description")),
      isActive: formData.get("isActive") !== "off",
      name,
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
  });

  revalidateInventoryCategoryViews();
}

export async function updateInventoryCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  if (!name) {
    throw new Error("Kategoriename ist ein Pflichtfeld.");
  }

  await prisma.inventoryCategory.update({
    where: {
      id,
    },
    data: {
      colorClass: optionalString(formData.get("colorClass")),
      description: optionalString(formData.get("description")),
      isActive: formData.get("isActive") === "on",
      name,
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
  });

  revalidateInventoryCategoryViews();
}

export async function deleteInventoryCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  await prisma.inventoryCategory.delete({
    where: {
      id,
    },
  });

  revalidateInventoryCategoryViews();
}
