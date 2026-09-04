"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

const STORAGE_BUCKET = "uploads";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function createKalkulationProject(formData: FormData) {
  await requireSession();

  const projectNumber = text(formData, "projectNumber");
  const tenderTitle = text(formData, "tenderTitle");
  if (!projectNumber) throw new Error("Projektnummer ist ein Pflichtfeld.");

  await prisma.kalkulationProject.upsert({
    create: { projectNumber, tenderTitle: tenderTitle || null },
    update: {},
    where: { projectNumber },
  });

  revalidatePath("/kalkulation/projects");
  redirect(`/kalkulation/projects/${encodeURIComponent(projectNumber)}`);
}

/** Löscht ein ganzes Kalkulations-Projekt samt ALLER zugehörigen Imports
 * (LV, Kalkulation, kalkuliertes LV). KalkulationProject ist bewusst nicht
 * per FK mit KalkulationLvImport verknüpft (siehe createKalkulationProject-
 * Kommentar an anderer Stelle) - die Imports müssen deshalb hier von Hand
 * mitgelöscht werden, sonst blieben sie als Datenleiche mit einer
 * Projektnummer stehen, die es gar nicht mehr gibt. */
export async function deleteKalkulationProject(formData: FormData) {
  await requireSession();
  const projectNumber = text(formData, "projectNumber");
  if (!projectNumber) throw new Error("Projektnummer fehlt.");

  const imports = await prisma.kalkulationLvImport.findMany({ where: { projectNumber } });

  // Zeilen hängen per onDelete: Cascade an der jeweiligen Import-Zeile,
  // werden also automatisch mitgelöscht - nur die abgelegten Original-
  // dateien müssen separat aus dem Storage entfernt werden.
  await prisma.kalkulationLvImport.deleteMany({ where: { projectNumber } });
  await Promise.all(
    imports
      .filter((item) => item.originalStoragePath)
      .map((item) => deleteFile(STORAGE_BUCKET, item.originalStoragePath!).catch(() => undefined)),
  );

  await prisma.kalkulationProject.deleteMany({ where: { projectNumber } });

  revalidatePath("/kalkulation/projects");
  redirect("/kalkulation/projects");
}
