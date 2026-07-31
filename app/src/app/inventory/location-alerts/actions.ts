"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function revalidateInventoryLocationAlerts() {
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/inventory/location-alerts");
}

export async function assignInventoryLocationAlert(formData: FormData) {
  await requireSession();
  const alertId = optionalString(formData.get("alertId"));
  const projectId = optionalString(formData.get("projectId"));
  const assignedByName =
    optionalString(formData.get("assignedByName")) ??
    "Admin / Disponent / Bauleiter";

  if (!alertId) {
    throw new Error("Standortmeldung fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte eine Baustelle auswählen.");
  }

  const alert = await prisma.inventoryLocationAlert.findUnique({
    where: {
      id: alertId,
    },
    select: {
      itemId: true,
      status: true,
    },
  });

  if (!alert) {
    throw new Error("Standortmeldung wurde nicht gefunden.");
  }

  await prisma.$transaction([
    prisma.inventoryItem.update({
      where: {
        id: alert.itemId,
      },
      data: {
        currentProject: {
          connect: {
            id: projectId,
          },
        },
      },
    }),
    prisma.inventoryLocationAlert.update({
      where: {
        id: alertId,
      },
      data: {
        assignedByName,
        notes:
          alert.status === "OPEN"
            ? "Objekt wurde über Standortmeldung einer Baustelle zugewiesen."
            : undefined,
        resolvedAt: new Date(),
        resolvedByName: assignedByName,
        status: "RESOLVED",
      },
    }),
  ]);

  revalidateInventoryLocationAlerts();
}

export async function dismissInventoryLocationAlert(formData: FormData) {
  await requireSession();
  const alertId = optionalString(formData.get("alertId"));
  const resolvedByName =
    optionalString(formData.get("resolvedByName")) ??
    "Admin / Disponent / Bauleiter";

  if (!alertId) {
    throw new Error("Standortmeldung fehlt.");
  }

  await prisma.inventoryLocationAlert.update({
    where: {
      id: alertId,
    },
    data: {
      resolvedAt: new Date(),
      resolvedByName,
      status: "DISMISSED",
    },
  });

  revalidateInventoryLocationAlerts();
}
