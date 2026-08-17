"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_TAPE_WIDTHS,
  getInventoryLabelCodeType,
  parseInventoryLabelBlocks,
  type InventoryLabelBlock,
} from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);

  if (!text) {
    throw new Error(`${label} ist ein Pflichtfeld.`);
  }

  return text;
}

function numberValue(
  value: FormDataEntryValue | null,
  fallback: number,
  options: { max?: number; min?: number } = {},
) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min !== undefined && parsed < options.min) return options.min;
  if (options.max !== undefined && parsed > options.max) return options.max;
  return parsed;
}

function floatValue(
  value: FormDataEntryValue | null,
  fallback: number,
  options: { max?: number; min?: number } = {},
) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min !== undefined && parsed < options.min) return options.min;
  if (options.max !== undefined && parsed > options.max) return options.max;
  return Math.round(parsed * 10) / 10;
}

/** Empty string means "use the automatically calculated length" - a null
 * override, not a fallback value. */
function optionalFloatValue(
  value: FormDataEntryValue | null,
  options: { max?: number; min?: number } = {},
): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return options.min;
  if (options.max !== undefined && parsed > options.max) return options.max;
  return Math.round(parsed * 10) / 10;
}

// The editor always submits blocks already in the new absolute-position
// shape (its hidden `blocksJson` field serializes the live React state
// directly), so this geometry is never actually used for a legacy-shape
// conversion here - it only satisfies the parser's signature.
const UNUSED_SAVE_GEOMETRY = {
  columnCount: 1,
  gapMm: 0,
  labelHeightMm: 100,
  labelWidthMm: 100,
  rowCount: 1,
};

function getBlocks(formData: FormData) {
  const rawJson = optionalString(formData.get("blocksJson"));
  const blocks = parseInventoryLabelBlocks(rawJson, UNUSED_SAVE_GEOMETRY);
  const enabledBlocks = blocks.filter((block) => block.enabled);

  if (enabledBlocks.length === 0) {
    throw new Error("Bitte mindestens einen Etiketten-Baustein auswählen.");
  }

  return JSON.stringify(normalizeBlocks(blocks));
}

function normalizeBlocks(blocks: InventoryLabelBlock[]) {
  return blocks
    .map((block, index) => ({
      align:
        block.align === "CENTER" || block.align === "RIGHT"
          ? block.align
          : "LEFT",
      bold: Boolean(block.bold),
      enabled: Boolean(block.enabled),
      heightMm: Math.max(2, Math.round((block.heightMm ?? 2) * 10) / 10),
      italic: Boolean(block.italic),
      key: block.key,
      labelVisible:
        block.key === "code" || block.key === "companyLogo"
          ? false
          : Boolean(block.labelVisible),
      order: Number.isFinite(block.order) ? block.order : index + 1,
      rotation:
        block.rotation === 90 || block.rotation === 180 || block.rotation === 270
          ? block.rotation
          : 0,
      size: block.size,
      underline: Boolean(block.underline),
      widthAuto: Boolean(block.widthAuto),
      widthMm: Math.max(2, Math.round((block.widthMm ?? 2) * 10) / 10),
      xMm: Math.max(0, Math.round((block.xMm ?? 0) * 10) / 10),
      yMm: Math.max(0, Math.round((block.yMm ?? 0) * 10) / 10),
    }))
    .sort((left, right) => left.order - right.order);
}

function getTemplatePayload(formData: FormData) {
  const name = requiredString(formData.get("name"), "Vorlagenname");
  const tapeWidthMm = numberValue(formData.get("tapeWidthMm"), 24);
  const safeTapeWidthMm = INVENTORY_LABEL_TAPE_WIDTHS.includes(
    tapeWidthMm as (typeof INVENTORY_LABEL_TAPE_WIDTHS)[number],
  )
    ? tapeWidthMm
    : 24;
  const labelLengthMm = numberValue(formData.get("labelLengthMm"), 70, {
    max: 220,
    min: 25,
  });
  const codeType = getInventoryLabelCodeType(
    optionalString(formData.get("codeType")) ?? "DATAMATRIX",
  );
  const orientation =
    optionalString(formData.get("orientation")) === "PORTRAIT"
      ? "PORTRAIT"
      : "LANDSCAPE";
  const showBorder = formData.get("showBorder") === "on";
  const isDefault = formData.get("isDefault") === "on";
  const snapMm = floatValue(formData.get("snapMm"), 1, { max: 5, min: 0 });
  const labelLengthOverrideMm = optionalFloatValue(
    formData.get("labelLengthOverrideMm"),
    { max: 220, min: 18 },
  );

  return {
    blocksJson: getBlocks(formData),
    codeType,
    isDefault,
    labelLengthMm,
    labelLengthOverrideMm,
    name,
    orientation,
    showBorder,
    snapMm,
    tapeWidthMm: safeTapeWidthMm,
  };
}

