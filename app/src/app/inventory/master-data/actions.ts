"use server";

import { revalidatePath } from "next/cache";
import { getNextInventoryObjectNumber } from "@/lib/inventory-object-numbers";
import { prisma } from "@/lib/prisma";

type SourceKind = "MATERIAL" | "TACK_COAT" | "ASPHALT" | "CONCRETE" | "VEHICLE";

const sourceConfigs: Record<
  SourceKind,
  {
    categoryName: string;
    label: string;
  }
> = {
  ASPHALT: {
    categoryName: "Asphalt",
    label: "Asphalt",
  },
  CONCRETE: {
    categoryName: "Beton",
    label: "Beton",
  },
  MATERIAL: {
    categoryName: "Material",
    label: "Material",
  },
  TACK_COAT: {
    categoryName: "Anspritzmittel",
    label: "Anspritzmittel",
  },
  VEHICLE: {
    categoryName: "Fahrzeuge",
    label: "Fahrzeuge",
  },
};

function revalidateMasterDataViews() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
  revalidatePath("/inventory/master-data");
}

function optionalId(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text && text !== "__none" ? text : null;
}

function getCategoryIdForSource(formData: FormData, kind: SourceKind) {
  return (
    optionalId(formData.get(`targetCategoryId_${kind}`)) ??
    optionalId(formData.get("targetCategoryId"))
  );
}

async function getCategoryOrThrow(kind: SourceKind, categoryId: string | null) {
  const config = sourceConfigs[kind];
  const category = categoryId
    ? await prisma.inventoryCategory.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          id: true,
          name: true,
          objectNumberEnd: true,
          objectNumberStart: true,
        },
      })
    : await prisma.inventoryCategory.findFirst({
        where: {
          name: config.categoryName,
        },
        select: {
          id: true,
          name: true,
          objectNumberEnd: true,
          objectNumberStart: true,
        },
      });

  if (!category) {
    throw new Error(
      `Bitte eine Inventarkategorie für „${config.label}“ auswählen oder eine Kategorie „${config.categoryName}“ anlegen.`,
    );
  }

  if (category.objectNumberStart === null || category.objectNumberEnd === null) {
    throw new Error(
      `Inventarkategorie „${category.name}“ hat noch keinen Nummernkreis.`,
    );
  }

  return category;
}

async function hasFallbackCategory(kind: SourceKind) {
  const category = await prisma.inventoryCategory.findFirst({
    where: {
      name: sourceConfigs[kind].categoryName,
    },
    select: {
      id: true,
      objectNumberEnd: true,
      objectNumberStart: true,
    },
  });

  return Boolean(
    category &&
      category.objectNumberStart !== null &&
      category.objectNumberEnd !== null,
  );
}

