"use server";

import { revalidatePath } from "next/cache";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectFormInput = {
  id?: string;
  projectNumber: string;
  name: string;
  constructionManager: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string;
  actualEnd: string;
  status: ProjectStatus;
  contractValueNet: number;
  changeOrdersNet: number;
  progressPercent: number;
  paymentsNet: number;
  notes: string;
};

function parseDate(value: string) {
  if (!value) return null;
  return new Date(value);
}

function cleanNumber(value: number) {
  if (Number.isNaN(value)) return 0;
  return value;
}

export async function createProject(input: ProjectFormInput) {
  if (!input.projectNumber || !input.name) {
    throw new Error("Projektnummer und Projektname sind Pflichtfelder.");
  }

  await prisma.project.create({
    data: {
      projectNumber: input.projectNumber,
      name: input.name,
      constructionManager: input.constructionManager || null,
      plannedStart: parseDate(input.plannedStart),
      plannedEnd: parseDate(input.plannedEnd),
      actualStart: parseDate(input.actualStart),
      actualEnd: parseDate(input.actualEnd),
      status: input.status,
      contractValueNet: cleanNumber(input.contractValueNet),
      changeOrdersNet: cleanNumber(input.changeOrdersNet),
      progressPercent: cleanNumber(input.progressPercent),
      paymentsNet: cleanNumber(input.paymentsNet),
      notes: input.notes || null,
    },
  });

  revalidatePath("/projects");
}

export async function updateProject(input: ProjectFormInput) {
  if (!input.id) {
    throw new Error("Projekt-ID fehlt.");
  }

  if (!input.projectNumber || !input.name) {
    throw new Error("Projektnummer und Projektname sind Pflichtfelder.");
  }

  await prisma.project.update({
    where: {
      id: input.id,
    },
    data: {
      projectNumber: input.projectNumber,
      name: input.name,
      constructionManager: input.constructionManager || null,
      plannedStart: parseDate(input.plannedStart),
      plannedEnd: parseDate(input.plannedEnd),
      actualStart: parseDate(input.actualStart),
      actualEnd: parseDate(input.actualEnd),
      status: input.status,
      contractValueNet: cleanNumber(input.contractValueNet),
      changeOrdersNet: cleanNumber(input.changeOrdersNet),
      progressPercent: cleanNumber(input.progressPercent),
      paymentsNet: cleanNumber(input.paymentsNet),
      notes: input.notes || null,
    },
  });

  revalidatePath("/projects");
}

export async function cancelProject(id: string) {
  await prisma.project.update({
    where: {
      id,
    },
    data: {
      status: ProjectStatus.CANCELLED,
    },
  });

  revalidatePath("/projects");
}
