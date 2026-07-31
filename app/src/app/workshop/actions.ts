"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { parseProjectFormFields } from "@/app/projects/projectFormTypes";
import {
  WORKSHOP_REPAIR_SYSTEM_FIELD_IDS,
  WORKSHOP_REPAIR_TEMPLATE_ID,
} from "./repairOrderTemplate";

const statusOptions = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"];
const priorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"];
const closedStatusOptions = ["DONE", "CANCELLED"];

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${label} fehlt.`);
  }

  return text;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Datum ist ungültig.");
  }

  return new Date(`${text}T00:00:00.000Z`);
}

function optionalDateTime(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return new Date(text);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00.000Z`);
  }

  throw new Error("Datum/Uhrzeit ist ungültig.");
}

function cleanStatus(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return statusOptions.includes(text) ? text : "OPEN";
}

function cleanPriority(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return priorityOptions.includes(text) ? text : "NORMAL";
}

async function getVehicleSnapshot(vehicleId: string | null) {
  if (!vehicleId) {
    return {
      licensePlate: null,
      vehicleNumber: null,
      vehicleType: null,
    };
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
    select: {
      licensePlate: true,
      vehicleNumber: true,
      vehicleType: true,
    },
  });

  return {
    licensePlate: vehicle?.licensePlate ?? null,
    vehicleNumber: vehicle?.vehicleNumber ?? null,
    vehicleType: vehicle?.vehicleType ?? null,
  };
}

async function getCustomValues(formData: FormData) {
  const template = await prisma.workshopFormTemplate.findUnique({
    where: { id: WORKSHOP_REPAIR_TEMPLATE_ID },
    select: { fieldsJson: true },
  });
  const customFields = parseProjectFormFields(template?.fieldsJson).filter(
    (field) => !WORKSHOP_REPAIR_SYSTEM_FIELD_IDS.has(field.id),
  );

  return Object.fromEntries(
    customFields.map((field) => {
      const entry = formData.get(`custom:${field.id}`);
      return [
        field.id,
        field.type === "checkbox" ? entry === "on" : String(entry ?? ""),
      ];
    }),
  );
}

async function getInventoryWorkshopStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  inventoryItemId: string,
) {
  const [openOrders, openForms] = await Promise.all([
    tx.workshopRepairOrder.count({
      where: {
        inventoryItemId,
        status: {
          notIn: closedStatusOptions,
        },
      },
    }),
    tx.workshopFormSubmission.count({
      where: {
        completedAt: null,
        inventoryItemId,
      },
    }),
  ]);

  return openOrders > 0 || openForms > 0 ? "DEFECT" : "ACTIVE";
}

