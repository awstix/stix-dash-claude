"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const allowedInventoryPhotoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalId(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  return text === "__none" ? null : text;
}

function optionalInt(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);
  if (!text) return null;

  const number = Number.parseInt(text, 10);

  if (!Number.isInteger(number)) {
    throw new Error(`${label} muss eine ganze Zahl sein.`);
  }

  return number;
}

function optionalMoneyCents(value: FormDataEntryValue | null) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error("Der Verrechnungssatz muss eine Zahl größer oder gleich 0 sein.");
  }

  return Math.round(number * 100);
}

function optionalStock(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }

  return Math.round(number * 1000) / 1000;
}

function optionalFloat(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }

  return Math.round(number * 100) / 100;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Bitte ein gültiges Datum angeben.");
  }

  return date;
}

function getResponsibleFields(formData: FormData) {
  const responsibleType = optionalString(formData.get("responsibleType"));

  if (responsibleType === "EMPLOYEE") {
    return {
      responsibleCrewId: null,
      responsibleEmployeeId: optionalId(formData.get("responsibleEmployeeId")),
      responsibleType,
    };
  }

  if (responsibleType === "CREW") {
    return {
      responsibleCrewId: optionalId(formData.get("responsibleCrewId")),
      responsibleEmployeeId: null,
      responsibleType,
    };
  }

  return {
    responsibleCrewId: null,
    responsibleEmployeeId: null,
    responsibleType: null,
  };
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
}

function revalidateInventoryItem(itemId?: string) {
  revalidateInventory();

  if (itemId) {
    revalidatePath(`/inventory/${itemId}`);
  }
}

function getInventoryPayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Name ist ein Pflichtfeld.");
  }

  const isStockManaged = formData.get("isStockManaged") === "on";
  const openingStock = isStockManaged
    ? optionalStock(formData.get("openingStock"), "Anfangsbestand")
    : null;

  return {
    billingRateCents: optionalMoneyCents(formData.get("billingRate")),
    categoryId: optionalId(formData.get("categoryId")),
    constructionDate: optionalDate(formData.get("constructionDate")),
    constructionYear: optionalInt(formData.get("constructionYear"), "Baujahr"),
    currentProjectId: optionalId(formData.get("currentProjectId")),
    currentStock: openingStock,
    inventoryNumber: optionalString(formData.get("inventoryNumber")),
    isContainer: formData.get("isContainer") === "on",
    isStockManaged,
    deliveryNoteNumber: optionalString(formData.get("deliveryNoteNumber")),
    invoiceNumber: optionalString(formData.get("invoiceNumber")),
    lastDguvInspectionDate: optionalDate(formData.get("lastDguvInspectionDate")),
    lastServiceAtDate: optionalDate(formData.get("lastServiceAtDate")),
    lastServiceMileageKm: optionalInt(
      formData.get("lastServiceMileageKm"),
      "Letzter Service KM",
    ),
    lastServiceOperatingHours: optionalFloat(
      formData.get("lastServiceOperatingHours"),
      "Letzter Service Betriebsstunden",
    ),
    lastTuvInspectionDate: optionalDate(formData.get("lastTuvInspectionDate")),
    manufacturer: optionalString(formData.get("manufacturer")),
    model: optionalString(formData.get("model")),
    name,
    nextDguvInspectionDate: optionalDate(formData.get("nextDguvInspectionDate")),
    nextServiceAtDate: optionalDate(formData.get("nextServiceAtDate")),
    nextServiceMileageKm: optionalInt(
      formData.get("nextServiceMileageKm"),
      "Nächster Service KM",
    ),
    nextServiceOperatingHours: optionalFloat(
      formData.get("nextServiceOperatingHours"),
      "Nächster Service Betriebsstunden",
    ),
    nextTuvInspectionDate: optionalDate(formData.get("nextTuvInspectionDate")),
    notes: optionalString(formData.get("notes")),
    openingStock,
    parentItemId: optionalId(formData.get("parentItemId")),
    purchasedAt: optionalDate(formData.get("purchasedAt")),
    purchasedFrom: optionalString(formData.get("purchasedFrom")),
    receivedAt: optionalDate(formData.get("receivedAt")),
    serialNumber: optionalString(formData.get("serialNumber")),
    stockUnit: optionalString(formData.get("stockUnit")) ?? "Stk.",
    vehicleId: optionalId(formData.get("vehicleId")),
    ...getResponsibleFields(formData),
  };
}

function getInventoryContacts(formData: FormData) {
  const roles = formData.getAll("contactRole");
  const companies = formData.getAll("contactCompany");
  const names = formData.getAll("contactName");
  const phones = formData.getAll("contactPhone");
  const emails = formData.getAll("contactEmail");
  const websites = formData.getAll("contactWebsite");
  const notes = formData.getAll("contactNotes");

  return roles
    .map((roleValue, index) => {
      const role = optionalString(roleValue);
      const company = optionalString(companies[index] ?? null);
      const name = optionalString(names[index] ?? null);
      const phone = optionalString(phones[index] ?? null);
      const email = optionalString(emails[index] ?? null);
      const website = optionalString(websites[index] ?? null);
      const contactNotes = optionalString(notes[index] ?? null);

      if (!role && !company && !name && !phone && !email && !website && !contactNotes) {
        return null;
      }

      return {
        company,
        email,
        name,
        notes: contactNotes,
        phone,
        role: role ?? "Ansprechpartner",
        website,
      };
    })
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
}

async function storeInventoryPhotos(itemId: string, formData: FormData) {
  const files = formData.getAll("photos");

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;

    const extension = allowedInventoryPhotoTypes.get(file.type);

    if (!extension) {
      throw new Error("Bitte Inventarfotos als JPG, PNG oder WebP hochladen.");
    }

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "inventory-items",
      itemId,
    );
    await mkdir(uploadDirectory, { recursive: true });

    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(uploadDirectory, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(absolutePath, bytes);

    await prisma.inventoryPhoto.create({
      data: {
        fileName,
        itemId,
        mimeType: file.type,
        originalName: file.name,
        sizeBytes: file.size,
        url: `/uploads/inventory-items/${itemId}/${fileName}`,
      },
    });
  }
}

export async function createInventoryItem(formData: FormData) {
  const payload = getInventoryPayload(formData);
  const contacts = getInventoryContacts(formData);

  const item = await prisma.inventoryItem.create({
    data: {
      ...payload,
      contacts: contacts.length
        ? {
            create: contacts,
          }
        : undefined,
    },
  });

  await storeInventoryPhotos(item.id, formData);

  revalidateInventoryItem(item.id);
}

export async function updateInventoryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  const payload = getInventoryPayload(formData);
  const contacts = getInventoryContacts(formData);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryContact.deleteMany({
      where: {
        itemId: id,
      },
    });

    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: payload,
    });

    if (contacts.length > 0) {
      await tx.inventoryContact.createMany({
        data: contacts.map((contact) => ({
          ...contact,
          itemId: id,
        })),
      });
    }
  });

  await storeInventoryPhotos(id, formData);

  revalidateInventoryItem(id);
}

export async function deleteInventoryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  await prisma.inventoryItem.delete({
    where: {
      id,
    },
  });

  revalidateInventory();
}

export async function deleteInventoryPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Foto-ID fehlt.");
  }

  const photo = await prisma.inventoryPhoto.delete({
    where: {
      id,
    },
  });

  revalidateInventoryItem(photo.itemId);
}
