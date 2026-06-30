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

function parseObjectNumber(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (!/^\d{1,6}$/.test(text)) {
    throw new Error(`${label} muss eine Zahl mit maximal 6 Stellen sein.`);
  }

  return Number.parseInt(text, 10);
}

function getObjectNumberRange(formData: FormData) {
  const objectNumberStart = parseObjectNumber(
    formData.get("objectNumberStart"),
    "Nummernkreis von",
  );
  const objectNumberEnd = parseObjectNumber(
    formData.get("objectNumberEnd"),
    "Nummernkreis bis",
  );
  const nextObjectNumber = parseObjectNumber(
    formData.get("nextObjectNumber"),
    "Nächste Objekt-ID",
  );

  const hasPartialRange =
    (objectNumberStart === null) !== (objectNumberEnd === null);

  if (hasPartialRange) {
    throw new Error("Bitte Nummernkreis von und bis angeben.");
  }

  if (
    objectNumberStart !== null &&
    objectNumberEnd !== null &&
    objectNumberStart > objectNumberEnd
  ) {
    throw new Error("Nummernkreis von darf nicht größer als Nummernkreis bis sein.");
  }

  if (
    nextObjectNumber !== null &&
    objectNumberStart !== null &&
    objectNumberEnd !== null &&
    (nextObjectNumber < objectNumberStart || nextObjectNumber > objectNumberEnd)
  ) {
    throw new Error("Nächste Objekt-ID muss innerhalb des Nummernkreises liegen.");
  }

  return {
    objectNumberEnd,
    objectNumberStart,
    nextObjectNumber: nextObjectNumber ?? objectNumberStart,
  };
}

function dailyReportSection(value: FormDataEntryValue | null) {
  const text = String(value ?? "NONE").trim();
  const allowedSections = new Set([
    "NONE",
    "MATERIAL",
    "MACHINES",
    "OTHER",
  ]);

  if (text === "TRUCKS") return "MACHINES";

  return allowedSections.has(text) ? text : "NONE";
}

function getTruckDispatchUsage(formData: FormData) {
  const useInTruckDispatchMaterial =
    formData.get("useInTruckDispatchMaterial") === "on";
  const useInTruckDispatchObject =
    formData.get("useInTruckDispatchObject") === "on";

  return {
    useInTruckDispatchMaterial,
    useInTruckDispatchObject,
    useInTruckDisposition:
      useInTruckDispatchMaterial || useInTruckDispatchObject,
  };
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
      dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
      description: optionalString(formData.get("description")),
      isActive: formData.get("isActive") !== "off",
      name,
      ...getObjectNumberRange(formData),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      useInDailyReports: formData.get("useInDailyReports") === "on",
      useInInventory: true,
      ...getTruckDispatchUsage(formData),
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
      dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
      description: optionalString(formData.get("description")),
      isActive: formData.get("isActive") === "on",
      name,
      ...getObjectNumberRange(formData),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      useInDailyReports: formData.get("useInDailyReports") === "on",
      useInInventory: true,
      ...getTruckDispatchUsage(formData),
    },
  });

  revalidateInventoryCategoryViews();
}

export async function deleteInventoryCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  const itemCount = await prisma.inventoryItem.count({
    where: {
      categoryId: id,
    },
  });

  if (itemCount > 0) {
    await prisma.inventoryCategory.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  } else {
    await prisma.inventoryCategory.delete({
      where: {
        id,
      },
    });
  }

  revalidateInventoryCategoryViews();
}