export async function createWorkshopRepairOrder(formData: FormData) {
  await requireSession();
  const vehicleId = optionalString(formData.get("vehicleId"));
  const inventoryItemId = optionalString(formData.get("inventoryItemId"));
  const vehicleSnapshot = await getVehicleSnapshot(vehicleId);
  const completedAt = optionalDate(formData.get("completedAt"));
  const status = completedAt ? "DONE" : cleanStatus(formData.get("status"));
  const customValues = await getCustomValues(formData);

  await prisma.$transaction(async (tx) => {
    const order = await tx.workshopRepairOrder.create({
      data: {
        vehicle: vehicleId
          ? {
              connect: {
                id: vehicleId,
              },
            }
          : undefined,
        ...vehicleSnapshot,
        title: requiredString(formData.get("title"), "Titel"),
        description: optionalString(formData.get("description")),
        priority: cleanPriority(formData.get("priority")),
        status,
        reportedAt: optionalDateTime(formData.get("reportedAt")) ?? new Date(),
        plannedStart: optionalDate(formData.get("plannedStart")),
        plannedEnd: optionalDate(formData.get("plannedEnd")),
        completedAt: status === "DONE" ? completedAt ?? new Date() : null,
        completedByName:
          status === "DONE" ? optionalString(formData.get("completedByName")) : null,
        assignedTo: optionalString(formData.get("assignedTo")),
        customValuesJson: JSON.stringify(customValues),
        notes: optionalString(formData.get("notes")),
        inventoryItem: inventoryItemId
          ? {
              connect: {
                id: inventoryItemId,
              },
            }
          : undefined,
      },
    });

    if (inventoryItemId) {
      await tx.inventoryItem.update({
        where: {
          id: inventoryItemId,
        },
        data: {
          status: await getInventoryWorkshopStatus(tx, inventoryItemId),
        },
      });

      await tx.inventoryUsageHistory.create({
        data: {
          defectDescription: order.description,
          eventType: "DEFECT",
          item: {
            connect: {
              id: inventoryItemId,
            },
          },
          notes: `Werkstattauftrag erstellt: ${order.title}`,
        },
      });
    }
  });

  revalidatePath("/workshop");
  if (inventoryItemId) {
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${inventoryItemId}`);
  }
}

export async function updateWorkshopRepairOrder(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Auftrags-ID");
  const vehicleId = optionalString(formData.get("vehicleId"));
  const inventoryItemId = formData.has("inventoryItemId")
    ? optionalString(formData.get("inventoryItemId"))
    : undefined;
  const vehicleSnapshot = await getVehicleSnapshot(vehicleId);
  const completedAt = optionalDate(formData.get("completedAt"));
  const status = completedAt ? "DONE" : cleanStatus(formData.get("status"));
  const customValues = await getCustomValues(formData);

  await prisma.$transaction(async (tx) => {
    const previousOrder = await tx.workshopRepairOrder.findUnique({
      where: {
        id,
      },
      select: {
        inventoryItemId: true,
      },
    });

    await tx.workshopRepairOrder.update({
      where: {
        id,
      },
      data: {
        vehicle: vehicleId
          ? {
              connect: {
                id: vehicleId,
              },
            }
          : {
              disconnect: true,
            },
        ...vehicleSnapshot,
        title: requiredString(formData.get("title"), "Titel"),
        description: optionalString(formData.get("description")),
        priority: cleanPriority(formData.get("priority")),
        status,
        reportedAt: optionalDateTime(formData.get("reportedAt")) ?? new Date(),
        plannedStart: optionalDate(formData.get("plannedStart")),
        plannedEnd: optionalDate(formData.get("plannedEnd")),
        completedAt: status === "DONE" ? completedAt ?? new Date() : null,
        completedByName:
          status === "DONE" ? optionalString(formData.get("completedByName")) : null,
        assignedTo: optionalString(formData.get("assignedTo")),
        customValuesJson: JSON.stringify(customValues),
        notes: optionalString(formData.get("notes")),
        inventoryItem:
          inventoryItemId === undefined
            ? undefined
            : inventoryItemId
              ? {
                  connect: {
                    id: inventoryItemId,
                  },
                }
              : {
                  disconnect: true,
                },
      },
    });

    const affectedInventoryIds = new Set(
      [previousOrder?.inventoryItemId, inventoryItemId].filter(Boolean) as string[],
    );

    for (const affectedInventoryId of affectedInventoryIds) {
      await tx.inventoryItem.update({
        where: {
          id: affectedInventoryId,
        },
        data: {
          status: await getInventoryWorkshopStatus(tx, affectedInventoryId),
        },
      });
    }
  });

  revalidatePath("/workshop");
  if (inventoryItemId) {
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${inventoryItemId}`);
  }
}

export async function deleteWorkshopRepairOrder(formData: FormData) {
  await requireSession();
  const id = requiredString(formData.get("id"), "Auftrags-ID");

  const inventoryItemId = await prisma.$transaction(async (tx) => {
    const order = await tx.workshopRepairOrder.findUnique({
      where: {
        id,
      },
      select: {
        inventoryItemId: true,
      },
    });

    await tx.workshopRepairOrder.delete({
      where: {
        id,
      },
    });

    if (order?.inventoryItemId) {
      await tx.inventoryItem.update({
        where: {
          id: order.inventoryItemId,
        },
        data: {
          status: await getInventoryWorkshopStatus(tx, order.inventoryItemId),
        },
      });
    }

    return order?.inventoryItemId ?? null;
  });

  revalidatePath("/workshop");
  if (inventoryItemId) {
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${inventoryItemId}`);
  }
}
