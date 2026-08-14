"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const number = Number.parseInt(text, 10);

  if (!Number.isInteger(number)) {
    throw new Error("Sortierung muss eine ganze Zahl sein.");
  }

  return number;
}

async function getNextCategorySortOrder(parentCategoryId: string | null) {
  const lastCategory = await prisma.inventoryCategory.findFirst({
    where: {
      parentCategoryId,
    },
    orderBy: {
      sortOrder: "desc",
    },
    select: {
      sortOrder: true,
    },
  });

  return (lastCategory?.sortOrder ?? 0) + 10;
}

async function assertCategoryNameAvailable(name: string, currentCategoryId?: string) {
  const existingCategory = await prisma.inventoryCategory.findUnique({
    where: {
      name,
    },
    select: {
      id: true,
    },
  });

  if (existingCategory && existingCategory.id !== currentCategoryId) {
    throw new Error(`Inventarkategorie „${name}“ existiert bereits.`);
  }
}

function parseObjectNumber(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  if (!/^\d{1,6}$/.test(text)) {
    throw new Error(`${label} muss eine Zahl mit maximal 6 Stellen sein.`);
  }

  return Number.parseInt(text, 10);
}

function getObjectNumberRange(formData: FormData) {
  const objectNumberStart = parseObjectNumber(
    formData.get("objectNumberStart"),
    "Nummernkreis von",
  );
  const objectNumberEnd = parseObjectNumber(
    formData.get("objectNumberEnd"),
    "Nummernkreis bis",
  );
  const nextObjectNumber = parseObjectNumber(
    formData.get("nextObjectNumber"),
    "Nächste Objekt-ID",
  );

  const hasPartialRange =
    (objectNumberStart === null) !== (objectNumberEnd === null);

  if (hasPartialRange) {
    throw new Error("Bitte Nummernkreis von und bis angeben.");
  }

  if (
    objectNumberStart !== null &&
    objectNumberEnd !== null &&
    objectNumberStart > objectNumberEnd
  ) {
    throw new Error("Nummernkreis von darf nicht größer als Nummernkreis bis sein.");
  }

  if (
    nextObjectNumber !== null &&
    objectNumberStart !== null &&
    objectNumberEnd !== null &&
    (nextObjectNumber < objectNumberStart || nextObjectNumber > objectNumberEnd)
  ) {
    throw new Error("Nächste Objekt-ID muss innerhalb des Nummernkreises liegen.");
  }

  return {
    objectNumberEnd,
    objectNumberStart,
    nextObjectNumber: nextObjectNumber ?? objectNumberStart,
  };
}

type ObjectNumberRange = ReturnType<typeof getObjectNumberRange>;

type SubcategoryPayload = ObjectNumberRange & {
  asphaltDispositionUsage: string;
  dailyReportMachineLabel: string | null;
  id: string | null;
  isActive: boolean;
  isPersonalInventory: boolean;
  name: string;
  sortOrder: number | null;
  useInSpecialVehicleDisposition: boolean;
  useInTeamManagement: boolean;
  useInEmployeeFile: boolean;
  useInTruckDispatchSelection: boolean;
  useInEquipmentDispatch: boolean;
};

