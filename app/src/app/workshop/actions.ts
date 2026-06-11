"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const statusOptions = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"];
const priorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"];

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

export async function createWorkshopRepairOrder(formData: FormData) {
  const vehicleId = optionalString(formData.get("vehicleId"));
  const vehicleSnapshot = await getVehicleSnapshot(vehicleId);
  const completedAt = optionalDate(formData.get("completedAt"));
  const status = completedAt ? "DONE" : cleanStatus(formData.get("status"));

  await prisma.workshopRepairOrder.create({
    data: {
      vehicleId,
      ...vehicleSnapshot,
      title: requiredString(formData.get("title"), "Titel"),
      description: optionalString(formData.get("description")),
      priority: cleanPriority(formData.get("priority")),
      status,
      reportedAt: optionalDate(formData.get("reportedAt")) ?? new Date(),
      plannedStart: optionalDate(formData.get("plannedStart")),
      plannedEnd: optionalDate(formData.get("plannedEnd")),
      completedAt: status === "DONE" ? completedAt ?? new Date() : null,
      assignedTo: optionalString(formData.get("assignedTo")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/workshop");
}

export async function updateWorkshopRepairOrder(formData: FormData) {
  const id = requiredString(formData.get("id"), "Auftrags-ID");
  const vehicleId = optionalString(formData.get("vehicleId"));
  const vehicleSnapshot = await getVehicleSnapshot(vehicleId);
  const completedAt = optionalDate(formData.get("completedAt"));
  const status = completedAt ? "DONE" : cleanStatus(formData.get("status"));

  await prisma.workshopRepairOrder.update({
    where: {
      id,
    },
    data: {
      vehicleId,
      ...vehicleSnapshot,
      title: requiredString(formData.get("title"), "Titel"),
      description: optionalString(formData.get("description")),
      priority: cleanPriority(formData.get("priority")),
      status,
      reportedAt: optionalDate(formData.get("reportedAt")) ?? new Date(),
      plannedStart: optionalDate(formData.get("plannedStart")),
      plannedEnd: optionalDate(formData.get("plannedEnd")),
      completedAt: status === "DONE" ? completedAt ?? new Date() : null,
      assignedTo: optionalString(formData.get("assignedTo")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/workshop");
}

export async function deleteWorkshopRepairOrder(formData: FormData) {
  const id = requiredString(formData.get("id"), "Auftrags-ID");

  await prisma.workshopRepairOrder.delete({
    where: {
      id,
    },
  });

  revalidatePath("/workshop");
}
