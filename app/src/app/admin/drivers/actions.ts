"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeShortcut(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text.length > 0 ? text : null;
}

export async function createDriver(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  if (!firstName || !lastName) {
    throw new Error("Vorname und Nachname sind Pflichtfelder.");
  }

  if (shortcut) {
    const existingDriver = await prisma.driver.findUnique({
      where: {
        shortcut,
      },
    });

    if (existingDriver) {
      throw new Error(`Das Kürzel "${shortcut}" ist bereits vergeben.`);
    }
  }

  await prisma.driver.create({
    data: {
      firstName,
      lastName,
      shortcut,
      phone: optionalString(formData.get("phone")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/drivers");
}

export async function updateDriver(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const shortcut = normalizeShortcut(formData.get("shortcut"));

  if (!id) {
    throw new Error("Fahrer-ID fehlt.");
  }

  if (!firstName || !lastName) {
    throw new Error("Vorname und Nachname sind Pflichtfelder.");
  }

  if (shortcut) {
    const existingDriver = await prisma.driver.findUnique({
      where: {
        shortcut,
      },
    });

    if (existingDriver && existingDriver.id !== id) {
      throw new Error(`Das Kürzel "${shortcut}" ist bereits vergeben.`);
    }
  }

  await prisma.driver.update({
    where: {
      id,
    },
    data: {
      firstName,
      lastName,
      shortcut,
      phone: optionalString(formData.get("phone")),
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/admin/drivers");
}

export async function deleteDriver(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Fahrer-ID fehlt.");
  }

  await prisma.driver.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/drivers");
}