async function validateCategoryHierarchy({
  categoryId,
  parentCategoryId,
  range,
}: {
  categoryId?: string;
  parentCategoryId: string | null;
  range: ObjectNumberRange;
}) {
  if (!parentCategoryId) {
    return;
  }

  const parentCategory = await prisma.inventoryCategory.findUnique({
    where: {
      id: parentCategoryId,
    },
    select: {
      id: true,
      name: true,
      objectNumberEnd: true,
      objectNumberStart: true,
      parentCategoryId: true,
    },
  });

  if (!parentCategory) {
    throw new Error("Übergeordnete Kategorie wurde nicht gefunden.");
  }

  let ancestorId = parentCategory.parentCategoryId;
  while (ancestorId) {
    if (ancestorId === categoryId) {
      throw new Error("Diese Unterkategorie würde eine Schleife erzeugen.");
    }

    const ancestor = await prisma.inventoryCategory.findUnique({
      where: {
        id: ancestorId,
      },
      select: {
        parentCategoryId: true,
      },
    });
    ancestorId = ancestor?.parentCategoryId ?? null;
  }

  const hasOwnRange =
    range.objectNumberStart !== null && range.objectNumberEnd !== null;

  if (!hasOwnRange) {
    return;
  }

  if (
    parentCategory.objectNumberStart === null ||
    parentCategory.objectNumberEnd === null
  ) {
    throw new Error(
      `Hauptkategorie „${parentCategory.name}“ braucht zuerst einen Nummernkreis.`,
    );
  }

  if (
    range.objectNumberStart! < parentCategory.objectNumberStart ||
    range.objectNumberEnd! > parentCategory.objectNumberEnd
  ) {
    throw new Error(
      `Nummernkreis der Unterkategorie muss innerhalb von ${formatObjectNumber(parentCategory.objectNumberStart)}–${formatObjectNumber(parentCategory.objectNumberEnd)} liegen.`,
    );
  }

  const overlappingSibling = await prisma.inventoryCategory.findFirst({
    where: {
      id: categoryId
        ? {
            not: categoryId,
          }
        : undefined,
      parentCategoryId,
      objectNumberEnd: {
        gte: range.objectNumberStart!,
      },
      objectNumberStart: {
        lte: range.objectNumberEnd!,
      },
    },
    select: {
      name: true,
      objectNumberEnd: true,
      objectNumberStart: true,
    },
  });

  if (overlappingSibling) {
    throw new Error(
      `Nummernkreis überschneidet sich mit „${overlappingSibling.name}“ (${formatObjectNumber(overlappingSibling.objectNumberStart)}–${formatObjectNumber(overlappingSibling.objectNumberEnd)}).`,
    );
  }
}

function formatObjectNumber(value: number | null) {
  return value === null ? "—" : String(value).padStart(6, "0");
}

function getSubcategoryPayloads(formData: FormData) {
  const ids = formData.getAll("subcategoryId");
  const names = formData.getAll("subcategoryName");
  const starts = formData.getAll("subcategoryObjectNumberStart");
  const ends = formData.getAll("subcategoryObjectNumberEnd");
  const nextValues = formData.getAll("subcategoryNextObjectNumber");
  const sortOrders = formData.getAll("subcategorySortOrder");
  const activeValues = formData.getAll("subcategoryIsActiveValue");
  const specialVehicleValues = formData.getAll(
    "subcategoryUseInSpecialVehicleDisposition",
  );
  const teamManagementValues = formData.getAll(
    "subcategoryUseInTeamManagement",
  );
  const employeeFileValues = formData.getAll(
    "subcategoryUseInEmployeeFile",
  );
  const personalInventoryValues = formData.getAll(
    "subcategoryIsPersonalInventory",
  );
  const truckDispatchSelectionValues = formData.getAll(
    "subcategoryUseInTruckDispatchSelection",
  );
  const equipmentDispatchValues = formData.getAll(
    "subcategoryUseInEquipmentDispatch",
  );
  const asphaltUsageValues = formData.getAll(
    "subcategoryAsphaltDispositionUsage",
  );
  const dailyReportMachineLabelValues = formData.getAll(
    "subcategoryDailyReportMachineLabel",
  );

  return names.map((nameValue, index) => {
    const name = String(nameValue ?? "").trim();
    const id = optionalId(ids[index] ?? null);
    const objectNumberStart = parseObjectNumber(
      starts[index] ?? null,
      `Unterkategorie ${index + 1}: Nummernkreis von`,
    );
    const objectNumberEnd = parseObjectNumber(
      ends[index] ?? null,
      `Unterkategorie ${index + 1}: Nummernkreis bis`,
    );
    const nextObjectNumber = parseObjectNumber(
      nextValues[index] ?? null,
      `Unterkategorie ${index + 1}: Nächste Objekt-ID`,
    );

    const hasPartialRange =
      (objectNumberStart === null) !== (objectNumberEnd === null);

    if (hasPartialRange) {
      throw new Error(
        `Bitte bei Unterkategorie ${index + 1} Nummernkreis von und bis angeben.`,
      );
    }

    if (
      objectNumberStart !== null &&
      objectNumberEnd !== null &&
      objectNumberStart > objectNumberEnd
    ) {
      throw new Error(
        `Unterkategorie ${index + 1}: Nummernkreis von darf nicht größer als bis sein.`,
      );
    }

    if (
      nextObjectNumber !== null &&
      objectNumberStart !== null &&
      objectNumberEnd !== null &&
      (nextObjectNumber < objectNumberStart || nextObjectNumber > objectNumberEnd)
    ) {
      throw new Error(
        `Unterkategorie ${index + 1}: Nächste Objekt-ID muss innerhalb des Nummernkreises liegen.`,
      );
    }

    return {
      asphaltDispositionUsage: normalizeAsphaltDispositionUsage(
        asphaltUsageValues[index],
      ),
      dailyReportMachineLabel: optionalString(
        dailyReportMachineLabelValues[index] ?? null,
      ),
      id,
      isActive: String(activeValues[index] ?? "0") === "1",
      isPersonalInventory:
        String(personalInventoryValues[index] ?? "0") === "1",
      name,
      objectNumberEnd,
      objectNumberStart,
      nextObjectNumber: nextObjectNumber ?? objectNumberStart,
      sortOrder: parseSortOrder(sortOrders[index] ?? null),
      useInSpecialVehicleDisposition:
        String(specialVehicleValues[index] ?? "0") === "1",
      useInTeamManagement:
        String(teamManagementValues[index] ?? "0") === "1",
      useInEmployeeFile:
        String(employeeFileValues[index] ?? "0") === "1",
      useInTruckDispatchSelection:
        String(truckDispatchSelectionValues[index] ?? "0") === "1",
      useInEquipmentDispatch:
        String(equipmentDispatchValues[index] ?? "0") === "1",
    } satisfies SubcategoryPayload;
  });
}