async function upsertInventorySourceItem({
  categoryId,
  axleCount,
  inventoryNumber,
  isActive,
  isStockManaged,
  licensePlate,
  name,
  notes,
  payloadKg,
  responsibleEmployeeId,
  sourceId,
  sourceType,
  stockUnit,
  vehicleId,
}: {
  categoryId: string;
  axleCount?: number | null;
  inventoryNumber: string | null;
  isActive: boolean;
  isStockManaged: boolean;
  licensePlate?: string | null;
  name: string;
  notes: string | null;
  payloadKg?: number | null;
  responsibleEmployeeId?: string | null;
  sourceId: string;
  sourceType: SourceKind;
  stockUnit: string;
  vehicleId?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    const existingItem = await tx.inventoryItem.findUnique({
      where: {
        sourceType_sourceId: {
          sourceId,
          sourceType,
        },
      },
      select: {
        id: true,
      },
    });
    const existingInventoryNumberItem = inventoryNumber
      ? await tx.inventoryItem.findUnique({
          where: {
            inventoryNumber,
          },
          select: {
            id: true,
          },
        })
      : null;
    const safeInventoryNumber =
      existingInventoryNumberItem && existingInventoryNumberItem.id !== existingItem?.id
        ? null
        : inventoryNumber;

    if (existingItem) {
      await tx.inventoryItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          axleCount,
          category: {
            connect: {
              id: categoryId,
            },
          },
          inventoryNumber: safeInventoryNumber,
          isStockManaged,
          licensePlate,
          name,
          notes,
          payloadKg,
          responsibleEmployee: responsibleEmployeeId
            ? {
                connect: {
                  id: responsibleEmployeeId,
                },
              }
            : undefined,
          responsibleType: responsibleEmployeeId ? "EMPLOYEE" : null,
          status: isActive ? "ACTIVE" : "LOCKED",
          stockUnit,
          vehicle: vehicleId
            ? {
                connect: {
                  id: vehicleId,
                },
              }
            : undefined,
        },
      });
      return;
    }

    await tx.inventoryItem.create({
      data: {
        axleCount,
        category: {
          connect: {
            id: categoryId,
          },
        },
        inventoryNumber: safeInventoryNumber,
        isStockManaged,
        licensePlate,
        name,
        notes,
        objectNumber: await getNextInventoryObjectNumber(tx, categoryId),
        payloadKg,
        responsibleEmployee: responsibleEmployeeId
          ? {
              connect: {
                id: responsibleEmployeeId,
              },
            }
          : undefined,
        responsibleType: responsibleEmployeeId ? "EMPLOYEE" : null,
        sourceId,
        sourceType,
        status: isActive ? "ACTIVE" : "LOCKED",
        stockUnit,
        vehicle: vehicleId
          ? {
              connect: {
                id: vehicleId,
              },
            }
          : undefined,
      },
    });
  });
}

function getVehicleCategoryId(formData: FormData, category: string) {
  return optionalId(formData.get(`vehicleCategoryId_${category}`));
}

function getVehicleAxleCount(category: string) {
  if (category === "2-Achser") return 2;
  if (category === "3-Achser") return 3;
  if (category === "4-Achser") return 4;

  return null;
}

