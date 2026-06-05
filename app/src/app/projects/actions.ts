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

export type ProjectMapInput = {
  id: string;
  siteAddress: string;
  mapLatitude: string;
  mapLongitude: string;
  mapZoom: string;
  siteBoundaryGeoJson: string;
};

function parseDate(value: string) {
  if (!value) return null;
  return new Date(value);
}

function cleanNumber(value: number) {
  if (Number.isNaN(value)) return 0;
  return value;
}

function cleanOptionalFloat(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanOptionalInt(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function cleanBoundaryGeoJson(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    JSON.parse(trimmed);
  } catch {
    throw new Error("Baufeld GeoJSON ist kein gültiges JSON.");
  }

  return trimmed;
}

function revalidateProjectViews(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/projects/performance");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
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

  revalidateProjectViews();
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

  revalidateProjectViews(input.id);
}

export async function updateProjectMap(input: ProjectMapInput) {
  if (!input.id) {
    throw new Error("Projekt-ID fehlt.");
  }

  await prisma.project.update({
    where: {
      id: input.id,
    },
    data: {
      siteAddress: input.siteAddress || null,
      mapLatitude: cleanOptionalFloat(input.mapLatitude),
      mapLongitude: cleanOptionalFloat(input.mapLongitude),
      mapZoom: cleanOptionalInt(input.mapZoom),
      siteBoundaryGeoJson: cleanBoundaryGeoJson(input.siteBoundaryGeoJson),
    },
  });

  revalidateProjectViews(input.id);
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

  revalidateProjectViews();
}

export async function deleteProject(id: string) {
  await prisma.project.delete({
    where: {
      id,
    },
  });

  revalidateProjectViews();
}