async function validateInlineSubcategories({
  parentCategoryId,
  parentName,
  parentRange,
  subcategories,
}: {
  parentCategoryId?: string;
  parentName: string;
  parentRange: ObjectNumberRange;
  subcategories: SubcategoryPayload[];
}) {
  const activeSubcategories = subcategories.filter(
    (subcategory) => subcategory.name.length > 0,
  );
  const seenNames = new Map<string, string>();

  for (const subcategory of activeSubcategories) {
    const normalizedName = subcategory.name.trim().toLowerCase();
    const previousName = seenNames.get(normalizedName);

    if (previousName) {
      throw new Error(
        `Unterkategorie „${subcategory.name}“ ist doppelt eingetragen.`,
      );
    }

    seenNames.set(normalizedName, subcategory.name);
  }

  for (const subcategory of activeSubcategories) {
    if (
      subcategory.objectNumberStart !== null &&
      subcategory.objectNumberEnd !== null
    ) {
      if (
        parentRange.objectNumberStart === null ||
        parentRange.objectNumberEnd === null
      ) {
        throw new Error(
          `Hauptkategorie „${parentName}“ braucht zuerst einen Nummernkreis.`,
        );
      }

      if (
        subcategory.objectNumberStart < parentRange.objectNumberStart ||
        subcategory.objectNumberEnd > parentRange.objectNumberEnd
      ) {
        throw new Error(
          `Unterkategorie „${subcategory.name}“ muss innerhalb von ${formatObjectNumber(parentRange.objectNumberStart)}–${formatObjectNumber(parentRange.objectNumberEnd)} liegen.`,
        );
      }
    }
  }

  for (let index = 0; index < activeSubcategories.length; index += 1) {
    const current = activeSubcategories[index];

    if (
      current.objectNumberStart === null ||
      current.objectNumberEnd === null
    ) {
      continue;
    }

    for (let nextIndex = index + 1; nextIndex < activeSubcategories.length; nextIndex += 1) {
      const next = activeSubcategories[nextIndex];

      if (next.objectNumberStart === null || next.objectNumberEnd === null) {
        continue;
      }

      const overlaps =
        current.objectNumberStart <= next.objectNumberEnd &&
        current.objectNumberEnd >= next.objectNumberStart;

      if (overlaps) {
        throw new Error(
          `Unterkategorien „${current.name}“ und „${next.name}“ überschneiden sich im Nummernkreis.`,
        );
      }
    }
  }

  for (const subcategory of activeSubcategories) {
    if (subcategory.id) continue;

    const existingCategory = await prisma.inventoryCategory.findUnique({
      where: {
        name: subcategory.name,
      },
      select: {
        parentCategoryId: true,
      },
    });

    if (
      existingCategory &&
      (!parentCategoryId ||
        existingCategory.parentCategoryId !== parentCategoryId)
    ) {
      throw new Error(
        `Der Name „${subcategory.name}“ ist bereits bei einer anderen Kategorie vergeben. Bitte einen eindeutigen Namen verwenden.`,
      );
    }
  }

  if (!parentCategoryId) {
    return;
  }

  const siblingIds = activeSubcategories
    .map((subcategory) => subcategory.id)
    .filter((id): id is string => Boolean(id));

  for (const subcategory of activeSubcategories) {
    if (
      subcategory.objectNumberStart === null ||
      subcategory.objectNumberEnd === null
    ) {
      continue;
    }

    const additionalExcludedIds: string[] = [];

    if (!subcategory.id) {
      const existingCategoryWithSameName = await prisma.inventoryCategory.findUnique({
        where: {
          name: subcategory.name,
        },
        select: {
          id: true,
          parentCategoryId: true,
        },
      });

      if (existingCategoryWithSameName) {
        if (existingCategoryWithSameName.parentCategoryId !== parentCategoryId) {
          throw new Error(
            `Unterkategorie „${subcategory.name}“ existiert bereits an anderer Stelle. Bitte einen eindeutigen Namen verwenden.`,
          );
        }

        additionalExcludedIds.push(existingCategoryWithSameName.id);
      }
    }

    const overlappingSibling = await prisma.inventoryCategory.findFirst({
      where: {
        id: {
          notIn: [
            parentCategoryId,
            ...siblingIds,
            ...additionalExcludedIds,
          ],
        },
        parentCategoryId,
        objectNumberEnd: {
          gte: subcategory.objectNumberStart,
        },
        objectNumberStart: {
          lte: subcategory.objectNumberEnd,
        },
      },
      select: {
        name: true,
        objectNumberEnd: true,
        objectNumberStart: true,
      },
    });

    if (overlappingSibling) {
      throw new Error(
        `Unterkategorie „${subcategory.name}“ überschneidet sich mit „${overlappingSibling.name}“ (${formatObjectNumber(overlappingSibling.objectNumberStart)}–${formatObjectNumber(overlappingSibling.objectNumberEnd)}).`,
      );
    }
  }
}

