"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

export async function updatePersonalInventoryManagers(formData: FormData) {
  await requireAdmin();
  const employeeIds = Array.from(
    new Set(
      formData
        .getAll("employeeIds")
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
  if (employeeIds.length === 0) {
    throw new Error("Bitte mindestens eine inventarverantwortliche Person auswählen.");
  }

  await prisma.$transaction([
    prisma.employee.updateMany({
      data: { canManagePersonalInventory: false },
    }),
    prisma.employee.updateMany({
      data: { canManagePersonalInventory: true },
      where: { id: { in: employeeIds }, statusValue: "active" },
    }),
  ]);

  revalidatePath("/admin/personal-inventory-managers");
  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
}
