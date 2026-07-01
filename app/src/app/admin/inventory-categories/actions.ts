"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return 0;

  const number = Number.parseInt(text, 10);

  if (!Number.isInteger(number)) {
    throw new Error("Sortierung muss eine ganze Zahl sein.");
  }

  return number;
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
  id: string | null;
  isActive: boolean;
  name: string;
  sortOrder: number;
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
      id,
      isActive: String(activeValues[index] ?? "0") === "1",
      name,
      objectNumberEnd,
      objectNumberStart,
      nextObjectNumber: nextObjectNumber ?? objectNumberStart,
      sortOrder: parseSortOrder(sortOrders[index] ?? null),
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

    const overlappingSibling = await prisma.inventoryCategory.findFirst({
      where: {
        id: {
          notIn: [
            parentCategoryId,
            ...siblingIds,
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
}

async function syncInlineSubcategories({
  categoryData,
  parentCategoryId,
  subcategories,
}: {
  categoryData: {
    colorClass: string | null;
    dailyReportSection: string;
    description: string | null;
    useInDailyReports: boolean;
    useInInventory: boolean;
    useInTruckDispatchMaterial: boolean;
    useInTruckDispatchObject: boolean;
    useInTruckDisposition: boolean;
  };
  parentCategoryId: string;
  subcategories: SubcategoryPayload[];
}) {
  for (const subcategory of subcategories) {
    if (!subcategory.name) {
      if (!subcategory.id) {
        continue;
      }

      const itemCount = await prisma.inventoryItem.count({
        where: {
          categoryId: subcategory.id,
        },
      });

      if (itemCount > 0) {
        await prisma.inventoryCategory.update({
          where: {
            id: subcategory.id,
          },
          data: {
            isActive: false,
          },
        });
      } else {
        await prisma.inventoryCategory.delete({
          where: {
            id: subcategory.id,
          },
        });
      }
      continue;
    }

    const data = {
      ...categoryData,
      isActive: subcategory.isActive,
      name: subcategory.name,
      nextObjectNumber: subcategory.nextObjectNumber,
      objectNumberEnd: subcategory.objectNumberEnd,
      objectNumberStart: subcategory.objectNumberStart,
      parentCategory: {
        connect: {
          id: parentCategoryId,
        },
      },
      sortOrder: subcategory.sortOrder,
    };

    if (subcategory.id) {
      await prisma.inventoryCategory.update({
        where: {
          id: subcategory.id,
        },
        data,
      });
    } else {
      await prisma.inventoryCategory.create({
        data,
      });
    }
  }
}

export async function createInventoryCategory(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Kategoriename ist ein Pflichtfeld.");
  }

  const parentCategoryId = optionalId(formData.get("parentCategoryId"));
  const objectNumberRange = getObjectNumberRange(formData);
  const subcategories = getSubcategoryPayloads(formData);
  const categoryData = {
    colorClass: optionalString(formData.get("colorClass")),
    dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
    description: optionalString(formData.get("description")),
    useInDailyReports: formData.get("useInDailyReports") === "on",
    useInInventory: true,
    ...getTruckDispatchUsage(formData),
  };

  await validateCategoryHierarchy({
    parentCategoryId,
    range: objectNumberRange,
  });
  await validateInlineSubcategories({
    parentName: name,
    parentRange: objectNumberRange,
    subcategories,
  });

  const category = await prisma.inventoryCategory.create({
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
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
    select: {
      id: true,
    },
  });

  await syncInlineSubcategories({
    categoryData,
    parentCategoryId: category.id,
    subcategories,
  });

  revalidateInventoryCategoryViews();
}

export async function updateInventoryCategory(formData: FormData) {
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
    colorClass: optionalString(formData.get("colorClass")),
    dailyReportSection: dailyReportSection(formData.get("dailyReportSection")),
    description: optionalString(formData.get("description")),
    useInDailyReports: formData.get("useInDailyReports") === "on",
    useInInventory: true,
    ...getTruckDispatchUsage(formData),
  };

  await validateCategoryHierarchy({
    categoryId: id,
    parentCategoryId,
    range: objectNumberRange,
  });
  await validateInlineSubcategories({
    parentCategoryId: id,
    parentName: name,
    parentRange: objectNumberRange,
    subcategories,
  });

  await prisma.inventoryCategory.update({
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
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
  });

  await syncInlineSubcategories({
    categoryData,
    parentCategoryId: id,
    subcategories,
  });

  revalidateInventoryCategoryViews();
}

export async function deleteInventoryCategory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Kategorie-ID fehlt.");
  }

  const itemCount = await prisma.inventoryItem.count({
    where: {
      categoryId: id,
    },
  });

  if (itemCount > 0) {
    await prisma.inventoryCategory.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  } else {
    await prisma.inventoryCategory.delete({
      where: {
        id,
      },
    });
  }

  revalidateInventoryCategoryViews();
}