function dailyReportSection(value: FormDataEntryValue | null) {
  const text = String(value ?? "NONE").trim();
  const allowedSections = new Set([
    "NONE",
    "MATERIAL",
    "MACHINES",
    "OTHER",
  ]);

  if (text === "TRUCKS") return "MACHINES";

  return allowedSections.has(text) ? text : "NONE";
}

function normalizeAsphaltDispositionUsage(value: unknown) {
  const usage = String(value ?? "NONE").trim().toUpperCase();
  return ["ASPHALT_MIX", "TACK_COAT"].includes(usage) ? usage : "NONE";
}

function getTruckDispatchUsage(formData: FormData) {
  const useInTruckDispatchMaterial =
    formData.get("useInTruckDispatchMaterial") === "on";
  const useInTruckDispatchObject =
    formData.get("useInTruckDispatchObject") === "on";

  return {
    useInTruckDispatchMaterial,
    useInTruckDispatchObject,
    useInTruckDisposition:
      useInTruckDispatchMaterial || useInTruckDispatchObject,
  };
}

function optionalId(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text && text !== "__none" ? text : null;
}

function revalidateInventoryCategoryViews() {
  revalidatePath("/admin/inventory-categories");
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
}

async function syncInlineSubcategories({
  categoryData,
  db,
  parentCategoryId,
  subcategories,
}: {
  categoryData: {
    colorClass: string | null;
    dailyReportSection: string;
    dailyReportMachineLabel: string | null;
    description: string | null;
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDispatchSelection: boolean;
    useInEquipmentDispatch: boolean;
    useInTruckDisposition: boolean;
    useInSpecialVehicleDisposition: boolean;
    useInTeamManagement: boolean;
    useInEmployeeFile: boolean;
    isPersonalInventory: boolean;
    asphaltDispositionUsage: string;
  };
  db: Prisma.TransactionClient;
  parentCategoryId: string;
  subcategories: SubcategoryPayload[];
}) {
  for (const [index, subcategory] of subcategories.entries()) {
    if (!subcategory.name) {
      if (!subcategory.id) {
        continue;
      }

      const itemCount = await db.inventoryItem.count({
        where: {
          categoryId: subcategory.id,
        },
      });

      if (itemCount > 0) {
        await db.inventoryCategory.update({
          where: {
            id: subcategory.id,
          },
          data: {
            isActive: false,
          },
        });
      } else {
        await db.inventoryCategory.delete({
          where: {
            id: subcategory.id,
          },
        });
      }
      continue;
    }

    const data = {
      ...categoryData,
      asphaltDispositionUsage: subcategory.asphaltDispositionUsage,
      dailyReportMachineLabel: subcategory.dailyReportMachineLabel,
      isActive: subcategory.isActive,
      isPersonalInventory: subcategory.isPersonalInventory,
      name: subcategory.name,
      nextObjectNumber: subcategory.nextObjectNumber,
      objectNumberEnd: subcategory.objectNumberEnd,
      objectNumberStart: subcategory.objectNumberStart,
      parentCategory: {
        connect: {
          id: parentCategoryId,
        },
      },
      sortOrder: subcategory.sortOrder ?? (index + 1) * 10,
      useInSpecialVehicleDisposition:
        subcategory.useInSpecialVehicleDisposition,
      useInTeamManagement: subcategory.useInTeamManagement,
      useInEmployeeFile: subcategory.useInEmployeeFile,
      useInTruckDispatchSelection: subcategory.useInTruckDispatchSelection,
      useInEquipmentDispatch: subcategory.useInEquipmentDispatch,
    };

    if (subcategory.id) {
      await db.inventoryCategory.update({
        where: {
          id: subcategory.id,
        },
        data,
      });
    } else {
      const existingCategory = await db.inventoryCategory.findUnique({
        where: {
          name: subcategory.name,
        },
        select: {
          id: true,
          parentCategoryId: true,
        },
      });

      if (existingCategory) {
        if (existingCategory.parentCategoryId !== parentCategoryId) {
          throw new Error(
            `Unterkategorie „${subcategory.name}“ existiert bereits an anderer Stelle. Bitte einen eindeutigen Namen verwenden.`,
          );
        }

        await db.inventoryCategory.update({
          where: {
            id: existingCategory.id,
          },
          data,
        });
        continue;
      }

      await db.inventoryCategory.create({
        data,
      });
    }
  }
}

