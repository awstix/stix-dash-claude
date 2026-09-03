"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

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
