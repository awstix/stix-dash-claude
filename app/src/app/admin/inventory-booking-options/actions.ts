"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";

export async function getInventoryBookingSettings() {
  const settings = await prisma.inventoryBookingSettings.findUnique({
    where: {
      id: "default",
    },
  });

  return {
    specialVehicleAutoExtend: settings?.specialVehicleAutoExtend ?? true,
  };
}

export async function updateInventoryBookingSettings(formData: FormData) {
  await requireAdmin();

  const specialVehicleAutoExtend = formData.get("specialVehicleAutoExtend") === "on";
  // "on"/"off" statt Checkbox, weil die beiden Zustände hier ausführlich
  // erklärt werden - eine reine Checkbox mit einem Label würde die zweite
  // Beschreibung (was "aus" konkret bedeutet) unterschlagen.

  await prisma.inventoryBookingSettings.upsert({
    create: {
      id: "default",
      specialVehicleAutoExtend,
    },
    update: {
      specialVehicleAutoExtend,
    },
    where: {
      id: "default",
    },
  });

  revalidatePath("/admin/inventory-booking-options");
}
