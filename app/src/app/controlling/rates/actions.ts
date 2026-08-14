"use server";
import type { Prisma } from "@prisma/client";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { getInventoryActor } from "@/app/inventory/actions";

function text(value: FormDataEntryValue | null) {
  const result = String(value ?? "").trim();
  return result.length > 0 ? result : null;
}

function normalizeNumberText(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "—") return null;

  let normalized = trimmed
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || normalized === "-" || normalized === "—") return null;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  return normalized;
}

function numberValue(value: FormDataEntryValue | null, label: string) {
  const normalized = normalizeNumberText(text(value));

  if (!normalized) return 0;

  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`${label} muss eine Zahl sein.`);
  }

  return parsed;
}

function moneyCents(value: FormDataEntryValue | null, label: string) {
  return Math.round(numberValue(value, label) * 100);
}

function optionalYear(value: FormDataEntryValue | null) {
  const year = Math.round(numberValue(value, "Jahr"));

  if (!year) return null;

  if (year < 2000 || year > 2100) {
    throw new Error("Jahr muss zwischen 2000 und 2100 liegen.");
  }

  return year;
}

function yearStart(year: number | null) {
  return year ? new Date(Date.UTC(year, 0, 1)) : null;
}

function yearEnd(year: number | null) {
  return year ? new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)) : null;
}

function revalidateRates() {
  revalidatePath("/controlling/rates");
  revalidatePath("/controlling/performance");
  revalidatePath("/inventory");
}