async function createInventoryCategoryInternal(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Kategoriename ist ein Pflichtfeld.");
  }

  const parentCategoryId = optionalId(formData.get("parentCategoryId"));
  const objectNumberRange = getObjectNumberRange(formData);
  const subcategories = getSubcategoryPayloads(formData);
  const categoryData = {
    asphaltDispositionUsage: normalizeAsphaltDispositionUsage(
      formData.get("asphaltDispositionUsage"),
    ),
    colorClass: optionalString(formData.get("colorClass")),
    dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
    dailyReportMachineLabel: optionalString(
      formData.get("dailyReportMachineLabel"),
    ),
    description: optionalString(formData.get("description")),
    useInDailyReports: formData.get("useInDailyReports") === "on",
    useInSpecialVehicleDisposition:
      formData.get("useInSpecialVehicleDisposition") === "on",
    useInTeamManagement: formData.get("useInTeamManagement") === "on",
    useInEmployeeFile: formData.get("useInEmployeeFile") === "on",
    isPersonalInventory: formData.get("isPersonalInventory") === "on",
    useInTruckDispatchSelection:
      formData.get("useInTruckDispatchSelection") === "on",
    useInEquipmentDispatch:
      formData.get("useInEquipmentDispatch") === "on",
    useInInventory: true,
    ...getTruckDispatchUsage(formData),
  };

  await validateCategoryHierarchy({
    parentCategoryId,
    range: objectNumberRange,
  });
  await assertCategoryNameAvailable(name);
  await validateInlineSubcategories({
    parentName: name,
    parentRange: objectNumberRange,
    subcategories,
  });

  const sortOrder =
    parseSortOrder(formData.get("sortOrder")) ??
    (await getNextCategorySortOrder(parentCategoryId));

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const category = await tx.inventoryCategory.create({
      data: {
        ...categoryData,
        isActive: formData.get("isActive") !== "off",
        name,
        ...objectNumberRange,
        parentCategory: parentCategoryId
          ? {
              connect: {
                id: parentCategoryId,
              },
            }
          : undefined,
        sortOrder,
      },
      select: {
        id: true,
      },
    });

    await syncInlineSubcategories({
      categoryData,
      db: tx,
      parentCategoryId: category.id,
      subcategories,
    });
  });

  revalidateInventoryCategoryViews();
}