async function getFallbackVehicleCategory(category: string, vehicleType: string) {
  const candidates = [
    `${vehicleType} ${category}`,
    `${category} ${vehicleType}`,
    category,
    vehicleType,
    category === "2-Achser" ? "LKW 2-Achser" : null,
    category === "3-Achser" ? "LKW 3-Achser" : null,
    category === "4-Achser" ? "LKW 4-Achser" : null,
    category === "Sattel" ? "LKW Rest" : null,
    category === "Tankwagen" ? "LKW Rest" : null,
    category === "Kranwagen" ? "LKW Rest" : null,
    category.includes("Anhänger") ? "LKW Anhänger" : null,
    category.includes("PKW") ? "PKW" : null,
    category === "Sprinter" ? "PKW" : null,
    category === "Bagger" ? "Bagger" : null,
    category === "Radlader" ? "Radlader" : null,
    category === "Traktor" ? "Sondergeräte/Sonderfahrzeuge" : null,
    vehicleType === "Traktor" ? "Sondergeräte/Sonderfahrzeuge" : null,
  ].filter((value): value is string => Boolean(value));

  return prisma.inventoryCategory.findFirst({
    where: {
      isActive: true,
      name: {
        in: candidates,
      },
      objectNumberEnd: {
        not: null,
      },
      objectNumberStart: {
        not: null,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
    },
  });
}

async function syncVehicles(formData: FormData) {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      driverAssignments: {
        where: {
          isActive: true,
        },
        include: {
          driver: {
            include: {
              employee: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ category: "asc" }, { vehicleNumber: "asc" }],
  });
  let syncedCount = 0;

  for (const vehicle of vehicles) {
    const categoryId =
      getVehicleCategoryId(formData, vehicle.category) ??
      (await getFallbackVehicleCategory(vehicle.category, vehicle.vehicleType))?.id;

    if (!categoryId) {
      continue;
    }

    const name = [
      vehicle.vehicleNumber,
      vehicle.licensePlate,
      vehicle.dailyReportMachineLabel,
      vehicle.vehicleType,
    ]
      .filter(Boolean)
      .join(" · ");

    await upsertInventorySourceItem({
      axleCount: getVehicleAxleCount(vehicle.category),
      categoryId,
      inventoryNumber: vehicle.vehicleNumber,
      isActive: vehicle.isActive,
      isStockManaged: false,
      licensePlate: vehicle.licensePlate,
      name,
      notes: [
        vehicle.notes,
        vehicle.category ? `Fahrzeugkategorie: ${vehicle.category}` : null,
        vehicle.vehicleType ? `Fahrzeugtyp: ${vehicle.vehicleType}` : null,
        vehicle.asphaltPayloadTons
          ? `Nutzlast: ${vehicle.asphaltPayloadTons} t`
          : null,
        vehicle.tackCoatTankLiters
          ? `Anspritzmittel-Tank: ${vehicle.tackCoatTankLiters} l`
          : null,
      ]
        .filter(Boolean)
        .join("\n") || null,
      sourceId: vehicle.id,
      sourceType: "VEHICLE",
      payloadKg: vehicle.asphaltPayloadTons
        ? Math.round(vehicle.asphaltPayloadTons * 1000)
        : null,
      responsibleEmployeeId:
        vehicle.driverAssignments[0]?.driver.employee?.id ?? null,
      stockUnit: "Stk.",
      vehicleId: vehicle.id,
    });
    syncedCount += 1;
  }

  return syncedCount;
}

async function syncMaterials(categoryId: string | null) {
  const category = await getCategoryOrThrow("MATERIAL", categoryId);
  const materials = await prisma.materialType.findMany({
    where: {
      OR: [{ category: null }, { category: { not: "Anspritzmittel" } }],
    },
    orderBy: [{ materialNumber: "asc" }, { name: "asc" }],
  });

  for (const material of materials) {
    await upsertInventorySourceItem({
      categoryId: category.id,
      inventoryNumber: material.materialNumber,
      isActive: material.isActive,
      isStockManaged: true,
      name: material.name,
      notes: material.notes,
      sourceId: material.id,
      sourceType: "MATERIAL",
      stockUnit: material.unit,
    });
  }
}

async function syncTackCoatTypes(categoryId: string | null) {
  const category = await getCategoryOrThrow("TACK_COAT", categoryId);
  const materials = await prisma.materialType.findMany({
    where: {
      category: "Anspritzmittel",
    },
    orderBy: [{ materialNumber: "asc" }, { name: "asc" }],
  });

  for (const material of materials) {
    await upsertInventorySourceItem({
      categoryId: category.id,
      inventoryNumber: material.materialNumber,
      isActive: material.isActive,
      isStockManaged: true,
      name: material.name,
      notes: material.notes,
      sourceId: material.id,
      sourceType: "TACK_COAT",
      stockUnit: material.unit,
    });
  }
}

async function syncAsphaltTypes(categoryId: string | null) {
  const category = await getCategoryOrThrow("ASPHALT", categoryId);
  const asphaltTypes = await prisma.asphaltMixType.findMany({
    orderBy: [{ mixNumber: "asc" }, { name: "asc" }],
  });

  for (const asphaltType of asphaltTypes) {
    await upsertInventorySourceItem({
      categoryId: category.id,
      inventoryNumber: asphaltType.mixNumber,
      isActive: asphaltType.isActive,
      isStockManaged: true,
      name: asphaltType.name,
      notes:
        [
          asphaltType.shortName ? `Kurzname: ${asphaltType.shortName}` : null,
          asphaltType.category ? `Kategorie: ${asphaltType.category}` : null,
          asphaltType.plant ? `Mischanlage: ${asphaltType.plant}` : null,
          asphaltType.notes,
        ]
          .filter(Boolean)
          .join("\n") || null,
      sourceId: asphaltType.id,
      sourceType: "ASPHALT",
      stockUnit: asphaltType.unit,
    });
  }
}

async function syncConcreteTypes(categoryId: string | null) {
  const category = await getCategoryOrThrow("CONCRETE", categoryId);
  const concreteTypes = await prisma.concreteType.findMany({
    orderBy: [{ typeNumber: "asc" }, { name: "asc" }],
  });

  for (const concreteType of concreteTypes) {
    await upsertInventorySourceItem({
      categoryId: category.id,
      inventoryNumber: concreteType.typeNumber,
      isActive: concreteType.isActive,
      isStockManaged: true,
      name: concreteType.name,
      notes:
        [
          concreteType.strengthClass
            ? `Festigkeitsklasse: ${concreteType.strengthClass}`
            : null,
          concreteType.exposureClass
            ? `Expositionsklasse: ${concreteType.exposureClass}`
            : null,
          concreteType.aggregate ? `Körnung: ${concreteType.aggregate}` : null,
          concreteType.consistency ? `Konsistenz: ${concreteType.consistency}` : null,
          concreteType.notes,
        ]
          .filter(Boolean)
          .join("\n") || null,
      sourceId: concreteType.id,
      sourceType: "CONCRETE",
      stockUnit: concreteType.unit,
    });
  }
}

export async function syncInventoryMasterData(formData: FormData) {
  const sourceType = String(formData.get("sourceType") ?? "");

  if (sourceType === "MATERIAL") {
    await syncMaterials(getCategoryIdForSource(formData, "MATERIAL"));
  } else if (sourceType === "TACK_COAT") {
    await syncTackCoatTypes(getCategoryIdForSource(formData, "TACK_COAT"));
  } else if (sourceType === "ASPHALT") {
    await syncAsphaltTypes(getCategoryIdForSource(formData, "ASPHALT"));
  } else if (sourceType === "CONCRETE") {
    await syncConcreteTypes(getCategoryIdForSource(formData, "CONCRETE"));
  } else if (sourceType === "VEHICLE") {
    const syncedVehicles = await syncVehicles(formData);

    if (syncedVehicles === 0) {
      throw new Error(
        "Für die Fahrzeuge wurde keine passende Inventarkategorie mit Nummernkreis gefunden oder ausgewählt.",
      );
    }
  } else if (sourceType === "ALL") {
    let syncedSources = 0;

    const materialCategoryId = getCategoryIdForSource(formData, "MATERIAL");
    if (materialCategoryId || (await hasFallbackCategory("MATERIAL"))) {
      await syncMaterials(materialCategoryId);
      syncedSources += 1;
    }

    const tackCoatCategoryId = getCategoryIdForSource(formData, "TACK_COAT");
    if (tackCoatCategoryId || (await hasFallbackCategory("TACK_COAT"))) {
      await syncTackCoatTypes(tackCoatCategoryId);
      syncedSources += 1;
    }

    const asphaltCategoryId = getCategoryIdForSource(formData, "ASPHALT");
    if (asphaltCategoryId || (await hasFallbackCategory("ASPHALT"))) {
      await syncAsphaltTypes(asphaltCategoryId);
      syncedSources += 1;
    }

    const concreteCategoryId = getCategoryIdForSource(formData, "CONCRETE");
    if (concreteCategoryId || (await hasFallbackCategory("CONCRETE"))) {
      await syncConcreteTypes(concreteCategoryId);
      syncedSources += 1;
    }

    const syncedVehicles = await syncVehicles(formData);
    if (syncedVehicles > 0) {
      syncedSources += 1;
    }

    if (syncedSources === 0) {
      throw new Error(
        "Bitte mindestens eine Zielkategorie mit Nummernkreis auswählen.",
      );
    }
  } else {
    throw new Error("Unbekannte Stammdaten-Auswahl.");
  }

  revalidateMasterDataViews();
}
