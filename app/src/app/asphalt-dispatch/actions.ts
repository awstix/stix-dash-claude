"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

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

async function getAsphaltMixInventoryItem(itemId: string) {
  if (!itemId) return null;

  return prisma.inventoryItem.findFirst({
    where: {
      id: itemId,
      status: {
        not: "DELETED",
      },
      category: {
        OR: [
          {
            asphaltDispositionUsage: "ASPHALT_MIX",
          },
          {
            parentCategory: {
              asphaltDispositionUsage: "ASPHALT_MIX",
            },
          },
        ],
      },
    },
    include: {
      category: {
        include: {
          parentCategory: true,
        },
      },
    },
  });
}

async function getTackCoatInventoryItem(itemId: string) {
  if (!itemId) return null;

  return prisma.inventoryItem.findFirst({
    where: {
      id: itemId,
      status: {
        not: "DELETED",
      },
      category: {
        OR: [
          {
            asphaltDispositionUsage: "TACK_COAT",
          },
          {
            parentCategory: {
              asphaltDispositionUsage: "TACK_COAT",
            },
          },
        ],
      },
    },
    include: {
      category: {
        include: {
          parentCategory: true,
        },
      },
    },
  });
}

function getInventoryItemNumber(item: {
  inventoryNumber: string | null;
  objectNumber: string | null;
  stixId: string | null;
}) {
  return item.inventoryNumber ?? item.objectNumber ?? item.stixId ?? null;
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
  revalidatePath("/equipment-dispatch");
}

export async function createAsphaltDispatchEntry(formData: FormData) {
  await requireSession();
  const workDate = parseWorkDate(formData.get("workDate"));
  const crew = String(formData.get("crew") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const asphaltInventoryItemId = String(formData.get("asphaltMixTypeId") ?? "").trim();
  const tackCoatInput = getTackCoatInput(formData);

  if (!crew) {
    throw new Error("Kolonne fehlt.");
  }

  if (!projectId) {
    throw new Error("Bitte ein Projekt auswählen.");
  }

  const isTackCoatCrew = isTackCoatCrewName(crew);

  if (!asphaltInventoryItemId && !isTackCoatCrew) {
    throw new Error("Bitte eine Asphaltsorte auswählen.");
  }

  if (isTackCoatCrew && !tackCoatInput.tackCoatMaterialTypeId) {
    throw new Error("Bitte ein Anspritzmittel auswählen.");
  }

  const [project, asphaltMixItem, tackCoatItem] = await Promise.all([
    getProject(projectId),
    getAsphaltMixInventoryItem(asphaltInventoryItemId),
    getTackCoatInventoryItem(tackCoatInput.tackCoatMaterialTypeId),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (asphaltInventoryItemId && !asphaltMixItem) {
    throw new Error("Asphaltsorte wurde nicht gefunden.");
  }

  if (tackCoatInput.tackCoatMaterialTypeId && !tackCoatItem) {
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

      asphaltMixTypeId: null,
      asphaltInventoryItemId: asphaltMixItem?.id ?? null,
      asphaltMixNumber: asphaltMixItem
        ? getInventoryItemNumber(asphaltMixItem)
        : null,
      asphaltMixName: asphaltMixItem?.name ?? null,

      quantityTons: asphaltMixItem ? parseNumber(formData.get("quantityTons")) : 0,

      tackCoatMaterialTypeId: null,
      tackCoatInventoryItemId: tackCoatItem?.id ?? null,
      tackCoatMaterialName: tackCoatItem?.name ?? null,
      tackCoatQuantity: tackCoatItem ? tackCoatInput.tackCoatQuantity : 0,
      tackCoatUnit: tackCoatItem
        ? tackCoatInput.tackCoatUnit ?? "l"
        : null,

      isForeignMix: asphaltMixItem ? formData.get("isForeignMix") === "on" : false,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateAsphaltPlanningViews();
}

export async function updateAsphaltDispatchEntry(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const asphaltInventoryItemId = String(formData.get("asphaltMixTypeId") ?? "").trim();
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

  if (!asphaltInventoryItemId && !isTackCoatCrew) {
    throw new Error("Bitte eine Asphaltsorte auswählen.");
  }

  if (isTackCoatCrew && !tackCoatInput.tackCoatMaterialTypeId) {
    throw new Error("Bitte ein Anspritzmittel auswählen.");
  }

  const [project, asphaltMixItem, tackCoatItem] = await Promise.all([
    getProject(projectId),
    getAsphaltMixInventoryItem(asphaltInventoryItemId),
    getTackCoatInventoryItem(tackCoatInput.tackCoatMaterialTypeId),
  ]);

  if (!project) {
    throw new Error("Projekt wurde nicht gefunden.");
  }

  if (asphaltInventoryItemId && !asphaltMixItem) {
    throw new Error("Asphaltsorte wurde nicht gefunden.");
  }

  if (tackCoatInput.tackCoatMaterialTypeId && !tackCoatItem) {
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

      asphaltMixTypeId: null,
      asphaltInventoryItemId: asphaltMixItem?.id ?? null,
      asphaltMixNumber: asphaltMixItem
        ? getInventoryItemNumber(asphaltMixItem)
        : null,
      asphaltMixName: asphaltMixItem?.name ?? null,

      quantityTons: asphaltMixItem ? parseNumber(formData.get("quantityTons")) : 0,

      tackCoatMaterialTypeId: null,
      tackCoatInventoryItemId: tackCoatItem?.id ?? null,
      tackCoatMaterialName: tackCoatItem?.name ?? null,
      tackCoatQuantity: tackCoatItem ? tackCoatInput.tackCoatQuantity : 0,
      tackCoatUnit: tackCoatItem
        ? tackCoatInput.tackCoatUnit ?? "l"
        : null,

      isForeignMix: asphaltMixItem ? formData.get("isForeignMix") === "on" : false,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateAsphaltPlanningViews();
}

export async function copyAsphaltDispatchEntry(formData: FormData) {
  await requireSession();
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
      asphaltInventoryItemId: source.asphaltInventoryItemId,
      asphaltMixNumber: source.asphaltMixNumber,
      asphaltMixName: source.asphaltMixName,

      quantityTons: source.quantityTons,

      tackCoatMaterialTypeId: source.tackCoatMaterialTypeId,
      tackCoatInventoryItemId: source.tackCoatInventoryItemId,
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
  await requireSession();
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
