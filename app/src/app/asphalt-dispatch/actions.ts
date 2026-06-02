"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function parseWorkDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error("Datum fehlt.");
  }

  return new Date(`${text}T00:00:00.000Z`);
}

function parseNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "0").replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function isTackCoatCrewName(value: string | null | undefined) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    normalizedValue.includes("anspritz") ||
    normalizedValue.includes("spritzwagen") ||
    normalizedValue.includes("spritz")
  );
}

async function getProject(projectId: string) {
  if (!projectId) return null;

  return prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });
}

async function getAsphaltMixType(asphaltMixTypeId: string) {
  if (!asphaltMixTypeId) return null;

  return prisma.asphaltMixType.findUnique({
    where: {
      id: asphaltMixTypeId,
    },
  });
}

async function getTackCoatMaterialType(materialTypeId: string) {
  if (!materialTypeId) return null;

  return prisma.materialType.findFirst({
    where: {
      id: materialTypeId,
      category: "Anspritzmittel",
    },
  });
}

function getTackCoatInput(formData: FormData) {
  const tackCoatMaterialTypeId = String(
    formData.get("tackCoatMaterialTypeId") ?? "",
  ).trim();
  const tackCoatQuantity = parseNumber(formData.get("tackCoatQuantity"));
  const tackCoatUnit = optionalString(formData.get("tackCoatUnit")) ?? "l";

  return {
    tackCoatMaterialTypeId,
    tackCoatQuantity,
    tackCoatUnit,
  };
}

function revalidateAsphaltPlanningViews() {
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/crew-dispatch");
}