async function updateInventoryCategoryInternal(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  if (!name) {
    throw new Error("Kategoriename ist ein Pflichtfeld.");
  }

  const parentCategoryId = optionalId(formData.get("parentCategoryId"));

  if (parentCategoryId === id) {
    throw new Error("Eine Kategorie kann nicht ihre eigene Unterkategorie sein.");
  }

  const objectNumberRange = getObjectNumberRange(formData);
  const subcategories = getSubcategoryPayloads(formData);
  const categoryData = {
    asphaltDispositionUsage: normalizeAsphaltDispositionUsage(
      formData.get("asphaltDispositionUsage"),
    ),
    colorClass: optionalString(formData.get("colorClass")),
    dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
    dailyReportMachineLabel: optionalString(
      formData.get("dailyReportMachineLabel"),
    ),
    description: optionalString(formData.get("description")),
    useInDailyReports: formData.get("useInDailyReports") === "on",
    useInSpecialVehicleDisposition:
      formData.get("useInSpecialVehicleDisposition") === "on",
    useInTeamManagement: formData.get("useInTeamManagement") === "on",
    useInEmployeeFile: formData.get("useInEmployeeFile") === "on",
    isPersonalInventory: formData.get("isPersonalInventory") === "on",
    useInTruckDispatchSelection:
      formData.get("useInTruckDispatchSelection") === "on",
    useInEquipmentDispatch:
      formData.get("useInEquipmentDispatch") === "on",
    useInInventory: true,
    ...getTruckDispatchUsage(formData),
  };

  await validateCategoryHierarchy({
    categoryId: id,
    parentCategoryId,
    range: objectNumberRange,
  });
  await assertCategoryNameAvailable(name, id);
  await validateInlineSubcategories({
    parentCategoryId: id,
    parentName: name,
    parentRange: objectNumberRange,
    subcategories,
  });

  const sortOrder =
    parseSortOrder(formData.get("sortOrder")) ??
    (await getNextCategorySortOrder(parentCategoryId));

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.inventoryCategory.update({
      where: {
        id,
      },
      data: {
        ...categoryData,
        isActive: formData.get("isActive") === "on",
        name,
        ...objectNumberRange,
        parentCategory: parentCategoryId
          ? {
              connect: {
                id: parentCategoryId,
              },
            }
          : {
              disconnect: true,
            },
        sortOrder,
      },
    });

    await syncInlineSubcategories({
      categoryData,
      db: tx,
      parentCategoryId: id,
      subcategories,
    });
  });

  revalidateInventoryCategoryViews();
}

type CategoryActionState = {
  error: string | null;
  errorKey: number;
  success: boolean;
  successKey: number;
};

function categoryActionError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "Dieser Kategoriename ist bereits vergeben. Bitte einen eindeutigen Namen verwenden.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Die Kategorie konnte nicht gespeichert werden. Bitte Eingaben prüfen.";
}

export async function createInventoryCategory(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  await requireAdmin();
  try {
    await createInventoryCategoryInternal(formData);
    return {
      error: null,
      errorKey: _previousState.errorKey,
      success: true,
      successKey: _previousState.successKey + 1,
    };
  } catch (error) {
    return {
      error: categoryActionError(error),
      errorKey: _previousState.errorKey + 1,
      success: false,
      successKey: _previousState.successKey,
    };
  }
}

export async function updateInventoryCategory(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  await requireAdmin();
  try {
    await updateInventoryCategoryInternal(formData);
    return {
      error: null,
      errorKey: _previousState.errorKey,
      success: true,
      successKey: _previousState.successKey + 1,
    };
  } catch (error) {
    return {
      error: categoryActionError(error),
      errorKey: _previousState.errorKey + 1,
      success: false,
      successKey: _previousState.successKey,
    };
  }
}

export async function deleteInventoryCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const category = await tx.inventoryCategory.findUnique({
      where: { id },
      select: {
        childCategories: {
          select: { id: true },
        },
      },
    });

    if (!category) return;

    const categoryIds = [
      id,
      ...category.childCategories.map((childCategory) => childCategory.id),
    ];
    const itemCount = await tx.inventoryItem.count({
      where: {
        categoryId: {
          in: categoryIds,
        },
      },
    });

    if (itemCount > 0) {
      await tx.inventoryCategory.updateMany({
        where: {
          id: {
            in: categoryIds,
          },
        },
        data: {
          isActive: false,
        },
      });
      return;
    }

    await tx.inventoryCategory.deleteMany({
      where: {
        parentCategoryId: id,
      },
    });
    await tx.inventoryCategory.delete({
      where: {
        id,
      },
    });
  });

  revalidateInventoryCategoryViews();
}
