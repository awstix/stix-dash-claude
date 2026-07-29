"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const uploadDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "inventory-initial-tests",
);

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  return value || null;
}

function date(formData: FormData, name: string) {
  const value = text(formData, name);
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function density(formData: FormData) {
  const value = text(formData, "densityTonPerCubicMeter");
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Bitte eine gültige Dichte in t/m³ eingeben.");
  }
  return parsed;
}

async function storePdf(entry: FormDataEntryValue | null) {
  if (!(entry instanceof File) || entry.size === 0) return null;
  if (entry.type !== "application/pdf") {
    throw new Error("Die Erstprüfung muss als PDF hochgeladen werden.");
  }
  await mkdir(uploadDirectory, { recursive: true });
  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.pdf`;
  await writeFile(
    path.join(uploadDirectory, fileName),
    Buffer.from(await entry.arrayBuffer()),
  );
  return {
    pdfFileName: fileName,
    pdfOriginalName: entry.name,
    pdfUrl: `/uploads/inventory-initial-tests/${fileName}`,
    pdfMimeType: entry.type,
    pdfSizeBytes: entry.size,
  };
}

function payload(formData: FormData) {
  const productName = text(formData, "productName");
  if (!productName) throw new Error("Asphalt-/Materialbezeichnung fehlt.");
  const validFrom = date(formData, "validFrom");
  const validUntil = date(formData, "validUntil");
  if (validFrom && validUntil && validUntil < validFrom) {
    throw new Error("„Gültig bis“ darf nicht vor „Gültig ab“ liegen.");
  }
  return {
    productCode: text(formData, "productCode"),
    productName,
    category: text(formData, "category"),
    validFrom,
    validUntil,
    testNumber: text(formData, "testNumber"),
    densityTonPerCubicMeter: density(formData),
    description: text(formData, "description"),
    notes: text(formData, "notes"),
    isActive: formData.get("isActive") === "on",
  };
}

export async function createInitialTest(formData: FormData) {
  const pdf = await storePdf(formData.get("pdf"));
  await prisma.inventoryInitialTest.create({
    data: { ...payload(formData), ...(pdf ?? {}) },
  });
  revalidatePath("/inventory/initial-tests");
}

export async function updateInitialTest(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Erstprüfung fehlt.");
  const pdf = await storePdf(formData.get("pdf"));
  await prisma.inventoryInitialTest.update({
    where: { id },
    data: { ...payload(formData), ...(pdf ?? {}) },
  });
  revalidatePath("/inventory/initial-tests");
}

export async function deleteInitialTest(formData: FormData) {
  const id = text(formData, "id");
  if (!id) throw new Error("Erstprüfung fehlt.");
  await prisma.inventoryInitialTest.delete({ where: { id } });
  revalidatePath("/inventory/initial-tests");
}
