"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function nextSortOrder() {
  const highest = await prisma.crewTimeActivity.aggregate({
    _max: { sortOrder: true },
  });
  return (highest._max.sortOrder ?? 0) + 10;
}

export async function createCrewTimeActivity(formData: FormData) {
  await requireAdmin();
  const label = text(formData.get("label"));
  if (!label) {
    throw new Error("Bitte eine Bezeichnung angeben.");
  }
  const sortOrder = await nextSortOrder();

  await prisma.crewTimeActivity.create({
    data: { label, sortOrder },
  });

  revalidatePath("/admin/working-time/taetigkeiten");
}

export async function updateCrewTimeActivity(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (!id) {
    throw new Error("Tätigkeit fehlt.");
  }
  const label = text(formData.get("label"));
  if (!label) {
    throw new Error("Bitte eine Bezeichnung angeben.");
  }
  const isActive = formData.get("isActive") === "on";

  await prisma.crewTimeActivity.update({
    data: { isActive, label },
    where: { id },
  });

  revalidatePath("/admin/working-time/taetigkeiten");
}

export async function deleteCrewTimeActivity(formData: FormData) {
  await requireAdmin();
  const id = text(formData.get("id"));
  if (!id) {
    throw new Error("Tätigkeit fehlt.");
  }

  await prisma.crewTimeActivity.delete({
    where: { id },
  });

  revalidatePath("/admin/working-time/taetigkeiten");
}