function redirectWithNotice(
  message: string,
  anchor?: string,
  yearValue?: FormDataEntryValue | null,
): never {
  const year = text(yearValue ?? null);
  const params = new URLSearchParams({
    notice: message,
  });
  if (year) params.set("year", year);
  // Keeps the section the user was just working in expanded and scrolls
  // back to it instead of resetting to the top of the page after every
  // single save - each anchor id matches a RateDetails section's id.
  if (anchor) params.set("open", anchor);

  redirect(`/controlling/rates?${params.toString()}${anchor ? `#${anchor}` : ""}`);
}

function redirectWithError(
  message: string,
  anchor?: string,
  yearValue?: FormDataEntryValue | null,
): never {
  const year = text(yearValue ?? null);
  const params = new URLSearchParams({
    notice: message,
    noticeType: "error",
  });
  if (year) params.set("year", year);
  if (anchor) params.set("open", anchor);

  redirect(`/controlling/rates?${params.toString()}${anchor ? `#${anchor}` : ""}`);
}

function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function handleRateActionError(error: unknown, anchor?: string): never {
  if (isRedirectError(error)) {
    throw error;
  }

  redirectWithError(
    error instanceof Error
      ? error.message
      : "Aktion konnte nicht ausgeführt werden.",
    anchor,
  );
}

export async function saveEmployeeGroupRate(formData: FormData) {
  const actor = await getInventoryActor();
  try {
  const rateSetId = text(formData.get("rateSetId"));
  const id = text(formData.get("id"));
  const name = text(formData.get("name"));

  if (!rateSetId) {
    throw new Error("Satzstand fehlt.");
  }

  if (!name) {
    throw new Error("Gruppe fehlt.");
  }

  const year = optionalYear(formData.get("year"));
  const description = text(formData.get("description"));
  const realRateCents = moneyCents(formData.get("realRate"), "EK real");
  const internalRateCents = moneyCents(formData.get("internalRate"), "Interner Satz");

  const existing = id
    ? await prisma.controllingEmployeeGroupRate.findUnique({
        where: {
          id,
        },
      })
    : await prisma.controllingEmployeeGroupRate.findUnique({
        where: {
          rateSetId_name: {
            name,
            rateSetId,
          },
        },
      });

  const saved = existing
    ? await prisma.controllingEmployeeGroupRate.update({
        data: {
          description,
          internalRateCents,
          isActive: true,
          rateSetId,
          realRateCents,
          validFrom: yearStart(year),
          validTo: yearEnd(year),
          visibilityLevel: "CONTROLLING",
        },
        where: {
          id: existing.id,
        },
      })
    : await prisma.controllingEmployeeGroupRate.create({
        data: {
          description,
          internalRateCents,
          name,
          rateSetId,
          realRateCents,
          validFrom: yearStart(year),
          validTo: yearEnd(year),
          visibilityLevel: "CONTROLLING",
        },
      });

  await logRateChange({
    changedByName: actor.name,
    fieldName: "employee-group-rates",
    newValueCents: realRateCents,
    previousValueCents: existing?.realRateCents ?? null,
    targetId: saved.id,
    targetLabel: saved.name,
    targetType: "EMPLOYEE_GROUP",
  });

  revalidateRates();
  redirectWithNotice(`Mitarbeitergruppe „${saved.name}“ wurde gespeichert.`, "employee-group-rates", formData.get("year"));
  } catch (error) {
    handleRateActionError(error);
  }
}

/** Saves every existing Mitarbeitergruppe row in one submit, so changes
 * across several rows can be entered first and saved together instead of
 * clicking "Speichern" once per row. Rows are submitted as parallel
 * same-name field arrays (id/year/realRate/internalRate/description),
 * index-aligned - same pattern as the inline subcategory rows on
 * /admin/inventory-categories. */
export async function saveAllEmployeeGroupRates(formData: FormData) {
  const actor = await getInventoryActor();
  try {
  const ids = formData.getAll("id").map((value) => String(value ?? ""));
  const years = formData.getAll("year");
  const realRates = formData.getAll("realRate");
  const internalRates = formData.getAll("internalRate");
  const descriptions = formData.getAll("description");

  const existingRates = await prisma.controllingEmployeeGroupRate.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
  const existingById = new Map(existingRates.map((rate) => [rate.id, rate]));

  let changedCount = 0;

  for (const [index, id] of ids.entries()) {
    const existing = existingById.get(id);
    if (!existing) continue;

    const year = optionalYear(years[index] ?? null);
    const description = text(descriptions[index] ?? null);
    const realRateCents = moneyCents(realRates[index] ?? null, `EK real (${existing.name})`);
    const internalRateCents = moneyCents(
      internalRates[index] ?? null,
      `Interner Satz (${existing.name})`,
    );
    const validFrom = yearStart(year);
    const validTo = yearEnd(year);

    const unchanged =
      realRateCents === existing.realRateCents &&
      internalRateCents === existing.internalRateCents &&
      description === existing.description &&
      (validFrom?.getTime() ?? null) === (existing.validFrom?.getTime() ?? null) &&
      (validTo?.getTime() ?? null) === (existing.validTo?.getTime() ?? null);

    if (unchanged) continue;

    await prisma.controllingEmployeeGroupRate.update({
      data: {
        description,
        internalRateCents,
        isActive: true,
        realRateCents,
        validFrom,
        validTo,
        visibilityLevel: "CONTROLLING",
      },
      where: {
        id: existing.id,
      },
    });

    const changed = await logRateChange({
      changedByName: actor.name,
      fieldName: "employee-group-rates",
      newValueCents: realRateCents,
      previousValueCents: existing.realRateCents,
      targetId: existing.id,
      targetLabel: existing.name,
      targetType: "EMPLOYEE_GROUP",
    });
    if (changed) changedCount += 1;
  }

  revalidateRates();
  redirectWithNotice(
    changedCount > 0
      ? `${changedCount} Mitarbeitergruppe(n) gespeichert.`
      : "Keine Änderungen zum Speichern gefunden.",
    "employee-group-rates",
    formData.get("pageYear"),
  );
  } catch (error) {
    handleRateActionError(error);
  }
}

/** Saves every Inventarkategorie/Unterkategorie row in one submit - same
 * "fill in several fields, then one save" workflow as
 * saveAllEmployeeGroupRates, and also fixes an invalid-HTML bug: the old
 * per-row implementation put a <form> directly inside a <tr> (only <td>/
 * <th> are valid there), which browsers "fix" via foster parenting -
 * moving the form's content out of the table, which is why rows could
 * render empty/broken. One <form> wraps the whole <table> now. */
export async function saveAllInventoryCategoryRates(formData: FormData) {
  const actor = await getInventoryActor();
  try {
  const rateSetId = text(formData.get("rateSetId"));
  if (!rateSetId) {
    throw new Error("Satzstand fehlt.");
  }

  const categoryIds = formData.getAll("categoryId").map((value) => String(value ?? ""));
  const realRates = formData.getAll("realRate");
  const idleRates = formData.getAll("idleRate");

  const [categories, existingRates] = await Promise.all([
    prisma.inventoryCategory.findMany({
      where: {
        id: {
          in: categoryIds,
        },
      },
    }),
    prisma.controllingInventoryCategoryRate.findMany({
      where: {
        categoryId: {
          in: categoryIds,
        },
        rateSetId,
      },
    }),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const existingRateByCategoryId = new Map(
    existingRates.map((rate) => [rate.categoryId, rate]),
  );

  let changedCount = 0;

  for (const [index, categoryId] of categoryIds.entries()) {
    const category = categoryById.get(categoryId);
    if (!category) continue;

    const existingRate = existingRateByCategoryId.get(categoryId) ?? null;
    const realRateCents = moneyCents(
      realRates[index] ?? null,
      `Normaler Satz (${category.name})`,
    );
    const idleRateCents = moneyCents(
      idleRates[index] ?? null,
      `Stillstandssatz (${category.name})`,
    );
    const previousReal = existingRate?.billingRateCents ?? null;
    const previousIdle = existingRate?.idleBillingRateCents ?? null;
    const newReal = realRateCents || null;
    const newIdle = idleRateCents || null;

    if (newReal === previousReal && newIdle === previousIdle) continue;

    const rate = await prisma.controllingInventoryCategoryRate.upsert({
      create: {
        billingRateCents: newReal,
        categoryId,
        idleBillingRateCents: newIdle,
        rateSetId,
      },
      update: {
        billingRateCents: newReal,
        idleBillingRateCents: newIdle,
      },
      where: {
        rateSetId_categoryId: {
          categoryId,
          rateSetId,
        },
      },
    });

    const [realChanged, idleChanged] = await Promise.all([
      logRateChange({
        changedByName: actor.name,
        fieldName: "billingRateCents",
        newValueCents: newReal,
        previousValueCents: previousReal,
        targetId: rate.id,
        targetLabel: category.name,
        targetType: "INVENTORY_CATEGORY_RATE",
      }),
      logRateChange({
        changedByName: actor.name,
        fieldName: "idleBillingRateCents",
        newValueCents: newIdle,
        previousValueCents: previousIdle,
        targetId: rate.id,
        targetLabel: category.name,
        targetType: "INVENTORY_CATEGORY_RATE",
      }),
    ]);
    if (realChanged || idleChanged) changedCount += 1;
  }

  revalidateRates();
  redirectWithNotice(
    changedCount > 0
      ? `${changedCount} Kategorie(n) gespeichert.`
      : "Keine Änderungen zum Speichern gefunden.",
    "inventory-category-rates",
    formData.get("pageYear"),
  );
  } catch (error) {
    handleRateActionError(error);
  }
}

/** Same pattern as saveAllInventoryCategoryRates, for Inventarobjekte. */
export async function saveAllInventoryItemRates(formData: FormData) {
  const actor = await getInventoryActor();
  try {
  const rateSetId = text(formData.get("rateSetId"));
  if (!rateSetId) {
    throw new Error("Satzstand fehlt.");
  }

  const itemIds = formData.getAll("itemId").map((value) => String(value ?? ""));
  const realRates = formData.getAll("realRate");
  const idleRates = formData.getAll("idleRate");

  const [items, existingRates] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
    }),
    prisma.controllingInventoryItemRate.findMany({
      where: {
        itemId: {
          in: itemIds,
        },
        rateSetId,
      },
    }),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const existingRateByItemId = new Map(existingRates.map((rate) => [rate.itemId, rate]));

  let changedCount = 0;

  for (const [index, itemId] of itemIds.entries()) {
    const item = itemById.get(itemId);
    if (!item) continue;

    const itemLabel = item.objectNumber ? `${item.objectNumber} · ${item.name}` : item.name;
    const existingRate = existingRateByItemId.get(itemId) ?? null;
    const realRateCents = moneyCents(realRates[index] ?? null, `Normaler Satz (${itemLabel})`);
    const idleRateCents = moneyCents(
      idleRates[index] ?? null,
      `Stillstandssatz (${itemLabel})`,
    );
    const previousReal = existingRate?.billingRateCents ?? null;
    const previousIdle = existingRate?.idleBillingRateCents ?? null;
    const newReal = realRateCents || null;
    const newIdle = idleRateCents || null;

    if (newReal === previousReal && newIdle === previousIdle) continue;

    const rate = await prisma.controllingInventoryItemRate.upsert({
      create: {
        billingRateCents: newReal,
        idleBillingRateCents: newIdle,
        itemId,
        rateSetId,
      },
      update: {
        billingRateCents: newReal,
        idleBillingRateCents: newIdle,
      },
      where: {
        rateSetId_itemId: {
          itemId,
          rateSetId,
        },
      },
    });

    const [realChanged, idleChanged] = await Promise.all([
      logRateChange({
        changedByName: actor.name,
        fieldName: "billingRateCents",
        newValueCents: newReal,
        previousValueCents: previousReal,
        targetId: rate.id,
        targetLabel: itemLabel,
        targetType: "INVENTORY_ITEM_RATE",
      }),
      logRateChange({
        changedByName: actor.name,
        fieldName: "idleBillingRateCents",
        newValueCents: newIdle,
        previousValueCents: previousIdle,
        targetId: rate.id,
        targetLabel: itemLabel,
        targetType: "INVENTORY_ITEM_RATE",
      }),
    ]);
    if (realChanged || idleChanged) changedCount += 1;
  }

  revalidateRates();
  redirectWithNotice(
    changedCount > 0
      ? `${changedCount} Objekt(e) gespeichert.`
      : "Keine Änderungen zum Speichern gefunden.",
    "inventory-item-rates",
    formData.get("pageYear"),
  );
  } catch (error) {
    handleRateActionError(error);
  }
}

export async function raiseRates(formData: FormData) {
  const actor = await getInventoryActor();
  try {
  const rateSetId = text(formData.get("rateSetId"));
  const targetType = String(formData.get("targetType") ?? "");
  const fieldName = String(formData.get("fieldName") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const amount = numberValue(formData.get("amount"), "Anhebung");
  const reason = text(formData.get("reason"));
  const selectedTargetIds = formData
    .getAll("targetIds")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const batchId = randomUUID();
  const batchLabel = batchLabelForRaise({
    amount,
    fieldName,
    mode,
    targetType,
  });

  if (!["EMPLOYEE_GROUP", "INVENTORY_CATEGORY", "INVENTORY_ITEM"].includes(targetType)) {
    throw new Error("Bereich für Anhebung ist ungültig.");
  }

  if (!["normal", "idle", "both"].includes(fieldName)) {
    throw new Error("Satz-Art für Anhebung ist ungültig.");
  }

  if (!["percent", "euro"].includes(mode)) {
    throw new Error("Anhebungsart ist ungültig.");
  }

  if (amount === 0) {
    throw new Error("Anhebung darf nicht 0 sein.");
  }

  if (!rateSetId) {
    throw new Error("Satzstand fehlt.");
  }
  const effectiveRateSetId = rateSetId;

  if (selectedTargetIds.length === 0) {
    throw new Error("Bitte mindestens einen Satz zum Anheben auswählen.");
  }

  const fields =
    targetType === "EMPLOYEE_GROUP"
      ? fieldName === "both"
        ? ["realRateCents", "internalRateCents"]
        : fieldName === "idle"
          ? ["internalRateCents"]
          : ["realRateCents"]
      : fieldName === "both"
        ? ["billingRateCents", "idleBillingRateCents"]
        : fieldName === "idle"
          ? ["idleBillingRateCents"]
          : ["billingRateCents"];

  let changedCount = 0;

  if (targetType === "EMPLOYEE_GROUP") {
    const rates = await prisma.controllingEmployeeGroupRate.findMany({
      where: {
        id: {
          in: selectedTargetIds,
        },
        isActive: true,
        rateSetId: effectiveRateSetId,
      },
    });

    for (const rate of rates) {
      const data: Record<string, number> = {};
      for (const field of fields) {
        const previousValue = rate[field as "realRateCents" | "internalRateCents"];
        const newValue = calculateRaisedValue(previousValue, amount, mode);
        data[field] = newValue;
        const changed = await logRateChange({
          batchId,
          batchLabel,
          changedByName: actor.name,
          changeReason: reason,
          changeType: "RAISE",
          fieldName: field,
          newValueCents: newValue,
          previousValueCents: previousValue,
          targetId: rate.id,
          targetLabel: rate.name,
          targetType,
        });
        if (changed) changedCount += 1;
      }
      await prisma.controllingEmployeeGroupRate.update({
        data,
        where: {
          id: rate.id,
        },
      });
    }
  }

  if (targetType === "INVENTORY_CATEGORY") {
    const allCategories = await prisma.inventoryCategory.findMany({
      where: {
        isActive: true,
      },
    });
    const affectedCategoryIds = descendantCategoryIds(
      selectedTargetIds,
      allCategories.map((category) => ({
        id: category.id,
        parentCategoryId: category.parentCategoryId,
      })),
    );
    const items = await prisma.inventoryItem.findMany({
      where: {
        categoryId: {
          in: Array.from(affectedCategoryIds),
        },
        status: {
          not: "DELETED",
        },
      },
    });

    if (items.length === 0) {
      throw new Error("Für die ausgewählten Kategorien wurden keine Objekte gefunden.");
    }

    for (const item of items) {
      const existingRate = await prisma.controllingInventoryItemRate.findUnique({
        where: {
          rateSetId_itemId: {
            itemId: item.id,
            rateSetId: effectiveRateSetId,
          },
        },
      }) ?? await prisma.controllingInventoryItemRate.create({
        data: {
          billingRateCents: item.billingRateCents,
          idleBillingRateCents: item.idleBillingRateCents,
          itemId: item.id,
          rateSetId: effectiveRateSetId,
        },
      });
      const data: Record<string, number | null> = {};
      for (const field of fields) {
        const previousValue =
          existingRate?.[field as "billingRateCents" | "idleBillingRateCents"] ??
          item[field as "billingRateCents" | "idleBillingRateCents"] ??
          0;
        const newValue = calculateRaisedValue(previousValue, amount, mode);
        data[field] = newValue || null;
        const changed = await logRateChange({
          batchId,
          batchLabel,
          changedByName: actor.name,
          changeReason: reason,
          changeType: "RAISE",
          fieldName: field,
          newValueCents: newValue || null,
          previousValueCents: previousValue || null,
          targetId: existingRate.id,
          targetLabel: item.objectNumber ? `${item.objectNumber} · ${item.name}` : item.name,
          targetType: "INVENTORY_ITEM_RATE",
        });
        if (changed) changedCount += 1;
      }
      await prisma.controllingInventoryItemRate.upsert({
        create: {
          billingRateCents:
            "billingRateCents" in data
              ? data.billingRateCents ?? null
              : existingRate.billingRateCents,
          idleBillingRateCents:
            "idleBillingRateCents" in data
              ? data.idleBillingRateCents ?? null
              : existingRate.idleBillingRateCents,
          itemId: item.id,
          rateSetId: effectiveRateSetId,
        },
        update: data,
        where: {
          rateSetId_itemId: {
            itemId: item.id,
            rateSetId: effectiveRateSetId,
          },
        },
      });
    }
  }

  if (targetType === "INVENTORY_ITEM") {
    const items = await prisma.inventoryItem.findMany({
      where: {
        id: {
          in: selectedTargetIds,
        },
        status: {
          not: "DELETED",
        },
      },
    });

    for (const item of items) {
      const existingRate = await prisma.controllingInventoryItemRate.findUnique({
        where: {
          rateSetId_itemId: {
            itemId: item.id,
            rateSetId: effectiveRateSetId,
          },
        },
      }) ?? await prisma.controllingInventoryItemRate.create({
        data: {
          billingRateCents: item.billingRateCents,
          idleBillingRateCents: item.idleBillingRateCents,
          itemId: item.id,
          rateSetId: effectiveRateSetId,
        },
      });
      const data: Record<string, number | null> = {};
      for (const field of fields) {
        const previousValue =
          existingRate?.[field as "billingRateCents" | "idleBillingRateCents"] ??
          item[field as "billingRateCents" | "idleBillingRateCents"] ??
          0;
        const newValue = calculateRaisedValue(previousValue, amount, mode);
        data[field] = newValue || null;
        const changed = await logRateChange({
          batchId,
          batchLabel,
          changedByName: actor.name,
          changeReason: reason,
          changeType: "RAISE",
          fieldName: field,
          newValueCents: newValue || null,
          previousValueCents: previousValue || null,
          targetId: existingRate.id,
          targetLabel: item.objectNumber ? `${item.objectNumber} · ${item.name}` : item.name,
          targetType: "INVENTORY_ITEM_RATE",
        });
        if (changed) changedCount += 1;
      }
      await prisma.controllingInventoryItemRate.upsert({
        create: {
          billingRateCents:
            "billingRateCents" in data
              ? data.billingRateCents ?? null
              : existingRate.billingRateCents,
          idleBillingRateCents:
            "idleBillingRateCents" in data
              ? data.idleBillingRateCents ?? null
              : existingRate.idleBillingRateCents,
          itemId: item.id,
          rateSetId: effectiveRateSetId,
        },
        update: data,
        where: {
          rateSetId_itemId: {
            itemId: item.id,
            rateSetId: effectiveRateSetId,
          },
        },
      });
    }
  }

  const raiseAnchor =
    targetType === "EMPLOYEE_GROUP"
      ? "employee-group-rates"
      : targetType === "INVENTORY_CATEGORY"
        ? "inventory-category-rates"
        : "inventory-item-rates";

  revalidateRates();
  redirectWithNotice(
    changedCount > 0
      ? `${changedCount} Verrechnungssätze wurden geändert.`
      : "Keine Verrechnungssätze geändert, weil die neuen Werte identisch waren.",
    raiseAnchor,
    formData.get("year"),
  );
  } catch (error) {
    handleRateActionError(error);
  }
}

export async function revertRateChange(formData: FormData) {
  await requireSession();
  try {
  const id = String(formData.get("id") ?? "");
  const log = await prisma.controllingRateChangeLog.findUniqueOrThrow({
    where: {
      id,
    },
  });

  if (log.revertedAt || !log.canRevert) {
    throw new Error("Diese Änderung kann nicht mehr rückgängig gemacht werden.");
  }

  if (log.targetType === "EMPLOYEE_GROUP") {
    await prisma.controllingEmployeeGroupRate.update({
      data: {
        [log.fieldName]: log.previousValueCents ?? 0,
      },
      where: {
        id: log.targetId,
      },
    });
  } else if (log.targetType === "INVENTORY_CATEGORY") {
    await prisma.inventoryCategory.update({
      data: {
        [log.fieldName]: log.previousValueCents,
      },
      where: {
        id: log.targetId,
      },
    });
  } else if (log.targetType === "INVENTORY_ITEM") {
    await prisma.inventoryItem.update({
      data: {
        [log.fieldName]: log.previousValueCents,
      },
      where: {
        id: log.targetId,
      },
    });
  } else if (log.targetType === "INVENTORY_CATEGORY_RATE") {
    await prisma.controllingInventoryCategoryRate.update({
      data: {
        [log.fieldName]: log.previousValueCents,
      },
      where: {
        id: log.targetId,
      },
    });
  } else if (log.targetType === "INVENTORY_ITEM_RATE") {
    await prisma.controllingInventoryItemRate.update({
      data: {
        [log.fieldName]: log.previousValueCents,
      },
      where: {
        id: log.targetId,
      },
    });
  }

  await prisma.controllingRateChangeLog.update({
    data: {
      revertedAt: new Date(),
    },
    where: {
      id,
    },
  });

  revalidateRates();
  redirectWithNotice("Änderung wurde rückgängig gemacht.", "rate-archive");
  } catch (error) {
    handleRateActionError(error, "rate-archive");
  }
}

export async function revertRateChangeBatch(formData: FormData) {
  await requireSession();
  try {
  const batchId = String(formData.get("batchId") ?? "");
  const logIds = String(formData.get("logIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!batchId && logIds.length === 0) {
    throw new Error("Sammeländerung fehlt.");
  }

  const logs = await prisma.controllingRateChangeLog.findMany({
    where: {
      ...(batchId
        ? {
            batchId,
          }
        : {
            id: {
              in: logIds,
            },
          }),
      canRevert: true,
      revertedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (logs.length === 0) {
    throw new Error("Für diese Sammeländerung gibt es nichts mehr rückgängig zu machen.");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const log of logs) {
      if (log.targetType === "EMPLOYEE_GROUP") {
        await tx.controllingEmployeeGroupRate.update({
          data: {
            [log.fieldName]: log.previousValueCents ?? 0,
          },
          where: {
            id: log.targetId,
          },
        });
      } else if (log.targetType === "INVENTORY_CATEGORY") {
        await tx.inventoryCategory.update({
          data: {
            [log.fieldName]: log.previousValueCents,
          },
          where: {
            id: log.targetId,
          },
        });
      } else if (log.targetType === "INVENTORY_ITEM") {
        await tx.inventoryItem.update({
          data: {
            [log.fieldName]: log.previousValueCents,
          },
          where: {
            id: log.targetId,
          },
        });
      } else if (log.targetType === "INVENTORY_CATEGORY_RATE") {
        await tx.controllingInventoryCategoryRate.update({
          data: {
            [log.fieldName]: log.previousValueCents,
          },
          where: {
            id: log.targetId,
          },
        });
      } else if (log.targetType === "INVENTORY_ITEM_RATE") {
        await tx.controllingInventoryItemRate.update({
          data: {
            [log.fieldName]: log.previousValueCents,
          },
          where: {
            id: log.targetId,
          },
        });
      }
    }

    await tx.controllingRateChangeLog.updateMany({
      data: {
        revertedAt: new Date(),
      },
      where: {
        id: {
          in: logs.map((log) => log.id),
        },
      },
    });
  });

  revalidateRates();
  redirectWithNotice(
    `${logs.length} Änderungen wurden gesammelt rückgängig gemacht.`,
    "rate-archive",
  );
  } catch (error) {
    handleRateActionError(error, "rate-archive");
  }
}

export async function createRateSetFromPreviousYear(formData: FormData) {
  await requireSession();
  try {
    const sourceYear = optionalYear(formData.get("sourceYear"));
    const targetYear = optionalYear(formData.get("targetYear"));

    if (!sourceYear || !targetYear) {
      throw new Error("Quelljahr und neues Jahr müssen angegeben werden.");
    }

    if (sourceYear === targetYear) {
      throw new Error("Quelljahr und neues Jahr dürfen nicht gleich sein.");
    }

    const source = await prisma.controllingRateSet.findUnique({
      where: {
        year: sourceYear,
      },
      include: {
        categoryRates: true,
        employeeGroupRates: true,
        itemRates: true,
      },
    });

    if (!source) {
      throw new Error(`Satzstand ${sourceYear} wurde nicht gefunden.`);
    }

    const existing = await prisma.controllingRateSet.findUnique({
      where: {
        year: targetYear,
      },
    });

    if (existing) {
      throw new Error(`Satzstand ${targetYear} existiert bereits.`);
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const target = await tx.controllingRateSet.create({
        data: {
          description: `Aus Satzstand ${sourceYear} kopiert.`,
          isActive: true,
          isDefault: false,
          name: `Satzstand ${targetYear}`,
          year: targetYear,
        },
      });

      if (source.employeeGroupRates.length > 0) {
        await tx.controllingEmployeeGroupRate.createMany({
          data: source.employeeGroupRates.map((rate) => ({
            description: rate.description,
            internalRateCents: rate.internalRateCents,
            isActive: rate.isActive,
            name: rate.name,
            rateSetId: target.id,
            realRateCents: rate.realRateCents,
            sortOrder: rate.sortOrder,
            validFrom: yearStart(targetYear),
            validTo: yearEnd(targetYear),
            visibilityLevel: rate.visibilityLevel,
          })),
        });
      }

      if (source.categoryRates.length > 0) {
        await tx.controllingInventoryCategoryRate.createMany({
          data: source.categoryRates.map((rate) => ({
            billingRateCents: rate.billingRateCents,
            categoryId: rate.categoryId,
            idleBillingRateCents: rate.idleBillingRateCents,
            rateSetId: target.id,
          })),
        });
      }

      if (source.itemRates.length > 0) {
        await tx.controllingInventoryItemRate.createMany({
          data: source.itemRates.map((rate) => ({
            billingRateCents: rate.billingRateCents,
            idleBillingRateCents: rate.idleBillingRateCents,
            itemId: rate.itemId,
            rateSetId: target.id,
          })),
        });
      }
    });

    revalidateRates();
    redirectWithNotice(
      `Satzstand ${targetYear} wurde aus ${sourceYear} erstellt.`,
      undefined,
      String(targetYear),
    );
  } catch (error) {
    handleRateActionError(error);
  }
}

export async function deleteRateSet(formData: FormData) {
  await requireSession();
  try {
    const rateSetId = text(formData.get("rateSetId"));
    const confirmation = text(formData.get("confirmation"));

    if (!rateSetId) {
      throw new Error("Satzstand fehlt.");
    }

    if (confirmation !== "LÖSCHEN") {
      throw new Error("Bitte zur Bestätigung LÖSCHEN eingeben.");
    }

    const count = await prisma.controllingRateSet.count({
      where: {
        isActive: true,
      },
    });

    if (count <= 1) {
      throw new Error("Der letzte Satzstand kann nicht gelöscht werden.");
    }

    const rateSet = await prisma.controllingRateSet.findUniqueOrThrow({
      where: {
        id: rateSetId,
      },
    });

    await prisma.controllingRateSet.delete({
      where: {
        id: rateSet.id,
      },
    });

    revalidateRates();
    redirectWithNotice(`Satzstand ${rateSet.year} wurde gelöscht.`);
  } catch (error) {
    handleRateActionError(error);
  }
}

function calculateRaisedValue(currentCents: number, amount: number, mode: string) {
  if (mode === "percent") {
    return Math.round(currentCents * (1 + amount / 100));
  }

  return Math.round(currentCents + amount * 100);
}

function descendantCategoryIds(
  selectedIds: string[],
  categories: Array<{
    id: string;
    parentCategoryId: string | null;
  }>,
) {
  const categoryIds = new Set(selectedIds);
  let changed = true;

  while (changed) {
    changed = false;
    for (const category of categories) {
      if (
        category.parentCategoryId &&
        categoryIds.has(category.parentCategoryId) &&
        !categoryIds.has(category.id)
      ) {
        categoryIds.add(category.id);
        changed = true;
      }
    }
  }

  return categoryIds;
}

async function logRateChange({
  batchId,
  batchLabel,
  changedByName,
  changeReason,
  changeType = "UPDATE",
  fieldName,
  newValueCents,
  previousValueCents,
  targetId,
  targetLabel,
  targetType,
}: {
  batchId?: string | null;
  batchLabel?: string | null;
  changedByName?: string | null;
  changeReason?: string | null;
  changeType?: string;
  fieldName: string;
  newValueCents: number | null;
  previousValueCents: number | null;
  targetId: string;
  targetLabel: string;
  targetType: string;
}) {
  if (previousValueCents === newValueCents) return false;

  await prisma.controllingRateChangeLog.create({
    data: {
      batchId,
      batchLabel,
      changedByName,
      changeReason,
      changeType,
      fieldName,
      newValueCents,
      previousValueCents,
      targetId,
      targetLabel,
      targetType,
    },
  });

  return true;
}

function batchLabelForRaise({
  amount,
  fieldName,
  mode,
  targetType,
}: {
  amount: number;
  fieldName: string;
  mode: string;
  targetType: string;
}) {
  const targetLabel =
    targetType === "EMPLOYEE_GROUP"
      ? "Mitarbeitergruppen"
      : targetType === "INVENTORY_CATEGORY"
        ? "Inventarkategorien"
        : "Inventarobjekte";
  const fieldLabel =
    fieldName === "both"
      ? "Normal und Stillstand"
      : fieldName === "idle"
        ? "Stillstand"
        : "Normal";
  const amountLabel =
    mode === "percent"
      ? `${formatGermanNumber(amount)} %`
      : `${formatGermanNumber(amount)} €`;

  return `${targetLabel} · ${fieldLabel} · +${amountLabel}`;
}

function formatGermanNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}