async function clearDefaultIfNeeded(isDefault: boolean, currentId?: string) {
  if (!isDefault) return;

  await prisma.inventoryLabelTemplate.updateMany({
    data: {
      isDefault: false,
    },
    where: currentId
      ? {
          id: {
            not: currentId,
          },
        }
      : undefined,
  });
}

export async function createInventoryLabelTemplate(formData: FormData) {
  await requireSession();
  const payload = getTemplatePayload(formData);

  await clearDefaultIfNeeded(payload.isDefault);

  const template = await prisma.inventoryLabelTemplate.create({
    data: payload,
  });

  revalidateInventoryLabelViews();
  redirect(`/inventory/labels?template=${template.id}`);
}

export async function updateInventoryLabelTemplate(
  templateId: string,
  formData: FormData,
) {
  await requireSession();
  const payload = getTemplatePayload(formData);

  await clearDefaultIfNeeded(payload.isDefault, templateId);

  await prisma.inventoryLabelTemplate.update({
    data: payload,
    where: {
      id: templateId,
    },
  });

  revalidateInventoryLabelViews();
  redirect(`/inventory/labels?template=${templateId}`);
}

export async function deleteInventoryLabelTemplate(templateId: string) {
  await requireSession();
  await prisma.inventoryLabelTemplate.delete({
    where: {
      id: templateId,
    },
  });

  revalidateInventoryLabelViews();
  redirect("/inventory/labels");
}

function buildSeedBlocks(
  enabledKeys: InventoryLabelBlock["key"][],
  overrides: Partial<Record<InventoryLabelBlock["key"], Partial<InventoryLabelBlock>>> = {},
) {
  return JSON.stringify(
    DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => ({
      ...block,
      enabled: enabledKeys.includes(block.key),
      ...overrides[block.key],
    })),
  );
}

export async function createDefaultInventoryLabelTemplates() {
  await requireSession();
  const count = await prisma.inventoryLabelTemplate.count();

  if (count > 0) {
    redirect("/inventory/labels");
  }

  await prisma.inventoryLabelTemplate.createMany({
    data: [
      {
        // Matches DEFAULT_INVENTORY_LABEL_BLOCKS' own 70x24mm reference
        // geometry exactly, so its positions can be reused as-is.
        blocksJson: JSON.stringify(DEFAULT_INVENTORY_LABEL_BLOCKS),
        codeType: "DATAMATRIX",
        isDefault: true,
        labelLengthMm: 70,
        name: "TZe 24 mm · Standard Inventar",
        orientation: "LANDSCAPE",
        showBorder: true,
        tapeWidthMm: 24,
      },
      {
        blocksJson: buildSeedBlocks(["objectNumber", "code", "name"], {
          code: { heightMm: 10, widthMm: 10, xMm: 2, yMm: 1 },
          name: { heightMm: 5, widthAuto: true, widthMm: 30, xMm: 14, yMm: 6 },
          objectNumber: { heightMm: 5, widthMm: 25, xMm: 14, yMm: 1 },
        }),
        codeType: "DATAMATRIX",
        isDefault: false,
        labelLengthMm: 55,
        name: "TZe 12 mm · Kompakt",
        orientation: "LANDSCAPE",
        showBorder: true,
        tapeWidthMm: 12,
      },
      {
        // Same 70x24mm reference layout as the standard template - the
        // extra 36x90mm canvas just leaves more margin, nothing overflows.
        blocksJson: JSON.stringify(DEFAULT_INVENTORY_LABEL_BLOCKS),
        codeType: "DATAMATRIX",
        isDefault: false,
        labelLengthMm: 90,
        name: "TZe 36 mm · Groß",
        orientation: "LANDSCAPE",
        showBorder: true,
        tapeWidthMm: 36,
      },
      {
        blocksJson: buildSeedBlocks(["code"], {
          code: { heightMm: 20, widthMm: 20, xMm: 4, yMm: 2 },
        }),
        codeType: "DATAMATRIX",
        isDefault: false,
        labelLengthMm: 28,
        name: "TZe 24 mm · Nur ECC200",
        orientation: "LANDSCAPE",
        showBorder: false,
        tapeWidthMm: 24,
      },
      {
        blocksJson: buildSeedBlocks(["code", "objectNumber", "name"], {
          code: { heightMm: 18, widthMm: 18, xMm: 2, yMm: 2 },
          name: { heightMm: 6, widthAuto: true, widthMm: 28, xMm: 24, yMm: 11 },
          objectNumber: { heightMm: 8, widthMm: 28, xMm: 24, yMm: 2 },
        }),
        codeType: "QR",
        isDefault: false,
        labelLengthMm: 55,
        name: "TZe 24 mm · QR mit Text",
        orientation: "LANDSCAPE",
        showBorder: true,
        tapeWidthMm: 24,
      },
    ],
  });

  revalidateInventoryLabelViews();
  redirect("/inventory/labels");
}

function revalidateInventoryLabelViews() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/labels");
}