export async function createAsphaltDispatchEntry(formData: FormData) {
  const workDate = parseWorkDate(formData.get("workDate"));
  const crew = String(formData.get("crew") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const asphaltMixTypeId = String(formData.get("asphaltMixTypeId") ?? "").trim();
  const tackCoatInput = getTackCoatInput(formData);

  if (!crew) {
    throw new Error("Kolonne fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }

  const isTackCoatCrew = isTackCoatCrewName(crew);

  if (!asphaltMixTypeId && !isTackCoatCrew) {
    throw new Error("Bitte eine Asphaltsorte auswählen.");
  }

  if (isTackCoatCrew && !tackCoatInput.tackCoatMaterialTypeId) {
    throw new Error("Bitte ein Anspritzmittel auswählen.");
  }

  const [project, asphaltMixType, tackCoatMaterialType] = await Promise.all([
    getProject(projectId),
    getAsphaltMixType(asphaltMixTypeId),
    getTackCoatMaterialType(tackCoatInput.tackCoatMaterialTypeId),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (asphaltMixTypeId && !asphaltMixType) {
    throw new Error("Asphaltsorte wurde nicht gefunden.");
  }

  if (tackCoatInput.tackCoatMaterialTypeId && !tackCoatMaterialType) {
    throw new Error("Anspritzmittel wurde nicht gefunden.");
  }

  await prisma.asphaltDispatchEntry.create({
    data: {
      workDate,
      crew,

      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      constructionManager: project.constructionManager,

      asphaltMixTypeId: asphaltMixType?.id ?? null,
      asphaltMixNumber: asphaltMixType?.mixNumber ?? null,
      asphaltMixName: asphaltMixType?.name ?? null,

      quantityTons: asphaltMixType ? parseNumber(formData.get("quantityTons")) : 0,

      tackCoatMaterialTypeId: tackCoatMaterialType?.id ?? null,
      tackCoatMaterialName: tackCoatMaterialType?.name ?? null,
      tackCoatQuantity: tackCoatMaterialType ? tackCoatInput.tackCoatQuantity : 0,
      tackCoatUnit: tackCoatMaterialType
        ? tackCoatInput.tackCoatUnit ?? "l"
        : null,

      isForeignMix: asphaltMixType ? formData.get("isForeignMix") === "on" : false,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateAsphaltPlanningViews();
}

export async function updateAsphaltDispatchEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const asphaltMixTypeId = String(formData.get("asphaltMixTypeId") ?? "").trim();
  const tackCoatInput = getTackCoatInput(formData);

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }

  const existingEntry = await prisma.asphaltDispatchEntry.findUnique({
    where: {
      id,
    },
  });

  if (!existingEntry) {
    throw new Error("Eintrag wurde nicht gefunden.");
  }

  const isTackCoatCrew = isTackCoatCrewName(existingEntry.crew);

  if (!asphaltMixTypeId && !isTackCoatCrew) {
    throw new Error("Bitte eine Asphaltsorte auswählen.");
  }

  if (isTackCoatCrew && !tackCoatInput.tackCoatMaterialTypeId) {
    throw new Error("Bitte ein Anspritzmittel auswählen.");
  }

  const [project, asphaltMixType, tackCoatMaterialType] = await Promise.all([
    getProject(projectId),
    getAsphaltMixType(asphaltMixTypeId),
    getTackCoatMaterialType(tackCoatInput.tackCoatMaterialTypeId),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (asphaltMixTypeId && !asphaltMixType) {
    throw new Error("Asphaltsorte wurde nicht gefunden.");
  }

  if (tackCoatInput.tackCoatMaterialTypeId && !tackCoatMaterialType) {
    throw new Error("Anspritzmittel wurde nicht gefunden.");
  }

  await prisma.asphaltDispatchEntry.update({
    where: {
      id,
    },
    data: {
      projectId: project.id,
      projectNumber: project.projectNumber,
      projectName: project.name,
      constructionManager: project.constructionManager,

      asphaltMixTypeId: asphaltMixType?.id ?? null,
      asphaltMixNumber: asphaltMixType?.mixNumber ?? null,
      asphaltMixName: asphaltMixType?.name ?? null,

      quantityTons: asphaltMixType ? parseNumber(formData.get("quantityTons")) : 0,

      tackCoatMaterialTypeId: tackCoatMaterialType?.id ?? null,
      tackCoatMaterialName: tackCoatMaterialType?.name ?? null,
      tackCoatQuantity: tackCoatMaterialType ? tackCoatInput.tackCoatQuantity : 0,
      tackCoatUnit: tackCoatMaterialType
        ? tackCoatInput.tackCoatUnit ?? "l"
        : null,

      isForeignMix: asphaltMixType ? formData.get("isForeignMix") === "on" : false,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateAsphaltPlanningViews();
}

export async function copyAsphaltDispatchEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const targetWorkDate = parseWorkDate(formData.get("targetWorkDate"));
  const targetCrew = String(formData.get("targetCrew") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  const source = await prisma.asphaltDispatchEntry.findUnique({
    where: {
      id,
    },
  });

  if (!source) {
    throw new Error("Zu kopierender Eintrag wurde nicht gefunden.");
  }

  await prisma.asphaltDispatchEntry.create({
    data: {
      workDate: targetWorkDate,
      crew: targetCrew || source.crew,

      projectId: source.projectId,
      projectNumber: source.projectNumber,
      projectName: source.projectName,
      constructionManager: source.constructionManager,

      asphaltMixTypeId: source.asphaltMixTypeId,
      asphaltMixNumber: source.asphaltMixNumber,
      asphaltMixName: source.asphaltMixName,

      quantityTons: source.quantityTons,

      tackCoatMaterialTypeId: source.tackCoatMaterialTypeId,
      tackCoatMaterialName: source.tackCoatMaterialName,
      tackCoatQuantity: source.tackCoatQuantity,
      tackCoatUnit: source.tackCoatUnit,

      isForeignMix: source.isForeignMix,
      notes: source.notes,
    },
  });

  revalidateAsphaltPlanningViews();
}

export async function deleteAsphaltDispatchEntry(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Eintrag-ID fehlt.");
  }

  await prisma.asphaltDispatchEntry.delete({
    where: {
      id,
    },
  });

  revalidateAsphaltPlanningViews();
}